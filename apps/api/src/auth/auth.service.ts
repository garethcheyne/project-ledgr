import { createHash, randomBytes } from "node:crypto";
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import {
  ErrorCodes,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from "@ledgr/contracts";
import { ENV, type Env } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";

export interface AccessTokenClaims {
  sub: string;
  householdId: string;
  role: string;
}

/**
 * Argon2id parameters.
 *
 * argon2id resists both GPU and side-channel attack, unlike argon2i or argon2d
 * alone. 19 MiB / 2 iterations / 1 lane is the OWASP baseline — memory cost is
 * what actually defeats GPU cracking, so raise `memoryCost` before `timeCost`
 * if you tune this.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: HouseholdCryptoService,
  ) {}

  async register(input: RegisterInput, context: RequestContext): Promise<AuthResponse> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      // Registration necessarily reveals whether an address is taken — there is
      // no way to create an account without saying so. Login does not (see
      // below), which is where enumeration actually matters.
      throw new ConflictException({
        code: ErrorCodes.EMAIL_TAKEN,
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const householdName = input.householdName?.trim() || `${input.displayName}'s household`;

    // One transaction: a household without keys, or a user without a household,
    // would both be unusable states.
    const { user, membership, household } = await this.prisma.client.$transaction(async (tx) => {
      const household = await tx.household.create({ data: { name: householdName } });

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      });

      const membership = await tx.householdMember.create({
        data: {
          householdId: household.id,
          userId: user.id,
          // First user owns the household they just created.
          role: "OWNER",
        },
      });

      await this.crypto.createKeysFor(household.id, tx);

      return { user, membership, household };
    });

    this.logger.log(`Registered user ${user.id} and household ${household.id}`);

    return this.issueSession(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        householdId: household.id,
        householdName: household.name,
        role: membership.role,
      },
      context,
    );
  }

  async login(input: LoginInput, context: RequestContext): Promise<AuthResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          include: { household: true },
          orderBy: { joinedAt: "asc" },
          take: 1,
        },
      },
    });

    // Hash a dummy password when the user doesn't exist, so a request for an
    // unknown address takes the same time as one for a known address. Without
    // this, response timing enumerates registered users.
    if (!user) {
      await argon2.hash(input.password, ARGON2_OPTIONS).catch(() => undefined);
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: "Email or password is incorrect.",
      });
    }

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);

    // Identical response for a wrong password and an unknown address —
    // deliberately unhelpful, so it can't be used to confirm an account exists.
    if (!valid) {
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: "Email or password is incorrect.",
      });
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException({
        code: ErrorCodes.FORBIDDEN,
        message: "This account is not a member of any household.",
      });
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        householdId: membership.householdId,
        householdName: membership.household.name,
        role: membership.role,
      },
      context,
    );
  }

  /**
   * Exchanges a refresh token for a new pair, rotating the old one.
   *
   * Rotation with reuse detection: each refresh token is single-use. If a
   * token that has already been used is presented again, either it was stolen
   * or the legitimate client is replaying — and we can't tell which, so the
   * whole chain is revoked and everyone re-authenticates. Annoying once, versus
   * an attacker holding a valid session indefinitely.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<AuthResponse> {
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: { include: { household: true }, orderBy: { joinedAt: "asc" }, take: 1 },
          },
        },
      },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_INVALID,
        message: "That session is no longer valid. Please sign in again.",
      });
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}. Revoking all sessions.`,
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_REUSE_DETECTED,
        message: "This session was already used. For safety, all sessions have been signed out.",
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_EXPIRED,
        message: "Your session expired. Please sign in again.",
      });
    }

    const membership = stored.user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException({
        code: ErrorCodes.FORBIDDEN,
        message: "This account is not a member of any household.",
      });
    }

    // Claim the token atomically BEFORE issuing anything.
    //
    // The `revokedAt` check above is a read, and a read followed by a separate
    // write is a race: several concurrent requests can all observe the token as
    // live and all succeed, which silently defeats reuse detection — exactly
    // the attack it exists to catch. This conditional update lets the database
    // pick a single winner; `count === 0` means someone else already claimed it.
    const claimed = await this.prisma.client.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (claimed.count === 0) {
      this.logger.warn(
        `Concurrent or replayed refresh for user ${stored.userId}. Revoking all sessions.`,
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_REUSE_DETECTED,
        message: "This session was already used. For safety, all sessions have been signed out.",
      });
    }

    const session = await this.issueSession(
      {
        id: stored.user.id,
        email: stored.user.email,
        displayName: stored.user.displayName,
        householdId: membership.householdId,
        householdName: membership.household.name,
        role: membership.role,
      },
      context,
    );

    // Record the successor for the audit trail. The revocation itself already
    // happened above, so a crash here cannot leave the old token usable.
    await this.prisma.client.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: session.refreshTokenId },
    });

    return session.response;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.client.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      // Already gone, or never existed. Logging out is idempotent — surfacing
      // an error here only tells a caller whether a token was real.
      .catch(() => undefined);
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      displayName: string;
      householdId: string;
      householdName: string;
      role: string;
    },
    context: RequestContext,
  ): Promise<AuthResponse & { refreshTokenId: string; response: AuthResponse }> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      householdId: user.householdId,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL,
    });

    // The refresh token is opaque random bytes, not a JWT: it needs to be
    // revocable, and a self-contained JWT cannot be revoked without a lookup —
    // at which point the JWT bought nothing.
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + parseDuration(this.env.JWT_REFRESH_TTL));

    const stored = await this.prisma.client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent: context.userAgent?.slice(0, 500),
        ipAddress: context.ipAddress,
      },
      select: { id: true },
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        householdId: user.householdId,
        householdName: user.householdName,
        role: user.role as AuthResponse["user"]["role"],
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: Math.floor(parseDuration(this.env.JWT_ACCESS_TTL) / 1000),
        tokenType: "Bearer",
      },
    };

    return { ...response, refreshTokenId: stored.id, response };
  }
}

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * SHA-256, not argon2.
 *
 * Refresh tokens are 48 random bytes, so brute force is already infeasible and
 * a slow hash would only add latency to every refresh. Password hashing needs
 * argon2 precisely because human-chosen passwords are low-entropy.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Parses `15m` / `30d` / `12h` / `45s` into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}". Expected a form like 15m, 12h, or 30d.`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return amount * multipliers[unit];
}

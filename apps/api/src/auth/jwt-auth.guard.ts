import {
  CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ErrorCodes } from "@ledgr/contracts";
import type { Request } from "express";
import { ENV, type Env } from "../config/env.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import type { AccessTokenClaims } from "./auth.service.js";

export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
    /**
     * Tenant scope for the request. Every query must be constrained by this —
     * a query that escapes its household is a data breach, not a bug.
     * See CONTRIBUTING.md.
     */
    householdId: string;
    role: string;
  };
}

/**
 * Applied globally in AppModule, so routes are authenticated by default and
 * `@Public()` is an explicit, greppable opt-out. The reverse — guarding each
 * route individually — makes an unprotected endpoint the silent default when
 * someone forgets a decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Authentication required.",
      });
    }

    const token = header.slice("Bearer ".length).trim();

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        // Verified against the ACCESS secret specifically. The two secrets are
        // enforced distinct at boot, so a refresh token presented here fails.
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_EXPIRED,
        message: "Your session has expired. Please sign in again.",
      });
    }

    if (!claims.sub || !claims.householdId) {
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_INVALID,
        message: "Malformed token.",
      });
    }

    request.auth = {
      userId: claims.sub,
      householdId: claims.householdId,
      role: claims.role,
    };

    return true;
  }
}

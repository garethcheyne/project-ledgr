import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ErrorCodes,
  type ConnectionTestResult,
  type ImapConnectionInput,
  type MailAccountSummary,
  type TestConnectionInput,
} from "@ledgr/contracts";
import { ImapProvider } from "@ledgr/mail";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";

/**
 * Mail account management.
 *
 * Credentials are encrypted with the household's data key before they reach
 * Postgres, and are never returned by any endpoint. See
 * docs/adr/0006-encryption-at-rest.md.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HouseholdCryptoService,
  ) {}

  /**
   * Probes credentials without storing anything.
   *
   * Deliberately available before an account exists: a user should be able to
   * find out their app password is wrong without first creating a broken
   * account they then have to delete.
   */
  async testConnection(input: TestConnectionInput): Promise<ConnectionTestResult> {
    const provider = new ImapProvider({
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapUseTls: input.imapUseTls,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUseTls: input.smtpUseTls,
      username: input.username,
      password: input.password,
      fromAddress: input.emailAddress,
    });

    try {
      return await provider.testConnection();
    } finally {
      await provider.dispose();
    }
  }

  async listAccounts(householdId: string): Promise<MailAccountSummary[]> {
    const accounts = await this.prisma.client.mailAccount.findMany({
      where: { householdId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { folders: true } },
        folders: { select: { unreadCount: true } },
      },
    });

    // Note the absence: no password, no tokens. Those never leave the server.
    return accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      status: account.status,
      isDefault: account.isDefault,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      lastSyncError: account.lastSyncError,
      supportsIdle: account.supportsIdle,
      folderCount: account._count.folders,
      unreadCount: account.folders.reduce((sum, folder) => sum + folder.unreadCount, 0),
      createdAt: account.createdAt.toISOString(),
    }));
  }

  /**
   * Stores a verified IMAP account.
   *
   * The connection is tested first and a failure aborts the write — an account
   * saved with bad credentials would sit in the list failing to sync, and the
   * user would have no idea why.
   */
  async connectImap(
    householdId: string,
    userId: string,
    input: ImapConnectionInput,
  ): Promise<MailAccountSummary> {
    const existing = await this.prisma.client.mailAccount.findFirst({
      where: { householdId, provider: "IMAP", emailAddress: input.emailAddress },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `${input.emailAddress} is already connected.`,
      });
    }

    const test = await this.testConnection(input);

    if (!test.imap.ok) {
      throw new ConflictException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: test.imap.error ?? "Could not connect to the IMAP server.",
        fieldErrors: { password: [test.imap.error ?? "Connection failed."] },
      });
    }

    // SMTP failing is not fatal — reading mail still works, and it's better to
    // connect the account and flag sending as broken than to refuse outright.
    if (!test.smtp.ok) {
      this.logger.warn(`SMTP check failed for ${input.emailAddress}: ${test.smtp.error}`);
    }

    const passwordEnc = await this.crypto.encryptFor(householdId, input.password);
    const keyVersion = await this.crypto.keyVersionFor(householdId);

    const isFirst = (await this.prisma.client.mailAccount.count({ where: { householdId } })) === 0;

    const account = await this.prisma.client.mailAccount.create({
      data: {
        householdId,
        userId,
        provider: "IMAP",
        displayName: input.displayName,
        emailAddress: input.emailAddress,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapUseTls: input.imapUseTls,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUseTls: input.smtpUseTls,
        username: input.username,
        passwordEnc,
        keyVersion,
        supportsIdle: test.imap.supportsIdle ?? false,
        status: "CONNECTED",
        // The first mailbox becomes the default, so sending works without the
        // user having to nominate one.
        isDefault: isFirst,
        lastSyncError: test.smtp.ok ? null : `SMTP unavailable: ${test.smtp.error}`,
      },
    });

    this.logger.log(
      `Connected IMAP account ${account.id} (${input.emailAddress}) for household ${householdId}`,
    );

    return {
      id: account.id,
      provider: "IMAP",
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      status: account.status,
      isDefault: account.isDefault,
      lastSyncAt: null,
      lastSyncError: account.lastSyncError,
      supportsIdle: account.supportsIdle,
      folderCount: 0,
      unreadCount: 0,
      createdAt: account.createdAt.toISOString(),
    };
  }

  async deleteAccount(householdId: string, accountId: string): Promise<void> {
    // Scoped by household as well as id — an id alone would let one household
    // delete another's account.
    const result = await this.prisma.client.mailAccount.deleteMany({
      where: { id: accountId, householdId },
    });

    if (result.count === 0) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "That mail account does not exist.",
      });
    }
  }

  /**
   * Builds a live provider for an account, decrypting its stored credentials.
   *
   * The caller owns the returned provider and must dispose it.
   */
  async providerFor(householdId: string, accountId: string): Promise<ImapProvider> {
    const account = await this.prisma.client.mailAccount.findFirst({
      where: { id: accountId, householdId },
    });

    if (!account) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "That mail account does not exist.",
      });
    }

    if (account.provider !== "IMAP" || !account.passwordEnc) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: `${account.provider} accounts are not supported yet.`,
      });
    }

    const password = await this.crypto.decryptFor(householdId, Buffer.from(account.passwordEnc));

    return new ImapProvider({
      imapHost: account.imapHost ?? "",
      imapPort: account.imapPort ?? 993,
      imapUseTls: account.imapUseTls,
      smtpHost: account.smtpHost ?? "",
      smtpPort: account.smtpPort ?? 465,
      smtpUseTls: account.smtpUseTls,
      username: account.username ?? account.emailAddress,
      password,
      fromAddress: account.emailAddress,
      fromName: account.displayName,
    });
  }
}

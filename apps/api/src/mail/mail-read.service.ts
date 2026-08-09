import { Injectable, NotFoundException } from "@nestjs/common";
import { ErrorCodes, type MailFolderSummary, type MessageListItem } from "@ledgr/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";
import { MailService } from "./mail.service.js";

export interface MessageDetail extends MessageListItem {
  bodyText: string | null;
  bodyHtml: string | null;
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  folderId: string | null;
  entityId: string | null;
  entityName: string | null;
}

/**
 * Reading synced mail.
 *
 * Every displayable field is encrypted at rest, so each read decrypts. That is
 * the cost of ADR 0006 and it lands here: list queries decrypt only subject,
 * snippet and sender, never bodies.
 */
@Injectable()
export class MailReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HouseholdCryptoService,
    private readonly mail: MailService,
  ) {}

  /**
   * Folder list with counts derived from the messages themselves.
   *
   * The stored totalCount/unreadCount columns are NOT used. Maintained counters
   * drift — a re-sync, a move, or a delete each need a matching adjustment, and
   * missing one leaves a permanently wrong number. This shipped with exactly
   * that bug: folders read 0 messages and -1 unread. Deriving costs one grouped
   * query and cannot be wrong.
   */
  async listFolders(householdId: string, accountId?: string): Promise<MailFolderSummary[]> {
    const where = { householdId, ...(accountId ? { mailAccountId: accountId } : {}) };

    const [folders, totals, unread] = await Promise.all([
      this.prisma.client.mailFolder.findMany({
        where,
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      this.prisma.client.message.groupBy({
        by: ["folderId"],
        where: { householdId },
        _count: { _all: true },
      }),
      this.prisma.client.message.groupBy({
        by: ["folderId"],
        where: { householdId, isRead: false },
        _count: { _all: true },
      }),
    ]);

    const totalBy = new Map(totals.map((row) => [row.folderId, row._count._all]));
    const unreadBy = new Map(unread.map((row) => [row.folderId, row._count._all]));

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      role: folder.role,
      totalCount: totalBy.get(folder.id) ?? 0,
      unreadCount: unreadBy.get(folder.id) ?? 0,
      isSubscribed: folder.isSubscribed,
    }));
  }

  async listMessages(
    householdId: string,
    options: { folderId?: string; limit?: number; before?: Date } = {},
  ): Promise<MessageListItem[]> {
    const messages = await this.prisma.client.message.findMany({
      where: {
        householdId,
        ...(options.folderId ? { folderId: options.folderId } : {}),
        ...(options.before ? { sentAt: { lt: options.before } } : {}),
      },
      orderBy: { sentAt: "desc" },
      take: Math.min(options.limit ?? 50, 200),
      select: {
        id: true,
        mailThreadId: true,
        subjectEnc: true,
        snippetEnc: true,
        fromNameEnc: true,
        fromAddressEnc: true,
        sentAt: true,
        isRead: true,
        isStarred: true,
        hasAttachments: true,
      },
    });

    // Bodies are deliberately not selected — decrypting 50 of them to render a
    // list would be slow and pointless.
    return Promise.all(
      messages.map(async (message) => ({
        id: message.id,
        mailThreadId: message.mailThreadId,
        subject: (await this.dec(householdId, message.subjectEnc)) ?? "(no subject)",
        snippet: (await this.dec(householdId, message.snippetEnc)) ?? "",
        fromName: (await this.dec(householdId, message.fromNameEnc)) ?? "",
        fromAddress: (await this.dec(householdId, message.fromAddressEnc)) ?? "",
        sentAt: message.sentAt.toISOString(),
        isRead: message.isRead,
        isStarred: message.isStarred,
        hasAttachments: message.hasAttachments,
      })),
    );
  }

  async getMessage(householdId: string, messageId: string): Promise<MessageDetail> {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, householdId },
      include: { entity: { select: { id: true, name: true } } },
    });

    if (!message) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "That message does not exist.",
      });
    }

    return {
      id: message.id,
      mailThreadId: message.mailThreadId,
      folderId: message.folderId,
      subject: (await this.dec(householdId, message.subjectEnc)) ?? "(no subject)",
      snippet: (await this.dec(householdId, message.snippetEnc)) ?? "",
      fromName: (await this.dec(householdId, message.fromNameEnc)) ?? "",
      fromAddress: (await this.dec(householdId, message.fromAddressEnc)) ?? "",
      bodyText: await this.dec(householdId, message.bodyTextEnc),
      bodyHtml: await this.dec(householdId, message.bodyHtmlEnc),
      to: parseAddresses(await this.dec(householdId, message.toEnc)),
      cc: parseAddresses(await this.dec(householdId, message.ccEnc)),
      sentAt: message.sentAt.toISOString(),
      isRead: message.isRead,
      isStarred: message.isStarred,
      hasAttachments: message.hasAttachments,
      entityId: message.entity?.id ?? null,
      entityName: message.entity?.name ?? null,
    };
  }

  /**
   * Stars or unstars, updating both Ledgr and the provider.
   *
   * The provider write happens first: if it fails the local state is left
   * alone, so the UI never claims a change the mailbox didn't accept.
   */
  async setStarred(householdId: string, messageId: string, starred: boolean): Promise<void> {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, householdId },
      select: {
        id: true,
        providerMessageId: true,
        mailAccountId: true,
        folder: { select: { providerFolderId: true } },
      },
    });

    if (!message?.folder) return;

    const provider = await this.mail.providerFor(householdId, message.mailAccountId);
    try {
      await provider.markStarred(
        message.folder.providerFolderId,
        [message.providerMessageId],
        starred,
      );
    } finally {
      await provider.dispose();
    }

    await this.prisma.client.message.update({
      where: { id: message.id },
      data: { isStarred: starred },
    });
  }

  /** Marks read locally. Provider flag sync happens on the next pass. */
  async markRead(householdId: string, messageId: string, read: boolean): Promise<void> {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, householdId },
      select: { id: true, isRead: true, folderId: true },
    });

    if (!message || message.isRead === read) return;

    // No folder-counter bookkeeping: counts are derived in listFolders, which
    // is what stopped them drifting to -1.
    await this.prisma.client.message.update({
      where: { id: message.id },
      data: { isRead: read },
    });
  }

  private async dec(householdId: string, payload: Uint8Array | null): Promise<string | null> {
    return this.crypto.decryptOptional(householdId, payload);
  }
}

function parseAddresses(json: string | null): { name: string; address: string }[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as { name: string; address: string }[]) : [];
  } catch {
    return [];
  }
}

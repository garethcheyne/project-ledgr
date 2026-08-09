import { Injectable, NotFoundException } from "@nestjs/common";
import { ErrorCodes, type MailFolderSummary, type MessageListItem } from "@ledgr/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";

export interface MessageDetail extends MessageListItem {
  bodyText: string | null;
  bodyHtml: string | null;
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  folderId: string | null;
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
  ) {}

  async listFolders(householdId: string, accountId?: string): Promise<MailFolderSummary[]> {
    const folders = await this.prisma.client.mailFolder.findMany({
      where: { householdId, ...(accountId ? { mailAccountId: accountId } : {}) },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      role: folder.role,
      totalCount: folder.totalCount,
      unreadCount: folder.unreadCount,
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
    };
  }

  /** Marks read locally. Provider flag sync happens on the next pass. */
  async markRead(householdId: string, messageId: string, read: boolean): Promise<void> {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, householdId },
      select: { id: true, isRead: true, folderId: true },
    });

    if (!message || message.isRead === read) return;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.message.update({ where: { id: message.id }, data: { isRead: read } });
      if (message.folderId) {
        await tx.mailFolder.update({
          where: { id: message.folderId },
          data: { unreadCount: { increment: read ? -1 : 1 } },
        });
      }
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

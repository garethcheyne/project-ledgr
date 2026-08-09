import { Injectable, Logger } from "@nestjs/common";
import { stripHtml, stripQuotedText, tokenise } from "@ledgr/crypto";
import {
  resolveThread,
  normaliseSubject,
  type NormalisedMessage,
  type ThreadCandidate,
} from "@ledgr/mail";
import type { FolderRole } from "@ledgr/mail";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";
import { MailService } from "./mail.service.js";

/**
 * Which folders are synced by default.
 *
 * Deliberately narrow. Gmail's "All Mail" contains a copy of *every* message,
 * so syncing it alongside INBOX and SENT stores everything twice and turns a
 * first sync into a multi-hour download of the user's entire history. Spam and
 * Trash are noise nobody wants indexed.
 *
 * Users can subscribe to more folders explicitly; this is only the default.
 */
const DEFAULT_SYNCED_ROLES: FolderRole[] = ["INBOX", "SENT", "DRAFTS"];

/**
 * Cap on the first pass per folder.
 *
 * A mailbox with 80,000 messages must not block the request, fill the disk, or
 * hammer the provider on day one. Later passes continue from the cursor, so
 * nothing is lost — it just arrives incrementally.
 */
const INITIAL_BACKFILL_LIMIT = 200;
const INCREMENTAL_LIMIT = 100;

/** How far back to look for a thread to join. Bounded for both speed and accuracy. */
const THREAD_LOOKBACK_DAYS = 60;
const THREAD_CANDIDATE_LIMIT = 500;

export interface SyncResult {
  foldersDiscovered: number;
  foldersSynced: number;
  messagesStored: number;
  hasMore: boolean;
  errors: string[];
}

@Injectable()
export class MailSyncService {
  private readonly logger = new Logger(MailSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HouseholdCryptoService,
    private readonly mail: MailService,
  ) {}

  /**
   * Pulls folders and a page of messages for each subscribed folder.
   *
   * Idempotent: re-running continues from each folder's cursor rather than
   * re-importing, and message upserts are keyed on the provider's own id.
   */
  async syncAccount(householdId: string, accountId: string): Promise<SyncResult> {
    const result: SyncResult = {
      foldersDiscovered: 0,
      foldersSynced: 0,
      messagesStored: 0,
      hasMore: false,
      errors: [],
    };

    const provider = await this.mail.providerFor(householdId, accountId);

    await this.prisma.client.mailAccount.update({
      where: { id: accountId },
      data: { status: "SYNCING", lastSyncError: null },
    });

    try {
      const folders = await provider.listFolders();
      result.foldersDiscovered = folders.length;

      for (const folder of folders) {
        await this.prisma.client.mailFolder.upsert({
          where: {
            mailAccountId_providerFolderId: {
              mailAccountId: accountId,
              providerFolderId: folder.providerFolderId,
            },
          },
          create: {
            householdId,
            mailAccountId: accountId,
            providerFolderId: folder.providerFolderId,
            name: folder.name,
            role: folder.role,
            uidValidity: folder.uidValidity,
            isSubscribed: DEFAULT_SYNCED_ROLES.includes(folder.role),
          },
          // Name and role can change server-side; subscription is the user's
          // choice, so it is deliberately not overwritten here.
          update: { name: folder.name, role: folder.role },
        });
      }

      const subscribed = await this.prisma.client.mailFolder.findMany({
        where: { mailAccountId: accountId, isSubscribed: true },
      });

      for (const folder of subscribed) {
        try {
          const stored = await this.syncFolder(householdId, accountId, folder, provider);
          result.messagesStored += stored.count;
          result.hasMore ||= stored.hasMore;
          result.foldersSynced += 1;
        } catch (error) {
          // One bad folder must not abort the whole sync — a permission error
          // on a shared mailbox would otherwise block the inbox entirely.
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Folder ${folder.name} failed: ${message}`);
          result.errors.push(`${folder.name}: ${message}`);
        }
      }

      await this.prisma.client.mailAccount.update({
        where: { id: accountId },
        data: {
          status: "CONNECTED",
          lastSyncAt: new Date(),
          lastSyncError: result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null,
        },
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.client.mailAccount.update({
        where: { id: accountId },
        data: { status: "ERROR", lastSyncError: message.slice(0, 500) },
      });
      throw error;
    } finally {
      await provider.dispose();
    }
  }

  private async syncFolder(
    householdId: string,
    accountId: string,
    folder: { id: string; providerFolderId: string; syncCursor: string | null; name: string },
    provider: Awaited<ReturnType<MailService["providerFor"]>>,
  ): Promise<{ count: number; hasMore: boolean }> {
    const page = await provider.fetchMessages({
      folderId: folder.providerFolderId,
      cursor: folder.syncCursor ?? undefined,
      limit: folder.syncCursor ? INCREMENTAL_LIMIT : INITIAL_BACKFILL_LIMIT,
    });

    let count = 0;
    for (const message of page.messages) {
      await this.storeMessage(householdId, accountId, folder.id, message);
      count += 1;
    }

    await this.prisma.client.mailFolder.update({
      where: { id: folder.id },
      data: {
        syncCursor: page.nextCursor,
        lastSyncAt: new Date(),
        totalCount: { increment: count },
        unreadCount: {
          increment: page.messages.filter((message) => !message.isRead).length,
        },
      },
    });

    return { count, hasMore: page.hasMore };
  }

  private async storeMessage(
    householdId: string,
    accountId: string,
    folderId: string,
    message: NormalisedMessage,
  ): Promise<void> {
    // The provider's id is unique per account, so a re-sync updates rather than
    // duplicating.
    const existing = await this.prisma.client.message.findUnique({
      where: {
        mailAccountId_providerMessageId: {
          mailAccountId: accountId,
          providerMessageId: message.providerMessageId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Flags are the only thing that routinely changes after delivery.
      await this.prisma.client.message.update({
        where: { id: existing.id },
        data: { isRead: message.isRead, isStarred: message.isStarred, folderId },
      });
      return;
    }

    const threadId = await this.resolveThreadFor(householdId, accountId, message);
    const keyVersion = await this.crypto.keyVersionFor(householdId);

    const participants = [
      message.from?.address,
      ...message.to.map((address) => address.address),
      ...message.cc.map((address) => address.address),
    ].filter((address): address is string => Boolean(address));

    const created = await this.prisma.client.message.create({
      data: {
        householdId,
        mailAccountId: accountId,
        folderId,
        mailThreadId: threadId,
        providerMessageId: message.providerMessageId,
        uid: message.uid,
        messageIdHeader: message.messageIdHeader,
        inReplyTo: message.inReplyTo,
        references: message.references,

        subjectEnc: await this.enc(householdId, message.subject),
        bodyTextEnc: await this.enc(householdId, message.bodyText),
        bodyHtmlEnc: await this.enc(householdId, message.bodyHtml),
        snippetEnc: await this.enc(householdId, message.snippet),

        fromAddressEnc: await this.enc(householdId, message.from?.address),
        fromAddressIdx: message.from?.address
          ? await this.crypto.blindIndexFor(householdId, message.from.address)
          : null,
        fromNameEnc: await this.enc(householdId, message.from?.name),
        toEnc: await this.enc(householdId, JSON.stringify(message.to)),
        ccEnc: await this.enc(householdId, JSON.stringify(message.cc)),

        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        isRead: message.isRead,
        isStarred: message.isStarred,
        isDraft: message.isDraft,
        hasAttachments: message.hasAttachments,
        sizeBytes: message.sizeBytes,
        providerLabels: message.labels,
        keyVersion,
      },
      select: { id: true },
    });

    await this.indexSearchTerms(householdId, created.id, message);
    await this.touchThread(threadId, message, participants);
  }

  /** Encrypted columns are optional; skip empties rather than storing ciphertext of "". */
  private async enc(householdId: string, value?: string | null): Promise<Buffer | null> {
    if (!value) return null;
    return this.crypto.encryptFor(householdId, value);
  }

  /**
   * Finds or creates the conversation this message belongs to.
   *
   * Candidates are limited to the recent window: matching against an entire
   * mailbox is slow and more likely to produce a false positive.
   * See packages/mail/src/imap/threading.ts.
   */
  private async resolveThreadFor(
    householdId: string,
    accountId: string,
    message: NormalisedMessage,
  ): Promise<string> {
    const since = new Date(Date.now() - THREAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const recent = await this.prisma.client.mailThread.findMany({
      where: { mailAccountId: accountId, lastMessageAt: { gte: since } },
      orderBy: { lastMessageAt: "desc" },
      take: THREAD_CANDIDATE_LIMIT,
      include: {
        messages: {
          select: { messageIdHeader: true, fromAddressIdx: true },
          take: 50,
        },
      },
    });

    const subjectKeys = new Map<string, string>();
    const candidates: ThreadCandidate[] = [];

    for (const thread of recent) {
      const subjectKey = thread.subjectIdx ?? "";
      subjectKeys.set(thread.id, subjectKey);
      candidates.push({
        threadId: thread.id,
        subjectKey,
        lastMessageAt: thread.lastMessageAt,
        messageIds: new Set(
          thread.messages
            .map((entry) => entry.messageIdHeader)
            .filter((id): id is string => Boolean(id)),
        ),
        // Participants are encrypted, so match on the blind index instead —
        // exact-match is all the threading heuristic needs.
        participants: new Set(
          thread.messages
            .map((entry) => entry.fromAddressIdx)
            .filter((id): id is string => Boolean(id)),
        ),
      });
    }

    const fromIdx = message.from?.address
      ? await this.crypto.blindIndexFor(householdId, message.from.address)
      : "";

    // subjectIdx stores an HMAC of the normalised subject, so compare in that
    // space rather than plaintext.
    const subjectKey = normaliseSubject(message.subject);
    const subjectIdx = subjectKey ? await this.crypto.blindIndexFor(householdId, subjectKey) : "";

    const resolution = resolveThread(
      {
        messageIdHeader: message.messageIdHeader,
        inReplyTo: message.inReplyTo,
        references: message.references,
        // Pass the hashed subject so it matches what candidates carry.
        subject: subjectIdx,
        sentAt: message.sentAt,
        participants: fromIdx ? [fromIdx] : [],
      },
      candidates,
    );

    if (resolution.matchedExisting) return resolution.threadId;

    const thread = await this.prisma.client.mailThread.create({
      data: {
        householdId,
        mailAccountId: accountId,
        providerThreadId: resolution.threadId,
        isSynthetic: resolution.isSynthetic,
        subjectEnc: await this.enc(householdId, message.subject),
        subjectIdx: subjectIdx || null,
        lastMessageAt: message.sentAt,
        keyVersion: await this.crypto.keyVersionFor(householdId),
      },
      select: { id: true },
    });

    return thread.id;
  }

  private async touchThread(
    threadId: string,
    message: NormalisedMessage,
    _participants: string[],
  ): Promise<void> {
    await this.prisma.client.mailThread.update({
      where: { id: threadId },
      data: {
        messageCount: { increment: 1 },
        unreadCount: { increment: message.isRead ? 0 : 1 },
        hasAttachments: message.hasAttachments ? true : undefined,
        lastMessageAt: message.sentAt,
      },
    });
  }

  /**
   * Builds the encrypted-search index.
   *
   * Bodies are encrypted, so conventional full-text search is impossible.
   * Tokens are HMAC'd instead, which gives exact whole-word matching only.
   * See docs/adr/0006-encryption-at-rest.md.
   */
  private async indexSearchTerms(
    householdId: string,
    messageId: string,
    message: NormalisedMessage,
  ): Promise<void> {
    const bodySource = message.bodyText ?? (message.bodyHtml ? stripHtml(message.bodyHtml) : "");

    const subjectTokens = tokenise(message.subject);
    // Quoted replies are stripped: without that, every message in a thread
    // indexes the whole history and one term matches all of them.
    const bodyTokens = tokenise(stripQuotedText(bodySource));
    const participantTokens = tokenise(
      [message.from?.address, message.from?.name, ...message.to.map((address) => address.address)]
        .filter(Boolean)
        .join(" "),
    );

    const rows: { termHash: Buffer; field: "SUBJECT" | "BODY" | "PARTICIPANT" }[] = [];
    const seen = new Set<string>();

    for (const [tokens, field] of [
      [subjectTokens, "SUBJECT"],
      [bodyTokens, "BODY"],
      [participantTokens, "PARTICIPANT"],
    ] as const) {
      const hashes = await this.crypto.termHashesFor(householdId, tokens);
      for (const hash of hashes) {
        const key = `${field}:${hash.toString("hex")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ termHash: hash, field });
      }
    }

    if (rows.length === 0) return;

    await this.prisma.client.messageSearchTerm.createMany({
      data: rows.map((row) => ({
        messageId,
        householdId,
        termHash: row.termHash,
        field: row.field,
      })),
      skipDuplicates: true,
    });
  }
}

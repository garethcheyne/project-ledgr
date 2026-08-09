import { ImapFlow, type ListResponse } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import nodemailer, { type Transporter } from "nodemailer";
import {
  MailProviderError,
  type ConnectionCheck,
  type FetchOptions,
  type FetchResult,
  type MailAddress,
  type MailProviderAdapter,
  type NormalisedAttachment,
  type NormalisedFolder,
  type NormalisedMessage,
  type OutgoingMessage,
  type SendResult,
} from "../provider.js";
import { resolveFolderRole } from "./folder-role.js";

export interface ImapConfig {
  imapHost: string;
  imapPort: number;
  imapUseTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUseTls: boolean;
  username: string;
  password: string;
  /** The address messages are sent from. Often, but not always, the username. */
  fromAddress: string;
  fromName?: string;
}

/** Bounded so one enormous folder can't exhaust memory in a single pass. */
const DEFAULT_FETCH_LIMIT = 100;
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * IMAP + SMTP implementation of {@link MailProviderAdapter}.
 *
 * The fallback adapter: Fastmail, iCloud, Proton Bridge and every self-hosted
 * server have no API. See docs/adr/0008-native-provider-apis.md.
 *
 * Connections are lazy and reused. IMAP servers commonly cap concurrent
 * connections (iCloud and Gmail are strict), so opening one per operation gets
 * an account throttled or locked out.
 */
export class ImapProvider implements MailProviderAdapter {
  readonly provider = "IMAP" as const;

  private client?: ImapFlow;
  private transport?: Transporter;
  private connecting?: Promise<ImapFlow>;

  constructor(private readonly config: ImapConfig) {}

  // ── Connection ───────────────────────────────────────────────────────────

  private async connect(): Promise<ImapFlow> {
    if (this.client?.usable) return this.client;
    // Collapse concurrent callers onto one connection attempt, rather than
    // opening several and tripping the server's connection cap.
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const client = new ImapFlow({
        host: this.config.imapHost,
        port: this.config.imapPort,
        secure: this.config.imapUseTls,
        auth: { user: this.config.username, pass: this.config.password },
        // imapflow logs every command at info level by default, which would
        // put message subjects and headers into application logs.
        logger: false,
        socketTimeout: CONNECT_TIMEOUT_MS,
      });

      try {
        await client.connect();
      } catch (error) {
        throw toProviderError(error);
      }

      this.client = client;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  private smtp(): Transporter {
    this.transport ??= nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      // Port 465 is implicit TLS; 587 and 25 start plaintext and STARTTLS up.
      secure: this.config.smtpUseTls && this.config.smtpPort === 465,
      requireTLS: this.config.smtpUseTls,
      auth: { user: this.config.username, pass: this.config.password },
      connectionTimeout: CONNECT_TIMEOUT_MS,
    });
    return this.transport;
  }

  /**
   * Probes both protocols. Never throws — failures come back as structured
   * results so the connect screen can show which half is broken. A user with a
   * working IMAP password and a wrong SMTP port should be told exactly that.
   */
  async testConnection(): Promise<{ imap: ConnectionCheck; smtp: ConnectionCheck }> {
    const imap: ConnectionCheck = { ok: false };
    const smtp: ConnectionCheck = { ok: false };

    try {
      const client = await this.connect();
      const folders = await client.list();
      imap.ok = true;
      imap.folderCount = folders.length;
      // Without IDLE we fall back to interval polling, so surface it at
      // connect time rather than letting sync silently become slow.
      imap.supportsIdle = Boolean(client.capabilities?.has("IDLE"));
    } catch (error) {
      imap.error = toProviderError(error).message;
    }

    try {
      await this.smtp().verify();
      smtp.ok = true;
    } catch (error) {
      smtp.error = toProviderError(error).message;
    }

    return { imap, smtp };
  }

  // ── Folders ──────────────────────────────────────────────────────────────

  async listFolders(): Promise<NormalisedFolder[]> {
    const client = await this.connect();
    const list = await client.list();

    return list.map((entry: ListResponse) => ({
      providerFolderId: entry.path,
      name: entry.name,
      role: resolveFolderRole(entry.path, entry.specialUse, new Set(entry.flags ?? [])),
      parentFolderId: entry.parentPath || undefined,
      // Counts come from STATUS, which `list()` doesn't return; the sync worker
      // fills them per folder rather than paying for a STATUS on every folder
      // during a listing.
    }));
  }

  // ── Reading ──────────────────────────────────────────────────────────────

  /**
   * Fetches a page of messages.
   *
   * `cursor` is the highest UID already seen. UIDs are monotonic within a
   * folder for a given UIDVALIDITY, which makes `uid > cursor` a reliable
   * incremental window — provided UIDVALIDITY hasn't changed, which is checked
   * below because the alternative is silently importing the wrong messages.
   */
  async fetchMessages(options: FetchOptions): Promise<FetchResult> {
    const client = await this.connect();
    const limit = options.limit ?? DEFAULT_FETCH_LIMIT;

    const lock = await client.getMailboxLock(options.folderId);
    try {
      const mailbox = client.mailbox;
      if (!mailbox || typeof mailbox === "boolean") {
        throw new MailProviderError(
          `Mailbox ${options.folderId} could not be opened.`,
          "MAILBOX_NOT_FOUND",
          false,
        );
      }

      const cursor = parseCursor(options.cursor);

      // UIDVALIDITY changing means the server rebuilt its UID space: every
      // cached UID is now meaningless. Continuing would import the wrong
      // messages, so this is terminal and forces a resync from scratch.
      if (cursor && cursor.uidValidity !== mailbox.uidValidity) {
        throw new MailProviderError(
          "The mailbox UID space changed; this folder must be resynced from scratch.",
          "UIDVALIDITY_CHANGED",
          false,
        );
      }

      const since = cursor ? cursor.lastUid + 1 : 1;
      const messages: NormalisedMessage[] = [];
      let highestUid = cursor?.lastUid ?? 0;

      for await (const message of client.fetch(
        { uid: `${since}:*` },
        {
          uid: true,
          flags: true,
          envelope: true,
          size: true,
          // Full source, so mailparser can handle MIME, encodings and
          // attachments rather than us reimplementing any of it.
          source: !options.headersOnly,
          bodyStructure: options.headersOnly,
        },
      )) {
        // `uid:since:*` always returns at least the last message even when
        // nothing is new, so skip anything at or below the cursor.
        if (message.uid <= (cursor?.lastUid ?? 0)) continue;

        highestUid = Math.max(highestUid, message.uid);

        if (message.source) {
          messages.push(await this.normalise(message, await simpleParser(message.source)));
        }

        if (messages.length >= limit) break;
      }

      return {
        messages,
        nextCursor: makeCursor(mailbox.uidValidity, highestUid),
        hasMore: messages.length >= limit,
      };
    } finally {
      lock.release();
    }
  }

  async fetchMessage(
    folderId: string,
    providerMessageId: string,
  ): Promise<NormalisedMessage | null> {
    const client = await this.connect();
    const lock = await client.getMailboxLock(folderId);
    try {
      const message = await client.fetchOne(providerMessageId, {
        uid: true,
        flags: true,
        envelope: true,
        size: true,
        source: true,
      });

      if (!message || !message.source) return null;
      return this.normalise(message, await simpleParser(message.source));
    } finally {
      lock.release();
    }
  }

  private async normalise(
    raw: { uid: number; flags?: Set<string>; size?: number },
    parsed: ParsedMail,
  ): Promise<NormalisedMessage> {
    const flags = raw.flags ?? new Set<string>();
    const attachments: NormalisedAttachment[] = (parsed.attachments ?? []).map((attachment) => ({
      filename: attachment.filename ?? "attachment",
      contentType: attachment.contentType,
      sizeBytes: attachment.size,
      content: attachment.content,
      contentId: attachment.contentId,
      isInline: attachment.contentDisposition === "inline",
    }));

    const bodyText = parsed.text ?? undefined;

    return {
      providerMessageId: String(raw.uid),
      uid: BigInt(raw.uid),
      // Left undefined: the caller resolves threads against what's already
      // stored, which this adapter cannot see. See ./threading.ts.
      threadId: undefined,
      threadIsSynthetic: true,

      messageIdHeader: parsed.messageId,
      inReplyTo: parsed.inReplyTo,
      references: normaliseReferences(parsed.references),

      subject: parsed.subject ?? "",
      bodyText,
      bodyHtml: typeof parsed.html === "string" ? parsed.html : undefined,
      snippet: buildSnippet(
        bodyText ?? stripTags(typeof parsed.html === "string" ? parsed.html : ""),
      ),

      from: toAddress(parsed.from),
      to: toAddressList(parsed.to),
      cc: toAddressList(parsed.cc),
      bcc: toAddressList(parsed.bcc),
      replyTo: toAddressList(parsed.replyTo),

      sentAt: parsed.date ?? new Date(),
      receivedAt: parsed.date ?? new Date(),
      isRead: flags.has("\\Seen"),
      isStarred: flags.has("\\Flagged"),
      isDraft: flags.has("\\Draft"),
      hasAttachments: attachments.some((attachment) => !attachment.isInline),
      sizeBytes: raw.size,
      labels: [...flags].filter((flag) => !flag.startsWith("\\")),

      attachments,
    };
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  /**
   * Sends via SMTP.
   *
   * `sentCopyFiled` is always false: SMTP delivery does not put anything in the
   * Sent folder, and whether the *server* does so on its own varies. The caller
   * checks the Sent folder before appending — getting this wrong yields either
   * duplicated or missing sent mail, and both read as data loss.
   * See docs/adr/0005-full-email-client.md.
   */
  async send(message: OutgoingMessage): Promise<SendResult> {
    try {
      const info = await this.smtp().sendMail({
        from: { name: this.config.fromName ?? "", address: this.config.fromAddress },
        to: message.to.map(formatAddress),
        cc: message.cc?.map(formatAddress),
        bcc: message.bcc?.map(formatAddress),
        subject: message.subject,
        text: message.bodyText,
        html: message.bodyHtml,
        inReplyTo: message.inReplyToMessageId,
        references: message.references,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          cid: attachment.contentId,
        })),
      });

      return { providerMessageId: info.messageId, sentCopyFiled: false };
    } catch (error) {
      throw new MailProviderError(
        `Failed to send: ${errorMessage(error)}`,
        "SEND_FAILED",
        // A transport failure may succeed on retry; a rejected recipient or
        // refused auth will not.
        isTransientSmtpError(error),
        error,
      );
    }
  }

  async appendToSent(raw: Buffer): Promise<void> {
    const client = await this.connect();
    const folders = await this.listFolders();
    const sent = folders.find((folder) => folder.role === "SENT");

    if (!sent) {
      throw new MailProviderError(
        "No Sent folder found on the server, so the sent copy could not be filed.",
        "MAILBOX_NOT_FOUND",
        false,
      );
    }

    await client.append(sent.providerFolderId, raw, ["\\Seen"]);
  }

  // ── Flags and moves ──────────────────────────────────────────────────────

  async markRead(folderId: string, ids: string[], read: boolean): Promise<void> {
    await this.setFlag(folderId, ids, "\\Seen", read);
  }

  async markStarred(folderId: string, ids: string[], starred: boolean): Promise<void> {
    await this.setFlag(folderId, ids, "\\Flagged", starred);
  }

  private async setFlag(
    folderId: string,
    ids: string[],
    flag: string,
    add: boolean,
  ): Promise<void> {
    if (ids.length === 0) return;
    const client = await this.connect();
    const lock = await client.getMailboxLock(folderId);
    try {
      const range = ids.join(",");
      if (add) await client.messageFlagsAdd(range, [flag], { uid: true });
      else await client.messageFlagsRemove(range, [flag], { uid: true });
    } finally {
      lock.release();
    }
  }

  async moveToFolder(fromFolderId: string, toFolderId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const client = await this.connect();
    const lock = await client.getMailboxLock(fromFolderId);
    try {
      await client.messageMove(ids.join(","), toFolderId, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Moves to Trash rather than expunging.
   *
   * A destructive delete against someone's real mailbox is not recoverable, and
   * "delete" in every mail client means "move to Trash". Emptying Trash is a
   * separate, explicit action.
   */
  async deleteMessages(folderId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const folders = await this.listFolders();
    const trash = folders.find((folder) => folder.role === "TRASH");

    if (trash && trash.providerFolderId !== folderId) {
      await this.moveToFolder(folderId, trash.providerFolderId, ids);
      return;
    }

    // Already in Trash, or the server has none: flag deleted, don't expunge.
    await this.setFlag(folderId, ids, "\\Deleted", true);
  }

  // ── Push ─────────────────────────────────────────────────────────────────

  /**
   * Holds an IDLE connection.
   *
   * A dedicated client, because IDLE occupies the connection for its duration —
   * sharing the main one would block every other operation.
   */
  async watch(folderId: string, onChange: () => void): Promise<() => Promise<void>> {
    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapUseTls,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });

    await client.connect();
    await client.mailboxOpen(folderId);
    client.on("exists", onChange);

    if (!client.capabilities?.has("IDLE")) {
      await client.logout();
      throw new MailProviderError(
        "This server does not support IDLE; fall back to polling.",
        "CONNECTION_FAILED",
        false,
      );
    }

    // Not awaited: idle() resolves only when idling stops.
    void client.idle();

    return async () => {
      try {
        await client.logout();
      } catch {
        // Already gone. Nothing useful to do, and throwing from a disposer
        // would mask whatever caused the caller to dispose.
      }
    };
  }

  async dispose(): Promise<void> {
    try {
      if (this.client?.usable) await this.client.logout();
    } catch {
      // Best effort — the connection may already be dead.
    } finally {
      this.client = undefined;
      this.transport?.close();
      this.transport = undefined;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Cursor encodes UIDVALIDITY so a UID-space change is detectable. */
function makeCursor(uidValidity: bigint | number, lastUid: number): string {
  return `${uidValidity.toString()}:${lastUid}`;
}

function parseCursor(cursor?: string): { uidValidity: bigint; lastUid: number } | null {
  if (!cursor) return null;
  const [validity, uid] = cursor.split(":");
  if (!validity || !uid) return null;
  return { uidValidity: BigInt(validity), lastUid: Number(uid) };
}

function toAddress(value?: AddressObject | AddressObject[]): MailAddress | undefined {
  return toAddressList(value)[0];
}

function toAddressList(value?: AddressObject | AddressObject[]): MailAddress[] {
  if (!value) return [];
  const objects = Array.isArray(value) ? value : [value];
  return objects.flatMap((object) =>
    (object.value ?? [])
      .filter((entry) => entry.address)
      .map((entry) => ({ name: entry.name ?? "", address: entry.address ?? "" })),
  );
}

function formatAddress(address: MailAddress): string {
  return address.name ? `"${address.name}" <${address.address}>` : address.address;
}

/** mailparser returns References as a string when there's exactly one. */
function normaliseReferences(references?: string | string[]): string[] {
  if (!references) return [];
  return Array.isArray(references) ? references : [references];
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(text: string, length = 200): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= length ? collapsed : `${collapsed.slice(0, length - 1)}…`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Maps a driver error onto our taxonomy.
 *
 * The distinction that matters is retryable vs terminal: a wrong password must
 * not be retried in a loop, and a dropped socket should be.
 */
function toProviderError(error: unknown): MailProviderError {
  if (error instanceof MailProviderError) return error;

  const message = errorMessage(error);
  const code = (error as { code?: string; authenticationFailed?: boolean })?.code;

  if (
    (error as { authenticationFailed?: boolean })?.authenticationFailed ||
    /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed/i.test(message)
  ) {
    return new MailProviderError(
      "The server rejected those credentials. If your account uses two-factor authentication, you need an app-specific password rather than your normal one.",
      "AUTH_FAILED",
      false,
      error,
    );
  }

  if (/certificate|self.signed|CERT_/i.test(message)) {
    return new MailProviderError(
      `The server's TLS certificate could not be verified: ${message}`,
      "TLS_FAILED",
      false,
      error,
    );
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new MailProviderError(
      "That server hostname could not be resolved. Check the host name.",
      "CONNECTION_FAILED",
      false,
      error,
    );
  }

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET") {
    return new MailProviderError(
      "Could not reach the server. Check the host and port, and that TLS is set correctly.",
      "CONNECTION_FAILED",
      true,
      error,
    );
  }

  return new MailProviderError(message, "UNKNOWN", true, error);
}

function isTransientSmtpError(error: unknown): boolean {
  const code = (error as { responseCode?: number })?.responseCode;
  // 4xx is "try again later"; 5xx is a permanent refusal.
  return typeof code === "number" ? code >= 400 && code < 500 : true;
}

/**
 * The mail provider contract.
 *
 * Gmail, Microsoft Graph and IMAP are three implementations of this interface;
 * nothing above it knows which one it's talking to. Adding a provider must not
 * require changes outside its own adapter.
 * See docs/adr/0008-native-provider-apis.md.
 *
 * The types below are the *normalised* shapes. Each adapter is responsible for
 * translating its provider's model into these — including the awkward parts,
 * like IMAP having no thread IDs and Gmail having labels rather than folders.
 */

export interface MailAddress {
  name: string;
  address: string;
}

export interface NormalisedFolder {
  /** Provider's own identifier: IMAP path, Gmail label id, Graph folder id. */
  providerFolderId: string;
  name: string;
  role: FolderRole;
  parentFolderId?: string;
  totalCount?: number;
  unreadCount?: number;
  /**
   * IMAP only. Changes when the server's UID space is invalidated, which means
   * every cached UID for the folder is meaningless and it must be resynced.
   */
  uidValidity?: bigint;
}

export type FolderRole =
  | "INBOX"
  | "SENT"
  | "DRAFTS"
  | "TRASH"
  | "SPAM"
  | "ARCHIVE"
  | "STARRED"
  | "IMPORTANT"
  | "CUSTOM";

export interface NormalisedAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
  /** Set for images referenced by cid: in an HTML body. */
  contentId?: string;
  isInline: boolean;
}

export interface NormalisedMessage {
  providerMessageId: string;
  /** IMAP UID. Null for API providers, which have no equivalent. */
  uid?: bigint;

  /**
   * Provider thread id where one exists.
   *
   * Gmail and Graph supply this authoritatively. The IMAP adapter derives one
   * from References/In-Reply-To with a subject+time fallback and marks it
   * synthetic, so threading bugs are attributable to the adapter rather than
   * looking like data corruption.
   */
  threadId?: string;
  threadIsSynthetic: boolean;

  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];

  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet: string;

  from?: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo: MailAddress[];

  sentAt: Date;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  sizeBytes?: number;
  /** Provider-native labels we don't model natively (Gmail categories, etc.). */
  labels: string[];

  attachments: NormalisedAttachment[];
}

export interface FetchOptions {
  folderId: string;
  /** Opaque provider cursor. Absent means "from the beginning". */
  cursor?: string;
  limit?: number;
  /** Skip attachment bodies. Much cheaper for an initial backfill. */
  headersOnly?: boolean;
}

export interface FetchResult {
  messages: NormalisedMessage[];
  /** Pass back as `cursor` next time. Null when fully caught up. */
  nextCursor: string | null;
  hasMore: boolean;
}

export interface OutgoingMessage {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  /** Builds the References chain so the reply threads correctly. */
  inReplyToMessageId?: string;
  references?: string[];
  attachments?: Omit<NormalisedAttachment, "isInline">[];
}

export interface SendResult {
  providerMessageId?: string;
  /**
   * Whether the provider filed a copy in Sent itself.
   *
   * False means the caller must APPEND one. Gmail and Graph do it; IMAP+SMTP
   * varies per server, and getting this wrong produces either duplicated or
   * missing sent mail — both of which read as data loss.
   */
  sentCopyFiled: boolean;
}

export interface ConnectionCheck {
  ok: boolean;
  error?: string;
  supportsIdle?: boolean;
  folderCount?: number;
}

/**
 * Implemented once per provider.
 *
 * Every method may throw {@link MailProviderError}; callers distinguish
 * retryable transport failures from terminal auth failures via `retryable`.
 */
export interface MailProviderAdapter {
  readonly provider: "GOOGLE" | "MICROSOFT" | "IMAP";

  /** Probes credentials without persisting anything. Never throws. */
  testConnection(): Promise<{ imap: ConnectionCheck; smtp: ConnectionCheck }>;

  listFolders(): Promise<NormalisedFolder[]>;

  fetchMessages(options: FetchOptions): Promise<FetchResult>;

  /** Fetches one message in full, including attachment bodies. */
  fetchMessage(folderId: string, providerMessageId: string): Promise<NormalisedMessage | null>;

  send(message: OutgoingMessage): Promise<SendResult>;

  /** Files a copy in Sent. Only called when `SendResult.sentCopyFiled` is false. */
  appendToSent(raw: Buffer): Promise<void>;

  markRead(folderId: string, providerMessageIds: string[], read: boolean): Promise<void>;
  markStarred(folderId: string, providerMessageIds: string[], starred: boolean): Promise<void>;
  moveToFolder(
    fromFolderId: string,
    toFolderId: string,
    providerMessageIds: string[],
  ): Promise<void>;
  deleteMessages(folderId: string, providerMessageIds: string[]): Promise<void>;

  /**
   * Watches for new mail, invoking `onChange` when something arrives.
   *
   * IMAP holds an IDLE connection; the API providers register a push
   * subscription. Returns a disposer.
   */
  watch?(folderId: string, onChange: () => void): Promise<() => Promise<void>>;

  /** Releases connections. Safe to call more than once. */
  dispose(): Promise<void>;
}

export class MailProviderError extends Error {
  constructor(
    message: string,
    readonly code: MailErrorCode,
    /**
     * Whether a retry could plausibly succeed. Auth failures are terminal and
     * need the user to reconnect; network blips are worth retrying.
     */
    readonly retryable: boolean,
    // `override` because ES2022's Error already declares `cause`.
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MailProviderError";
  }
}

export type MailErrorCode =
  | "AUTH_FAILED"
  | "CONNECTION_FAILED"
  | "TLS_FAILED"
  | "MAILBOX_NOT_FOUND"
  | "UIDVALIDITY_CHANGED"
  | "RATE_LIMITED"
  | "SEND_FAILED"
  | "UNKNOWN";

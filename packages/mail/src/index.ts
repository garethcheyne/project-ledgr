export type {
  ConnectionCheck,
  FetchOptions,
  FetchResult,
  FolderRole,
  MailAddress,
  MailErrorCode,
  MailProviderAdapter,
  NormalisedAttachment,
  NormalisedFolder,
  NormalisedMessage,
  OutgoingMessage,
  SendResult,
} from "./provider.js";
export { MailProviderError } from "./provider.js";

export { ImapProvider } from "./imap/imap-provider.js";
export type { ImapConfig } from "./imap/imap-provider.js";

export { resolveFolderRole } from "./imap/folder-role.js";
export { normaliseSubject, resolveThread } from "./imap/threading.js";
export type { ThreadCandidate, ThreadInput, ThreadResolution } from "./imap/threading.js";

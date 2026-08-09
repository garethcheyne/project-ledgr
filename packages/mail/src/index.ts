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

export { resolveFolderRole } from "./imap/folder-role.js";

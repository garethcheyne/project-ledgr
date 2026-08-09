import { z } from "zod";

/**
 * Mail account contracts.
 *
 * One `provider` discriminator covers Gmail, Microsoft Graph and IMAP. Adding
 * a provider means adding a variant here and an adapter implementation —
 * nothing above the adapter interface changes.
 * See docs/adr/0008-native-provider-apis.md.
 */

export const mailProviderSchema = z.enum(["GOOGLE", "MICROSOFT", "IMAP"]);
export type MailProvider = z.infer<typeof mailProviderSchema>;

export const syncStatusSchema = z.enum([
  "PENDING",
  "CONNECTED",
  "SYNCING",
  "ERROR",
  "REAUTH_REQUIRED",
  "DISABLED",
]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const folderRoleSchema = z.enum([
  "INBOX",
  "SENT",
  "DRAFTS",
  "TRASH",
  "SPAM",
  "ARCHIVE",
  "STARRED",
  "IMPORTANT",
  "CUSTOM",
]);
export type FolderRole = z.infer<typeof folderRoleSchema>;

/**
 * IMAP connection settings.
 *
 * Ports are constrained to the standard pair rather than left free: 993 is
 * implicit TLS, 143 is STARTTLS. Anything else is almost always a typo, and a
 * wrong port produces a confusing hang rather than a clear error.
 */
/**
 * Mailbox address.
 *
 * Deliberately more permissive than the account-signup email rule: a strict
 * check rejects TLD-less hosts like `gareth@mailserver` or `you@nas.local`,
 * which are perfectly normal on a self-hosted LAN — and self-hosters are this
 * product's core audience. Requires a local part and a host, nothing more; the
 * IMAP server is the real authority on whether the address works.
 */
export const mailboxAddressSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+$/, "Enter an address in the form name@host")
  .transform((value) => value.toLowerCase());

export const imapConnectionSchema = z.object({
  provider: z.literal("IMAP"),
  displayName: z.string().trim().min(1).max(120),
  emailAddress: mailboxAddressSchema,

  imapHost: z.string().trim().min(1, "IMAP host is required"),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapUseTls: z.boolean().default(true),

  smtpHost: z.string().trim().min(1, "SMTP host is required"),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(465),
  smtpUseTls: z.boolean().default(true),

  username: z.string().trim().min(1, "Username is required"),
  /**
   * For most providers this is an app-specific password, not the account
   * password — Gmail and iCloud both require one when 2FA is enabled.
   */
  password: z.string().min(1, "Password is required"),
});
export type ImapConnectionInput = z.infer<typeof imapConnectionSchema>;

/** Probes credentials without persisting anything. */
export const testConnectionSchema = imapConnectionSchema.omit({ displayName: true });
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

export const connectionTestResultSchema = z.object({
  imap: z.object({
    ok: z.boolean(),
    error: z.string().optional(),
    /** Whether the server advertises IDLE. Without it we fall back to polling. */
    supportsIdle: z.boolean().optional(),
    folderCount: z.number().int().optional(),
  }),
  smtp: z.object({
    ok: z.boolean(),
    error: z.string().optional(),
  }),
});
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;

export const mailAccountSchema = z.object({
  id: z.string().uuid(),
  provider: mailProviderSchema,
  displayName: z.string(),
  emailAddress: z.string(),
  status: syncStatusSchema,
  isDefault: z.boolean(),
  lastSyncAt: z.string().datetime().nullable(),
  lastSyncError: z.string().nullable(),
  supportsIdle: z.boolean(),
  folderCount: z.number().int(),
  unreadCount: z.number().int(),
  createdAt: z.string().datetime(),
});
export type MailAccountSummary = z.infer<typeof mailAccountSchema>;

/**
 * Which providers this deployment can actually offer.
 *
 * The connect screen is built from this rather than hard-coding three buttons:
 * a provider with no OAuth credentials configured simply isn't shown, and
 * completing Google's security assessment later flips `configured` without any
 * UI change. See docs/adr/0008-native-provider-apis.md.
 */
export const providerAvailabilitySchema = z.object({
  provider: mailProviderSchema,
  configured: z.boolean(),
  /** Shown when unconfigured, pointing at the relevant setup guide. */
  setupHint: z.string().optional(),
});
export type ProviderAvailability = z.infer<typeof providerAvailabilitySchema>;

export const mailFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: folderRoleSchema,
  totalCount: z.number().int(),
  unreadCount: z.number().int(),
  isSubscribed: z.boolean(),
});
export type MailFolderSummary = z.infer<typeof mailFolderSchema>;

export const messageListItemSchema = z.object({
  id: z.string().uuid(),
  mailThreadId: z.string().uuid().nullable(),
  subject: z.string(),
  snippet: z.string(),
  fromName: z.string(),
  fromAddress: z.string(),
  sentAt: z.string().datetime(),
  isRead: z.boolean(),
  isStarred: z.boolean(),
  hasAttachments: z.boolean(),
});
export type MessageListItem = z.infer<typeof messageListItemSchema>;

/**
 * Known IMAP/SMTP settings, so connecting a mailbox doesn't require the user to
 * look up host names and ports.
 *
 * `appPasswordUrl` and `requiresAppPassword` matter more than the hosts: on
 * Gmail and iCloud, using the account password instead of an app-specific one
 * is the single most common reason a connection fails, and the error the server
 * returns doesn't say so.
 */

export interface MailPreset {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapUseTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUseTls: boolean;
  /** True when the provider rejects the normal account password over IMAP. */
  requiresAppPassword: boolean;
  appPasswordUrl?: string;
  /** Shown on the connect form. Keep it to what the user must actually do. */
  hint?: string;
  /** Domains that select this preset automatically from the address entered. */
  domains: string[];
}

export const GMAIL_PRESET: MailPreset = {
  id: "gmail",
  label: "Gmail / Google Workspace",
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapUseTls: true,
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpUseTls: true,
  requiresAppPassword: true,
  appPasswordUrl: "https://myaccount.google.com/apppasswords",
  hint:
    "Gmail needs a 16-character app password, not your normal one. Two-step verification " +
    "must be switched on first — the app-passwords page stays hidden until it is.",
  domains: ["gmail.com", "googlemail.com"],
};

/** Fallback for anything we don't recognise, and for self-hosted servers. */
export const CUSTOM_PRESET: MailPreset = {
  id: "custom",
  label: "Other / self-hosted",
  imapHost: "",
  imapPort: 993,
  imapUseTls: true,
  smtpHost: "",
  smtpPort: 465,
  smtpUseTls: true,
  requiresAppPassword: false,
  hint: "Enter the IMAP and SMTP details from your provider.",
  domains: [],
};

export const MAIL_PRESETS: MailPreset[] = [
  GMAIL_PRESET,
  {
    id: "icloud",
    label: "iCloud Mail",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapUseTls: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpUseTls: true,
    requiresAppPassword: true,
    appPasswordUrl: "https://account.apple.com/account/manage",
    hint: "iCloud requires an app-specific password generated from your Apple Account page.",
    domains: ["icloud.com", "me.com", "mac.com"],
  },
  {
    id: "fastmail",
    label: "Fastmail",
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    imapUseTls: true,
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpUseTls: true,
    requiresAppPassword: true,
    appPasswordUrl: "https://app.fastmail.com/settings/security/apps",
    hint: "Create an app password with Mail (IMAP/SMTP) access.",
    domains: ["fastmail.com", "fastmail.fm", "sent.com", "messagingengine.com"],
  },
  {
    id: "outlook",
    label: "Outlook.com / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapUseTls: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpUseTls: true,
    requiresAppPassword: true,
    hint:
      "Microsoft has retired basic authentication for IMAP and SMTP on most accounts. " +
      "If this fails, OAuth is required and IMAP will not work — Microsoft support is planned.",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapUseTls: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpUseTls: true,
    requiresAppPassword: true,
    appPasswordUrl: "https://login.yahoo.com/account/security",
    hint: "Yahoo requires an app password generated from Account Security.",
    domains: ["yahoo.com", "yahoo.co.uk", "ymail.com"],
  },
  CUSTOM_PRESET,
];

/** Picks a preset from an email address, falling back to custom. */
export function presetForAddress(email: string): MailPreset {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return CUSTOM_PRESET;
  return MAIL_PRESETS.find((preset) => preset.domains.includes(domain)) ?? CUSTOM_PRESET;
}

/** Total by design — callers get a usable preset rather than a guard at every site. */
export function presetById(id: string): MailPreset {
  return MAIL_PRESETS.find((preset) => preset.id === id) ?? CUSTOM_PRESET;
}

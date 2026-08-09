import type { FolderRole } from "../provider.js";

/**
 * Maps an IMAP mailbox to a normalised role.
 *
 * RFC 6154 SPECIAL-USE flags are authoritative where a server supports them.
 * Many don't, so name matching is the fallback — and names are localised, which
 * is why the lists below include non-English variants. Getting this wrong means
 * the UI can't find the user's inbox, or files sent mail into the wrong place.
 */

const SPECIAL_USE_ROLES: Record<string, FolderRole> = {
  "\\Inbox": "INBOX",
  "\\Sent": "SENT",
  "\\Drafts": "DRAFTS",
  "\\Trash": "TRASH",
  "\\Junk": "SPAM",
  "\\Archive": "ARCHIVE",
  "\\Flagged": "STARRED",
  "\\Important": "IMPORTANT",
  "\\All": "ARCHIVE",
};

const NAME_PATTERNS: [FolderRole, RegExp][] = [
  ["INBOX", /^inbox$/i],
  ["SENT", /^(sent|sent items|sent mail|sent messages|gesendet|envoyés|enviados)$/i],
  ["DRAFTS", /^(drafts?|entwürfe|brouillons|borradores)$/i],
  ["TRASH", /^(trash|deleted|deleted items|bin|papierkorb|corbeille|papelera)$/i],
  ["SPAM", /^(spam|junk|junk e-?mail|bulk mail|unerwünscht|pourriel)$/i],
  ["ARCHIVE", /^(archive|archives|all mail|archiv)$/i],
  ["STARRED", /^(starred|flagged)$/i],
  ["IMPORTANT", /^(important|priority)$/i],
];

export function resolveFolderRole(
  path: string,
  specialUse?: string,
  flags?: Set<string>,
): FolderRole {
  // SPECIAL-USE first — it's explicit and locale-independent.
  if (specialUse && SPECIAL_USE_ROLES[specialUse]) {
    return SPECIAL_USE_ROLES[specialUse];
  }

  if (flags) {
    for (const [flag, role] of Object.entries(SPECIAL_USE_ROLES)) {
      if (flags.has(flag)) return role;
    }
  }

  // Fall back to the leaf name, so "[Gmail]/Sent Mail" matches on "Sent Mail"
  // rather than failing on the full path.
  const leaf = path.split(/[/.]/).pop() ?? path;

  for (const [role, pattern] of NAME_PATTERNS) {
    if (pattern.test(leaf.trim())) return role;
  }

  return "CUSTOM";
}

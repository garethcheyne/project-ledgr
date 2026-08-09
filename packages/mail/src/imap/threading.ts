import { createHash } from "node:crypto";

/**
 * Thread derivation for IMAP.
 *
 * Gmail and Graph hand us an authoritative thread id. IMAP does not, so we
 * reconstruct one — and every message we do this for is marked
 * `threadIsSynthetic`, so a mis-threaded conversation is attributable to this
 * file rather than looking like data corruption.
 *
 * Two strategies, in order:
 *
 *  1. `References` / `In-Reply-To` chains (RFC 5322). Correct when present and
 *     well-formed. In practice they are frequently truncated, reordered, or
 *     missing entirely — plenty of clients and mailing lists mangle them.
 *  2. Normalised subject + participant overlap, within a time window. This is
 *     what every IMAP client eventually falls back to.
 *
 * The time window matters: without it, a monthly "Your bill is ready" from the
 * same sender collapses two years of separate bills into one thread.
 */

/** Longest gap between messages that can still be considered the same thread. */
const THREAD_WINDOW_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Reply and forward prefixes across the locales most likely to appear in a
 * New Zealand / European mailbox. Matching these is what lets "Re: Invoice"
 * and "Invoice" land in the same conversation.
 */
const SUBJECT_PREFIX =
  /^(\s*(re|aw|antw|sv|vs|ref|fwd?|wg|tr|rv|enc|res|odp|回覆|转发)\s*(\[\d+\])?\s*:\s*)+/i;

/** Strips reply/forward prefixes and normalises whitespace and case. */
export function normaliseSubject(subject: string): string {
  let previous: string;
  let current = subject.trim();

  // Loop: "Re: Fwd: Re: x" needs several passes.
  do {
    previous = current;
    current = current.replace(SUBJECT_PREFIX, "").trim();
  } while (current !== previous);

  return current.replace(/\s+/g, " ").toLowerCase();
}

export interface ThreadCandidate {
  threadId: string;
  /** Normalised subject of the thread, for the fallback match. */
  subjectKey: string;
  lastMessageAt: Date;
  /** Every Message-ID already in the thread, for chain matching. */
  messageIds: Set<string>;
  participants: Set<string>;
}

export interface ThreadInput {
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  sentAt: Date;
  participants: string[];
}

export interface ThreadResolution {
  threadId: string;
  isSynthetic: boolean;
  /** True when an existing thread was joined rather than a new one started. */
  matchedExisting: boolean;
}

/**
 * Picks a thread for a message, given the threads already known for the folder.
 *
 * `candidates` should be scoped to a recent window — matching against an entire
 * mailbox is both slow and more likely to produce a false positive.
 */
export function resolveThread(input: ThreadInput, candidates: ThreadCandidate[]): ThreadResolution {
  // ── 1. Chain matching ────────────────────────────────────────────────────
  // Any referenced Message-ID already in a thread means this belongs there.
  // Walk references newest-first: the last entry is the immediate parent, so
  // it's the strongest signal when a message references several threads.
  const chain = [input.inReplyTo, ...[...input.references].reverse()].filter((id): id is string =>
    Boolean(id),
  );

  for (const referenced of chain) {
    const match = candidates.find((candidate) => candidate.messageIds.has(referenced));
    if (match) {
      return { threadId: match.threadId, isSynthetic: true, matchedExisting: true };
    }
  }

  // ── 2. Subject + participant fallback ────────────────────────────────────
  const subjectKey = normaliseSubject(input.subject);

  // An empty subject carries no signal — grouping every "(no subject)" together
  // would be worse than leaving them separate.
  if (subjectKey.length > 0) {
    const participants = new Set(input.participants.map((p) => p.toLowerCase()));

    const match = candidates
      .filter((candidate) => candidate.subjectKey === subjectKey)
      .filter(
        (candidate) =>
          Math.abs(input.sentAt.getTime() - candidate.lastMessageAt.getTime()) <= THREAD_WINDOW_MS,
      )
      // Require at least one shared participant, so two unrelated people
      // emailing "Invoice" don't merge.
      .filter((candidate) =>
        [...participants].some((participant) => candidate.participants.has(participant)),
      )
      // Closest in time wins when several match.
      .sort(
        (a, b) =>
          Math.abs(input.sentAt.getTime() - a.lastMessageAt.getTime()) -
          Math.abs(input.sentAt.getTime() - b.lastMessageAt.getTime()),
      )[0];

    if (match) {
      return { threadId: match.threadId, isSynthetic: true, matchedExisting: true };
    }
  }

  // ── 3. New thread ────────────────────────────────────────────────────────
  // Keyed on the root of the reference chain where there is one, so two
  // messages that arrive out of order still converge on the same thread id.
  const root = input.references[0] ?? input.inReplyTo ?? input.messageIdHeader;

  const seed =
    root ?? `${subjectKey}|${input.sentAt.toISOString()}|${input.participants.join(",")}`;

  return {
    threadId: `imap-${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`,
    isSynthetic: true,
    matchedExisting: false,
  };
}

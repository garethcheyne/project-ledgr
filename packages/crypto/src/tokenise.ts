/**
 * Tokeniser for encrypted-mail search. See docs/adr/0006-encryption-at-rest.md.
 *
 * Encrypted columns can't be indexed or scanned, so search works by hashing
 * each word and indexing the hashes. That buys exact whole-word matching and
 * nothing else: no prefix, no substring, no fuzzy, no phrase search.
 *
 * The index also leaks word-frequency statistics to anyone who can read the
 * table, which for a large enough mailbox is vulnerable to frequency analysis.
 * Both limits are accepted deliberately; the alternative was decrypting every
 * message on every query.
 */

/**
 * Words carrying no search value. Indexing them would bloat the table and make
 * frequency analysis easier without helping anyone find anything.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const MIN_TOKEN_LENGTH = 2;
const MAX_TOKEN_LENGTH = 64;

/**
 * Caps how many distinct terms one message contributes. A newsletter or a long
 * quoted reply chain would otherwise write thousands of rows, and the tail
 * contributes almost nothing to recall.
 */
const MAX_TERMS_PER_FIELD = 500;

export interface TokeniseOptions {
  /** Keep stop words. Off by default. */
  includeStopWords?: boolean;
  maxTerms?: number;
}

/**
 * Splits text into normalised, deduplicated search tokens.
 *
 * Email addresses are emitted whole *and* split into their parts, so both
 * "billing@octopus.co.nz" and "octopus" find the same message.
 */
export function tokenise(text: string, options: TokeniseOptions = {}): string[] {
  const { includeStopWords = false, maxTerms = MAX_TERMS_PER_FIELD } = options;
  const seen = new Set<string>();

  const add = (raw: string): void => {
    if (seen.size >= maxTerms) return;
    const token = raw.toLowerCase().normalize("NFKC");
    if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) return;
    if (!includeStopWords && STOP_WORDS.has(token)) return;
    seen.add(token);
  };

  // Whole email addresses first, before punctuation splitting destroys them.
  for (const match of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    add(match[0]);
  }

  // Then words. Unicode-aware so non-Latin scripts aren't silently dropped.
  for (const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu)) {
    const word = match[0];
    add(word);

    // Split hyphenated and underscored compounds into their parts too.
    if (word.includes("-") || word.includes("_")) {
      for (const part of word.split(/[-_]/)) add(part);
    }
  }

  return [...seen];
}

/**
 * Tokenises a search query the same way as indexed content.
 *
 * Must stay identical to `tokenise`, or queries silently fail to match: a
 * query normalised differently from the index produces a different hash and
 * therefore no results, with no error to explain why.
 */
export function tokeniseQuery(query: string): string[] {
  return tokenise(query, { includeStopWords: false, maxTerms: 32 });
}

/** Strips HTML so a body isn't indexed full of tag names and CSS. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Removes quoted reply chains before indexing.
 *
 * Without this, every message in a long thread indexes the entire history, so
 * one search term matches all of them and the results are useless.
 */
export function stripQuotedText(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*(On .+ wrote:|-{2,}\s*Original Message\s*-{2,}|_{5,})\s*$/i.test(line)) break;
    if (/^\s*From:\s*.+\s*$/i.test(line) && kept.length > 0) break;
    kept.push(line);
  }

  return kept.join("\n").trim();
}

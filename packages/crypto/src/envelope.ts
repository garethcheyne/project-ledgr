import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Envelope encryption for Ledgr. See docs/adr/0006-encryption-at-rest.md.
 *
 * Master key (KEK, from LEDGR_ENCRYPTION_KEY)
 *   └─ wraps a per-household data key (DEK)  → encrypts row data
 *   └─ wraps a per-household index key       → HMACs blind indexes
 *
 * Rotating the master key rewraps a handful of household keys rather than
 * rewriting every row in the database.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;

/**
 * Ciphertext layout: [format:1][keyVersion:2 BE][iv:12][tag:16][ciphertext:n]
 *
 * The key version travels with the data so rotation can be incremental — old
 * rows stay readable while new ones use the new key, with no migration window
 * during which the application is down.
 */
const FORMAT_VERSION = 1;
const HEADER_BYTES = 1 + 2 + IV_BYTES + TAG_BYTES;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

/** A 32-byte symmetric key. Branded so a raw Buffer can't be passed by mistake. */
export type Key = Buffer & { readonly __brand: "ledgr-key" };

export function assertKey(value: Buffer, label: string): Key {
  if (value.length !== KEY_BYTES) {
    throw new CryptoError(`${label} must be exactly ${KEY_BYTES} bytes, got ${value.length}`);
  }
  return value as Key;
}

/** Generates a fresh random key. Used for new household DEKs and index keys. */
export function generateKey(): Key {
  return randomBytes(KEY_BYTES) as Key;
}

/**
 * Loads the master key from an environment variable.
 *
 * Throws rather than falling back to a default or to plaintext. A deployment
 * that quietly stopped encrypting would be worse than one that never started —
 * the failure would be invisible until a breach.
 */
export function loadMasterKey(env: NodeJS.ProcessEnv = process.env): Key {
  const raw = env.LEDGR_ENCRYPTION_KEY;

  if (!raw || raw.trim() === "") {
    throw new CryptoError(
      "LEDGR_ENCRYPTION_KEY is not set. Generate one with:\n" +
        "  openssl rand -base64 32\n" +
        "Then back it up somewhere separate from your database backups — " +
        "without it, your data and every backup are unreadable.",
    );
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch {
    throw new CryptoError("LEDGR_ENCRYPTION_KEY is not valid base64.");
  }

  if (decoded.length !== KEY_BYTES) {
    throw new CryptoError(
      `LEDGR_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }

  return decoded as Key;
}

/**
 * Encrypts with AES-256-GCM.
 *
 * GCM is authenticated: tampering with the ciphertext causes decryption to
 * throw rather than silently returning corrupted plaintext.
 *
 * `aad` binds the ciphertext to its context — pass something like the row id so
 * a ciphertext copied from one row to another fails to decrypt instead of
 * quietly succeeding.
 */
export function encrypt(
  plaintext: string | Buffer,
  key: Key,
  keyVersion = 1,
  aad?: string,
): Buffer {
  if (keyVersion < 0 || keyVersion > 0xffff) {
    throw new CryptoError(`keyVersion must fit in 16 bits, got ${keyVersion}`);
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));

  const input = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(3);
  header.writeUInt8(FORMAT_VERSION, 0);
  header.writeUInt16BE(keyVersion, 1);

  return Buffer.concat([header, iv, tag, ciphertext]);
}

/** Reads the key version from a ciphertext without decrypting it. */
export function readKeyVersion(payload: Buffer): number {
  if (payload.length < HEADER_BYTES) {
    throw new CryptoError("Ciphertext is too short to contain a header.");
  }
  const format = payload.readUInt8(0);
  if (format !== FORMAT_VERSION) {
    throw new CryptoError(`Unsupported ciphertext format version ${format}.`);
  }
  return payload.readUInt16BE(1);
}

export function decrypt(payload: Buffer, key: Key, aad?: string): Buffer {
  if (payload.length < HEADER_BYTES) {
    throw new CryptoError("Ciphertext is too short to contain a header.");
  }

  const format = payload.readUInt8(0);
  if (format !== FORMAT_VERSION) {
    throw new CryptoError(`Unsupported ciphertext format version ${format}.`);
  }

  const iv = payload.subarray(3, 3 + IV_BYTES);
  const tag = payload.subarray(3 + IV_BYTES, HEADER_BYTES);
  const ciphertext = payload.subarray(HEADER_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // Deliberately opaque: distinguishing "wrong key" from "tampered data"
    // gives an attacker a probing oracle.
    throw new CryptoError(
      "Decryption failed. The key is wrong, or the ciphertext has been altered.",
    );
  }
}

export function decryptToString(payload: Buffer, key: Key, aad?: string): string {
  return decrypt(payload, key, aad).toString("utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Key wrapping
// ─────────────────────────────────────────────────────────────────────────────

/** Wraps a household key under the master key for storage. */
export function wrapKey(dataKey: Key, masterKey: Key, kekVersion = 1): Buffer {
  return encrypt(dataKey, masterKey, kekVersion, "ledgr:key-wrap");
}

export function unwrapKey(wrapped: Buffer, masterKey: Key): Key {
  const unwrapped = decrypt(wrapped, masterKey, "ledgr:key-wrap");
  return assertKey(unwrapped, "Unwrapped data key");
}

// ─────────────────────────────────────────────────────────────────────────────
// Blind indexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic HMAC of a value, so encrypted columns remain exact-match
 * searchable.
 *
 * Supports equality only — no ranges, no prefixes, no substrings. It also
 * reveals which rows share a value, which for something like a sender address
 * is usually acceptable and should be a conscious choice per column.
 *
 * Uses a key separate from the encryption key, so compromising the index key
 * does not enable decryption.
 */
export function blindIndex(value: string, indexKey: Key): string {
  const normalised = value.trim().toLowerCase().normalize("NFKC");
  return createHmac("sha256", indexKey).update(normalised, "utf8").digest("hex");
}

/** Truncated binary form, for the message search-term table. */
export function termHash(token: string, indexKey: Key): Buffer {
  const normalised = token.trim().toLowerCase().normalize("NFKC");
  return createHmac("sha256", indexKey).update(normalised, "utf8").digest().subarray(0, 16);
}

/** Constant-time comparison, for verifying blind indexes and token hashes. */
export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const bufA = typeof a === "string" ? Buffer.from(a, "utf8") : a;
  const bufB = typeof b === "string" ? Buffer.from(b, "utf8") : b;
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

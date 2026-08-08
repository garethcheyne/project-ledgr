import { describe, expect, it } from "vitest";
import {
  CryptoError,
  blindIndex,
  decrypt,
  decryptToString,
  encrypt,
  generateKey,
  loadMasterKey,
  readKeyVersion,
  termHash,
  unwrapKey,
  wrapKey,
} from "./envelope.js";

describe("encrypt / decrypt", () => {
  it("round-trips text", () => {
    const key = generateKey();
    const plaintext = "Your March power bill is $184.20";
    expect(decryptToString(encrypt(plaintext, key), key)).toBe(plaintext);
  });

  it("round-trips binary and unicode", () => {
    const key = generateKey();
    const bytes = Buffer.from([0x00, 0xff, 0x7f, 0x80]);
    expect(decrypt(encrypt(bytes, key), key).equals(bytes)).toBe(true);

    const unicode = "Ōtautahi — 電気料金 — café";
    expect(decryptToString(encrypt(unicode, key), key)).toBe(unicode);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const key = generateKey();
    const a = encrypt("same input", key);
    const b = encrypt("same input", key);
    expect(a.equals(b)).toBe(false);
    expect(decryptToString(a, key)).toBe(decryptToString(b, key));
  });

  it("fails with the wrong key rather than returning garbage", () => {
    const encrypted = encrypt("secret", generateKey());
    expect(() => decrypt(encrypted, generateKey())).toThrow(CryptoError);
  });

  it("detects tampering — this is why GCM and not CBC", () => {
    const key = generateKey();
    const encrypted = encrypt("Amount due: $50.00", key);

    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0x01;

    expect(() => decrypt(tampered, key)).toThrow(CryptoError);
  });

  it("binds ciphertext to its context via AAD", () => {
    const key = generateKey();
    const encrypted = encrypt("body", key, 1, "message:abc-123");

    // Correct context decrypts.
    expect(decryptToString(encrypted, key, "message:abc-123")).toBe("body");
    // A ciphertext copied onto a different row must not decrypt.
    expect(() => decrypt(encrypted, key, "message:xyz-789")).toThrow(CryptoError);
  });

  it("exposes the key version without decrypting, so rotation can be incremental", () => {
    const encrypted = encrypt("data", generateKey(), 7);
    expect(readKeyVersion(encrypted)).toBe(7);
  });

  it("rejects a truncated payload", () => {
    expect(() => decrypt(Buffer.alloc(4), generateKey())).toThrow(CryptoError);
  });
});

describe("key wrapping", () => {
  it("round-trips a data key through the master key", () => {
    const master = generateKey();
    const dek = generateKey();
    const unwrapped = unwrapKey(wrapKey(dek, master), master);
    expect(unwrapped.equals(dek)).toBe(true);
  });

  it("does not unwrap under a different master key", () => {
    const wrapped = wrapKey(generateKey(), generateKey());
    expect(() => unwrapKey(wrapped, generateKey())).toThrow(CryptoError);
  });

  it("survives master-key rotation: rewrap, same DEK, data still readable", () => {
    const oldMaster = generateKey();
    const newMaster = generateKey();
    const dek = generateKey();

    const ciphertext = encrypt("bill total 184.20", dek);
    const wrappedOld = wrapKey(dek, oldMaster, 1);

    // Rotation rewraps the DEK only — no row data is rewritten.
    const rewrapped = wrapKey(unwrapKey(wrappedOld, oldMaster), newMaster, 2);

    expect(decryptToString(ciphertext, unwrapKey(rewrapped, newMaster))).toBe("bill total 184.20");
  });
});

describe("loadMasterKey", () => {
  it("refuses to start without a key rather than silently not encrypting", () => {
    expect(() => loadMasterKey({} as NodeJS.ProcessEnv)).toThrow(/LEDGR_ENCRYPTION_KEY is not set/);
  });

  it("rejects a key of the wrong length", () => {
    const env = { LEDGR_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") };
    expect(() => loadMasterKey(env as NodeJS.ProcessEnv)).toThrow(/must decode to 32 bytes/);
  });

  it("accepts a valid 32-byte base64 key", () => {
    const key = generateKey();
    const env = { LEDGR_ENCRYPTION_KEY: key.toString("base64") };
    expect(loadMasterKey(env as NodeJS.ProcessEnv).equals(key)).toBe(true);
  });
});

describe("blind index", () => {
  it("is deterministic, so equality lookups work", () => {
    const key = generateKey();
    expect(blindIndex("billing@octopus.co.nz", key)).toBe(blindIndex("billing@octopus.co.nz", key));
  });

  it("normalises case and whitespace", () => {
    const key = generateKey();
    expect(blindIndex("  Billing@Octopus.CO.NZ  ", key)).toBe(
      blindIndex("billing@octopus.co.nz", key),
    );
  });

  it("differs per key, so one household's index can't probe another's", () => {
    const value = "billing@octopus.co.nz";
    expect(blindIndex(value, generateKey())).not.toBe(blindIndex(value, generateKey()));
  });

  it("produces 16-byte term hashes for the search table", () => {
    expect(termHash("invoice", generateKey())).toHaveLength(16);
  });
});

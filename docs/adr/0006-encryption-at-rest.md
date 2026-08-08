# 0006 — Encryption at rest: application-layer column encryption

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Ledgr holds an unusually sensitive combination for a self-hosted app: mail account credentials, the full text of personal correspondence, financial records, and scanned documents. A stolen backup file is a serious breach, and self-hosted backups end up in more places than managed ones do.

"Encrypted at rest" is used to mean at least three different things, with very different guarantees.

## Decision

**Application-layer encryption of sensitive columns**, performed by the API before data reaches Postgres or MinIO.

- **Cipher:** AES-256-GCM (authenticated — tampering is detected, not silently decrypted).
- **Envelope scheme:** a master key (KEK) from `LEDGR_ENCRYPTION_KEY` wraps a per-household data key (DEK). Rows are encrypted with the DEK. Rotating the master key rewraps a handful of DEKs rather than rewriting every row in the database.
- **Key versioning:** every ciphertext records the key version that produced it, so rotation is incremental and old data stays readable throughout.
- **Searchability:** encrypted columns that need lookup get a blind index — HMAC-SHA256 of the normalised plaintext under a separate index key. Exact-match lookup works; range and substring do not.

Encrypted: mail credentials, message bodies and subjects, attachment bytes in MinIO, OCR text, extracted financial data, notes fields.

Not encrypted: primary and foreign keys, timestamps, enums, and the amount/date columns the ledger aggregates on. Encrypting those would make `SUM(amount) GROUP BY category` impossible without decrypting the entire table per query, which would defeat the reporting the product exists for.

## Why not the alternatives

**Volume encryption alone** (LUKS, encrypted EBS) protects a physically stolen disk and nothing else. A leaked `pg_dump`, a compromised container, or anyone holding DB credentials reads everything in plaintext. Since the most likely real-world exposure for a self-hosted app is a backup file copied somewhere careless, this is precisely the wrong threat to be defended against. It remains _complementary_ and is recommended in the deployment docs — it is just not sufficient on its own.

**End-to-end encryption with user-held keys** is the strongest privacy story and structurally incompatible with this product. If the server cannot decrypt, then OCR cannot read the receipt, Claude cannot extract from it, IMAP sync cannot parse messages, and server-side search cannot function. It would mean deleting features already committed to. It also makes key loss equal permanent data loss with no recovery path — a bad trade for a household finance tool.

## Threat model

**Defends against:** stolen or leaked database dumps; stolen backup archives; a compromised MinIO bucket; disk-level theft; an operator with read access to Postgres but not to application secrets.

**Does not defend against:** a compromised API process (it holds the key by necessity); a compromised host with memory access; a malicious administrator who can read the environment. Column encryption is not a defence against someone who already controls the running application, and the docs must not imply otherwise.

## Consequences

- `LEDGR_ENCRYPTION_KEY` becomes mandatory. The API refuses to start without it — no silent fallback to plaintext, because a deployment that quietly stopped encrypting would be worse than one that never started.
- **Losing the key means losing the data.** Backups must include the key material, stored separately from the data backups. This is documented prominently in the DR runbook ([ADR 0007](0007-backup-and-disaster-recovery.md)); it is the single most likely way a user destroys their own install.
- Encryption/decryption lives in `packages/crypto` and is applied through a Prisma client extension, so field-level crypto is declarative and cannot be forgotten at a call site.
- Encrypted columns are `Bytes`. Blind-index columns sit alongside them as indexed `String`s.
- Some queries get slower and some become impossible. Accepted deliberately, column by column.

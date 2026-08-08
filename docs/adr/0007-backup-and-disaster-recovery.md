# 0007 — Backup and disaster recovery

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Ledgr is the system of record for a household's financial history and correspondence. Losing it means losing years of data that mostly cannot be reconstructed — you can re-download recent bills, but not the vendor-switch history or the thread of a three-month dispute.

Self-hosted users have wildly varying infrastructure: some have off-site object storage, many have a NAS and nothing else. A backup design that assumes a cloud account excludes a large part of the audience; one that assumes a single machine isn't disaster recovery at all.

There are three distinct things to protect, and a restore that recovers only some of them is not a restore:

1. Postgres — the ledger, relationships, correspondence metadata.
2. MinIO — attachment bytes.
3. **The encryption key** — without it, 1 and 2 are unreadable noise ([ADR 0006](0006-encryption-at-rest.md)).

## Decision

**Local by default, remote optional.**

- **Scheduled `pg_dump`** (custom format, compressed), encrypted with age before it touches disk.
- **MinIO bucket sync** to the same backup volume.
- **Optional remote target** — any S3-compatible endpoint or rclone remote, configured in `.env`. Off by default, one variable to enable.
- **Retention:** 7 daily, 4 weekly, 12 monthly, pruned automatically.
- **`scripts/restore.sh`** performing a full restore into a clean stack, and a runbook at `docs/runbooks/disaster-recovery.md`.

Backups are encrypted independently of column encryption. The two protect different things: column encryption defends a leaked dump of the live database, backup encryption defends the archive sitting on a NAS or in someone else's object storage.

## The key is the hard part

The encryption key must be backed up, and it must **not** live in the same place as the data. A backup archive containing both the encrypted data and the key that opens it is an unencrypted backup with extra steps.

So:

- `scripts/backup.sh` **never** includes `LEDGR_ENCRYPTION_KEY` or `.env` in the data archive.
- A separate `scripts/export-keys.sh` writes key material to a file intended for a password manager or offline storage, deliberately requiring a manual step.
- First-run setup prints a conspicuous warning, and the runbook leads with it.

This is the single most likely way a user destroys their own installation: diligent nightly backups, no copy of the key, and a restore that produces a database full of unreadable ciphertext.

## Restore targets

| | Target | Reasoning |
| --- | --- | --- |
| **RPO** (data loss) | ≤ 24h default, ≤ 1h with hourly dumps | Household finance data changes slowly; a day is tolerable, and the knob is there for people who disagree. |
| **RTO** (downtime) | ≤ 1h from a clean host | Bounded by `docker compose up` plus restore time. |

## An untested backup is not a backup

`scripts/verify-backup.sh` restores the most recent archive into a throwaway container, runs integrity checks (row counts, referential integrity, decrypting a sample of encrypted columns to prove the key matches), then tears it down. It runs in CI against synthetic data and is documented as a monthly task for real deployments.

The check that matters most is decrypting a sample: a restore can succeed at the database level and still be worthless if the key doesn't match, and that failure is invisible until someone opens a record.

## Consequences

- A `backup` service in the compose stack, cron-scheduled, off by default so `docker compose up` doesn't silently start writing archives before anyone has configured retention.
- New env vars: `BACKUP_ENABLED`, `BACKUP_SCHEDULE`, `BACKUP_RETENTION_*`, `BACKUP_ENCRYPTION_RECIPIENT`, `BACKUP_REMOTE_*`.
- The DR runbook is a real deliverable, not a paragraph in the README.

## Rejected

**Postgres WAL archiving / PITR.** Better RPO — recovery to the second rather than the day. Rejected as disproportionate: it needs continuous archiving infrastructure and a much more involved restore procedure, for a workload where a day's loss is a handful of manually-entered rows. Revisit if Ledgr is ever run as a hosted service, where the calculus changes completely.

**Backing up to the same volume as the data.** Zero protection against the most common failure, which is disk failure.

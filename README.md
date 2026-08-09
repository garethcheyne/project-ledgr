# Ledgr

An open-source, self-hostable **personal CRM** that tracks your relationships, communication, and finances with the companies and vendors in your life — with a full email client built in, so you can actually live in it.

Not a sales CRM.

> **Status: pre-alpha.** The scaffold boots and the data model is settled; features are landing phase by phase (see [Roadmap](#roadmap)). Not yet ready to trust with real data.

## The idea

Every subscription tracker conflates two different things: **what you're paying for** and **who you're paying**. So the day you switch from one power company to another, your spending history breaks in half. You lose the answer to the only question that matters — _"am I spending more on power than I was two years ago?"_

Ledgr separates them:

- **Category** — the persistent thing you're tracking. _Power._ _Broadband._ _Home insurance._
- **Entity** — the vendor you currently pay for it. _Octopus Energy._
- **Subscription** — a dated link between the two.

Switching providers closes one Subscription and opens another under the same Category. Spend continuity survives, and the switch itself becomes a first-class, graphable event rather than a gap in your records.

On top of that sits the relationship half: threads for ongoing issues ("the boiler warranty dispute"), a normalised log of emails and calls per vendor, and receipts that file themselves against the right Category automatically.

## What makes it different

No existing tool combines all of these. The closest in each column, for the record:

| Capability                                | Ledgr | Closest alternative                                                       |
| ----------------------------------------- | :---: | ------------------------------------------------------------------------- |
| Relationship / communication tracking     |  ✅   | Monica — people-focused, no finance or vendor tracking, manual entry only |
| Category-vs-vendor subscription tracking  |  ✅   | Wallos — household support, but no category/vendor separation             |
| OCR + AI receipt extraction               |  ✅   | SubOS — small and early                                                   |
| Household multi-tenancy                   |  ✅   | Wallos                                                                    |
| Email + calendar sync over open protocols |  ✅   | —                                                                         |

Traditional open-source CRMs (SuiteCRM, EspoCRM, Corteza) are sales-pipeline shaped, which is explicitly not this.

## The email client

Ledgr is a real mail client, not a mail _reader_. Inbox, threads, compose, reply, forward, drafts, folders and labels, search, and send — with every message linked to the vendor, thread, subscription or bill it belongs to.

That linkage is the point. Replying to your power company from inside Ledgr logs the reply against the power company, in the dispute thread, next to the bill it's about. Replying from Gmail logs it nowhere.

**Connecting an account** — click _Connect_, consent, done:

| Provider                                     | How                       | Also brings                       |
| -------------------------------------------- | ------------------------- | --------------------------------- |
| Gmail / Google Workspace                     | Gmail API, OAuth          | Calendar + contacts, same consent |
| Outlook.com / Microsoft 365                  | Microsoft Graph, OAuth    | Calendar + contacts, same consent |
| Fastmail, iCloud, Proton Bridge, self-hosted | IMAP + SMTP, app password | CalDAV / CardDAV separately       |

Native provider APIs are used where they exist, because IMAP can't compete on threading, search, push notifications, or getting sent mail into the Sent folder reliably — see [ADR 0008](docs/adr/0008-native-provider-apis.md). IMAP stays fully supported, since most self-hosted mail has no API.

> **Self-hosting note.** Google and Microsoft connections need OAuth client credentials in `.env`. Until Ledgr completes Google's security assessment for restricted Gmail scopes, that means [registering your own app](docs/setup/google-oauth.md) — roughly ten minutes, once. Providers with no credentials configured simply don't appear on the connect screen. IMAP needs none of this.

Ledgr does **not** run a mail server. It connects to the mailbox you already have: no MX records, no inbound MTA, no deliverability reputation to manage.

## Architecture

Three decoupled layers, so that adding a native mobile app later is _"just another client"_ rather than a rewrite.

```
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   Web (Next) │     │  Future iOS  │     │  Future CLI    │
└──────┬───────┘     └──────┬───────┘     └───────┬────────┘
       └────────────────────┼─────────────────────┘
                            │  HTTP + bearer token
                     ┌──────▼───────┐
                     │  Core API    │  all business logic, versioned
                     │  (NestJS)    │
                     └──────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
   ┌────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │ Postgres │      │    MinIO    │     │    Redis    │
   └──────────┘      │ attachments │     │  job queue  │
                     └─────────────┘     └──────┬──────┘
                                                │
                                        ┌───────▼────────┐
                                        │  Sync worker   │
                                        │ IMAP · CalDAV  │
                                        │ OCR · Claude   │
                                        └────────────────┘
```

Two deliberate constraints:

- **Mail access sits behind one adapter interface.** Gmail API, Microsoft Graph, and IMAP/SMTP are three implementations of the same contract, verified by a shared conformance test suite. Nothing above the interface knows which provider it's talking to.
- **Ledgr connects to your mailbox; it is not a mail server.** No MX records, no inbound MTA, no spam filtering, no deliverability reputation. That is the boundary that keeps the scope finite, and it isn't up for revision.

## Stack

| Layer       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Web         | Next.js 16 (App Router) + Fluent UI v9                     |
| Core API    | NestJS 11, JWT bearer auth                                 |
| Sync worker | NestJS standalone + BullMQ                                 |
| Database    | PostgreSQL 17 + Prisma 7                                   |
| Attachments | MinIO (S3-compatible)                                      |
| Mail        | Gmail API · Microsoft Graph · IMAP/SMTP behind one adapter |
| OCR         | Tesseract                                                  |
| Extraction  | Claude (`claude-opus-5`) with structured outputs           |
| Encryption  | AES-256-GCM column encryption, envelope keys               |

## Quick start

Requires Docker and Docker Compose. Nothing else.

```bash
git clone https://github.com/garethcheyne/project-ledgr.git
cd project-ledgr
cp .env.example .env

# Generate the two auth secrets (they must differ)
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"  >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)" >> .env

docker compose up --build
```

Then open <http://localhost:5750>.

The `ANTHROPIC_API_KEY` in `.env` is optional — leave it blank and everything works except AI extraction. OCR still runs and stores the raw text for manual entry.

### Local development

```bash
pnpm install
pnpm db:generate
docker compose up postgres redis minio -d   # backing services only
pnpm db:migrate && pnpm db:seed
pnpm dev                                     # web + api + worker in watch mode
```

## Receipt extraction, and why it asks first

Upload a receipt, or let one arrive as an email attachment:

```
attachment → Tesseract OCR → Claude structured extraction → YOU CONFIRM → saved
```

The extraction step proposes a vendor, amount, billing period, and category. **It never writes a bill on its own.** Every extraction lands in a review queue and waits for a human, and vendor names are fuzzy-matched against your existing entities so you don't accumulate four spellings of the same power company.

Auto-categorisation is a suggestion. Your ledger should not silently acquire rows you didn't approve.

## Security

- **Column-level encryption at rest.** AES-256-GCM with envelope keys — a per-household data key wrapped by a master key, so rotating the master rewraps a handful of keys instead of rewriting the database. Mail credentials, OAuth refresh tokens, message bodies, attachment bytes, OCR text and notes are all encrypted before they reach Postgres or MinIO. A stolen dump or backup file is ciphertext. ([ADR 0006](docs/adr/0006-encryption-at-rest.md))
- **Encrypted, tested backups.** Scheduled `pg_dump` plus MinIO sync, encrypted with age, local by default with an optional remote target. `verify-backup.sh` restores into a throwaway container and decrypts a sample to prove the key still matches — because a restore that succeeds and produces unreadable data is the failure nobody notices. ([ADR 0007](docs/adr/0007-backup-and-disaster-recovery.md))

> **Back up your encryption key, separately from your data.** Without it, your backups are noise. This is the most likely way to lose a Ledgr install: perfect nightly archives, no copy of the key. `scripts/export-keys.sh` exists for exactly this, and deliberately makes you do it by hand.

Column encryption defends against stolen dumps, leaked backups and disk theft. It does **not** defend against a compromised API process, which necessarily holds the key.

## Roadmap

Email first, deliberately — it's the half you use every day, so it's the half that makes the app worth opening.

| Phase | Scope                                                                         | State |
| ----- | ----------------------------------------------------------------------------- | ----- |
| 1     | Monorepo scaffold, CI, licensing                                              | ✅    |
| 2     | Data model, encryption, migrations, compose stack, backups                    | 🔨    |
| 3     | **Email client** — OAuth connect, sync, inbox, threads, compose, send, drafts | ⬜    |
| 4     | Entities and threads — linking correspondence to the vendors it's about       | ⬜    |
| 5     | **Finance core** — categories, subscriptions, bills, vendor switching         | ⬜    |
| 6     | OCR + AI extraction + review queue                                            | ⬜    |
| 7     | Calendar + contacts sync                                                      | ⬜    |

Phase 3 is the first release worth living in. Phase 5 is where the category-vs-vendor thesis becomes real.

Deferred on purpose: SaaS hosting (same codebase, different deployment profile) and native mobile (responsive PWA first, native only if usage justifies it).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Project scope and rationale live in [PROJECT.md](PROJECT.md); design decisions and their trade-offs are recorded in [docs/adr/](docs/adr/).

## Licence

[AGPL-3.0-only](LICENSE).

Self-host it, modify it, run it for your household — freely. The AGPL's network clause means that if you offer Ledgr to others as a hosted service, your modifications have to be shared back. That protects the project from being taken closed-source while leaving every self-hosting user completely unrestricted.

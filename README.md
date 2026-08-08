# Ledgr

An open-source, self-hostable **personal CRM** that tracks your relationships, communication, and finances with the companies and vendors in your life.

Not a sales CRM. Not an email client.

> **Status: pre-alpha.** The scaffold boots and the data model is settled; features are landing phase by phase (see [Roadmap](#roadmap)). Not yet ready to trust with real data.

## The idea

Every subscription tracker conflates two different things: **what you're paying for** and **who you're paying**. So the day you switch from one power company to another, your spending history breaks in half. You lose the answer to the only question that matters — *"am I spending more on power than I was two years ago?"*

Ledgr separates them:

- **Category** — the persistent thing you're tracking. *Power.* *Broadband.* *Home insurance.*
- **Entity** — the vendor you currently pay for it. *Octopus Energy.*
- **Subscription** — a dated link between the two.

Switching providers closes one Subscription and opens another under the same Category. Spend continuity survives, and the switch itself becomes a first-class, graphable event rather than a gap in your records.

On top of that sits the relationship half: threads for ongoing issues ("the boiler warranty dispute"), a normalised log of emails and calls per vendor, and receipts that file themselves against the right Category automatically.

## What makes it different

No existing tool combines all of these. The closest in each column, for the record:

| Capability | Ledgr | Closest alternative |
|---|:---:|---|
| Relationship / communication tracking | ✅ | Monica — people-focused, no finance or vendor tracking, manual entry only |
| Category-vs-vendor subscription tracking | ✅ | Wallos — household support, but no category/vendor separation |
| OCR + AI receipt extraction | ✅ | SubOS — small and early |
| Household multi-tenancy | ✅ | Wallos |
| Email + calendar sync over open protocols | ✅ | — |

Traditional open-source CRMs (SuiteCRM, EspoCRM, Corteza) are sales-pipeline shaped, which is explicitly not this.

## Architecture

Three decoupled layers, so that adding a native mobile app later is *"just another client"* rather than a rewrite.

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

- **The sync layer speaks protocols, not vendor APIs.** IMAP, CalDAV, CardDAV — so Gmail, Fastmail, iCloud, and self-hosted mail all work through one code path instead of one OAuth integration each.
- **Email is read-only, and stays that way.** Ledgr links, extracts, and files. It does not compose, thread, or reimplement SMTP. That boundary is what stops this becoming "build an email client" instead of "build a personal CRM".

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router) + Fluent UI v9 |
| Core API | NestJS 11, JWT bearer auth |
| Sync worker | NestJS standalone + BullMQ |
| Database | PostgreSQL 17 + Prisma 7 |
| Attachments | MinIO (S3-compatible) |
| OCR | Tesseract |
| Extraction | Claude (`claude-opus-5`) with structured outputs |

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

Then open <http://localhost:3000>.

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

## Roadmap

| Phase | Scope | State |
|---|---|---|
| 1 | Monorepo scaffold, CI, licensing | 🔨 |
| 2 | Data model, migrations, compose stack | ⬜ |
| 3 | **Finance core** — entities, categories, subscriptions, bills, vendor switching | ⬜ |
| 4 | Communications, threads, attachments, IMAP sync | ⬜ |
| 5 | OCR + AI extraction + review queue | ⬜ |

Phase 3 is the first genuinely usable release: the category-vs-vendor model works end to end without sync or OCR ever being switched on.

Deferred on purpose: SaaS hosting (same codebase, different deployment profile) and native mobile (responsive PWA first, native only if usage justifies it).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Project scope and rationale live in [PROJECT.md](PROJECT.md); design decisions and their trade-offs are recorded in [docs/adr/](docs/adr/).

## Licence

[AGPL-3.0-only](LICENSE).

Self-host it, modify it, run it for your household — freely. The AGPL's network clause means that if you offer Ledgr to others as a hosted service, your modifications have to be shared back. That protects the project from being taken closed-source while leaving every self-hosting user completely unrestricted.

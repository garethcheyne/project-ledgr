# Ledgr

An open-source, self-hostable personal CRM that tracks relationships, communication, and finances with companies/vendors — including a full email client, so it's somewhere you can live rather than somewhere you visit. Not a sales CRM.

**Core differentiator:** separates what you're tracking (a category, e.g. "Power") from who you pay (a vendor, e.g. "Octopus Energy"), so switching providers is a first-class, graphable event rather than breaking spend continuity.

## Competitive Gap

No existing tool combines all of:

- Relationship/communication tracking (closest: Monica — PHP/Laravel, self-hosted, people-focused, no finance/vendor tracking, manual entry only)
- Category-vs-vendor subscription tracking (closest: Wallos — PHP/SQLite, self-hosted, household member support, no relationship/communication tracking, no category/vendor separation)
- OCR + AI receipt extraction (closest: SubOS — small/early project, Python/React)
- Household multi-tenancy + email/calendar sync in one package
  Traditional open-source CRMs (SuiteCRM, EspoCRM, Corteza) are sales-pipeline shaped and explicitly not what this is.

**Market reality check:** audience is self-hosted/homelab-adjacent (r/selfhosted scale — thousands to low tens of thousands of engaged users), not mass market. "Open source now, SaaS later" has precedent (n8n, Cal.com) but no guarantee — validate demand before assuming the pivot. Part of this audience self-hosts specifically to avoid SaaS/cloud, so a future SaaS pivot could alienate early adopters if not handled carefully. Keep the self-host path fully alive.

## Core Data Model

- **Entities** — vendors/companies (lifecycle: active/inactive relationship)
- **Categories/Services** — the persistent thing being tracked (Power, Broadband, Insurance), independent of vendor
- **Subscriptions/Accounts** — join table: Entity ↔ Category for a date range. A vendor switch = closing one Subscription, opening another under the same Category. Switch events and category-over-time graphs fall out of this naturally.
- **Threads/Cases** — trackable unit for an issue/dispute with a vendor (e.g. "boiler warranty issue")
- **Communications** — normalized log of emails/calls/notes, linked to Entity and optionally a Thread
- **Attachments** — from email or upload, linked to Communications, tagged (receipt, contract, correspondence)
- **Bills/Receipts** — specialized attachment, linked to a Subscription (inherits vendor + category automatically)

## OCR/AI Pipeline

Upload or email attachment → OCR (Tesseract) → LLM structured extraction (vendor, amount, billing period, category) → manual human-in-the-loop confirm step before committing to DB. Fuzzy-match vendor names against existing Entities to avoid duplicates. Auto-categorization is a suggestion, not auto-committed, in MVP.

## Architecture

Three decoupled layers so a native mobile app later is "just another client," not a rewrite:

1. **Core API** — all business logic, versioned, auth via tokens (not session-in-cookie-only)
2. **Sync service** — standalone worker behind a single `MailProvider` adapter interface, with three implementations: Gmail API, Microsoft Graph, and IMAP/SMTP (plus CalDAV/CardDAV for providers without an API). Nothing above the interface knows which provider it's talking to. See [ADR 0008](docs/adr/0008-native-provider-apis.md).
3. **Web frontend** — Next.js, just one client of the Core API

**Scope revised:** Ledgr is now a _full_ email client — compose, reply, drafts, folders, threading, send — not read-and-extract only. The original scope explicitly excluded this to avoid becoming "build an email client instead of a personal CRM", and that risk is real and acknowledged: this is the single largest piece of work in the project. It is accepted because a CRM you have to leave in order to reply is one you visit rather than live in, and the reply never gets logged against the vendor. Contained by sequencing (email ships before the finance core so the everyday half exists first), by using established libraries rather than reimplementing protocols, and by a hard boundary: **Ledgr connects to your mailbox, it does not run a mail server.** See [ADR 0005](docs/adr/0005-full-email-client.md).

## Deployment Model

- Local-first, Docker Compose from day one: web, api, sync-worker, postgres, minio (attachments), redis (job queue), backup
- Multi-tenancy (`household_id` on every table) designed in from the start, even for single-user local installs — retrofitting later is expensive
- **Encrypted at rest** — AES-256-GCM column encryption with envelope keys, so a leaked dump or backup is ciphertext. Not end-to-end: the server must be able to read mail and receipts for sync, OCR and extraction to work at all. See [ADR 0006](docs/adr/0006-encryption-at-rest.md).
- **Backup and DR** — encrypted `pg_dump` + MinIO sync, local by default with an optional remote target, plus a restore runbook and an automated restore _verification_. The encryption key is backed up separately from the data, on purpose. See [ADR 0007](docs/adr/0007-backup-and-disaster-recovery.md).
- SaaS hosting deferred to a later phase (same codebase, different deployment profile — managed infra + billing layer)
- Native mobile app deferred — responsive PWA first, native app only if usage justifies it

## Stack Decisions

- **Frontend:** Next.js 16 (App Router) + Fluent UI v9 — frontend only, never touches the database
- **Database:** Postgres 17 (JSONB for flexible metadata) + Prisma 7
- **Backend:** TypeScript / NestJS 11 — see [ADR 0001](docs/adr/0001-backend-language.md). C#/.NET was the closest alternative and a genuine personal fit; passed over because it splits the stack in two (no shared types with the frontend, EF Core instead of Prisma).
- **Mail:** Gmail API · Microsoft Graph · IMAP/SMTP, behind one adapter interface
- **Extraction:** Claude `claude-opus-5` with structured outputs — one Zod schema defines both the model's output contract and the API's validation

## Naming

Project name settled: **Ledgr** (chosen over Docket, Threadline, Ledgerly, LedgerBox, etc. — avoids trademark collision with "Ledger" hardware wallet company and "Ledgy" cap-table tool).

## Resolved Decisions

Recorded as ADRs in [`docs/adr/`](docs/adr/); the rationale and what was rejected live there.

1. **Backend language — TypeScript/NestJS.** C#/.NET was the closest alternative and a genuinely strong personal fit; passed over because it splits the stack (no shared types with the frontend, EF Core instead of Prisma). See [ADR 0001](docs/adr/0001-backend-language.md).
2. **Three-layer architecture, Next.js frontend-only.** The web app never touches the database; enforced by lint rule, not convention. See [ADR 0002](docs/adr/0002-three-layer-architecture.md).
3. **Category/vendor separation.** `Bill` stores no vendor — it resolves through `Subscription` by date. See [ADR 0003](docs/adr/0003-category-vendor-separation.md).
4. **Licence — AGPL-3.0-only.** Protects a future hosted offering without restricting self-hosters at all. See [ADR 0004](docs/adr/0004-agpl-licence.md).
5. **LLM provider — Anthropic only** (`claude-opus-5`), using structured outputs so one Zod schema defines both the model's output contract and the API's validation.
6. **GitHub repo** — `garethcheyne/project-ledgr`, public, AGPL-3.0.
7. **Full email client**, superseding the original read-and-extract-only scope. See [ADR 0005](docs/adr/0005-full-email-client.md).
8. **Encryption at rest** — application-layer column encryption, AES-256-GCM with envelope keys. Not end-to-end, because the server must read mail and receipts for sync, OCR and extraction to function. See [ADR 0006](docs/adr/0006-encryption-at-rest.md).
9. **Backup and DR** — encrypted, local-by-default with an optional remote, key backed up separately, restores verified automatically. See [ADR 0007](docs/adr/0007-backup-and-disaster-recovery.md).
10. **Native provider APIs** (Gmail, Graph) over open protocols, with IMAP retained as the fallback adapter. Amends the original "protocols not vendor APIs" principle. See [ADR 0008](docs/adr/0008-native-provider-apis.md).
11. **Build order — email before finance.** The everyday half ships first so the app is worth opening while the differentiating half is built.

## Open Decisions / Next Steps

1. **Google security assessment** for restricted Gmail scopes — required before Ledgr can ship its own OAuth credentials and offer a one-click Connect to ordinary users. Until then, operators register their own app. Design already treats client credentials as configuration, so this is a config change rather than a refactor.
2. **Publish the Google OAuth app early** (even unverified). Apps left in "Testing" status expire refresh tokens after 7 days, which means re-authorising weekly during dogfooding.
3. Sync data-flow design (provider message → Communication + Attachment + possible Bill) — shape is planned, unvalidated against a real mailbox
4. Domain / npm / GitHub-org availability check for "Ledgr" — **not yet done, and worth doing before package names are published**
5. Threading strategy for the IMAP adapter — `References` chains are unreliable in the wild and need a subject+time fallback; Gmail and Graph give this for free, which is part of why they're primary
6. Whether a local-LLM option (Ollama / OpenAI-compatible endpoint) is needed for the privacy-motivated slice of the self-hosted audience — deferred, currently Anthropic-only

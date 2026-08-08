# Ledgr

An open-source, self-hostable personal CRM that tracks relationships, communication, and finances with companies/vendors. Not a sales CRM, not a full email client.

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
2. **Sync service** — standalone worker, built on protocols not vendor APIs: IMAP (email), CalDAV (calendar), CardDAV (contacts) — generalizes across Gmail/Fastmail/iCloud/self-hosted mail rather than locking to one vendor's OAuth quirks. IMAP IDLE / CalDAV sync-collection for near-real-time sync instead of naive polling.
3. **Web frontend** — Next.js, just one client of the Core API
Deliberately scoped as email integration (read + link + extract), explicitly NOT a full email client (compose/threading/IMAP-SMTP-from-scratch), to avoid the project becoming "build an email client" instead of "build a personal CRM."

## Deployment Model

- Local-first, Docker Compose from day one: web, api, sync-worker, postgres, minio (attachments), redis (job queue)
- Multi-tenancy (`household_id` on every table) designed in from the start, even for single-user local installs — retrofitting later is expensive
- SaaS hosting deferred to a later phase (same codebase, different deployment profile — managed infra + billing layer)
- Native mobile app deferred — responsive PWA first, native app only if usage justifies it
## Stack Decisions

- **Frontend:** Next.js + Fluent UI
- **Database:** Postgres (JSONB for flexible metadata fields) + Prisma
- **Backend language:** not yet decided — candidates:
  - **TypeScript/NestJS** — shared types with Next.js frontend, strong IMAP/CalDAV/LLM ecosystem, weaker raw concurrency
  - **Go** — better concurrency for sync-worker, single static binary, thinner OCR/LLM ecosystem
  - **C#/.NET (ASP.NET Core + EF Core)** — strong decoupled-API ergonomics, excellent MailKit library for IMAP, good concurrency, leverages existing C# fluency from D365 plugin work — flagged as a genuinely strong personal fit, not just an option
Recommendation: keep Next.js as frontend-only regardless of backend language choice, with the Core API as a fully separate deployable service.

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

## Open Decisions / Next Steps

1. Sync-worker data flow design (IMAP message → Communication + Attachment + possible Bill) — shape is planned, unvalidated against a real mailbox
2. Domain / npm / GitHub-org availability check for "Ledgr" — **not yet done, and worth doing before package names are published**
3. Validate real demand (r/selfhosted post, or personal dogfooding of the phase-3 finance core) before committing to the full build
4. Whether a local-LLM option (Ollama / OpenAI-compatible endpoint) is needed for the privacy-motivated slice of the self-hosted audience — deferred, currently Anthropic-only


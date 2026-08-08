# 0001 — Backend language: TypeScript / NestJS

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

PROJECT.md left the backend language open with three candidates: TypeScript/NestJS, Go, and C#/.NET. The frontend was already settled as Next.js + Fluent UI, and the database as Postgres + Prisma.

The backend has three distinct jobs, and they pull in different directions:

1. A conventional CRUD/business-logic API.
2. A sync worker holding long-lived IMAP IDLE and CalDAV connections.
3. An OCR + LLM extraction pipeline.

## Decision

**TypeScript with NestJS**, in a pnpm monorepo shared with the Next.js frontend.

## Rationale

The deciding factor is the type boundary between API and web. Every request and response shape is defined once as a Zod schema in `packages/contracts` and consumed by both sides. A change to an API contract becomes a compile error in the frontend rather than a runtime surprise — and given how much of this product is CRUD over a fiddly relational model, that feedback loop is where most of the day-to-day time goes.

The OCR/LLM ecosystem also matters more than it first appears. The Anthropic SDK's structured-output helpers let the _same_ Zod schema define the LLM's output contract and the API's validation. In Go or C# that becomes two definitions that can drift, and drift between "what the model returns" and "what we accept" is exactly the kind of bug that surfaces as a corrupted ledger row weeks later.

## What we gave up

**C#/.NET was the closest call**, and PROJECT.md was right to flag it as a genuinely strong personal fit rather than a token option. Existing C# fluency from D365 plugin work is real leverage, MailKit is the best IMAP library in any ecosystem — not merely competitive, actually best — and ASP.NET Core's decoupled-API ergonomics are excellent.

We passed on it because it splits the stack in two: no shared types with the frontend, and Prisma would be swapped for EF Core, meaning two ORMs' worth of context. For a solo-maintained project where the frontend and backend churn together, that tax is paid on every feature.

**Go** has the best concurrency story for the sync worker and ships as a single static binary, which genuinely suits self-hosting. But its OCR/LLM ecosystem is the thinnest of the three, it means no Prisma, and it has the least overlap with existing fluency.

## Consequences

- Node's concurrency is weaker than Go's or C#'s for the sync worker. Mitigated by BullMQ: sync work is queued and horizontally scalable by running more worker containers, so the ceiling is process count rather than threads-per-process. If a single household ever saturates one worker, that is a good problem and a solvable one.
- Node IMAP libraries are rougher than MailKit. `imapflow` is the best of them and supports IDLE properly. Accepted as the main cost of this decision.
- Next.js stays frontend-only regardless. The Core API is a separately deployable service, not a set of Next route handlers — see [0002](0002-three-layer-architecture.md).

# 0002 — Three-layer architecture, and why Next.js stays frontend-only

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Next.js can host a backend. Server Actions, route handlers, and direct database access from server components make it entirely possible to build Ledgr as a single Next application with Prisma imported straight into the web app. That is the path of least resistance and it would work.

PROJECT.md also states a goal that quietly rules it out: a native mobile app later should be _"just another client, not a rewrite."_

## Decision

Three decoupled layers, deployed as three containers:

1. **Core API** (`apps/api`) — all business logic, versioned under `/api/v1`, bearer-token auth.
2. **Sync worker** (`apps/sync-worker`) — standalone process, no HTTP listener, BullMQ consumers.
3. **Web** (`apps/web`) — Next.js, one client of the Core API among eventual others.

`apps/web` must never import Prisma or `@ledgr/db`. An ESLint `no-restricted-imports` rule enforces this at build time.

## Rationale

If business logic can live in the web app, it will. Not through bad intent — through a hundred individually reasonable shortcuts, each one a small piece of logic that was faster to write in a server component than to add as an endpoint. By the time a second client exists, "just another client" has become "reimplement everything the web app knows."

The ESLint rule exists because this boundary cannot be maintained by discipline alone. It has to fail the build.

The sync worker is separate for a different reason: it does work that has no HTTP request to attach to. IMAP IDLE holds a socket open for hours; OCR is CPU-bound for seconds at a time. Neither belongs in a request/response lifecycle, and both would be actively hostile to a serverless deployment model.

## Consequences

- **More boilerplate.** Adding a field means touching a Prisma model, a Zod contract, an API endpoint, and the web client. Server Actions would be one file. This is the cost, paid per feature, and it is the point.
- **Auth is token-based, not session-cookie-only.** A cookie-only design would work for the browser and immediately break for a mobile client or CLI.
- **The web app can still be deployed anywhere**, including a hosted platform, precisely because it holds no server-side secrets and no database connection. That option stays open without being taken now.
- **Self-hosting stays the primary target.** Docker Compose is the distribution channel, not an afterthought — a meaningful part of this audience self-hosts specifically to avoid SaaS.

## Rejected

**Single Next.js app with Server Actions and direct Prisma access.** Faster to build, and correct for a product that will only ever have a web UI. Rejected because it forecloses the mobile path that PROJECT.md explicitly wants left open, and because unwinding it later means moving business logic out of the UI layer — the most expensive refactor in the shape of this project.

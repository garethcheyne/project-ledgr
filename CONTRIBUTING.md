# Contributing to Ledgr

Thanks for looking. Ledgr is early — the fastest way to help right now is to try self-hosting it and tell us where it breaks or where the model doesn't fit how you actually live.

## Getting set up

```bash
pnpm install
pnpm db:generate
docker compose up postgres redis minio -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Before opening a PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Architectural rules

These three are load-bearing. A change that breaks one needs an ADR arguing why, not just a green test run.

**1. The web app never touches the database.**
`apps/web` talks to the Core API over HTTP, like any other client. This is what keeps "a native app later is just another client" true instead of aspirational. An ESLint rule enforces it; if you hit that rule, the fix is to add an API endpoint, not to add an exception.

**2. Every table carries `householdId`.**
Multi-tenancy is designed in from the start, even for single-user installs, because retrofitting it later means touching every query in the codebase. Scoping is applied centrally in a Prisma client extension — don't hand-roll `where: { householdId }` per query, and don't bypass the extension.

**3. Bills never store a vendor.**
A `Bill` points at a `Subscription`, which resolves vendor *and* category by date. This is the whole product thesis: it's what keeps spend continuity intact when someone switches providers. A denormalised `vendorId` on `Bill` would silently break vendor-switch history, and it would break it quietly — the tests to watch are the vendor-switch continuity ones.

## Commits and branches

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), branches as `feat/short-description`. Keep PRs to one concern.

## Tests

New behaviour needs a test. Two areas where we're strict, because both fail silently in production:

- **Tenancy scoping** — a query that can escape its household is a data breach, not a bug.
- **Subscription date ranges** — overlap and continuity rules across a vendor switch.

## Design decisions

Anything with a real trade-off gets an ADR in [`docs/adr/`](docs/adr/). Copy the format of an existing one; record what was rejected and why, since that's the part nobody can reconstruct later.

## Licence

Contributions are licensed under [AGPL-3.0-only](LICENSE), matching the project.

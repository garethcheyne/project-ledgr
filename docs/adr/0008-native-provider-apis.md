# 0008 — Native provider APIs, with IMAP as the fallback adapter

- **Status:** Accepted
- **Date:** 2026-08-09
- **Amends:** the "protocols, not vendor APIs" principle in PROJECT.md
- **Related:** [ADR 0005](0005-full-email-client.md)

## Context

PROJECT.md committed to open protocols — IMAP, CalDAV, CardDAV — to *"generalize across Gmail/Fastmail/iCloud/self-hosted mail rather than locking to one vendor's OAuth quirks."*

That was correct for a read-and-extract integration. It is not sufficient for a client people live in ([ADR 0005](0005-full-email-client.md)). IMAP cannot represent what makes a modern mail client feel modern:

| | IMAP | Gmail API / Microsoft Graph |
| --- | --- | --- |
| Threading | Reconstructed from `References` headers, frequently malformed | Authoritative server-side thread IDs |
| Labels | Folders only; Gmail labels emulate badly (one message → three folders) | Native |
| Search | `SEARCH` — slow, inconsistent, often unindexed | Server-side and indexed |
| New mail | IDLE — one held socket per folder, silently dropped by NAT | Webhooks / change subscriptions |
| Sent mail | Manual `APPEND` after SMTP; duplicates or vanished mail depending on server | Provider files it |
| Calendar + contacts | Separate CalDAV/CardDAV stacks | Same API, same OAuth grant |

The sent-mail row alone justifies the change: under IMAP, getting a sent message correctly into the Sent folder is a per-server guessing game whose failure modes look like data loss to the user.

The last row is the one that was missed the first time round. **IMAP is mail only** — it has no notion of calendars or contacts, so open protocols mean three separate stacks (IMAP + CalDAV + CardDAV) and three separate credentials. Microsoft Graph covers mail, calendar and contacts in a single API behind a single consent; Google covers the same ground with Gmail, Calendar and People APIs behind one consent screen.

## Decision

**Native provider APIs are the primary path.** A `MailProvider` adapter interface with three implementations:

1. **`GoogleProvider`** — Gmail API, Calendar API, People API. OAuth 2.0. Push via `users.watch` + Pub/Sub.
2. **`MicrosoftProvider`** — Microsoft Graph (mail, calendar, contacts). OAuth 2.0. Change-notification subscriptions.
3. **`ImapProvider`** — IMAP + SMTP, with CalDAV/CardDAV alongside. The fallback for Fastmail, iCloud, Proton Bridge, and every self-hosted server, none of which have an API.

IMAP is not dropped, only demoted. A large share of the self-hosted audience has no alternative, and excluding them would exclude the people most likely to run this.

**POP3 is not supported and will not be.** Download-and-delete, one folder, no flags, no server-side state — read/unread wouldn't survive across devices.

## OAuth credentials are a configuration source, not a code path

This is the part that has to be designed correctly now, because it determines whether the eventual security review is a config change or a refactor.

Ledgr resolves OAuth client credentials from configuration and does not care where they came from:

| Tier | Client ID/secret from | Who this is for | Status |
| --- | --- | --- | --- |
| **Bring-your-own** | Operator's own Google Cloud / Azure app, via `.env` | Developers and self-hosters today | Now |
| **Ledgr-provided** | A verified Ledgr OAuth app | Everyone; "Connect" just works | After security assessment |
| **No OAuth** | — | IMAP with an app password | Now |

**The `Connect` flow is identical across tiers.** The user clicks *Connect Google*, consents, and Ledgr stores the tokens. Only the source of the client ID changes. When the security assessment is passed, shipping default credentials is a configuration default — no user-facing change, no migration, no rewrite.

Design rules that follow:
- Never hard-code a client ID anywhere. Always read from config, with per-provider optional presence — an absent client ID means that provider is simply not offered on the connect screen.
- Model the `Connect` UI around providers being *available* or *not available*, never around "you must first create a Google Cloud project". That message belongs in a setup guide, surfaced only when the provider is unconfigured.

## Known friction, so it isn't a surprise later

- **Gmail mail scopes are *restricted*.** Production use by a published app requires annual independent security assessment (five figures). Planned, not yet held.
- **Testing-mode refresh tokens expire after 7 days.** A Google OAuth app in "Testing" publishing status invalidates refresh tokens weekly, meaning re-authorisation every week — genuinely painful for daily dogfooding. Publishing the app (even unverified) removes the expiry, at the cost of an "unverified app" interstitial and a 100-user cap. **Publish early, verify later.**
- **Push needs a public HTTPS endpoint.** Gmail requires Pub/Sub, Graph requires a reachable webhook. Installs behind CGNAT degrade to polling automatically rather than failing.
- **Three adapters, three sets of sync edge cases.** Mitigated by a shared conformance suite every adapter must pass, so provider-specific bugs surface in CI rather than in someone's inbox.

## Consequences

- `MailAccount` gains `provider`, encrypted OAuth access/refresh tokens, token expiry, and granted scopes ([ADR 0006](0006-encryption-at-rest.md)). IMAP/SMTP fields become provider-specific and optional.
- OAuth refresh tokens are long-lived credentials to an entire mailbox. Encrypted at rest, never logged. A leaked Ledgr database must not yield mailbox access.
- New env vars, all optional: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`.
- Calendar and contacts arrive with the same OAuth grant on Google and Microsoft, so those features get materially cheaper than the CalDAV/CardDAV route would have been.
- Setup guides required per provider: `docs/setup/google-oauth.md`, `docs/setup/microsoft-oauth.md`, `docs/setup/imap.md`.

## Rejected

**Open protocols only (IMAP/CalDAV/CardDAV).** Zero OAuth setup for Google, iCloud, Fastmail and self-hosted; two-minute onboarding. Rejected because it caps the client's quality permanently — reconstructed threading, fragile sent-mail, slow search — and because Microsoft retired basic auth for IMAP/SMTP anyway, so Outlook needs OAuth regardless. The setup cost is paid once by the operator; the quality cost would be paid daily by every user.

**Provider APIs only, no IMAP.** ~30% less sync code and a uniformly good experience. Rejected outright: excludes Fastmail, iCloud, Proton and all self-hosted mail — most of the intended audience.

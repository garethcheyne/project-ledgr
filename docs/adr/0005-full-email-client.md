# 0005 — Ledgr is a full email client

- **Status:** Accepted
- **Date:** 2026-08-09
- **Supersedes:** the email-scope boundary in PROJECT.md ("explicitly NOT a full email client")

## Context

The original scope was deliberately narrow: read email, link it to vendors, extract receipts from attachments. No compose, no threading, no SMTP. PROJECT.md gave a clear reason — _"to avoid the project becoming 'build an email client' instead of 'build a personal CRM.'"_

That reasoning was sound and is being overridden knowingly.

The counter-argument is a product one. A CRM that can _read_ your correspondence but bounces you to Gmail to reply is a CRM you visit occasionally, not one you work in. The vendor relationship is the product, and half of a relationship is what you send. If replying means leaving, the context — which thread, which subscription, which dispute — is lost at exactly the moment it's most useful, and the sent message never gets logged against the vendor at all.

So: Ledgr becomes somewhere you can live.

## Decision

Ledgr is a full email client: read, compose, reply, forward, drafts, folders, flags, search, and SMTP delivery — with every message still linked to entities, threads, subscriptions and bills the way inbound mail already is.

## The risk, stated plainly

**This is the single largest scope increase in the project, and it is bigger than the finance core.** Email clients are a genre notorious for consuming projects. The specific hazards, none of them optional to solve once you accept compose:

- **Sent-mail reconciliation.** After SMTP delivery you must `APPEND` to the IMAP Sent folder yourself. Many servers don't do it for you; some do it automatically and you get duplicates. Both failure modes look like data loss to the user.
- **Threading.** RFC 5322 `References`/`In-Reply-To` chains are frequently malformed in the wild. Every client falls back to subject-and-time heuristics eventually.
- **MIME.** Generating correct multipart messages with inline images, alternative text/HTML parts, and attachments is genuinely fiddly, and the failure mode is a mangled message in someone else's inbox.
- **Deliverability.** Mail sent from a self-hosted box lands in spam unless SPF, DKIM and DMARC are right. This is largely outside our control and will be reported to us as a Ledgr bug.
- **Offline and conflict.** Flags changed in two clients, a draft edited in two places, `UIDVALIDITY` changing mid-sync.

## How we contain it

1. **Provider APIs carry most of the load.** Gmail and Graph supply authoritative threading and file sent mail themselves, which removes the two worst hazards above outright ([ADR 0008](0008-native-provider-apis.md)). They apply in full only to the IMAP adapter.
2. **Established libraries, no protocol re-implementation.** `googleapis` and `@microsoft/microsoft-graph-client` for the API providers; `imapflow`, `nodemailer`, `mailparser` and `mimetext` for IMAP. We are assembling a client, not writing one from the socket up.
3. **Send is a queued job with explicit delivery state**, not a fire-and-forget call in a request handler. Every outbound message has a durable row and a status; a failed send is visible and retryable rather than silently gone. The same row tracks whether the sent copy has been filed, so the IMAP `APPEND` problem can't produce duplicates.
4. **We do not run a mail server.** Ledgr connects to the mailbox you already have. No MX records, no inbound MTA, no spam filtering, no deliverability reputation to manage. This is the boundary that keeps the scope finite, and it is not up for revision.

**Sequencing note:** the email client ships _first_ (phase 3), ahead of the finance core. Earlier drafts of this ADR put it last, on the reasoning that the differentiating half should exist before the expensive half begins. That was reversed deliberately: the mail client is what makes the app worth opening daily, and dogfooding it is the fastest way to find out whether the whole premise holds. The risk this accepts is that the project's _distinctive_ feature — category-vs-vendor tracking — is the last thing built rather than the first.

## Consequences

- New models: `MailFolder` (per-folder `uidValidity` — it belongs on the folder, not the account, and putting it on the account silently corrupts multi-folder sync), `MailThread`, `Message`, `Draft`, `OutboundMessage`, `MessageSearchTerm`.
- **`Message` is separate from `Communication`.** Email needs folders, flags, UIDs, threading and MIME parts; phone calls and handwritten notes need almost none of that. One table holding both would be wide and mostly null, and the mail client is the part that has to stay fast. `Communication` now covers non-email interactions only.
- The CRM's issue tracker is modelled as `Case`, not `Thread`, so it can't be confused with `MailThread` — two very different things that would otherwise share a name.
- Message bodies, subjects and participants are encrypted ([ADR 0006](0006-encryption-at-rest.md)), which makes conventional full-text search impossible. `MessageSearchTerm` holds HMAC'd word hashes instead: exact whole-word matching works, prefix and substring search do not.

## Rejected

**Compose-only-as-reply-in-thread** (a reply box on a Thread, no folders, no inbox). Roughly a fifth of the work and captures most of the CRM value, since replies get logged against the vendor automatically. Rejected because it doesn't meet the stated goal — you still can't live in the app, and you'd still have Gmail open in another tab. Worth revisiting only if phase 5 proves as expensive as feared.

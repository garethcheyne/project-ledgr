# Connecting Gmail

Ledgr connects to Gmail over IMAP with an **app password**. No Google Cloud project, no OAuth consent screen, no security assessment — about three minutes, once.

> **Why an app password and not "sign in with Google"?** Gmail's mail scopes are _restricted_: a published app using them needs an annual third-party security assessment costing five figures, which no open-source self-hosted project can ship credentials for. An app password sidesteps that entirely and works today. OAuth support is planned — see [ADR 0008](../adr/0008-native-provider-apis.md).

## 1. Turn on 2-Step Verification

Google **hides the app-passwords page entirely** until 2-Step Verification is on. If you can't find it, this is almost always why.

1. Go to <https://myaccount.google.com/security>
2. Under _How you sign in to Google_, choose **2-Step Verification**
3. Follow the prompts

## 2. Create an app password

1. Go to <https://myaccount.google.com/apppasswords>
2. Give it a name — `Ledgr` is fine
3. Click **Create**
4. Copy the 16-character password

It's shown **once**. If you lose it, delete it and make another; there's no way to view it again.

The spaces Google displays are for readability. Ledgr accepts it with or without them.

## 3. Connect it in Ledgr

1. Open **Settings → Mail accounts**
2. Click **Connect mailbox**
3. Enter your Gmail address — the server settings fill in automatically
4. Paste the app password
5. Click **Test connection** to check it before saving
6. Click **Connect**

Ledgr uses these automatically, so you shouldn't need to type them:

| Setting   | Value                   |
| --------- | ----------------------- |
| IMAP host | `imap.gmail.com`        |
| IMAP port | `993` (TLS)             |
| SMTP host | `smtp.gmail.com`        |
| SMTP port | `465` (TLS)             |
| Username  | your full Gmail address |

## Troubleshooting

**"The server rejected those credentials"**
You almost certainly used your normal Google password. Gmail rejects it over IMAP — you need the 16-character app password from step 2.

**The app-passwords page says "the setting you are looking for is not available"**
2-Step Verification isn't on, or you're signed in to a Workspace account whose administrator has disabled app passwords. For the latter, ask your admin to allow them.

**Workspace account, and it still fails**
An administrator can disable IMAP for the whole domain. In the Google Admin console that's _Apps → Google Workspace → Gmail → End User Access → IMAP access_.

**Connected, but "polling only" rather than "push"**
Gmail supports IDLE, so this normally shouldn't happen. It usually means something between you and Google is closing idle connections — Ledgr falls back to polling automatically and still works, just with a delay.

## What Ledgr does with the password

- **Encrypted before it reaches the database**, with your household's key (AES-256-GCM). A stolen database dump or backup file yields ciphertext. See [ADR 0006](../adr/0006-encryption-at-rest.md).
- **Never returned by any endpoint.** No screen and no API response includes it.
- **Never logged.** IMAP command logging is switched off precisely because it would put credentials and message content into application logs.

To revoke access at any time, delete the app password at <https://myaccount.google.com/apppasswords>. That immediately cuts Ledgr off, with no action needed on the Ledgr side.

> **Back up your `LEDGR_ENCRYPTION_KEY`, separately from your database backups.** Without it, the stored password — and everything else encrypted — is unrecoverable noise.

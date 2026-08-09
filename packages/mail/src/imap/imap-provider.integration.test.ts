import { afterAll, describe, expect, it } from "vitest";
import { ImapProvider, type ImapConfig } from "./imap-provider.js";

/**
 * Integration tests against a real IMAP/SMTP server (GreenMail).
 *
 * Unit tests can't catch what actually goes wrong with IMAP: flag semantics,
 * UID behaviour, MIME round-tripping, and whether a sent message is filed.
 * Those only surface against a server that speaks the protocol.
 *
 * Start one with:
 *   docker run -d --name ledgr-greenmail -p 3143:3143 -p 3025:3025 \
 *     -e GREENMAIL_OPTS="-Dgreenmail.setup.test.smtp -Dgreenmail.setup.test.imap \
 *       -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users=gareth:testpass@localhost" \
 *     greenmail/standalone:2.1.0
 *
 * Skipped automatically when it isn't running, so `pnpm test` stays green on a
 * machine without Docker.
 */

const CONFIG: ImapConfig = {
  imapHost: "127.0.0.1",
  imapPort: 3143,
  // GreenMail's plain IMAP port is not TLS. Real servers are.
  imapUseTls: false,
  smtpHost: "127.0.0.1",
  smtpPort: 3025,
  smtpUseTls: false,
  username: "gareth",
  password: "testpass",
  fromAddress: "gareth@localhost",
  fromName: "Gareth Cheyne",
};

async function serverAvailable(): Promise<boolean> {
  const probe = new ImapProvider(CONFIG);
  try {
    const result = await probe.testConnection();
    return result.imap.ok;
  } catch {
    return false;
  } finally {
    await probe.dispose();
  }
}

const available = await serverAvailable();
const describeIfServer = available ? describe : describe.skip;

if (!available) {
  console.warn("GreenMail not reachable on 127.0.0.1:3143 — skipping IMAP integration tests.");
}

describeIfServer("ImapProvider against a real server", () => {
  const provider = new ImapProvider(CONFIG);

  afterAll(async () => {
    await provider.dispose();
  });

  it("connects over both protocols and reports capabilities", async () => {
    const result = await provider.testConnection();

    expect(result.imap.ok).toBe(true);
    expect(result.smtp.ok).toBe(true);
    expect(result.imap.folderCount).toBeGreaterThan(0);
    // Drives whether sync uses IDLE or falls back to polling.
    expect(typeof result.imap.supportsIdle).toBe("boolean");
  });

  it("reports a clear, actionable error for bad credentials", async () => {
    const bad = new ImapProvider({ ...CONFIG, password: "wrong-password" });
    try {
      const result = await bad.testConnection();
      expect(result.imap.ok).toBe(false);
      // The app-password hint is the single most useful thing to say here —
      // it's the usual cause with Gmail and iCloud.
      expect(result.imap.error).toMatch(/credential|app-specific/i);
    } finally {
      await bad.dispose();
    }
  });

  it("lists folders and identifies INBOX by role", async () => {
    const folders = await provider.listFolders();

    expect(folders.length).toBeGreaterThan(0);
    expect(folders.some((folder) => folder.role === "INBOX")).toBe(true);
  });

  it("sends a message and reads it back, preserving content and headers", async () => {
    const marker = `ledgr-${Date.now()}`;

    const sent = await provider.send({
      to: [{ name: "Gareth", address: "gareth@localhost" }],
      subject: `Your power bill ${marker}`,
      bodyText: "Amount due: $184.20\nDue 15 March.",
    });

    // SMTP delivery never files a Sent copy — the caller must APPEND one.
    // See docs/adr/0005-full-email-client.md.
    expect(sent.sentCopyFiled).toBe(false);

    // Delivery is asynchronous; poll rather than sleeping a fixed time.
    let found: Awaited<ReturnType<typeof provider.fetchMessages>>["messages"][number] | undefined;
    for (let attempt = 0; attempt < 10 && !found; attempt++) {
      const page = await provider.fetchMessages({ folderId: "INBOX", limit: 50 });
      found = page.messages.find((message) => message.subject.includes(marker));
      if (!found) await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(found).toBeDefined();
    expect(found?.bodyText).toContain("184.20");
    expect(found?.from?.address).toBe("gareth@localhost");
    expect(found?.to[0]?.address).toBe("gareth@localhost");
    expect(found?.snippet).toContain("Amount due");
    expect(found?.uid).toBeGreaterThan(0n);
    expect(found?.sentAt).toBeInstanceOf(Date);
  });

  it("round-trips an attachment through MIME", async () => {
    const marker = `attach-${Date.now()}`;
    const content = Buffer.from("vendor,amount\nOctopus,184.20\n", "utf8");

    await provider.send({
      to: [{ name: "Gareth", address: "gareth@localhost" }],
      subject: `Receipt ${marker}`,
      bodyText: "Receipt attached.",
      attachments: [
        { filename: "receipt.csv", contentType: "text/csv", sizeBytes: content.length, content },
      ],
    });

    let found;
    for (let attempt = 0; attempt < 10 && !found; attempt++) {
      const page = await provider.fetchMessages({ folderId: "INBOX", limit: 50 });
      found = page.messages.find((message) => message.subject.includes(marker));
      if (!found) await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(found?.hasAttachments).toBe(true);
    const attachment = found?.attachments.find((a) => a.filename === "receipt.csv");
    expect(attachment).toBeDefined();
    expect(attachment?.content.toString("utf8")).toContain("Octopus,184.20");
  });

  it("advances the cursor and returns nothing on a second pass", async () => {
    const first = await provider.fetchMessages({ folderId: "INBOX", limit: 50 });
    expect(first.nextCursor).toBeTruthy();

    // The `uid:since:*` range always returns the last message even when
    // nothing is new, so this asserts the cursor filtering actually works.
    const second = await provider.fetchMessages({
      folderId: "INBOX",
      cursor: first.nextCursor ?? undefined,
      limit: 50,
    });

    expect(second.messages).toHaveLength(0);
  });

  it("refuses to continue when UIDVALIDITY changes, rather than importing wrong messages", async () => {
    await expect(
      provider.fetchMessages({ folderId: "INBOX", cursor: "999999999:1" }),
    ).rejects.toMatchObject({ code: "UIDVALIDITY_CHANGED", retryable: false });
  });

  it("toggles read and starred flags", async () => {
    const page = await provider.fetchMessages({ folderId: "INBOX", limit: 1 });
    const message = page.messages[0];
    expect(message).toBeDefined();
    if (!message) return;

    await provider.markRead("INBOX", [message.providerMessageId], true);
    await provider.markStarred("INBOX", [message.providerMessageId], true);

    const after = await provider.fetchMessage("INBOX", message.providerMessageId);
    expect(after?.isRead).toBe(true);
    expect(after?.isStarred).toBe(true);

    await provider.markRead("INBOX", [message.providerMessageId], false);
    const unread = await provider.fetchMessage("INBOX", message.providerMessageId);
    expect(unread?.isRead).toBe(false);
  });
});

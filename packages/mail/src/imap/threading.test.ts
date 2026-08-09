import { describe, expect, it } from "vitest";
import { normaliseSubject, resolveThread, type ThreadCandidate } from "./threading.js";

describe("normaliseSubject", () => {
  it("strips reply and forward prefixes", () => {
    expect(normaliseSubject("Re: Your bill")).toBe("your bill");
    expect(normaliseSubject("FWD: Your bill")).toBe("your bill");
    expect(normaliseSubject("Fw: Your bill")).toBe("your bill");
  });

  it("strips stacked prefixes", () => {
    expect(normaliseSubject("Re: Fwd: RE: Your bill")).toBe("your bill");
  });

  it("strips non-English prefixes — mailboxes are not all in English", () => {
    expect(normaliseSubject("AW: Rechnung")).toBe("rechnung");
    expect(normaliseSubject("SV: Faktura")).toBe("faktura");
    expect(normaliseSubject("TR: Facture")).toBe("facture");
  });

  it("strips mailing-list counters like Re[2]:", () => {
    expect(normaliseSubject("Re[2]: Your bill")).toBe("your bill");
  });

  it("normalises whitespace and case", () => {
    expect(normaliseSubject("  Your   BILL  ")).toBe("your bill");
  });

  it("leaves a bare subject alone", () => {
    expect(normaliseSubject("Invoice 4471")).toBe("invoice 4471");
  });
});

function candidate(overrides: Partial<ThreadCandidate> = {}): ThreadCandidate {
  return {
    threadId: "thread-1",
    subjectKey: "your bill",
    lastMessageAt: new Date("2026-03-01T10:00:00Z"),
    messageIds: new Set(["<a@octopus>"]),
    participants: new Set(["billing@octopus.co.nz"]),
    ...overrides,
  };
}

describe("resolveThread", () => {
  it("matches on In-Reply-To", () => {
    const result = resolveThread(
      {
        inReplyTo: "<a@octopus>",
        references: [],
        subject: "Re: Your bill",
        sentAt: new Date("2026-03-02T10:00:00Z"),
        participants: ["billing@octopus.co.nz"],
      },
      [candidate()],
    );

    expect(result.threadId).toBe("thread-1");
    expect(result.matchedExisting).toBe(true);
  });

  it("matches on any entry in the References chain", () => {
    const result = resolveThread(
      {
        references: ["<root@x>", "<a@octopus>"],
        subject: "Re: Your bill",
        sentAt: new Date("2026-03-02T10:00:00Z"),
        participants: ["someone-else@example.com"],
      },
      [candidate()],
    );

    expect(result.threadId).toBe("thread-1");
  });

  it("falls back to subject + participant when headers are missing", () => {
    const result = resolveThread(
      {
        references: [],
        subject: "RE: Your bill",
        sentAt: new Date("2026-03-03T10:00:00Z"),
        participants: ["billing@octopus.co.nz"],
      },
      [candidate()],
    );

    expect(result.threadId).toBe("thread-1");
    expect(result.matchedExisting).toBe(true);
  });

  it("does NOT merge a monthly bill a year later — this is why the window exists", () => {
    const result = resolveThread(
      {
        references: [],
        subject: "Your bill",
        sentAt: new Date("2027-03-01T10:00:00Z"),
        participants: ["billing@octopus.co.nz"],
      },
      [candidate()],
    );

    expect(result.matchedExisting).toBe(false);
  });

  it("does not merge same-subject mail between unrelated people", () => {
    const result = resolveThread(
      {
        references: [],
        subject: "Your bill",
        sentAt: new Date("2026-03-02T10:00:00Z"),
        participants: ["someone@elsewhere.com"],
      },
      [candidate()],
    );

    expect(result.matchedExisting).toBe(false);
  });

  it("never groups empty subjects together", () => {
    const shared = {
      references: [],
      subject: "",
      participants: ["billing@octopus.co.nz"],
    };
    const a = resolveThread({ ...shared, sentAt: new Date("2026-03-02T10:00:00Z") }, [
      candidate({ subjectKey: "" }),
    ]);
    expect(a.matchedExisting).toBe(false);
  });

  it("gives out-of-order arrivals the same thread id via the chain root", () => {
    const first = resolveThread(
      {
        messageIdHeader: "<second@x>",
        references: ["<root@x>"],
        subject: "Re: Contract",
        sentAt: new Date("2026-03-02T10:00:00Z"),
        participants: ["a@example.com"],
      },
      [],
    );

    const second = resolveThread(
      {
        messageIdHeader: "<third@x>",
        references: ["<root@x>", "<second@x>"],
        subject: "Re: Contract",
        sentAt: new Date("2026-03-03T10:00:00Z"),
        participants: ["a@example.com"],
      },
      [],
    );

    // Both key off the same root, so they converge without either having seen
    // the other — which is what makes an out-of-order backfill safe.
    expect(first.threadId).toBe(second.threadId);
  });

  it("prefers the immediate parent when a message references several threads", () => {
    const older = candidate({ threadId: "old", messageIds: new Set(["<old@x>"]) });
    const newer = candidate({ threadId: "new", messageIds: new Set(["<new@x>"]) });

    const result = resolveThread(
      {
        inReplyTo: "<new@x>",
        references: ["<old@x>", "<new@x>"],
        subject: "Re: Merged",
        sentAt: new Date("2026-03-02T10:00:00Z"),
        participants: ["a@example.com"],
      },
      [older, newer],
    );

    expect(result.threadId).toBe("new");
  });

  it("always marks IMAP threads synthetic, so bugs are attributable", () => {
    const result = resolveThread(
      {
        references: [],
        subject: "New",
        sentAt: new Date(),
        participants: ["a@example.com"],
      },
      [],
    );
    expect(result.isSynthetic).toBe(true);
  });
});

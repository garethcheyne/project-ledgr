import { describe, expect, it } from "vitest";
import { stripHtml, stripQuotedText, tokenise, tokeniseQuery } from "./tokenise.js";

describe("tokenise", () => {
  it("lowercases and deduplicates", () => {
    const tokens = tokenise("Invoice invoice INVOICE");
    expect(tokens).toEqual(["invoice"]);
  });

  it("drops stop words", () => {
    expect(tokenise("the power bill is for the house")).not.toContain("the");
  });

  it("keeps email addresses whole and also splits their parts", () => {
    const tokens = tokenise("Sent from billing@octopus.co.nz today");
    expect(tokens).toContain("billing@octopus.co.nz");
    expect(tokens).toContain("billing");
    expect(tokens).toContain("octopus");
  });

  it("splits hyphenated compounds so both halves are findable", () => {
    const tokens = tokenise("re-issued invoice");
    expect(tokens).toContain("re-issued");
    expect(tokens).toContain("issued");
  });

  it("handles non-Latin scripts rather than dropping them", () => {
    expect(tokenise("電気料金 Ōtautahi")).toEqual(expect.arrayContaining(["電気料金", "ōtautahi"]));
  });

  it("ignores single characters and caps term count", () => {
    expect(tokenise("a b c invoice")).toEqual(["invoice"]);

    const many = Array.from({ length: 800 }, (_, i) => `word${i}`).join(" ");
    expect(tokenise(many, { maxTerms: 100 })).toHaveLength(100);
  });

  it("tokenises queries identically to content — otherwise search silently misses", () => {
    const content = tokenise("Octopus Energy invoice");
    for (const term of tokeniseQuery("OCTOPUS  invoice")) {
      expect(content).toContain(term);
    }
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>Amount: <b>$50</b>&nbsp;due</p>")).toBe("Amount: $50 due");
  });

  it("removes script and style bodies, not just their tags", () => {
    const html = "<style>.a{color:red}</style><script>alert(1)</script><p>Hello</p>";
    const text = stripHtml(html);
    expect(text).toBe("Hello");
    expect(text).not.toContain("color");
    expect(text).not.toContain("alert");
  });
});

describe("stripQuotedText", () => {
  it("drops quoted reply chains so every message in a thread isn't identical", () => {
    const body = [
      "Thanks, that resolves it.",
      "",
      "On Mon, 3 Mar 2026, Octopus Energy wrote:",
      "> We have credited your account.",
      "> Regards",
    ].join("\n");

    const stripped = stripQuotedText(body);
    expect(stripped).toBe("Thanks, that resolves it.");
    expect(stripped).not.toContain("credited");
  });

  it("cuts at a forwarded-message header", () => {
    const body = "My reply\n\n-------- Original Message --------\nold content here";
    expect(stripQuotedText(body)).toBe("My reply");
  });

  it("leaves an unquoted body untouched", () => {
    expect(stripQuotedText("Just a plain message.")).toBe("Just a plain message.");
  });
});

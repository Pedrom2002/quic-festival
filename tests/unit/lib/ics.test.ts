import { describe, expect, it } from "vitest";
import { buildFestivalIcs } from "@/lib/ics";

describe("buildFestivalIcs", () => {
  it("contém envelope VCALENDAR/VEVENT", () => {
    const ics = buildFestivalIcs("Maria");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//QUIC//Festival//PT");
  });

  it("usa CRLF entre linhas", () => {
    expect(buildFestivalIcs("M")).toContain("\r\n");
  });

  it("inclui DTSTART/DTEND ISO compactos sem ms", () => {
    const ics = buildFestivalIcs("M");
    expect(ics).toMatch(/DTSTART:20260508T170000Z/);
    expect(ics).toMatch(/DTEND:20260510T020000Z/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("escapa RFC 5545: backslash, semicolon, comma, newlines", () => {
    const ics = buildFestivalIcs("a\\b;c,d\ne\rf\r\ng");
    expect(ics).toContain("a\\\\b\\;c\\,d\\ne\\nf\\ng");
  });

  it("faz line folding > 75 octetos com CRLF + space", () => {
    const longName = "x".repeat(200);
    const ics = buildFestivalIcs(longName);
    expect(ics).toMatch(/\r\n /);
  });

  it("não dobra linhas curtas", () => {
    const ics = buildFestivalIcs("M");
    expect(ics).toContain("UID:quic-festival-2026@quic.pt");
  });
});

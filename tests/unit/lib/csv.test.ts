import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("emite BOM + CRLF", () => {
    const out = toCsv([{ a: "1", b: "2" }], ["a", "b"]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("\r\n");
  });

  it("escapa formula injection prefixes", () => {
    const out = toCsv(
      [{ x: "=cmd" }, { x: "+1+2" }, { x: "-3" }, { x: "@SUM(A1)" }, { x: "\tTab" }, { x: "\rCR" }],
      ["x"],
    );
    expect(out).toContain("'=cmd");
    expect(out).toContain("'+1+2");
    expect(out).toContain("'-3");
    expect(out).toContain("'@SUM(A1)");
    // \t e \r também escapados (e quoted por causa do \r match no regex)
    expect(out).toMatch(/'\tTab|"'\tTab"/);
  });

  it("quota células com vírgulas, aspas, newlines", () => {
    const out = toCsv(
      [{ a: 'foo, bar', b: 'she said "hi"', c: "line1\nline2" }],
      ["a", "b", "c"],
    );
    expect(out).toContain('"foo, bar"');
    expect(out).toContain('"she said ""hi"""');
    expect(out).toContain('"line1\nline2"');
  });

  it("converte null/undefined para vazio", () => {
    const out = toCsv([{ a: null, b: undefined, c: 0 }], ["a", "b", "c"]);
    expect(out.split("\r\n")[1]).toBe(",,0");
  });

  it("aceita números", () => {
    const out = toCsv([{ n: 42 }], ["n"]);
    expect(out).toContain("42");
  });

  it("body vazio quando não há rows", () => {
    const out = toCsv([], ["a"]);
    expect(out).toBe("﻿a\r\n");
  });
});

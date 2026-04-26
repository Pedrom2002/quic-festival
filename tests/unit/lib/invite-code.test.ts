import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  isValidInviteCode,
  INVITE_CODE_RE,
} from "@/lib/invite-code";

describe("invite-code", () => {
  it("generateInviteCode produces 12-char uppercase base32 (Crockford)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(INVITE_CODE_RE);
      expect(code.length).toBe(12);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it("generateInviteCode is reasonably random", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateInviteCode());
    expect(seen.size).toBe(200);
  });

  it("isValidInviteCode aceita códigos válidos", () => {
    expect(isValidInviteCode("A7B3K9X2P5Q4")).toBe(true);
    expect(isValidInviteCode("0000000000ZZ")).toBe(true);
  });

  it("isValidInviteCode rejeita comprimento errado", () => {
    expect(isValidInviteCode("A7B3K9X2P5Q")).toBe(false);
    expect(isValidInviteCode("A7B3K9X2P5Q4A")).toBe(false);
    expect(isValidInviteCode("")).toBe(false);
  });

  it("isValidInviteCode rejeita caracteres lookalike (I, L, O, U)", () => {
    expect(isValidInviteCode("A7B3KIX2P5Q4")).toBe(false);
    expect(isValidInviteCode("A7B3KLX2P5Q4")).toBe(false);
    expect(isValidInviteCode("A7B3KOX2P5Q4")).toBe(false);
    expect(isValidInviteCode("A7B3KUX2P5Q4")).toBe(false);
  });

  it("isValidInviteCode rejeita lowercase", () => {
    expect(isValidInviteCode("a7b3k9x2p5q4")).toBe(false);
  });

  it("isValidInviteCode rejeita não-string", () => {
    expect(isValidInviteCode(undefined)).toBe(false);
    expect(isValidInviteCode(null)).toBe(false);
    expect(isValidInviteCode(123)).toBe(false);
  });
});

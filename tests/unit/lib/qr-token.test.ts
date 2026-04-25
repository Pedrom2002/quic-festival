import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const SECRET = "x".repeat(32);

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signQrToken", () => {
  it("emite UUID puro quando secret ausente em dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("QR_TOKEN_SECRET", "");
    const { signQrToken } = await import("@/lib/qr-token");
    expect(await signQrToken(VALID_UUID)).toBe(VALID_UUID);
  });

  it("rejeita uuid inválido", async () => {
    const { signQrToken } = await import("@/lib/qr-token");
    await expect(signQrToken("not-a-uuid")).rejects.toThrow(/invalid uuid/);
  });

  it("emite token assinado com secret + ttl default", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID);
    expect(t).toMatch(/^[0-9a-f-]{36}\.\d+\.[A-Za-z0-9_-]+$/);
  });

  it("ttl override aplicado", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken } = await import("@/lib/qr-token");
    const before = Date.now();
    const t = await signQrToken(VALID_UUID, 5_000);
    const exp = Number(t.split(".")[1]);
    expect(exp).toBeGreaterThanOrEqual(before + 4_000);
    expect(exp).toBeLessThanOrEqual(before + 6_000);
  });

  it("throws em produção sem secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("QR_TOKEN_SECRET", "");
    const { signQrToken } = await import("@/lib/qr-token");
    await expect(signQrToken(VALID_UUID)).rejects.toThrow(/em produção/);
  });

  it("usa QR_TOKEN_TTL_MS do env quando válido", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    vi.stubEnv("QR_TOKEN_TTL_MS", "10000");
    const { signQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID);
    const exp = Number(t.split(".")[1]);
    expect(exp).toBeLessThanOrEqual(Date.now() + 11_000);
  });
});

describe("verifyQrToken", () => {
  it("legacy UUID aceito quando secret ausente", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", "");
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken(VALID_UUID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.uuid).toBe(VALID_UUID);
  });

  it("legacy UUID rejeitado quando secret presente e allowLegacy=false (default)", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken(VALID_UUID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("legacy-rejected");
  });

  it("legacy UUID aceito com allowLegacy=true mesmo com secret", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken(VALID_UUID, { allowLegacy: true });
    expect(r.ok).toBe(true);
  });

  it("token assinado happy path", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken, verifyQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID);
    const r = await verifyQrToken(t);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.uuid).toBe(VALID_UUID);
      expect(r.legacy).toBe(false);
    }
  });

  it("token expirado → reason=expired", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken, verifyQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID, -1_000);
    const r = await verifyQrToken(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("assinatura adulterada → bad-signature", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken, verifyQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID);
    const tampered = t.slice(0, -3) + "xyz";
    const r = await verifyQrToken(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  it("formato inválido (poucas partes) → invalid", async () => {
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken("foo.bar");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });

  it("uuid mal-formado dentro de token assinado → invalid", async () => {
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken("not-uuid.123.sig");
    expect(r.ok).toBe(false);
  });

  it("exp não-numérico → invalid", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken(`${VALID_UUID}.notanumber.sig`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });

  it("token assinado mas secret não definido → bad-signature", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { signQrToken } = await import("@/lib/qr-token");
    const t = await signQrToken(VALID_UUID);
    vi.resetModules();
    vi.stubEnv("QR_TOKEN_SECRET", "");
    const { verifyQrToken } = await import("@/lib/qr-token");
    const r = await verifyQrToken(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  it("base64url de sinal não decodificável → invalid", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", SECRET);
    const { verifyQrToken } = await import("@/lib/qr-token");
    const future = Date.now() + 60_000;
    const r = await verifyQrToken(`${VALID_UUID}.${future}.@@@@`);
    expect(r.ok).toBe(false);
  });
});

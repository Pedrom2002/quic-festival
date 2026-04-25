import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const verifyTurnstileMock = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: verifyTurnstileMock,
  isTurnstileEnabled: () => false,
}));

const signInResult = { value: { error: null as { message: string } | null } };
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      signInWithPassword: vi.fn(async () => signInResult.value),
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  verifyTurnstileMock.mockClear();
  verifyTurnstileMock.mockResolvedValue({ ok: true });
  signInResult.value = { error: null };
});
afterEach(() => vi.restoreAllMocks());

async function call(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/admin/sign-in/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/sign-in", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
  return POST(req);
}

const validBody = { email: "admin@quic.pt", password: "password123" };

describe("POST /api/admin/sign-in", () => {
  it("happy path: 200 + audit ok", async () => {
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signin.password.ok" }),
    );
  });

  it("body inválido → 400", async () => {
    const res = await call({ email: "x" });
    expect(res.status).toBe(400);
  });

  it("body não-JSON → 400", async () => {
    const { POST } = await import("@/app/api/admin/sign-in/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/sign-in", {
      method: "POST",
      body: "x",
      headers: { "content-type": "application/json" },
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("rate-limit IP → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 100 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("100");
  });

  it("rate-limit (IP,email) → 429 com max retry", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 50 })
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("50");
  });

  it("rate-limit global email → 429", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
  });

  it("captcha falha → 400", async () => {
    verifyTurnstileMock.mockResolvedValueOnce({ ok: false, reason: "bad" });
    const res = await call(validBody);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Captcha/);
  });

  it("credenciais inválidas → 401 + audit fail", async () => {
    signInResult.value = { error: { message: "Invalid login" } };
    const res = await call(validBody);
    expect(res.status).toBe(401);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signin.password.fail" }),
    );
  });

  it("ip via x-forwarded-for", async () => {
    await call(validBody, { "x-forwarded-for": "5.5.5.5" });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ ip: "5.5.5.5" }));
  });

  it("ip = unknown sem headers", async () => {
    await call(validBody);
    expect(rateLimitMock.mock.calls[0]![0]).toContain("unknown");
  });
});

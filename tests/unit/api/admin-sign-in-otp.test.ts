import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const verifyTurnstileMock = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: verifyTurnstileMock, isTurnstileEnabled: () => false }));

const otpResult = { value: { error: null as { message: string } | null } };
const signInWithOtpMock = vi.fn(async (args: { options?: { emailRedirectTo?: string } }) => {
  signInWithOtpMock.lastArgs = args;
  return otpResult.value;
}) as ((...a: unknown[]) => Promise<unknown>) & { lastArgs?: { options?: { emailRedirectTo?: string } } };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { signInWithOtp: signInWithOtpMock },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  verifyTurnstileMock.mockClear();
  verifyTurnstileMock.mockResolvedValue({ ok: true });
  otpResult.value = { error: null };
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
});
afterEach(() => vi.unstubAllEnvs());

async function call(body: unknown) {
  const { POST } = await import("@/app/api/admin/sign-in/otp/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/sign-in/otp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

describe("POST /api/admin/sign-in/otp", () => {
  it("happy path → 200 + audit otp.sent", async () => {
    const res = await call({ email: "a@quic.pt" });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signin.otp.sent" }),
    );
  });

  it("rate-limit → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 99 });
    const res = await call({ email: "a@quic.pt" });
    expect(res.status).toBe(429);
  });

  it("body inválido → 400", async () => {
    expect((await call({ email: "no" })).status).toBe(400);
  });

  it("captcha falha → 400", async () => {
    verifyTurnstileMock.mockResolvedValueOnce({ ok: false, reason: "x" });
    expect((await call({ email: "a@quic.pt" })).status).toBe(400);
  });

  it("Supabase erro → 502 + audit fail", async () => {
    otpResult.value = { error: { message: "smtp" } };
    const res = await call({ email: "a@quic.pt" });
    expect(res.status).toBe(502);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signin.otp.fail" }),
    );
  });

  describe("safeRedirect", () => {
    it("aceita https://quic.pt/auth/callback?next=/admin", async () => {
      await call({ email: "a@quic.pt", redirectTo: "https://quic.pt/auth/callback?next=/admin" });
      expect(signInWithOtpMock.lastArgs?.options?.emailRedirectTo).toContain("/auth/callback");
    });

    it("rejeita origin externa", async () => {
      await call({ email: "a@quic.pt", redirectTo: "https://evil.test/auth/callback" });
      expect(signInWithOtpMock.lastArgs?.options?.emailRedirectTo).toBeUndefined();
    });

    it("rejeita pathname não-callback", async () => {
      await call({ email: "a@quic.pt", redirectTo: "https://quic.pt/admin" });
      expect(signInWithOtpMock.lastArgs?.options?.emailRedirectTo).toBeUndefined();
    });

    it("URL malformada → undefined", async () => {
      // zod nem sequer aceita — vai falhar a 400
      const res = await call({ email: "a@quic.pt", redirectTo: "not-a-url" });
      expect(res.status).toBe(400);
    });

    it("sem redirectTo → undefined", async () => {
      await call({ email: "a@quic.pt" });
      expect(signInWithOtpMock.lastArgs?.options?.emailRedirectTo).toBeUndefined();
    });
  });
});

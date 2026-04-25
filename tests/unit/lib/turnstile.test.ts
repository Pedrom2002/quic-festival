import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../mocks/server";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

const URL_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("isTurnstileEnabled", () => {
  it("false sem env", () => expect(isTurnstileEnabled()).toBe(false));
  it("true quando ambas envs presentes", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "k");
    expect(isTurnstileEnabled()).toBe(true);
  });
  it("false se só uma env presente", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    expect(isTurnstileEnabled()).toBe(false);
  });
});

describe("verifyTurnstile", () => {
  it("skipped quando secret ausente em dev/test", async () => {
    const r = await verifyTurnstile("anything");
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it("fail-closed quando secret ausente em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const r = await verifyTurnstile("anything");
    expect(r).toEqual({ ok: false, reason: "captcha-misconfigured" });
  });

  it("missing-token quando secret presente mas token vazio", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    const r = await verifyTurnstile(null);
    expect(r).toEqual({ ok: false, reason: "missing-token" });
  });

  it("success da Cloudflare passa", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    server.use(
      http.post(URL_VERIFY, async ({ request }) => {
        const body = await request.text();
        expect(body).toContain("secret=s");
        expect(body).toContain("response=tok");
        expect(body).toContain("remoteip=1.2.3.4");
        return HttpResponse.json({ success: true });
      }),
    );
    expect(await verifyTurnstile("tok", "1.2.3.4")).toEqual({ ok: true });
  });

  it("success false → reason error-codes joined", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    server.use(
      http.post(URL_VERIFY, () => HttpResponse.json({ success: false, "error-codes": ["bad", "expired"] })),
    );
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "bad,expired" });
  });

  it("success false sem error-codes → verify-failed", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    server.use(http.post(URL_VERIFY, () => HttpResponse.json({ success: false })));
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "verify-failed" });
  });

  it("non-200 → verify-{status}", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    server.use(http.post(URL_VERIFY, () => new HttpResponse(null, { status: 503 })));
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "verify-503" });
  });

  it("network exception → reason mensagem", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    server.use(http.post(URL_VERIFY, () => HttpResponse.error()));
    const r = await verifyTurnstile("tok");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/.+/);
  });
});

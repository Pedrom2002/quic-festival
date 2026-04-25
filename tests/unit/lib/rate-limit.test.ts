import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../mocks/server";

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("rateLimit memoryLimit", () => {
  it("primeira chamada ok=true", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const r = await rateLimit("k1:" + Math.random(), 3, 1000);
    expect(r.ok).toBe(true);
    expect(r.retryAfterSeconds).toBe(0);
  });

  it("excede max retorna ok=false com retryAfter", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = "k2:" + Math.random();
    expect((await rateLimit(key, 2, 5000)).ok).toBe(true);
    expect((await rateLimit(key, 2, 5000)).ok).toBe(true);
    const r = await rateLimit(key, 2, 5000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("janela expira → reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = "k3:" + Math.random();
    expect((await rateLimit(key, 1, 1000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 1000)).ok).toBe(false);
    vi.advanceTimersByTime(2000);
    expect((await rateLimit(key, 1, 1000)).ok).toBe(true);
  });
});

describe("rateLimit upstash", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://up.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  });

  it("chama pipeline e devolve ok=true quando count <= max", async () => {
    server.use(
      http.post("https://up.test/pipeline", async ({ request }) => {
        const auth = request.headers.get("authorization");
        expect(auth).toBe("Bearer tok");
        return HttpResponse.json([{ result: 1 }, { result: 1 }, { result: 30000 }]);
      }),
    );
    const { rateLimit } = await import("@/lib/rate-limit");
    const r = await rateLimit("up:1", 5, 60000);
    expect(r).toEqual({ ok: true, retryAfterSeconds: 0 });
  });

  it("count > max retorna ok=false com retryAfter de PTTL", async () => {
    server.use(
      http.post("https://up.test/pipeline", () =>
        HttpResponse.json([{ result: 6 }, { result: 0 }, { result: 30000 }]),
      ),
    );
    const { rateLimit } = await import("@/lib/rate-limit");
    const r = await rateLimit("up:2", 5, 60000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(30);
  });

  it("upstash 500 → fallback memória", async () => {
    server.use(http.post("https://up.test/pipeline", () => new HttpResponse(null, { status: 500 })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rateLimit } = await import("@/lib/rate-limit");
    const r = await rateLimit("up:3:" + Math.random(), 1, 1000);
    expect(r.ok).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("data[].result undefined → defaults", async () => {
    server.use(http.post("https://up.test/pipeline", () => HttpResponse.json([{}, {}, {}])));
    const { rateLimit } = await import("@/lib/rate-limit");
    const r = await rateLimit("up:4", 5, 60000);
    expect(r.ok).toBe(true);
  });
});

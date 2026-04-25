import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), child: () => ({ warn: vi.fn() }) },
}));

const PROJECT_DSN = "https://abc@o123.ingest.sentry.io/456";

beforeEach(() => {
  vi.resetModules();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function call(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/sentry-tunnel/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/sentry-tunnel", {
    method: "POST",
    body,
    headers,
  });
  return POST(req);
}

function envelope(dsn: string): string {
  const header = JSON.stringify({ event_id: "abc", sent_at: "now", dsn });
  const itemHeader = JSON.stringify({ type: "event" });
  const itemBody = JSON.stringify({ message: "hi" });
  return `${header}\n${itemHeader}\n${itemBody}\n`;
}

describe("POST /api/sentry-tunnel", () => {
  it("404 quando DSN não configurada", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const res = await call(envelope(PROJECT_DSN));
    expect(res.status).toBe(404);
  });

  it("rate-limit excedido → 429", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 5 });
    const res = await call(envelope(PROJECT_DSN));
    expect(res.status).toBe(429);
  });

  it("body acima de 256KB → 413", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const big = "x".repeat(260 * 1024);
    const res = await call(big);
    expect(res.status).toBe(413);
  });

  it("envelope inválido (sem JSON header) → 400", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const res = await call("not-json\n{}\n");
    expect(res.status).toBe(400);
  });

  it("envelope sem dsn → 400", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const res = await call(JSON.stringify({}) + "\n");
    expect(res.status).toBe(400);
  });

  it("DSN diferente da configurada → 403", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const res = await call(envelope("https://x@evil.example/999"));
    expect(res.status).toBe(403);
  });

  it("happy path proxy → status do upstream", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call(envelope(PROJECT_DSN));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://o123.ingest.sentry.io/api/456/envelope/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("envelope DSN malformada → 400", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    const res = await call(envelope("not-a-valid-url"));
    expect(res.status).toBe(400);
  });

  it("project DSN inválida → 400 (URL parse falha)", async () => {
    vi.stubEnv("SENTRY_DSN", "not-a-url");
    const res = await call(envelope("not-a-url"));
    expect(res.status).toBe(400);
  });

  it("usa NEXT_PUBLIC_SENTRY_DSN como fallback", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", PROJECT_DSN);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    const res = await call(envelope(PROJECT_DSN));
    expect(res.status).toBe(200);
  });

  it("upstream falha → 502", async () => {
    vi.stubEnv("SENTRY_DSN", PROJECT_DSN);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    const res = await call(envelope(PROJECT_DSN));
    expect(res.status).toBe(502);
  });
});

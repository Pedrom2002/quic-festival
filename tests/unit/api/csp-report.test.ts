import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const childWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ warn: childWarn }),
  },
}));

beforeEach(() => {
  vi.resetModules();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  childWarn.mockClear();
});

afterEach(() => vi.restoreAllMocks());

async function call(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/csp-report/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/csp-report", {
    method: "POST",
    body,
    headers,
  });
  return POST(req);
}

describe("POST /api/csp-report", () => {
  it("legacy csp-report → 204 + warn", async () => {
    const res = await call(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://quic.pt/",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(childWarn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "csp-report" }),
    );
  });

  it("Reporting API array → 204 + warn por entrada", async () => {
    const res = await call(JSON.stringify([{ type: "csp-violation" }, { type: "csp-violation" }]));
    expect(res.status).toBe(204);
    expect(childWarn).toHaveBeenCalledTimes(2);
  });

  it("forma desconhecida → 204 + warn kind=unknown", async () => {
    const res = await call(JSON.stringify({ random: "object" }));
    expect(res.status).toBe(204);
    expect(childWarn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unknown" }),
    );
  });

  it("body inválido (JSON malformado) → 400", async () => {
    const res = await call("not json");
    expect(res.status).toBe(400);
  });

  it("body acima de 16KB → 413", async () => {
    const huge = "a".repeat(20 * 1024);
    const res = await call(JSON.stringify({ x: huge }));
    expect(res.status).toBe(413);
  });

  it("rate-limit excedido → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 5 });
    const res = await call(JSON.stringify({ "csp-report": {} }));
    expect(res.status).toBe(429);
  });
});

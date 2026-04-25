import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guestResult = { value: { data: { token: "11111111-1111-1111-1111-111111111111" }, error: null } as { data: { token: string } | null; error: unknown } };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => guestResult.value,
        }),
      }),
    }),
  }),
}));

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    toDataURL: vi.fn(async () => "data:fake"),
  },
}));

beforeEach(() => {
  vi.resetModules();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  guestResult.value = { data: { token: "11111111-1111-1111-1111-111111111111" }, error: null };
});
afterEach(() => vi.restoreAllMocks());

async function call(token: string, headers: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/qr/[token]/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/qr/${token}`, { headers });
  return GET(req, { params: Promise.resolve({ token }) });
}

describe("GET /api/qr/[token]", () => {
  it("happy: 200 PNG com cache-control e X-Robots-Tag", async () => {
    const res = await call("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("cache-control")).toContain("max-age=300");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89);
  });

  it("UUID inválido → 404 cedo (sem hit DB)", async () => {
    const guestSpy = vi.spyOn(await import("@/lib/supabase/admin"), "supabaseAdmin");
    const res = await call("nope");
    expect(res.status).toBe(404);
    expect(guestSpy).not.toHaveBeenCalled();
  });

  it("rate-limit excedido → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 12 });
    const res = await call("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
  });

  it("token inexistente → 404", async () => {
    guestResult.value = { data: null, error: null };
    const res = await call("22222222-2222-2222-2222-222222222222");
    expect(res.status).toBe(404);
  });

  it("ip de x-real-ip usado na rate-limit key", async () => {
    await call("11111111-1111-1111-1111-111111111111", { "x-real-ip": "8.8.8.8" });
    expect(rateLimitMock.mock.calls[0]![0]).toContain("8.8.8.8");
  });

  it("ip unknown sem headers", async () => {
    await call("11111111-1111-1111-1111-111111111111");
    expect(rateLimitMock.mock.calls[0]![0]).toContain("unknown");
  });
});

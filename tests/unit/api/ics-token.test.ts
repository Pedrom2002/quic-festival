import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guestResult = { value: { data: { id: "g1", name: "Maria", token: "11111111-1111-1111-1111-111111111111", ics: null as string | null }, error: null } as { data: { id: string; name: string; token: string; ics: string | null } | null; error: unknown } };

const updateBackfill = vi.fn(() => ({
  eq: () => ({
    then: (cb: (r: { error: unknown }) => void) => {
      cb({ error: null });
      return Promise.resolve({ error: null });
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => guestResult.value,
        }),
      }),
      update: updateBackfill,
    }),
  }),
}));

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

beforeEach(() => {
  vi.resetModules();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  updateBackfill.mockClear();
  guestResult.value = {
    data: {
      id: "g1",
      name: "Maria",
      token: "11111111-1111-1111-1111-111111111111",
      ics: null,
    },
    error: null,
  };
});
afterEach(() => vi.restoreAllMocks());

async function call(token: string, headers: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/ics/[token]/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/ics/${token}`, { headers });
  return GET(req, { params: Promise.resolve({ token }) });
}

describe("GET /api/ics/[token]", () => {
  it("happy: 200 ICS com headers correctos (live render quando ics=null)", async () => {
    const res = await call("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("Maria");
    // live-render path triggers backfill
    expect(updateBackfill).toHaveBeenCalledOnce();
  });

  it("cache hit: usa ics pre-renderizado, sem backfill", async () => {
    guestResult.value = {
      data: {
        id: "g1",
        name: "Maria",
        token: "11111111-1111-1111-1111-111111111111",
        ics: "BEGIN:VCALENDAR\r\nCACHED\r\nEND:VCALENDAR",
      },
      error: null,
    };
    const res = await call("11111111-1111-1111-1111-111111111111");
    const text = await res.text();
    expect(text).toContain("CACHED");
    expect(updateBackfill).not.toHaveBeenCalled();
  });

  it("UUID inválido → 404", async () => {
    const res = await call("not-uuid");
    expect(res.status).toBe(404);
  });

  it("rate-limit excedido → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 9 });
    const res = await call("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("9");
  });

  it("token inexistente → 404", async () => {
    guestResult.value = { data: null, error: null };
    const res = await call("22222222-2222-2222-2222-222222222222");
    expect(res.status).toBe(404);
  });

  it("ip extraído via ipFromHeaders → key contém ip", async () => {
    await call("11111111-1111-1111-1111-111111111111", { "x-forwarded-for": "7.7.7.7" });
    expect(rateLimitMock.mock.calls[0]![0]).toContain("7.7.7.7");
  });

  it("ip = unknown sem headers", async () => {
    await call("11111111-1111-1111-1111-111111111111");
    expect(rateLimitMock.mock.calls[0]![0]).toContain("unknown");
  });
});

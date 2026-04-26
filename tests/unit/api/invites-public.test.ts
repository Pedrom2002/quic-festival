import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inviteResult = {
  value: {
    data: {
      label: "Sonae",
      max_uses: 40,
      uses_count: 12,
      expires_at: null,
      archived_at: null,
    } as Record<string, unknown> | null,
    error: null,
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => inviteResult.value }),
      }),
    }),
  }),
}));

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

beforeEach(() => {
  vi.resetModules();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  inviteResult.value = {
    data: {
      label: "Sonae",
      max_uses: 40,
      uses_count: 12,
      expires_at: null,
      archived_at: null,
    },
    error: null,
  };
});

afterEach(() => vi.restoreAllMocks());

async function call(code: string) {
  const { GET } = await import("@/app/api/invites/[code]/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/invites/${code}`);
  return GET(req, { params: Promise.resolve({ code }) });
}

describe("GET /api/invites/[code]", () => {
  it("happy path: devolve seats restantes + label", async () => {
    const res = await call("ABCDEFGHJKMN");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label).toBe("Sonae");
    expect(body.seats_total).toBe(40);
    expect(body.seats_remaining).toBe(28);
  });

  it("404 código inválido (formato)", async () => {
    const res = await call("invalid");
    expect(res.status).toBe(404);
  });

  it("404 código inexistente / arquivado", async () => {
    inviteResult.value = { data: null, error: null };
    const res = await call("ABCDEFGHJKMN");
    expect(res.status).toBe(404);
  });

  it("404 quando arquivado", async () => {
    inviteResult.value = {
      data: {
        label: "X",
        max_uses: 10,
        uses_count: 0,
        expires_at: null,
        archived_at: "2024-01-01T00:00:00Z",
      },
      error: null,
    };
    const res = await call("ABCDEFGHJKMN");
    expect(res.status).toBe(404);
  });

  it("410 quando expirado", async () => {
    inviteResult.value = {
      data: {
        label: "X",
        max_uses: 10,
        uses_count: 0,
        expires_at: "2020-01-01T00:00:00Z",
        archived_at: null,
      },
      error: null,
    };
    const res = await call("ABCDEFGHJKMN");
    expect(res.status).toBe(410);
  });

  it("429 rate-limit excedido", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 9 });
    const res = await call("ABCDEFGHJKMN");
    expect(res.status).toBe(429);
  });
});

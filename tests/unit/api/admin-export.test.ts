import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const userResult = { value: { data: { user: { email: "a@quic.pt" } as { email: string } | null }, error: null } };
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const guestsResult = { value: { data: [] as Record<string, unknown>[], error: null as { code?: string } | null } };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => userResult.value },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from(table: string) {
      if (table === "admins") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: adminCheck.value, error: null }) }) }),
        };
      }
      return {
        select: () => ({ order: async () => guestsResult.value }),
      };
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  userResult.value = { data: { user: { email: "a@quic.pt" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  guestsResult.value = {
    data: [
      {
        created_at: "2026-04-01T10:00:00Z",
        name: "Maria",
        email: "m@x.pt",
        phone: "912",
        companion_count: 1,
        companion_names: ["Ana"],
        token: "tok",
        checked_in_at: null,
        email_sent_at: null,
      },
    ],
    error: null,
  };
});
afterEach(() => vi.restoreAllMocks());

async function call() {
  const { GET } = await import("@/app/api/admin/export/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/export");
  return GET(req);
}

describe("GET /api/admin/export", () => {
  it("happy: 200 CSV com headers + audit", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const csv = await res.text();
    expect(csv).toContain("Maria");
    expect(csv).toContain("Ana");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.export", meta: { rows: 1 } }),
    );
  });

  it("não autenticado → 401", async () => {
    userResult.value = { data: { user: null }, error: null };
    expect((await call()).status).toBe(401);
  });

  it("não admin → 403", async () => {
    adminCheck.value = null;
    expect((await call()).status).toBe(403);
  });

  it("DB error → 500", async () => {
    guestsResult.value = { data: [], error: { code: "X" } };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call()).status).toBe(500);
    err.mockRestore();
  });

  it("data null → rows vazias mas 200", async () => {
    guestsResult.value = { data: [] as Record<string, unknown>[], error: null };
    const res = await call();
    expect(res.status).toBe(200);
  });

  it("companion_names null → string vazia", async () => {
    guestsResult.value = {
      data: [{ created_at: "x", name: "n", email: "e", phone: "p", companion_count: 0, companion_names: null, token: "t", checked_in_at: null, email_sent_at: null }],
      error: null,
    };
    const res = await call();
    expect((await res.text())).toContain("n");
  });

  it("filename inclui data ISO", async () => {
    const res = await call();
    expect(res.headers.get("content-disposition")).toMatch(/quic-convidados-\d{4}-\d{2}-\d{2}\.csv/);
  });

  it("CSV inclui watermark com email do admin", async () => {
    const res = await call();
    const csv = await res.text();
    expect(csv).toContain("a@quic.pt");
  });

  it("rate-limit excedido → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    expect((await call()).status).toBe(429);
  });

  it("rate-limit degradado → 503", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30, degraded: true });
    expect((await call()).status).toBe(503);
  });
});

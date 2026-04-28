import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-guard", () => ({ requireAdmin: requireAdminMock }));

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const guestResult = { value: { data: null as Record<string, unknown> | null, error: null } };
const auditResult = { value: { data: [] as Record<string, unknown>[], error: null } };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "audit_log") {
        return {
          select: () => ({
            eq: () => ({ order: async () => auditResult.value }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => guestResult.value }),
        }),
      };
    },
  }),
}));

const auditMock = vi.fn();
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "1.1.1.1",
}));

beforeEach(() => {
  requireAdminMock.mockReset();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  guestResult.value = { data: null, error: null };
  auditResult.value = { data: [], error: null };
});

afterEach(() => vi.restoreAllMocks());

async function call(id: string) {
  const { GET } = await import("@/app/api/admin/guest/[id]/export/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/admin/guest/${id}/export`);
  return GET(req, { params: Promise.resolve({ id }) });
}

describe("GET /api/admin/guest/[id]/export", () => {
  it("401 quando não autenticado", async () => {
    const { NextResponse } = await import("next/server");
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({}, { status: 401 }),
    });
    const res = await call("11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(401);
  });

  it("400 ID inválido", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    const res = await call("not-uuid");
    expect(res.status).toBe(400);
  });

  it("404 guest inexistente", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    const res = await call("11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(404);
  });

  it("rate-limit excedido → 429", async () => {
    requireAdminMock.mockResolvedValue({ ok: true, user: { id: "u1", email: "a@quic.pt" } });
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    const res = await call("11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(429);
  });

  it("rate-limit degradado → 503", async () => {
    requireAdminMock.mockResolvedValue({ ok: true, user: { id: "u1", email: "a@quic.pt" } });
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30, degraded: true });
    const res = await call("11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(503);
  });

  it("happy path: JSON com data_subject + audit_trail + audit chamado", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    guestResult.value = {
      data: {
        id: "g1",
        name: "Maria",
        email: "m@x.pt",
        phone: "9",
        created_at: "2026-04-26",
        companion_count: 0,
        companion_names: [],
        checked_in_at: null,
        email_sent_at: "2026-04-26",
        email_attempts: 1,
        email_failed_at: null,
      },
      error: null,
    };
    auditResult.value = {
      data: [{ occurred_at: "2026-04-26", action: "admin.signin.password.ok" }],
      error: null,
    };
    const res = await call("11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.json();
    expect(body.data_subject.email).toBe("m@x.pt");
    expect(body.audit_trail).toHaveLength(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.guest.exported" }),
    );
  });
});

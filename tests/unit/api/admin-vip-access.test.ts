import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userResult = {
  value: { data: { user: { email: "a@quic.pt" } as { email: string } | null }, error: null },
};
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const guestRow = {
  value: { id: "g-1", name: "Maria", is_vip: false } as Record<string, unknown> | null,
};
const rateLimitResult = { value: { ok: true, retryAfterSeconds: 0 } as { ok: boolean; retryAfterSeconds: number; degraded?: boolean } };
const verifyResult = { value: { ok: true, uuid: "uuid-abc" } as { ok: boolean; uuid?: string } };

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
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: adminCheck.value, error: null }) }),
          }),
        };
      }
      // guests
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: guestRow.value, error: null }) }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => rateLimitResult.value),
}));

vi.mock("@/lib/qr-token", () => ({
  verifyQrToken: vi.fn(async () => verifyResult.value),
}));

beforeEach(() => {
  vi.resetModules();
  userResult.value = { data: { user: { email: "a@quic.pt" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  guestRow.value = { id: "g-1", name: "Maria", is_vip: false };
  rateLimitResult.value = { ok: true, retryAfterSeconds: 0 };
  verifyResult.value = { ok: true, uuid: "uuid-abc" };
});
afterEach(() => vi.restoreAllMocks());

async function call(body: unknown) {
  const { POST } = await import("@/app/api/admin/vip-access/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/vip-access", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

describe("POST /api/admin/vip-access", () => {
  const VALID_TOKEN = "a".repeat(36);

  it("200 + is_vip false para guest normal", async () => {
    const res = await call({ token: VALID_TOKEN });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.name).toBe("Maria");
    expect(j.is_vip).toBe(false);
  });

  it("200 + is_vip true para guest VIP", async () => {
    guestRow.value = { id: "g-2", name: "Vasco", is_vip: true };
    const res = await call({ token: VALID_TOKEN });
    expect(res.status).toBe(200);
    expect((await res.json()).is_vip).toBe(true);
  });

  it("401 sem utilizador autenticado", async () => {
    userResult.value = { data: { user: null }, error: null };
    expect((await call({ token: VALID_TOKEN })).status).toBe(401);
  });

  it("403 não admin", async () => {
    adminCheck.value = null;
    expect((await call({ token: VALID_TOKEN })).status).toBe(403);
  });

  it("429 rate-limit excedido", async () => {
    rateLimitResult.value = { ok: false, retryAfterSeconds: 60 };
    expect((await call({ token: VALID_TOKEN })).status).toBe(429);
  });

  it("503 rate-limit degradado", async () => {
    rateLimitResult.value = { ok: false, retryAfterSeconds: 30, degraded: true };
    expect((await call({ token: VALID_TOKEN })).status).toBe(503);
  });

  it("400 payload inválido (token curto)", async () => {
    expect((await call({ token: "abc" })).status).toBe(400);
  });

  it("400 payload inválido (sem token)", async () => {
    expect((await call({})).status).toBe(400);
  });

  it("404 QR inválido", async () => {
    verifyResult.value = { ok: false };
    expect((await call({ token: VALID_TOKEN })).status).toBe(404);
  });

  it("404 guest não encontrado", async () => {
    guestRow.value = null;
    expect((await call({ token: VALID_TOKEN })).status).toBe(404);
  });
});

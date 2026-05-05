import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userResult = {
  value: { data: { user: { email: "a@quic.pt" } as { email: string } | null }, error: null },
};
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const updateError = { value: null as { code?: string } | null };

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "1.1.1.1",
}));

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
        update: () => ({ eq: async () => ({ error: updateError.value }) }),
      };
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  userResult.value = { data: { user: { email: "a@quic.pt" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  updateError.value = null;
});
afterEach(() => vi.restoreAllMocks());

const VALID_ID = "11111111-1111-4111-8111-111111111111";

async function call(body: unknown) {
  const { PATCH } = await import("@/app/api/admin/toggle-vip/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/toggle-vip", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return PATCH(req);
}

describe("PATCH /api/admin/toggle-vip", () => {
  it("200 + audit admin.vip.grant ao activar VIP", async () => {
    const res = await call({ id: VALID_ID, is_vip: true });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.is_vip).toBe(true);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.vip.grant" }),
    );
  });

  it("200 + audit admin.vip.revoke ao desactivar VIP", async () => {
    const res = await call({ id: VALID_ID, is_vip: false });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.vip.revoke" }),
    );
  });

  it("401 sem utilizador autenticado", async () => {
    userResult.value = { data: { user: null }, error: null };
    expect((await call({ id: VALID_ID, is_vip: true })).status).toBe(401);
  });

  it("403 não admin", async () => {
    adminCheck.value = null;
    expect((await call({ id: VALID_ID, is_vip: true })).status).toBe(403);
  });

  it("400 id inválido", async () => {
    expect((await call({ id: "not-uuid", is_vip: true })).status).toBe(400);
  });

  it("400 is_vip em falta", async () => {
    expect((await call({ id: VALID_ID })).status).toBe(400);
  });

  it("400 body inválido (null)", async () => {
    expect((await call(null)).status).toBe(400);
  });

  it("500 erro DB update", async () => {
    updateError.value = { code: "X" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ id: VALID_ID, is_vip: true });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

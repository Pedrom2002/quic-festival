import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const userResult = { value: { data: { user: { email: "a@quic.pt" } as { email: string } | null }, error: null } };
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const guestRow = { value: { id: "g-1", name: "Maria", companion_count: 0, checked_in_at: null as string | null } as Record<string, unknown> | null };
const updateError = { value: null as { code?: string } | null };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => userResult.value },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    const adminBuilder = {
      from(table: string) {
        if (table === "admins") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: adminCheck.value, error: null }) }) }),
          };
        }
        // guests
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: guestRow.value, error: null }) }),
          }),
          update: () => ({ eq: async () => ({ error: updateError.value }) }),
        };
      },
    };
    return adminBuilder;
  },
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  userResult.value = { data: { user: { email: "a@quic.pt" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  guestRow.value = { id: "g-1", name: "Maria", companion_count: 0, checked_in_at: null };
  updateError.value = null;
});
afterEach(() => vi.restoreAllMocks());

async function call(body: unknown) {
  const { PATCH } = await import("@/app/api/admin/checkin/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/checkin", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return PATCH(req);
}

const VALID_ID = "11111111-1111-1111-1111-111111111111";

describe("PATCH /api/admin/checkin", () => {
  it("happy path id: 200 + audit checkin.ok", async () => {
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.guest.id).toBe("g-1");
    expect(j.was_already_checked_in).toBe(false);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.checkin.ok" }),
    );
  });

  it("não autenticado → 401", async () => {
    userResult.value = { data: { user: null }, error: null };
    expect((await call({ id: VALID_ID })).status).toBe(401);
  });

  it("não admin → 403", async () => {
    adminCheck.value = null;
    expect((await call({ id: VALID_ID })).status).toBe(403);
  });

  it("body sem id nem token → 400", async () => {
    expect((await call({})).status).toBe(400);
  });

  it("guest não encontrado → 404 + audit not_found", async () => {
    guestRow.value = null;
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(404);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.checkin.not_found" }),
    );
  });

  it("duplicate (já check-in) → audit duplicate", async () => {
    guestRow.value = { id: "g-1", name: "M", companion_count: 0, checked_in_at: "2026-01-01" };
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(200);
    expect((await res.json()).was_already_checked_in).toBe(true);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.checkin.duplicate" }),
    );
  });

  it("uncheck (checked_in=false) → audit uncheck", async () => {
    const res = await call({ id: VALID_ID, checked_in: false });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.checkin.uncheck" }),
    );
  });

  it("update DB falha → 500", async () => {
    updateError.value = { code: "X" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("lookup por token (sem id)", async () => {
    const res = await call({ token: VALID_ID });
    expect(res.status).toBe(200);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userResult = { value: { data: { user: { email: "a@quic.pt", id: "u-1" } as { email: string; id: string } | null }, error: null } };
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => userResult.value },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: adminCheck.value, error: null }) }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  userResult.value = { data: { user: { email: "a@quic.pt", id: "u-1" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
});
afterEach(() => vi.restoreAllMocks());

describe("requireAdmin", () => {
  it("ok quando user autenticado e admin", async () => {
    const { requireAdmin } = await import("@/lib/admin-guard");
    const r = await requireAdmin();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user).toEqual({ id: "u-1", email: "a@quic.pt" });
  });

  it("user null → 401", async () => {
    userResult.value = { data: { user: null }, error: null };
    const { requireAdmin } = await import("@/lib/admin-guard");
    const r = await requireAdmin();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("user sem email → 401", async () => {
    userResult.value = { data: { user: { email: "", id: "u-1" } as never }, error: null };
    const { requireAdmin } = await import("@/lib/admin-guard");
    const r = await requireAdmin();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("user sem id → 401", async () => {
    userResult.value = { data: { user: { email: "a@quic.pt", id: "" } as never }, error: null };
    const { requireAdmin } = await import("@/lib/admin-guard");
    const r = await requireAdmin();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("não admin → 403", async () => {
    adminCheck.value = null;
    const { requireAdmin } = await import("@/lib/admin-guard");
    const r = await requireAdmin();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const userResult = { value: { data: { user: { email: "a@quic.pt", id: "u-1" } as { email: string; id: string } | null }, error: null } };
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const reAuthErr = { value: null as { message: string } | null };
const updateUserErr = { value: null as { message: string } | null };
const signOutErr = { value: null as Error | null };

const signInWithPasswordMock = vi.fn(async () => ({ error: reAuthErr.value }));
const signOutMock = vi.fn(async () => {
  if (signOutErr.value) throw signOutErr.value;
  return { error: null };
});
const updateUserByIdMock = vi.fn(async () => ({ error: updateUserErr.value }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => userResult.value,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from() {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: adminCheck.value, error: null }) }) }),
      };
    },
    auth: {
      admin: { updateUserById: updateUserByIdMock },
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  signInWithPasswordMock.mockClear();
  signOutMock.mockClear();
  updateUserByIdMock.mockClear();
  userResult.value = { data: { user: { email: "a@quic.pt", id: "u-1" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  reAuthErr.value = null;
  updateUserErr.value = null;
  signOutErr.value = null;
});
afterEach(() => vi.restoreAllMocks());

async function call(body: unknown) {
  const { POST } = await import("@/app/api/admin/account/password/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/account/password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

const valid = { currentPassword: "old-pw-123", newPassword: "new-pw-12345" };

describe("POST /api/admin/account/password", () => {
  it("happy: 200 + audit + signOut(others)", async () => {
    const res = await call(valid);
    expect(res.status).toBe(200);
    expect(updateUserByIdMock).toHaveBeenCalledWith("u-1", { password: "new-pw-12345" });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.password.changed", actorEmail: "a@quic.pt" }),
    );
  });

  it("não autenticado → 401", async () => {
    userResult.value = { data: { user: null }, error: null };
    expect((await call(valid)).status).toBe(401);
  });

  it("não admin → 403", async () => {
    adminCheck.value = null;
    expect((await call(valid)).status).toBe(403);
  });

  it("rate-limit → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 100 });
    expect((await call(valid)).status).toBe(429);
  });

  it("rate-limit user global → 429", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 100 });
    expect((await call(valid)).status).toBe(429);
  });

  it("body inválido → 400", async () => {
    expect((await call({ currentPassword: "x", newPassword: "short" })).status).toBe(400);
  });

  it("re-auth falha → 401 + audit fail", async () => {
    reAuthErr.value = { message: "wrong" };
    const res = await call(valid);
    expect(res.status).toBe(401);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signin.password.fail" }),
    );
  });

  it("updateUser falha → 500", async () => {
    updateUserErr.value = { message: "boom" };
    expect((await call(valid)).status).toBe(500);
  });

  it("signOut others falha → não bloqueia 200", async () => {
    signOutErr.value = new Error("revoke fail");
    const res = await call(valid);
    expect(res.status).toBe(200);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guestRow = { id: "g1", name: "A", companion_count: 0, checked_in_at: null };
const guestResult = { value: { data: guestRow as null | typeof guestRow, error: null } };

const adminCheckResult = { value: { data: { email: "admin@quic.pt" }, error: null } };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "admin@quic.pt" } } }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "admins") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => adminCheckResult.value }),
          }),
        };
      }
      // guests
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => guestResult.value }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  }),
}));

const auditMock = vi.fn();
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "127.0.0.1",
}));

beforeEach(() => {
  vi.resetModules();
  guestResult.value = { data: { ...guestRow }, error: null };
  adminCheckResult.value = { data: { email: "admin@quic.pt" }, error: null };
  auditMock.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

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

describe("PATCH /api/admin/checkin — signed token verification", () => {
  it("UUID legacy aceito quando QR_TOKEN_SECRET ausente", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", "");
    const res = await call({
      token: "11111111-1111-4111-8111-111111111111",
      checked_in: true,
    });
    expect(res.status).toBe(200);
  });

  it("token assinado válido → check-in OK", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", "x".repeat(32));
    vi.resetModules();
    const { signQrToken } = await import("@/lib/qr-token");
    const signed = await signQrToken("11111111-1111-4111-8111-111111111111");
    const res = await call({ token: signed, checked_in: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("token assinado inválido → 404 com audit", async () => {
    vi.stubEnv("QR_TOKEN_SECRET", "x".repeat(32));
    const res = await call({
      token: "11111111-1111-4111-8111-111111111111.123.bad",
      checked_in: true,
    });
    expect(res.status).toBe(404);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.checkin.not_found" }),
    );
  });

  it("admin sem permissões → 403", async () => {
    adminCheckResult.value = { data: null, error: null };
    const res = await call({
      token: "11111111-1111-4111-8111-111111111111",
      checked_in: true,
    });
    expect(res.status).toBe(403);
  });

  it("payload inválido → 400", async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });
});

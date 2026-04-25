import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

const guardResult = {
  value: { ok: true, user: { id: "u-1", email: "a@quic.pt" } } as
    | { ok: true; user: { id: string; email: string } }
    | { ok: false; response: Response },
};
vi.mock("@/lib/admin-guard", () => ({
  requireAdmin: vi.fn(async () => guardResult.value),
}));

const guestLookup = { value: { data: { id: "g-1", email: "x@x.pt" } as { id: string; email: string } | null, error: null } };
const deleteResult = { value: { error: null as { message: string } | null } };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => guestLookup.value }),
      }),
      delete: () => ({ eq: async () => deleteResult.value }),
    }),
  }),
}));

const VALID_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  guardResult.value = { ok: true, user: { id: "u-1", email: "a@quic.pt" } };
  guestLookup.value = { data: { id: "g-1", email: "x@x.pt" }, error: null };
  deleteResult.value = { error: null };
});
afterEach(() => vi.restoreAllMocks());

async function call(id: string = VALID_ID) {
  const { DELETE } = await import("@/app/api/admin/guest/[id]/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/admin/guest/${id}`, { method: "DELETE" });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe("DELETE /api/admin/guest/[id]", () => {
  it("happy: 200 + audit", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.guest.deleted", targetId: "g-1" }),
    );
  });

  it("guard recusa → encaminha response", async () => {
    const { NextResponse } = await import("next/server");
    guardResult.value = {
      ok: false,
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
    expect((await call()).status).toBe(401);
  });

  it("ID inválido → 400", async () => {
    expect((await call("nope")).status).toBe(400);
  });

  it("rate-limit → 429", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 99 });
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("99");
  });

  it("guest não existe → 404", async () => {
    guestLookup.value = { data: null, error: null };
    expect((await call()).status).toBe(404);
  });

  it("DB erro → 500", async () => {
    deleteResult.value = { error: { message: "boom" } };
    expect((await call()).status).toBe(500);
  });
});

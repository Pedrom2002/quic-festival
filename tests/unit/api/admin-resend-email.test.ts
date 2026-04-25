import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const sendMock = vi.fn(async () => ({ id: "msg" }));
vi.mock("@/lib/email", () => ({ sendRsvpEmail: sendMock }));

const userResult = { value: { data: { user: { email: "a@quic.pt", id: "u-1" } as { email: string; id: string } | null }, error: null } };
const adminCheck = { value: { email: "a@quic.pt" } as { email: string } | null };
const guestResult = { value: { data: { id: "g-1", name: "Maria", email: "m@x.pt", token: "tok-1" } as Record<string, unknown> | null, error: null as { code?: string } | null } };
const updateMock = vi.fn(async () => ({ error: null }));

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
        select: () => ({ eq: () => ({ maybeSingle: async () => guestResult.value }) }),
        update: () => ({ eq: updateMock }),
      };
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  sendMock.mockClear();
  sendMock.mockResolvedValue({ id: "msg" });
  updateMock.mockClear();
  userResult.value = { data: { user: { email: "a@quic.pt", id: "u-1" } }, error: null };
  adminCheck.value = { email: "a@quic.pt" };
  guestResult.value = { data: { id: "g-1", name: "Maria", email: "m@x.pt", token: "tok-1" }, error: null };
});
afterEach(() => vi.restoreAllMocks());

const VALID_ID = "11111111-1111-1111-1111-111111111111";

async function call(body: unknown) {
  const { POST } = await import("@/app/api/admin/resend-email/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/resend-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

describe("POST /api/admin/resend-email", () => {
  it("happy: 200 + send + audit ok", async () => {
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.resend_email.ok" }),
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

  it("body inválido → 400", async () => {
    expect((await call({ id: "x" })).status).toBe(400);
  });

  it("guest inexistente → 404", async () => {
    guestResult.value = { data: null, error: null };
    expect((await call({ id: VALID_ID })).status).toBe(404);
  });

  it("send falha → 502 + audit fail", async () => {
    sendMock.mockRejectedValueOnce(new Error("smtp"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ id: VALID_ID });
    expect(res.status).toBe(502);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.resend_email.fail" }),
    );
    err.mockRestore();
  });

  it("send falha com non-Error → 502", async () => {
    sendMock.mockRejectedValueOnce("string");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call({ id: VALID_ID })).status).toBe(502);
    err.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-guard", () => ({ requireAdmin: requireAdminMock }));

const insertSingle = vi.fn();
const orderByCreated = vi.fn();
const orderByArchived = vi.fn(() => ({ order: orderByCreated }));
const updateEq = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ order: orderByArchived }),
      insert: () => ({ select: () => ({ single: insertSingle }) }),
      update: () => ({ eq: updateEq }),
    }),
  }),
}));

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "1.1.1.1",
}));

const ADMIN_OK = { ok: true, user: { id: "u1", email: "a@quic.pt" } };
const ADMIN_401 = { ok: false, response: null as unknown };

beforeEach(async () => {
  vi.resetModules();
  insertSingle.mockReset();
  orderByCreated.mockReset();
  updateEq.mockReset();
  requireAdminMock.mockReset();
  auditMock.mockClear();

  const { NextResponse } = await import("next/server");
  ADMIN_401.response = NextResponse.json({}, { status: 401 });
});
afterEach(() => vi.restoreAllMocks());

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/admin/acreditacoes", () => {
  it("401 não autenticado", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_401);
    const { GET } = await import("@/app/api/admin/acreditacoes/route");
    expect((await GET()).status).toBe(401);
  });

  it("200 lista links", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_OK);
    orderByCreated.mockResolvedValue({ data: [{ id: "l1", code: "XYZ" }], error: null });
    const { GET } = await import("@/app/api/admin/acreditacoes/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).links).toHaveLength(1);
  });

  it("data null → links=[]", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_OK);
    orderByCreated.mockResolvedValue({ data: null, error: null });
    const { GET } = await import("@/app/api/admin/acreditacoes/route");
    expect((await (await GET()).json()).links).toEqual([]);
  });

  it("500 erro DB", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_OK);
    orderByCreated.mockResolvedValue({ data: null, error: { code: "X" } });
    const { GET } = await import("@/app/api/admin/acreditacoes/route");
    expect((await GET()).status).toBe(500);
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/acreditacoes", () => {
  async function call(body: unknown) {
    requireAdminMock.mockResolvedValue(ADMIN_OK);
    const { POST } = await import("@/app/api/admin/acreditacoes/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/acreditacoes", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return POST(req);
  }

  it("201 + code quando válido", async () => {
    insertSingle.mockResolvedValueOnce({ data: { id: "l1", code: "ABCDEFGHJKMN" }, error: null });
    const res = await call({ max_uses: 20 });
    expect(res.status).toBe(201);
    expect((await res.json()).code).toBe("ABCDEFGHJKMN");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.accreditation_link.created" }),
    );
  });

  it("400 max_uses inválido", async () => {
    const res = await call({ max_uses: 0 });
    expect(res.status).toBe(400);
  });

  it("retry em colisão 23505", async () => {
    insertSingle
      .mockResolvedValueOnce({ data: null, error: { code: "23505" } })
      .mockResolvedValueOnce({ data: { id: "l2", code: "RETRY12345AB" }, error: null });
    const res = await call({ max_uses: 10 });
    expect(res.status).toBe(201);
  });

  it("500 erro DB não-23505", async () => {
    insertSingle.mockResolvedValueOnce({ data: null, error: { code: "X99" } });
    const res = await call({ max_uses: 10 });
    expect(res.status).toBe(500);
  });

  it("401 não autenticado", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_401);
    const { POST } = await import("@/app/api/admin/acreditacoes/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/acreditacoes", {
      method: "POST",
      body: JSON.stringify({ max_uses: 10 }),
      headers: { "content-type": "application/json" },
    });
    expect((await POST(req)).status).toBe(401);
  });
});

// ── PATCH [id] ────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/acreditacoes/[id]", () => {
  const VALID_ID = "11111111-1111-4111-8111-111111111111";

  async function call(id: string, body: unknown) {
    requireAdminMock.mockResolvedValue(ADMIN_OK);
    const { PATCH } = await import("@/app/api/admin/acreditacoes/[id]/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`https://quic.pt/api/admin/acreditacoes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return PATCH(req, { params: Promise.resolve({ id }) });
  }

  it("400 ID inválido", async () => {
    expect((await call("bad-id", { archived: true })).status).toBe(400);
  });

  it("400 body inválido", async () => {
    expect((await call(VALID_ID, {})).status).toBe(400);
  });

  it("200 arquivar → audit admin.accreditation_link.archived", async () => {
    updateEq.mockResolvedValue({ error: null });
    const res = await call(VALID_ID, { archived: true });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.accreditation_link.archived" }),
    );
  });

  it("200 desarquivar → audit admin.accreditation_link.unarchived", async () => {
    updateEq.mockResolvedValue({ error: null });
    const res = await call(VALID_ID, { archived: false });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.accreditation_link.unarchived" }),
    );
  });

  it("500 erro DB", async () => {
    updateEq.mockResolvedValue({ error: { code: "X" } });
    expect((await call(VALID_ID, { archived: true })).status).toBe(500);
  });

  it("401 não autenticado (PATCH)", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_401);
    const { PATCH } = await import("@/app/api/admin/acreditacoes/[id]/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`https://quic.pt/api/admin/acreditacoes/${VALID_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "content-type": "application/json" },
    });
    expect((await PATCH(req, { params: Promise.resolve({ id: VALID_ID }) })).status).toBe(401);
  });
});

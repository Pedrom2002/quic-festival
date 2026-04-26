import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-guard", () => ({ requireAdmin: requireAdminMock }));

const insertSingle = vi.fn();
const orderByCreated = vi.fn();
const orderByArchived = vi.fn(() => ({ order: orderByCreated }));
const updateEq = vi.fn();

const fromMock = vi.fn(() => ({
  select: () => ({
    order: orderByArchived,
  }),
  insert: () => ({
    select: () => ({ single: insertSingle }),
  }),
  update: () => ({ eq: updateEq }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: fromMock }),
}));

const auditMock = vi.fn();
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "1.1.1.1",
}));

beforeEach(() => {
  vi.resetModules();
  fromMock.mockClear();
  insertSingle.mockReset();
  orderByCreated.mockReset();
  updateEq.mockReset();
  requireAdminMock.mockReset();
  auditMock.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/admin/invites", () => {
  it("401 quando não autenticado", async () => {
    const { NextResponse } = await import("next/server");
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({}, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/invites/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lista invites quando admin", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    orderByCreated.mockResolvedValue({
      data: [{ id: "1", code: "ABC", label: null }],
      error: null,
    });
    const { GET } = await import("@/app/api/admin/invites/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
  });

  it("data null → invites=[]", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    orderByCreated.mockResolvedValue({ data: null, error: null });
    const { GET } = await import("@/app/api/admin/invites/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invites: [] });
  });

  it("erro do supabase → 500", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    orderByCreated.mockResolvedValue({ data: null, error: { code: "X" } });
    const { GET } = await import("@/app/api/admin/invites/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/invites", () => {
  async function call(body: unknown) {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    const { POST } = await import("@/app/api/admin/invites/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/invites", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return POST(req);
  }

  it("201 com code quando válido", async () => {
    insertSingle.mockResolvedValueOnce({
      data: { id: "i1", code: "ABCDEFGHJKMN" },
      error: null,
    });
    const res = await call({ label: "Sonae", max_uses: 40 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("ABCDEFGHJKMN");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.invite.created" }),
    );
  });

  it("400 com max_uses inválido", async () => {
    const res = await call({ max_uses: 0 });
    expect(res.status).toBe(400);
  });

  it("400 com max_uses > 1000", async () => {
    const res = await call({ max_uses: 9999 });
    expect(res.status).toBe(400);
  });

  it("retry em colisão de código (23505)", async () => {
    insertSingle
      .mockResolvedValueOnce({ data: null, error: { code: "23505" } })
      .mockResolvedValueOnce({
        data: { id: "i1", code: "XYZ123ABCDEF" },
        error: null,
      });
    const res = await call({ max_uses: 10 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("XYZ123ABCDEF");
  });

  it("erro de DB não-23505 → 500", async () => {
    insertSingle.mockResolvedValueOnce({ data: null, error: { code: "X42" } });
    const res = await call({ max_uses: 10 });
    expect(res.status).toBe(500);
  });

  it("aceita expires_at + label", async () => {
    insertSingle.mockResolvedValueOnce({
      data: { id: "i1", code: "ABCDEFGHJKMN" },
      error: null,
    });
    const res = await call({
      label: "Test",
      max_uses: 5,
      expires_at: "2026-12-31T23:59:00Z",
    });
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/admin/invites/[id]", () => {
  async function call(id: string, body: unknown) {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "a@quic.pt" },
    });
    const { PATCH } = await import("@/app/api/admin/invites/[id]/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(`https://quic.pt/api/admin/invites/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    return PATCH(req, { params: Promise.resolve({ id }) });
  }

  it("400 ID inválido", async () => {
    const res = await call("not-uuid", { archived: true });
    expect(res.status).toBe(400);
  });

  it("400 body inválido", async () => {
    const res = await call("11111111-1111-4111-8111-111111111111", {});
    expect(res.status).toBe(400);
  });

  it("archive happy path → audit admin.invite.archived", async () => {
    updateEq.mockResolvedValue({ error: null });
    const res = await call("11111111-1111-4111-8111-111111111111", {
      archived: true,
    });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.invite.archived" }),
    );
  });

  it("unarchive → audit admin.invite.unarchived", async () => {
    updateEq.mockResolvedValue({ error: null });
    const res = await call("11111111-1111-4111-8111-111111111111", {
      archived: false,
    });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.invite.unarchived" }),
    );
  });

  it("erro update → 500", async () => {
    updateEq.mockResolvedValue({ error: { code: "X" } });
    const res = await call("11111111-1111-4111-8111-111111111111", {
      archived: true,
    });
    expect(res.status).toBe(500);
  });

  it("401 quando não autenticado (PATCH)", async () => {
    const { NextResponse } = await import("next/server");
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({}, { status: 401 }),
    });
    const { PATCH } = await import("@/app/api/admin/invites/[id]/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/invites/x", {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(res.status).toBe(401);
  });
});

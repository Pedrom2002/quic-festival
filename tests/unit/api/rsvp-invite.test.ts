import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const insertSingle = vi.fn();
const updateMock = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: rpcMock,
    from: () => ({
      insert: () => ({
        select: () => ({ single: async () => insertSingle() }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({ eq: updateMock }),
    }),
  }),
}));

vi.mock("@/lib/email", () => ({
  sendRsvpEmail: vi.fn(async () => ({ id: "msg" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_CODE = "ABCDEFGHJKMN";

const validBody = {
  name: "Maria Silva",
  email: "maria-invite@test.pt",
  phone: "912345678",
  acompanhante: "nao",
};

beforeEach(() => {
  vi.resetModules();
  rpcMock.mockReset();
  insertSingle.mockReset();
  updateMock.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

async function call(body: unknown) {
  const { POST } = await import("@/app/api/rsvp/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/rsvp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

describe("POST /api/rsvp — invite claim", () => {
  it("inviteCode válido + claim ok → insert com invite_link_id", async () => {
    rpcMock.mockResolvedValue({
      data: [{ ok: true, invite_link_id: "inv-1", reason: "ok" }],
      error: null,
    });
    insertSingle.mockResolvedValue({
      data: { id: "g1", token: VALID_UUID },
      error: null,
    });
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("claim_invite_seat", {
      p_code: VALID_CODE,
    });
  });

  it("inviteCode mas exhausted → 409 com reason", async () => {
    rpcMock.mockResolvedValue({
      data: [{ ok: false, invite_link_id: null, reason: "exhausted" }],
      error: null,
    });
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("exhausted");
  });

  it("inviteCode mas expirado → 410", async () => {
    rpcMock.mockResolvedValue({
      data: [{ ok: false, invite_link_id: null, reason: "expired" }],
      error: null,
    });
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(410);
  });

  it("inviteCode mas not-found → 410", async () => {
    rpcMock.mockResolvedValue({
      data: [{ ok: false, invite_link_id: null, reason: "not-found" }],
      error: null,
    });
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(410);
  });

  it("rpc retorna error → 500 + log", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42P01" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(500);
    errSpy.mockRestore();
  });

  it("inviteCode com formato inválido → 400 zod", async () => {
    const res = await call({ ...validBody, inviteCode: "not-valid" });
    expect(res.status).toBe(400);
  });

  it("sem inviteCode → fluxo normal sem rpc", async () => {
    insertSingle.mockResolvedValue({
      data: { id: "g1", token: VALID_UUID },
      error: null,
    });
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("insert falha após claim → release_invite_seat chamado", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ ok: true, invite_link_id: "inv-1", reason: "ok" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }); // release
    insertSingle.mockResolvedValue({
      data: null,
      error: { code: "X42" },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ ...validBody, inviteCode: VALID_CODE });
    expect(res.status).toBe(500);
    expect(rpcMock).toHaveBeenNthCalledWith(2, "release_invite_seat", {
      p_invite_link_id: "inv-1",
    });
    errSpy.mockRestore();
  });
});

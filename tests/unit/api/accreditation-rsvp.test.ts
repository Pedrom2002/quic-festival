import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claimResult = {
  value: {
    data: [{ ok: true, accreditation_link_id: "link-1", reason: "ok" }] as unknown[] | null,
    error: null as { code?: string } | null,
  },
};
const existingRow = { value: null as { id: string } | null };
const insertRow = {
  value: { data: { token: "tok-123" } as { token: string } | null, error: null as { code?: string } | null },
};

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", () => ({
  audit: auditMock,
  ipFromHeaders: () => "1.1.1.1",
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (_fn: string, _args: unknown) => claimResult.value,
    from(table: string) {
      if (table === "accreditations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: existingRow.value, error: null }) }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: async () => insertRow.value }),
          }),
        };
      }
      return {};
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  claimResult.value = {
    data: [{ ok: true, accreditation_link_id: "link-1", reason: "ok" }],
    error: null,
  };
  existingRow.value = null;
  insertRow.value = { data: { token: "tok-123" }, error: null };
});
afterEach(() => vi.restoreAllMocks());

const VALID_BODY = {
  name: "João Silva",
  email: "joao@media.pt",
  phone: "+351912345678",
  media_company: "Rádio X",
  accreditationCode: "ABCDEFGHJKMN",
};

async function call(body: unknown) {
  const { POST } = await import("@/app/api/accreditation-rsvp/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/accreditation-rsvp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

describe("POST /api/accreditation-rsvp", () => {
  it("201 + token em happy path", async () => {
    const res = await call(VALID_BODY);
    expect(res.status).toBe(201);
    expect((await res.json()).token).toBe("tok-123");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "accreditation.submitted" }),
    );
  });

  it("400 dados inválidos (sem nome)", async () => {
    const res = await call({ ...VALID_BODY, name: "" });
    expect(res.status).toBe(400);
  });

  it("403 sem accreditationCode", async () => {
    const { accreditationCode: _omit, ...rest } = VALID_BODY;
    const res = await call(rest);
    expect(res.status).toBe(403);
  });

  it("500 claim RPC falha", async () => {
    claimResult.value = { data: null, error: { code: "PGRST" } };
    expect((await call(VALID_BODY)).status).toBe(500);
  });

  it("500 claim devolve array vazio", async () => {
    claimResult.value = { data: [], error: null };
    expect((await call(VALID_BODY)).status).toBe(500);
  });

  it("409 claim not ok (expired)", async () => {
    claimResult.value = {
      data: [{ ok: false, accreditation_link_id: null, reason: "expired" }],
      error: null,
    };
    const res = await call(VALID_BODY);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("expirou");
  });

  it("409 claim not ok (exhausted)", async () => {
    claimResult.value = {
      data: [{ ok: false, accreditation_link_id: null, reason: "exhausted" }],
      error: null,
    };
    const res = await call(VALID_BODY);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("utilizadas");
  });

  it("409 claim not ok (unknown reason) → genérico", async () => {
    claimResult.value = {
      data: [{ ok: false, accreditation_link_id: null, reason: "other" }],
      error: null,
    };
    const res = await call(VALID_BODY);
    expect(res.status).toBe(409);
  });

  it("409 email duplicado neste link", async () => {
    existingRow.value = { id: "acc-1" };
    const res = await call(VALID_BODY);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("já tem uma acreditação");
  });

  it("500 insert falha", async () => {
    insertRow.value = { data: null, error: { code: "X" } };
    expect((await call(VALID_BODY)).status).toBe(500);
  });
});

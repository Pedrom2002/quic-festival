import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const linkRow = {
  value: {
    label: "Imprensa",
    max_uses: 50,
    uses_count: 10,
    expires_at: null as string | null,
    archived_at: null as string | null,
  } as Record<string, unknown> | null,
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: linkRow.value, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/invite-code", () => ({
  isValidInviteCode: (code: string) => /^[A-Z0-9]{8,}$/.test(code),
}));

beforeEach(() => {
  vi.resetModules();
  linkRow.value = {
    label: "Imprensa",
    max_uses: 50,
    uses_count: 10,
    expires_at: null,
    archived_at: null,
  };
});
afterEach(() => vi.restoreAllMocks());

const VALID_CODE = "ABCD1234";

async function call(code: string) {
  const { GET } = await import("@/app/api/a/[code]/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`https://quic.pt/api/a/${code}`);
  return GET(req, { params: Promise.resolve({ code }) });
}

describe("GET /api/a/[code]", () => {
  it("200 com seats corretos", async () => {
    const res = await call(VALID_CODE);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.label).toBe("Imprensa");
    expect(j.seats_total).toBe(50);
    expect(j.seats_remaining).toBe(40);
    expect(j.expires_at).toBeNull();
  });

  it("seats_remaining nunca negativo (uses > max)", async () => {
    linkRow.value = { label: null, max_uses: 5, uses_count: 10, expires_at: null, archived_at: null };
    const res = await call(VALID_CODE);
    expect(res.status).toBe(200);
    expect((await res.json()).seats_remaining).toBe(0);
  });

  it("404 código inválido (formato errado)", async () => {
    const res = await call("bad!");
    expect(res.status).toBe(404);
  });

  it("404 link não encontrado (null)", async () => {
    linkRow.value = null;
    expect((await call(VALID_CODE)).status).toBe(404);
  });

  it("404 link arquivado", async () => {
    linkRow.value = {
      label: "Old",
      max_uses: 10,
      uses_count: 0,
      expires_at: null,
      archived_at: "2026-01-01T00:00:00Z",
    };
    expect((await call(VALID_CODE)).status).toBe(404);
  });

  it("devolve expires_at quando definido", async () => {
    linkRow.value = {
      label: null,
      max_uses: 20,
      uses_count: 5,
      expires_at: "2026-12-31T23:59:00Z",
      archived_at: null,
    };
    const j = await (await call(VALID_CODE)).json();
    expect(j.expires_at).toBe("2026-12-31T23:59:00Z");
  });
});

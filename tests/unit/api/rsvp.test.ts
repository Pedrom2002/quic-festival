import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertResult = { value: { data: { id: "g-1", token: "11111111-1111-4111-8111-111111111111" }, error: null } as { data: { id: string; token: string } | null; error: { code?: string } | null } };
const existingLookup = { value: { data: { token: "22222222-2222-4222-8222-222222222222" } as { token: string } | null, error: null } };
const updateMock = vi.fn(async () => ({ data: null, error: null }));

const rpcMock = vi.fn(async () => ({
  data: [{ ok: true, invite_link_id: "inv-1", reason: "ok" }],
  error: null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: rpcMock,
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => insertResult.value,
        }),
      }),
      // dedup branch faz select().eq().maybeSingle()
      select: () => ({
        eq: () => ({
          maybeSingle: async () => existingLookup.value,
        }),
      }),
      update: () => ({
        eq: updateMock,
      }),
    }),
  }),
}));

const sendMock = vi.fn(async () => ({ id: "msg" }));
vi.mock("@/lib/email", () => ({ sendRsvpEmail: sendMock }));

const rateLimitMock = vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

beforeEach(() => {
  vi.resetModules();
  insertResult.value = { data: { id: "g-1", token: "11111111-1111-4111-8111-111111111111" }, error: null };
  // Por defeito o pre-dedup SELECT devolve nada → segue para insert.
  existingLookup.value = { data: null, error: null };
  sendMock.mockClear();
  sendMock.mockResolvedValue({ id: "msg" });
  updateMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  rpcMock.mockClear();
  rpcMock.mockResolvedValue({
    data: [{ ok: true, invite_link_id: "inv-1", reason: "ok" }],
    error: null,
  });
});

afterEach(() => vi.restoreAllMocks());

const validBody = {
  name: "Maria Silva",
  email: "maria@test.pt",
  phone: "912345678",
  acompanhante: "nao",
  inviteCode: "ABCDEFGHJKMN",
};

async function call(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/rsvp/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/rsvp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
  return POST(req);
}

describe("POST /api/rsvp", () => {
  it("happy path: 200 com token + envia email", async () => {
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "11111111-1111-4111-8111-111111111111" });
    expect(sendMock).toHaveBeenCalledWith({
      to: "maria@test.pt",
      name: "Maria Silva",
      token: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("body inválido → 400 com issues", async () => {
    const res = await call({ name: "x" });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("Dados inválidos.");
    expect(j.issues).toBeDefined();
  });

  it("body não-JSON → 400", async () => {
    const { POST } = await import("@/app/api/rsvp/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/rsvp", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rate-limit IP excedido → 429 com Retry-After", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 42 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });

  it("rate-limit (IP,email) excedido → 429", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 7 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
  });

  it("dedup email (23505) → 200 com token assinado do registo existente", async () => {
    insertResult.value = { data: null, error: { code: "23505" } };
    existingLookup.value = { data: { token: "22222222-2222-4222-8222-222222222222" }, error: null };
    const res = await call(validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("22222222-2222-4222-8222-222222222222");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("dedup race (23505 + lookup vazio) → 200 com fallback {ok:true}", async () => {
    insertResult.value = { data: null, error: { code: "23505" } };
    existingLookup.value = { data: null, error: null };
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("erro DB genérico → 500", async () => {
    insertResult.value = { data: null, error: { code: "X42" } };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(validBody);
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("erro DB sem code → 500 com 'unknown'", async () => {
    insertResult.value = { data: null, error: {} };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(validBody);
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("email send falha → 200 com token (não falha registo)", async () => {
    sendMock.mockRejectedValueOnce(new Error("smtp down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "11111111-1111-4111-8111-111111111111" });
    err.mockRestore();
  });

  it("ip extraído de x-forwarded-for", async () => {
    await call(validBody, { "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    const firstKey = rateLimitMock.mock.calls[0]![0] as string;
    expect(firstKey).toContain("1.2.3.4");
  });

  it("ip fallback x-real-ip", async () => {
    await call(validBody, { "x-real-ip": "9.9.9.9" });
    const firstKey = rateLimitMock.mock.calls[0]![0] as string;
    expect(firstKey).toContain("9.9.9.9");
  });

  it("ip = unknown sem headers", async () => {
    await call(validBody);
    const firstKey = rateLimitMock.mock.calls[0]![0] as string;
    expect(firstKey).toContain("unknown");
  });

  it("acompanhante=sim → companion_count=1 (insere)", async () => {
    const res = await call({
      ...validBody,
      acompanhante: "sim",
      companion_nome: "Ana Silva",
      companion_tel: "912345677",
      companion_email: "ana@test.pt",
    });
    expect(res.status).toBe(200);
  });

  it("rate-limit per-email global → 429", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, retryAfterSeconds: 11 });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("11");
  });

  it("sem inviteCode → 403 invite-only", async () => {
    const { inviteCode: _omit, ...noInvite } = validBody;
    void _omit;
    const res = await call(noInvite);
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.error).toMatch(/convite/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("RSVP_OPEN=false → 503", async () => {
    vi.resetModules();
    vi.stubEnv("RSVP_OPEN", "false");
    const { POST } = await import("@/app/api/rsvp/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/rsvp", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
  });
});

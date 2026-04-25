import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const idempotencyResult = { value: null as { response: unknown; status_code: number } | null };
const insertResult = { value: { data: { id: "g1", token: "11111111-1111-4111-8111-111111111111" }, error: null } as { data: { id: string; token: string } | null; error: { code?: string } | null } };

const idempotencyInsert = vi.fn(async () => ({ data: null, error: null }));
const guestUpdate = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "idempotency_keys") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: idempotencyResult.value, error: null }),
                }),
              }),
            }),
          }),
          insert: idempotencyInsert,
        };
      }
      // guests
      return {
        insert: () => ({
          select: () => ({
            single: async () => insertResult.value,
          }),
        }),
        update: () => ({ eq: guestUpdate }),
      };
    },
  }),
}));

vi.mock("@/lib/email", () => ({
  sendRsvpEmail: vi.fn(async () => ({ id: "msg" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));

beforeEach(() => {
  vi.resetModules();
  idempotencyResult.value = null;
  insertResult.value = { data: { id: "g1", token: "11111111-1111-4111-8111-111111111111" }, error: null };
  idempotencyInsert.mockClear();
  guestUpdate.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

const validBody = {
  name: "Maria Silva",
  email: "maria@test.pt",
  phone: "912345678",
  acompanhante: "nao",
};

async function call(headers: Record<string, string>) {
  const { POST } = await import("@/app/api/rsvp/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/rsvp", {
    method: "POST",
    body: JSON.stringify(validBody),
    headers: { "content-type": "application/json", ...headers },
  });
  return POST(req);
}

describe("POST /api/rsvp — idempotency", () => {
  it("response cached é devolvido sem novo insert", async () => {
    idempotencyResult.value = { response: { token: "cached-uuid" }, status_code: 200 };
    const res = await call({ "idempotency-key": "abcdef-12345678" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "cached-uuid" });
    expect(idempotencyInsert).not.toHaveBeenCalled();
  });

  it("Idempotency-Key inválida (curta demais) → 400", async () => {
    const res = await call({ "idempotency-key": "shrt" });
    expect(res.status).toBe(400);
  });

  it("Idempotency-Key válida → grava cache na resposta sucesso", async () => {
    const res = await call({ "idempotency-key": "abcdef-12345678" });
    expect(res.status).toBe(200);
    expect(idempotencyInsert).toHaveBeenCalledOnce();
  });

  it("dedup com Idempotency-Key grava cache do fake-success", async () => {
    insertResult.value = { data: null, error: { code: "23505" } };
    const res = await call({ "idempotency-key": "abcdef-12345678" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(idempotencyInsert).toHaveBeenCalledOnce();
  });

  it("falha de cache insert é silenciosa", async () => {
    idempotencyInsert.mockRejectedValueOnce(new Error("db down"));
    const res = await call({ "idempotency-key": "abcdef-12345678" });
    expect(res.status).toBe(200);
  });
});

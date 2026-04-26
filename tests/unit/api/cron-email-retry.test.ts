import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));

const fromMock = vi.fn(() => ({
  select: () => ({
    is: () => ({
      is: () => ({
        lt: () => ({
          gte: () => ({
            order: () => ({ limit }),
          }),
        }),
      }),
    }),
  }),
  update,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: fromMock }),
}));

const sendMock = vi.fn();
vi.mock("@/lib/email", () => ({ sendRsvpEmail: sendMock }));

beforeEach(() => {
  vi.resetModules();
  fromMock.mockClear();
  limit.mockReset();
  eq.mockReset();
  update.mockClear();
  sendMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

async function call(headers: Record<string, string> = {}) {
  vi.stubEnv("CRON_SECRET", "x".repeat(32));
  const { POST } = await import("@/app/api/cron/email-retry/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/cron/email-retry", {
    method: "POST",
    headers,
  });
  return POST(req);
}

describe("POST /api/cron/email-retry", () => {
  it("401 sem secret", async () => {
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("401 com secret errado", async () => {
    const res = await call({ "x-cron-secret": "wrong-but-32-bytes-padding-zzzz" });
    expect(res.status).toBe(401);
  });

  it("401 quando CRON_SECRET muito curto", async () => {
    vi.stubEnv("CRON_SECRET", "short");
    const { POST } = await import("@/app/api/cron/email-retry/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/cron/email-retry", {
      method: "POST",
      headers: { "x-cron-secret": "short" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("happy path: envia para candidatos pendentes via header x-cron-secret", async () => {
    limit.mockResolvedValue({
      data: [
        { id: "g1", email: "a@x.pt", name: "A", token: "11111111-1111-4111-8111-111111111111", created_at: "" },
      ],
      error: null,
    });
    eq.mockResolvedValue({ data: null, error: null });
    sendMock.mockResolvedValue({ id: "msg" });
    const res = await call({ "x-cron-secret": "x".repeat(32) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.candidates).toBe(1);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ email_sent_at: expect.any(String), email_attempts: expect.any(Number) }),
    );
  });

  it("happy path via Authorization Bearer", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    const res = await call({ authorization: `Bearer ${"x".repeat(32)}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toBe(0);
  });

  it("erro de query → 500", async () => {
    limit.mockResolvedValue({ data: null, error: { code: "X" } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ "x-cron-secret": "x".repeat(32) });
    expect(res.status).toBe(500);
    err.mockRestore();
  });

  it("falha de send conta como failed mas continua", async () => {
    limit.mockResolvedValue({
      data: [
        { id: "g1", email: "a@x.pt", name: "A", token: "11111111-1111-4111-8111-111111111111", created_at: "", email_attempts: 0 },
        { id: "g2", email: "b@x.pt", name: "B", token: "22222222-2222-4222-8222-222222222222", created_at: "", email_attempts: 0 },
      ],
      error: null,
    });
    eq.mockResolvedValue({ data: null, error: null });
    sendMock
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce({ id: "msg" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await call({ "x-cron-secret": "x".repeat(32) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
    warn.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-guard", () => ({ requireAdmin: requireAdminMock }));

const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

beforeEach(() => {
  requireAdminMock.mockReset();
  rateLimitMock.mockReset();
});

afterEach(() => vi.restoreAllMocks());

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest("https://quic.pt/api/admin/something", {
    method: "PATCH",
    headers,
  });
}

describe("withAdminGuard", () => {
  it("delega para handler quando admin OK", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@quic.pt" },
    });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const handler = vi.fn(async () => NextResponse.json({ pong: true }));
    const route = withAdminGuard(handler);
    const res = await route(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("retorna response do guard quando não autorizado", async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "no" }, { status: 401 }),
    });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const handler = vi.fn();
    const route = withAdminGuard(handler);
    const res = await route(makeReq());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rate-limit OK → handler corre", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@quic.pt" },
    });
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = withAdminGuard(handler, {
      rateLimit: {
        key: (u) => `key:${u.email}`,
        max: 5,
        windowMs: 60_000,
      },
    });
    const res = await route(makeReq());
    expect(res.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledWith("key:a@quic.pt", 5, 60_000);
  });

  it("rate-limit excedido → 429 com Retry-After", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@quic.pt" },
    });
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 7 });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const handler = vi.fn();
    const route = withAdminGuard(handler, {
      rateLimit: {
        key: () => "key",
        max: 1,
        windowMs: 60_000,
      },
    });
    const res = await route(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rate-limit degraded → 503", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@quic.pt" },
    });
    rateLimitMock.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 30,
      degraded: true,
    });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const route = withAdminGuard(async () => NextResponse.json({}), {
      rateLimit: { key: () => "k", max: 1, windowMs: 60_000 },
    });
    const res = await route(makeReq());
    expect(res.status).toBe(503);
  });

  it("passes params from route context", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@quic.pt" },
    });
    const { withAdminGuard } = await import("@/lib/with-admin-guard");
    const handler = vi.fn(async ({ params }) =>
      NextResponse.json({ id: (params as { id: string }).id }),
    );
    const route = withAdminGuard<{ id: string }>(handler);
    const res = await route(makeReq(), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(await res.json()).toEqual({ id: "abc" });
  });
});

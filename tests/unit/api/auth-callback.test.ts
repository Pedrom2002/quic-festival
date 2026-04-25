import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeResult = { value: { error: null as { message: string } | null } };
const exchangeMock = vi.fn(async () => exchangeResult.value);

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { exchangeCodeForSession: exchangeMock },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  exchangeMock.mockClear();
  exchangeResult.value = { error: null };
});
afterEach(() => vi.restoreAllMocks());

async function call(url: string) {
  const { GET } = await import("@/app/auth/callback/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(url));
}

describe("GET /auth/callback", () => {
  it("sem code → redirect /admin", async () => {
    const res = await call("https://quic.pt/auth/callback");
    expect(res.headers.get("location")).toBe("https://quic.pt/admin");
  });

  it("com code happy → redirect /admin", async () => {
    const res = await call("https://quic.pt/auth/callback?code=abc");
    expect(exchangeMock).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("https://quic.pt/admin");
  });

  it("exchange falha → redirect login?err=exchange", async () => {
    exchangeResult.value = { error: { message: "x" } };
    const res = await call("https://quic.pt/auth/callback?code=abc");
    expect(res.headers.get("location")).toContain("/admin/login?err=exchange");
  });

  describe("safeNext", () => {
    it("aceita path interno", async () => {
      const res = await call("https://quic.pt/auth/callback?next=/admin/scan");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin/scan");
    });

    it("rejeita protocol-relative //evil", async () => {
      const res = await call("https://quic.pt/auth/callback?next=//evil.test");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin");
    });

    it("rejeita /\\evil (backslash)", async () => {
      const res = await call("https://quic.pt/auth/callback?next=/%5Cevil");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin");
    });

    it("rejeita absolute URL", async () => {
      const res = await call("https://quic.pt/auth/callback?next=https://evil.test/x");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin");
    });

    it("rejeita CRLF injection", async () => {
      const res = await call("https://quic.pt/auth/callback?next=/x%0d%0aSet-Cookie");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin");
    });

    it("string vazia → /admin", async () => {
      const res = await call("https://quic.pt/auth/callback?next=");
      expect(res.headers.get("location")).toBe("https://quic.pt/admin");
    });
  });
});

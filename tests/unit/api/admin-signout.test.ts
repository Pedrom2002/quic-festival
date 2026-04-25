import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn(async () => {});
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, audit: auditMock };
});

const userResult = { value: { data: { user: { email: "admin@quic.pt" } }, error: null } as { data: { user: { email: string } | null }; error: unknown } };
const signOutMock = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => userResult.value,
      signOut: signOutMock,
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  auditMock.mockClear();
  signOutMock.mockClear();
  userResult.value = { data: { user: { email: "admin@quic.pt" } }, error: null };
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
});

afterEach(() => vi.unstubAllEnvs());

async function call(headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/admin/signout/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://quic.pt/api/admin/signout", {
    method: "POST",
    headers,
  });
  return POST(req);
}

describe("POST /api/admin/signout", () => {
  it("redireciona 303 para /admin/login", async () => {
    const res = await call();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/admin/login");
    expect(signOutMock).toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.signout", actorEmail: "admin@quic.pt" }),
    );
  });

  it("audit com actorEmail null se sem session", async () => {
    userResult.value = { data: { user: null }, error: null };
    await call();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorEmail: null }),
    );
  });

  it("usa fallback http://localhost:3000 sem NEXT_PUBLIC_SITE_URL", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const res = await call();
    expect(res.headers.get("location")).toContain("localhost:3000");
  });

  it("ip propagado para audit", async () => {
    await call({ "x-forwarded-for": "1.1.1.1" });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "1.1.1.1" }),
    );
  });
});

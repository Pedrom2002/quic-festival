import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminQuery = {
  value: { error: null as { message: string } | null },
  throwOn: false as boolean,
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    if (adminQuery.throwOn) throw new Error("env missing");
    return {
      from: () => ({
        select: () => ({
          limit: async () => adminQuery.value,
        }),
      }),
    };
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("BREVO_API_KEY", "re_test");
  adminQuery.value = { error: null };
  adminQuery.throwOn = false;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function call() {
  const { GET } = await import("@/app/api/health/route");
  return GET();
}

describe("GET /api/health", () => {
  it("happy: 200 com supabase=ok email=ok", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checks).toEqual({ supabase: "ok", email: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("supabase erro → 503 supabase=fail", async () => {
    adminQuery.value = { error: { message: "boom" } };
    const res = await call();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.checks.supabase).toBe("fail");
  });

  it("supabase throw → 503 supabase=fail", async () => {
    adminQuery.throwOn = true;
    const res = await call();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.checks.supabase).toBe("fail");
  });

  it("BREVO_API_KEY ausente → 503 email=fail", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const res = await call();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.checks.email).toBe("fail");
  });
});

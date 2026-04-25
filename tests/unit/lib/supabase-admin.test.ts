import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn(() => ({ id: "client" }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

beforeEach(() => {
  createClientMock.mockClear();
  vi.resetModules();
});

afterEach(() => vi.unstubAllEnvs());

describe("supabaseAdmin", () => {
  it("throw quando env ausente", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    expect(() => supabaseAdmin()).toThrow(/Env em falta/);
  });

  it("singleton: 2 chamadas → mesma instância", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const a = supabaseAdmin();
    const b = supabaseAdmin();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith("https://x.supabase.co", "k", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});

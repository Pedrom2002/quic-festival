import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setMock = vi.fn();
const getAllMock = vi.fn(() => [{ name: "sb", value: "v" }]);
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: getAllMock, set: setMock }),
}));

const createServerClientMock = vi.fn((_url, _key, opts: { cookies: { getAll: () => unknown; setAll: (a: unknown) => void } }) => opts);
vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  setMock.mockClear();
  createServerClientMock.mockClear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

afterEach(() => vi.unstubAllEnvs());

describe("supabaseServer", () => {
  it("hardenOptions força httpOnly+sameSite=lax+path=/ e secure depende NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { supabaseServer } = await import("@/lib/supabase/server");
    const opts = (await supabaseServer()) as unknown as { cookies: { setAll: (a: { name: string; value: string; options?: unknown }[]) => void } };
    opts.cookies.setAll([{ name: "sb", value: "v", options: { sameSite: "strict" } }]);
    expect(setMock).toHaveBeenCalledWith("sb", "v", expect.objectContaining({
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
    }));
  });

  it("dev: secure=false por defeito", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { supabaseServer } = await import("@/lib/supabase/server");
    const opts = (await supabaseServer()) as unknown as { cookies: { setAll: (a: { name: string; value: string; options?: unknown }[]) => void } };
    opts.cookies.setAll([{ name: "sb", value: "v" }]);
    expect(setMock).toHaveBeenCalledWith("sb", "v", expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    }));
  });

  it("setAll engole erros (Server Component)", async () => {
    setMock.mockImplementationOnce(() => { throw new Error("readonly"); });
    const { supabaseServer } = await import("@/lib/supabase/server");
    const opts = (await supabaseServer()) as unknown as { cookies: { setAll: (a: unknown[]) => void } };
    expect(() => opts.cookies.setAll([{ name: "sb", value: "v" }])).not.toThrow();
  });

  it("getAll devolve cookies do store", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const opts = (await supabaseServer()) as unknown as { cookies: { getAll: () => unknown } };
    expect(opts.cookies.getAll()).toEqual([{ name: "sb", value: "v" }]);
  });
});

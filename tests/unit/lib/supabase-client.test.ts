import { describe, expect, it, vi } from "vitest";

const createBrowserClientMock = vi.fn(() => ({ id: "browser" }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

describe("supabaseBrowser", () => {
  it("instancia createBrowserClient com env vars", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://b.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-b");
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    const c = supabaseBrowser();
    expect(c).toEqual({ id: "browser" });
    expect(createBrowserClientMock).toHaveBeenCalledWith("https://b.supabase.co", "anon-b");
  });
});

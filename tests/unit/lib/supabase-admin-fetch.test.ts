import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Verifica que o cliente passa um global.fetch que aplica timeout via
// AbortSignal e respeita signal já existente (AbortSignal.any).

let captured: { url: RequestInfo | URL; init?: RequestInit } | null = null;

const createClientMock = vi.fn((url, key, opts: { global?: { fetch?: (u: RequestInfo | URL, i?: RequestInit) => Promise<Response> } }) => ({
  __fetch: opts.global?.fetch,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

beforeEach(() => {
  vi.resetModules();
  createClientMock.mockClear();
  captured = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = { url, init };
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("supabaseAdmin global.fetch", () => {
  it("injecta AbortSignal.timeout quando init.signal ausente", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const client = supabaseAdmin() as unknown as { __fetch: (u: RequestInfo | URL, i?: RequestInit) => Promise<Response> };
    expect(typeof client.__fetch).toBe("function");
    await client.__fetch("https://example.invalid/x");
    expect(captured?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("combina signal existente com timeout via AbortSignal.any", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const client = supabaseAdmin() as unknown as { __fetch: (u: RequestInfo | URL, i?: RequestInit) => Promise<Response> };
    const userController = new AbortController();
    await client.__fetch("https://example.invalid/y", { signal: userController.signal });
    expect(captured?.init?.signal).toBeInstanceOf(AbortSignal);
    // O signal exposed deve abortar quando o user controller aborta.
    userController.abort();
    expect(captured?.init?.signal?.aborted).toBe(true);
  });
});

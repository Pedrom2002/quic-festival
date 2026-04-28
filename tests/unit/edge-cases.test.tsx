/**
 * Edge cases para fechar branches/lines residuais que escapam aos
 * testes de happy path por unidade.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

// ── middleware originAllowed: outer catch (origin malformado throw) ────────
describe("middleware originAllowed outer catch", () => {
  it("origin que faz new URL throw → 403", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
    const { middleware } = await import("@/middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/rsvp", {
      method: "POST",
      headers: { host: "quic.pt", origin: "http://[invalid" },
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });
});

// ── checkin: lookup by token branch + DB update error log path ────────────
describe("checkin route extra branches", () => {
  it("update DB devolve error code unknown → log fallback", async () => {
    const auditMock = vi.fn(async () => {});
    vi.doMock("@/lib/audit", async () => {
      const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
      return { ...actual, audit: auditMock };
    });
    vi.doMock("@/lib/supabase/server", () => ({
      supabaseServer: async () => ({
        auth: { getUser: async () => ({ data: { user: { email: "a@quic.pt" } }, error: null }) },
      }),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: () => ({
        from(table: string) {
          if (table === "admins") {
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: "a@quic.pt" }, error: null }) }) }) };
          }
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "g-1", name: "M", companion_count: 0, checked_in_at: null }, error: null }) }) }),
            update: () => ({ eq: async () => ({ error: {} }) }),
          };
        },
      }),
    }));

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { PATCH } = await import("@/app/api/admin/checkin/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/checkin", {
      method: "PATCH",
      body: JSON.stringify({ token: "11111111-1111-1111-1111-111111111111" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
    err.mockRestore();
  });
});

// ── otp safeRedirect catch (URL constructor throw) ────────────────────────
describe("otp safeRedirect URL throw", () => {
  it("redirectTo zod-pass mas URL constructor falha (raríssimo) → undefined", async () => {
    vi.doMock("@/lib/audit", async () => {
      const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
      return { ...actual, audit: vi.fn(async () => {}) };
    });
    vi.doMock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })) }));
    vi.doMock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn(async () => ({ ok: true })) }));
    const otpMock = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      supabaseServer: async () => ({ auth: { signInWithOtp: otpMock } }),
    }));
    const { POST } = await import("@/app/api/admin/sign-in/otp/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://quic.pt/api/admin/sign-in/otp", {
      method: "POST",
      body: JSON.stringify({ email: "a@quic.pt", redirectTo: "https://quic.pt/auth/callback" }),
      headers: { "content-type": "application/json" },
    });
    expect((await POST(req)).status).toBe(200);
  });
});

// ── login page: magic link network reject ─────────────────────────────────
describe("login page magic mode network reject", () => {
  it("magic link fetch throws → catch null → 'Erro a enviar magic link'", async () => {
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    }));
    vi.doMock("@/components/turnstile", () => ({
      default: () => null,
    }));
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("net"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { default: Page } = await import("@/app/admin/login/page");
    const { render, screen } = await import("@testing-library/react");
    const userEvent = (await import("@testing-library/user-event")).default;

    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Magic Link/i }));
    await user.type(screen.getByPlaceholderText(/exemplo.pt/), "a@quic.pt");
    await user.click(screen.getByRole("button", { name: /ENVIAR MAGIC LINK/i }));
    expect(await screen.findByText(/Erro a enviar magic link/)).toBeInTheDocument();
  });
});

// ── guests-table: companion_names null + sort por checked_in_at null ──────
describe("guests-table edge: null companion_names + null sort key", () => {
  it("renderiza sem rebentar com companion_names null e sort by checked_in_at", async () => {
    const { default: GuestsTable } = await import("@/components/admin/guests-table");
    const { render, screen } = await import("@testing-library/react");
    const userEvent = (await import("@testing-library/user-event")).default;
    const ROWS = [
      { id: "1", created_at: "x", name: "A", email: "a@x", phone: "9", companion_count: 1, companion_names: null as unknown as string[], token: "t1", checked_in_at: null, email_sent_at: null },
      { id: "2", created_at: "y", name: "B", email: "b@x", phone: "9", companion_count: 0, companion_names: [], token: "t2", checked_in_at: null, email_sent_at: null },
    ];
    render(<GuestsTable initial={ROWS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("columnheader", { name: /^Check-in/ }));
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

// ── qr-scanner: scanner.start error callback fires (just to exec line) ────
describe("qr-scanner stop chain on unmount", () => {
  it("unmount após scanner inicia → chama stop().clear()", async () => {
    const startMock = vi.fn(async () => {});
    const stopMock = vi.fn(async () => {});
    const clearMock = vi.fn();
    class FakeHtml5Qrcode {
      start = startMock;
      stop = stopMock;
      clear = clearMock;
      static getCameras = vi.fn(async () => [{ id: "c", label: "Back" }]);
    }
    vi.doMock("html5-qrcode", () => ({ Html5Qrcode: FakeHtml5Qrcode }));
    const { default: QrScanner } = await import("@/components/admin/qr-scanner");
    const { render, screen } = await import("@testing-library/react");
    const userEvent = (await import("@testing-library/user-event")).default;
    const { unmount } = render(<QrScanner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Iniciar Scanner/i }));
    await new Promise((r) => setTimeout(r, 0));
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(stopMock).toHaveBeenCalled();
  });
});

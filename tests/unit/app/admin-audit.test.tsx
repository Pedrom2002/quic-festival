import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const result = { value: { data: [] as Record<string, unknown>[] | null, error: null as { code?: string } | null } };
const likeMock = vi.fn(() => Promise.resolve(result.value));
const limitMock = vi.fn(() => ({ like: likeMock, then: undefined }));
const orderMock = vi.fn(() => ({ limit: limitMock }));
const selectMock = vi.fn(() => ({ order: orderMock }));

const queryBuilder = {
  select: selectMock,
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => queryBuilder,
  }),
}));

beforeEach(() => {
  result.value = {
    data: [
      { id: 1, occurred_at: "2026-04-01T10:00:00Z", actor_email: "a@quic.pt", action: "admin.signin.password.ok", target_id: "t-12345678abcd", ip: "1.1.1.1", meta: { ctx: "x" } },
      { id: 2, occurred_at: "2026-04-01T11:00:00Z", actor_email: null, action: "admin.checkin.duplicate", target_id: null, ip: null, meta: null },
      { id: 3, occurred_at: "2026-04-01T12:00:00Z", actor_email: "x", action: "admin.signin.password.fail", target_id: null, ip: "2.2.2.2", meta: null },
      { id: 4, occurred_at: "2026-04-01T13:00:00Z", actor_email: "x", action: "admin.checkin.not_found", target_id: null, ip: null, meta: null },
      { id: 5, occurred_at: "2026-04-01T14:00:00Z", actor_email: "x", action: "admin.signin.otp.sent", target_id: null, ip: null, meta: null },
      { id: 6, occurred_at: "2026-04-01T15:00:00Z", actor_email: "x", action: "admin.export", target_id: null, ip: null, meta: null },
    ],
    error: null,
  };
  likeMock.mockClear();
  limitMock.mockClear();
  // limit returns object that is also awaitable — return a promise
  limitMock.mockReturnValue({
    like: likeMock,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result.value).then(resolve),
  } as never);
  likeMock.mockResolvedValue(result.value as never);
});
afterEach(() => vi.restoreAllMocks());

describe("AuditPage", () => {
  it("render rows com badges e formatos", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    const ui = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    expect(container.textContent).toContain("admin.signin.password.ok");
    expect(container.textContent).toContain("admin.checkin.duplicate");
    expect(container.textContent).toContain("a@quic.pt");
    expect(container.textContent).toContain("1.1.1.1");
    expect(container.textContent).toContain("t-12345");
  });

  it("filter inválido → cai para 'all' (whitelist)", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    await Page({ searchParams: Promise.resolve({ filter: "DROP TABLE" }) });
    expect(likeMock).not.toHaveBeenCalled();
  });

  it("filter válido aplica .like('admin.signin.%')", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    await Page({ searchParams: Promise.resolve({ filter: "admin.signin" }) });
    expect(likeMock).toHaveBeenCalledWith("action", "admin.signin.%");
  });

  it("data null → rows vazias + 'Sem entradas'", async () => {
    result.value = { data: null, error: null };
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    const ui = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    expect(container.textContent).toContain("Sem entradas");
  });

  it("error → banner erro", async () => {
    result.value = { data: [], error: { code: "x" } };
    limitMock.mockReturnValue({
      like: likeMock,
      then: (resolve: (v: unknown) => void) => Promise.resolve(result.value).then(resolve),
    } as never);
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    const ui = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    expect(container.textContent).toContain("Erro ao carregar");
  });

  it("colorFor: cobre todos os endings (.ok, .fail, .duplicate, .not_found, default)", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    const ui = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    expect(container.querySelector(".text-emerald-300")).toBeTruthy();
    expect(container.querySelector(".text-rose-300")).toBeTruthy();
    expect(container.querySelector(".text-amber-300")).toBeTruthy();
  });

  it("filter active: aplicação visual da pill amarela", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/audit/page");
    const ui = await Page({ searchParams: Promise.resolve({ filter: "admin.signin" }) });
    const { container } = render(ui);
    const active = container.querySelector("a.bg-\\[\\#FFD27A\\]");
    expect(active?.textContent).toContain("Logins");
  });
});

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inviteResult = {
  value: {
    data: {
      label: "Sonae",
      max_uses: 40,
      uses_count: 12,
      expires_at: null,
      archived_at: null,
    } as Record<string, unknown> | null,
    error: null,
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => inviteResult.value }),
      }),
    }),
  }),
}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/components/rsvp-form", () => ({
  default: ({ inviteCode }: { inviteCode?: string }) => (
    <div data-test="rsvp-form" data-code={inviteCode ?? ""} />
  ),
}));

vi.mock("@/components/scene", () => ({ default: () => null }));
vi.mock("@/components/lineup", () => ({ default: () => null }));

beforeEach(() => {
  notFoundMock.mockClear();
  inviteResult.value = {
    data: {
      label: "Sonae",
      max_uses: 40,
      uses_count: 12,
      expires_at: null,
      archived_at: null,
    },
    error: null,
  };
});
afterEach(() => vi.restoreAllMocks());

describe("InvitePage /i/[code]", () => {
  it("happy: render label + vagas + form (mesmo layout do /)", async () => {
    const { default: Page } = await import("@/app/i/[code]/page");
    const ui = await Page({ params: Promise.resolve({ code: "ABCDEFGHJKMN" }) });
    const { container } = render(ui);
    expect(container.textContent).toContain("Sonae");
    expect(container.textContent).toContain("28");
    const form = container.querySelector('[data-test="rsvp-form"]');
    expect(form?.getAttribute("data-code")).toBe("ABCDEFGHJKMN");
    expect(container.querySelector(".site-main")).not.toBeNull();
    expect(container.querySelector(".hero")).not.toBeNull();
    expect(container.querySelector(".form-wrap")).not.toBeNull();
    expect(container.querySelector(".invite-banner")).not.toBeNull();
  });

  it("código inválido → notFound", async () => {
    const { default: Page } = await import("@/app/i/[code]/page");
    await expect(
      Page({ params: Promise.resolve({ code: "invalid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("código inexistente → notFound", async () => {
    inviteResult.value = { data: null, error: null };
    const { default: Page } = await import("@/app/i/[code]/page");
    await expect(
      Page({ params: Promise.resolve({ code: "ABCDEFGHJKMN" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("arquivado → notFound", async () => {
    inviteResult.value = {
      data: { label: "X", max_uses: 1, uses_count: 0, expires_at: null, archived_at: "2024-01-01" },
      error: null,
    };
    const { default: Page } = await import("@/app/i/[code]/page");
    await expect(
      Page({ params: Promise.resolve({ code: "ABCDEFGHJKMN" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("expirado → mensagem expired, sem form", async () => {
    inviteResult.value = {
      data: {
        label: "X",
        max_uses: 1,
        uses_count: 0,
        expires_at: "2020-01-01T00:00:00Z",
        archived_at: null,
      },
      error: null,
    };
    const { default: Page } = await import("@/app/i/[code]/page");
    const ui = await Page({ params: Promise.resolve({ code: "ABCDEFGHJKMN" }) });
    const { container } = render(ui);
    expect(container.textContent).toMatch(/expirou/i);
    expect(container.querySelector('[data-test="rsvp-form"]')).toBeNull();
  });

  it("esgotado → mensagem exhausted, sem form", async () => {
    inviteResult.value = {
      data: {
        label: "X",
        max_uses: 5,
        uses_count: 5,
        expires_at: null,
        archived_at: null,
      },
      error: null,
    };
    const { default: Page } = await import("@/app/i/[code]/page");
    const ui = await Page({ params: Promise.resolve({ code: "ABCDEFGHJKMN" }) });
    const { container } = render(ui);
    expect(container.textContent).toMatch(/esgotado/i);
    expect(container.querySelector('[data-test="rsvp-form"]')).toBeNull();
  });
});

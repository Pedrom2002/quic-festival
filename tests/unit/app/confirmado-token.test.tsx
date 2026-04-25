import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guestResult = { value: { data: { name: "Maria", token: "tok-1", companion_count: 1, companion_names: ["Ana"] } as Record<string, unknown> | null, error: null } };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => guestResult.value,
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/qr", () => ({
  generateQrDataUrl: vi.fn(async () => "data:fake-qr"),
}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/components/confirmado-actions", () => ({
  default: () => <div data-test="actions" />,
}));

beforeEach(() => {
  notFoundMock.mockClear();
  guestResult.value = { data: { name: "Maria", token: "tok-1", companion_count: 1, companion_names: ["Ana"] }, error: null };
});
afterEach(() => vi.restoreAllMocks());

describe("ConfirmadoPage", () => {
  it("guest existente: render nome, QR, acompanhante", async () => {
    const { default: Page } = await import("@/app/confirmado/[token]/page");
    const ui = await Page({ params: Promise.resolve({ token: "tok-1" }) });
    const { container } = render(ui);
    expect(container.textContent).toContain("Maria");
    expect(container.textContent).toContain("Ana");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:fake-qr");
    expect(container.querySelector('[data-test="actions"]')).toBeTruthy();
  });

  it("companion_count=0: não mostra acompanhante", async () => {
    guestResult.value = { data: { name: "M", token: "t", companion_count: 0, companion_names: [] }, error: null };
    const { default: Page } = await import("@/app/confirmado/[token]/page");
    const ui = await Page({ params: Promise.resolve({ token: "t" }) });
    const { container } = render(ui);
    expect(container.textContent).not.toContain("Acompanhante:");
  });

  it("guest inexistente: chama notFound()", async () => {
    guestResult.value = { data: null, error: null };
    const { default: Page } = await import("@/app/confirmado/[token]/page");
    await expect(Page({ params: Promise.resolve({ token: "tok" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});

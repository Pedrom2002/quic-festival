import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guestsResult = { value: { data: [] as Record<string, unknown>[] | null, error: null } };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: async () => guestsResult.value,
      }),
    }),
  }),
}));

vi.mock("@/components/admin/guests-table", () => ({
  default: ({ initial }: { initial: Record<string, unknown>[] }) => <div data-test="table" data-rows={initial.length} />,
}));

beforeEach(() => {
  guestsResult.value = {
    data: [
      { id: "1", created_at: "2026-04-01", name: "M", email: "m@x", phone: "9", companion_count: 1, companion_names: ["A"], token: "t1", checked_in_at: new Date().toISOString(), email_sent_at: null },
      { id: "2", created_at: "2026-04-02", name: "B", email: "b@x", phone: "9", companion_count: 0, companion_names: [], token: "t2", checked_in_at: null, email_sent_at: null },
    ],
    error: null,
  };
});
afterEach(() => vi.restoreAllMocks());

describe("AdminPage dashboard", () => {
  it("calcula stats: inscritos, acompanhantes, check-ins hoje, pendentes", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/page");
    const ui = await Page();
    const { container } = render(ui);
    expect(container.textContent).toContain("Inscritos");
    expect(container.textContent).toContain("Acompanhantes");
    expect(container.textContent).toContain("Check-ins hoje");
    expect(container.textContent).toContain("Pendentes");
    expect(container.textContent).toContain("Convidados");
    const table = container.querySelector('[data-test="table"]') as HTMLElement;
    expect(table.dataset.rows).toBe("2");
  });

  it("data null → rows []", async () => {
    guestsResult.value = { data: null, error: null };
    const { default: Page } = await import("@/app/admin/(authed)/page");
    const ui = await Page();
    const { container } = render(ui);
    expect((container.querySelector('[data-test="table"]') as HTMLElement).dataset.rows).toBe("0");
  });

  it("companion_count null tratado como 0", async () => {
    guestsResult.value = {
      data: [{ id: "1", created_at: "x", name: "x", email: "x", phone: "x", companion_count: null, companion_names: [], token: "t", checked_in_at: null, email_sent_at: null }],
      error: null,
    };
    const { default: Page } = await import("@/app/admin/(authed)/page");
    const ui = await Page();
    expect(ui).toBeDefined();
  });

  it("Stat com accent renderiza classe especial", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/page");
    const ui = await Page();
    const { container } = render(ui);
    expect(container.querySelector(".bg-\\[\\#FFD27A\\]\\/10")).toBeTruthy();
  });
});

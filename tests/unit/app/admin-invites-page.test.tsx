import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const orderByCreated = vi.fn();
const orderByArchived = vi.fn(() => ({ order: orderByCreated }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ order: orderByArchived }),
    }),
  }),
}));

vi.mock("@/components/admin/invites-panel", () => ({
  default: ({ initialInvites }: { initialInvites: unknown[] }) => (
    <div data-test="panel" data-count={initialInvites.length} />
  ),
}));

beforeEach(() => {
  orderByCreated.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("AdminInvitesPage", () => {
  it("render panel com invites do server", async () => {
    orderByCreated.mockResolvedValue({
      data: [
        {
          id: "1",
          code: "ABC",
          label: "L",
          max_uses: 10,
          uses_count: 1,
          expires_at: null,
          archived_at: null,
          created_at: "2026-01-01",
        },
        {
          id: "2",
          code: "DEF",
          label: null,
          max_uses: 5,
          uses_count: 5,
          expires_at: null,
          archived_at: null,
          created_at: "2026-01-02",
        },
      ],
      error: null,
    });
    const { default: Page } = await import(
      "@/app/admin/(authed)/invites/page"
    );
    const ui = await Page();
    const { container } = render(ui);
    const panel = container.querySelector('[data-test="panel"]');
    expect(panel?.getAttribute("data-count")).toBe("2");
  });

  it("data null → array vazio", async () => {
    orderByCreated.mockResolvedValue({ data: null, error: null });
    const { default: Page } = await import(
      "@/app/admin/(authed)/invites/page"
    );
    const ui = await Page();
    const { container } = render(ui);
    expect(
      container.querySelector('[data-test="panel"]')?.getAttribute("data-count"),
    ).toBe("0");
  });
});

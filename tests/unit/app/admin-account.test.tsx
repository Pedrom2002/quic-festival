import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userResult = { value: { data: { user: { email: "a@quic.pt" } as { email: string } | null }, error: null } };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: async () => userResult.value } }),
}));

vi.mock("@/components/admin/account-form", () => ({
  default: () => <div data-test="form" />,
}));

beforeEach(() => {
  userResult.value = { data: { user: { email: "a@quic.pt" } }, error: null };
});
afterEach(() => vi.restoreAllMocks());

describe("AccountPage", () => {
  it("render email do user + AccountForm", async () => {
    const { default: Page } = await import("@/app/admin/(authed)/account/page");
    const ui = await Page();
    const { container } = render(ui);
    expect(container.textContent).toContain("a@quic.pt");
    expect(container.querySelector('[data-test="form"]')).toBeTruthy();
  });

  it("user null → '—'", async () => {
    userResult.value = { data: { user: null }, error: null };
    const { default: Page } = await import("@/app/admin/(authed)/account/page");
    const ui = await Page();
    const { container } = render(ui);
    expect(container.textContent).toContain("—");
  });
});

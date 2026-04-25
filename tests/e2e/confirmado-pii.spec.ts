import { expect, test } from "@playwright/test";

test.describe("PII headers /confirmado", () => {
  // Precisa de guest seed em DB. Pulado quando sem Supabase real.
  test.skip(() => !process.env.E2E_TEST_TOKEN, "precisa E2E_TEST_TOKEN seed");

  test("metadata noindex/nocache via Next.js robots meta", async ({ page }) => {
    const token = process.env.E2E_TEST_TOKEN!;
    await page.goto(`/confirmado/${token}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
    expect(robots).toContain("noarchive");
  });
});

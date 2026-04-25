import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("homepage carrega com form RSVP", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/QUIC|Festival/i);
    await expect(page.getByLabel(/Nome completo/)).toBeVisible();
    await expect(page.getByLabel(/Email/)).toBeVisible();
  });

  test("admin login redireciona não-autenticado", async ({ page }) => {
    const res = await page.goto("/admin");
    expect(res?.url()).toContain("/admin/login");
  });

  test("/api/qr com UUID inválido → 404", async ({ request }) => {
    const res = await request.get("/api/qr/not-a-uuid");
    expect(res.status()).toBe(404);
  });

  test("CSP nonce header presente em rota HTML", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  });
});

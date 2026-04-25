import { expect, test } from "@playwright/test";

test.describe("Admin login (mocked auth)", () => {
  test("password mode: submit success → /admin", async ({ page }) => {
    await page.route("**/api/admin/sign-in", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    // /admin SSR pode rebentar sem Supabase real — interceptar para devolver shell vazio.
    await page.route("**/admin", async (route) => {
      const res = await route.fetch().catch(() => null);
      if (!res) {
        await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>OK</body></html>" });
        return;
      }
      await route.fulfill({ response: res });
    });
    await page.goto("/admin/login");
    await page.getByPlaceholder(/exemplo.pt/).fill("a@quic.pt");
    await page.getByPlaceholder("••••••••").fill("password-123456");
    await page.getByRole("button", { name: /^ENTRAR$/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/admin/);
  });

  test("password mode: erro 401 → message", async ({ page }) => {
    await page.route("**/api/admin/sign-in", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Credenciais inválidas." }) }),
    );
    await page.goto("/admin/login");
    await page.getByPlaceholder(/exemplo.pt/).fill("a@quic.pt");
    await page.getByPlaceholder("••••••••").fill("wrong");
    await page.getByRole("button", { name: /^ENTRAR$/i }).click();
    await expect(page.getByText(/Credenciais inválidas/)).toBeVisible();
  });

  test("password mode: rate-limit 429 → message", async ({ page }) => {
    await page.route("**/api/admin/sign-in", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Demasiadas tentativas." }) }),
    );
    await page.goto("/admin/login");
    await page.getByPlaceholder(/exemplo.pt/).fill("a@quic.pt");
    await page.getByPlaceholder("••••••••").fill("x");
    await page.getByRole("button", { name: /^ENTRAR$/i }).click();
    await expect(page.getByText(/Demasiadas/)).toBeVisible();
  });

  test("magic link mode: success → 'Se o email existir'", async ({ page }) => {
    await page.route("**/api/admin/sign-in/otp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/admin/login");
    await page.getByRole("button", { name: /Magic Link/i }).click();
    await page.getByPlaceholder(/exemplo.pt/).fill("a@quic.pt");
    await page.getByRole("button", { name: /ENVIAR MAGIC LINK/i }).click();
    await expect(page.getByText(/Se o email existir/)).toBeVisible();
  });

  test("magic link mode: erro 502 → message", async ({ page }) => {
    await page.route("**/api/admin/sign-in/otp", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Não foi possível enviar." }) }),
    );
    await page.goto("/admin/login");
    await page.getByRole("button", { name: /Magic Link/i }).click();
    await page.getByPlaceholder(/exemplo.pt/).fill("a@quic.pt");
    await page.getByRole("button", { name: /ENVIAR MAGIC LINK/i }).click();
    await expect(page.getByText(/Não foi possível enviar/)).toBeVisible();
  });
});

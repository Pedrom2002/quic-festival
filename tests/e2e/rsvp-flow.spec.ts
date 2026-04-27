import { expect, test } from "@playwright/test";

// Skip em WebKit pelos mesmos motivos descritos em admin-login.spec.ts.
test.skip(
  ({ browserName }) => browserName === "webkit",
  "WebKit/Linux hydration delay; covered manualmente em iPhone real.",
);

// Form RSVP só é renderizado em /i/[code] (invite-only). Esses caminhos
// requerem invite válido no DB → não dá para mockar via page.route. Os
// fluxos abaixo ficam cobertos por tests unit em tests/unit/components/
// rsvp-form.test.tsx + tests/unit/api/rsvp*.test.ts.
test.describe.skip("RSVP form (mocked /api/rsvp)", () => {
  test("validação client-side: nome curto bloqueia submit", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Nome completo/).fill("x");
    await page.getByLabel(/Email/).fill("a@b.pt");
    await page.getByLabel(/^Telefone/).first().fill("912345678");
    await page.getByLabel(/^NÃO$/).check();
    await page.getByRole("button", { name: /CONFIRMAR/i }).click();
    await expect(page.getByText(/curto|inválidos/i)).toBeVisible();
  });

  test("submit success → /confirmado/{token}", async ({ page }) => {
    await page.route("**/api/rsvp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "tok-123" }) }),
    );
    await page.route("**/api/qr/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }),
    );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Nome completo/).fill("Maria Silva");
    await page.getByLabel(/Email/).fill("maria@test.pt");
    await page.getByLabel(/^Telefone/).first().fill("912345678");
    await page.getByLabel(/^NÃO$/).check();
    await page.getByRole("button", { name: /CONFIRMAR/i }).click();
    await expect(page).toHaveURL(/\/confirmado\/tok-123/, { timeout: 10_000 });
  });

  test("rate-limit 429 → banner alert", async ({ page }) => {
    await page.route("**/api/rsvp", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Demasiados pedidos." }) }),
    );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Nome completo/).fill("Maria Silva");
    await page.getByLabel(/Email/).fill("maria@test.pt");
    await page.getByLabel(/^Telefone/).first().fill("912345678");
    await page.getByLabel(/^NÃO$/).check();
    await page.getByRole("button", { name: /CONFIRMAR/i }).click();
    await expect(page.getByRole("alert").getByText(/Demasiados/)).toBeVisible();
  });

  test("dedup {ok:true} sem token → mensagem genérica", async ({ page }) => {
    await page.route("**/api/rsvp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Nome completo/).fill("Maria Silva");
    await page.getByLabel(/Email/).fill("maria@test.pt");
    await page.getByLabel(/^Telefone/).first().fill("912345678");
    await page.getByLabel(/^NÃO$/).check();
    await page.getByRole("button", { name: /CONFIRMAR/i }).click();
    await expect(page.getByRole("status")).toContainText(/Inscrição recebida/);
  });

  test("acompanhante=sim revela campos extra", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/^SIM$/).check();
    await expect(page.getByLabel(/Nome do acompanhante/)).toBeVisible();
    await expect(page.getByLabel(/Telefone do acompanhante/)).toBeVisible();
  });
});

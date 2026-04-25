import { expect, test } from "@playwright/test";

test.describe("Security headers + CSRF + body-size", () => {
  test("HSTS / X-Frame / X-Content-Type / Permissions-Policy no /", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toContain("strict-origin");
    expect(h["permissions-policy"]).toContain("camera=(self)");
  });

  test("CSP nonce strict-dynamic em prod build", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  });

  test("CSRF: POST cross-origin sem Sec-Fetch-Site → 403", async ({ request, baseURL }) => {
    const res = await request.fetch(`${baseURL}/api/rsvp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.test" },
      data: JSON.stringify({ name: "x", email: "a@b.pt", phone: "912345678", acompanhante: "nao" }),
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test("body-size: POST > 64KB → 413", async ({ request, baseURL }) => {
    const big = "x".repeat(70_000);
    const res = await request.fetch(`${baseURL}/api/rsvp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        "content-length": String(70_000),
      },
      data: big,
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(413);
  });

  test("PII headers /api/ics/{uuid invalido} → 404 sem cache", async ({ request }) => {
    const res = await request.get("/api/ics/not-uuid", { failOnStatusCode: false });
    expect(res.status()).toBe(404);
  });

  test("/api/qr UUID inválido → 404 cedo (pré-DB)", async ({ request }) => {
    const res = await request.get("/api/qr/invalid", { failOnStatusCode: false });
    expect(res.status()).toBe(404);
  });
});

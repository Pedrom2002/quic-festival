import { expect, test } from "@playwright/test";

test.describe("Rate limit (depende de Upstash configurado em test env)", () => {
  test.skip(() => !process.env.UPSTASH_REDIS_REST_URL, "precisa Upstash");

  test("11ª submissão RSVP do mesmo IP → 429", async ({ request, baseURL }) => {
    const body = JSON.stringify({ name: "Maria Silva", email: `t${Date.now()}@x.pt`, phone: "912345678", acompanhante: "nao" });
    const headers = { "content-type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": `1.1.1.${Date.now() % 250}` };
    let last: number = 200;
    for (let i = 0; i < 12; i++) {
      const r = await request.fetch(`${baseURL}/api/rsvp`, { method: "POST", headers, data: body, failOnStatusCode: false });
      last = r.status();
    }
    expect(last).toBe(429);
  });
});

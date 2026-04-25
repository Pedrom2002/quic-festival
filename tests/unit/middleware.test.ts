import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return actual;
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
});
afterEach(() => vi.unstubAllEnvs());

type FakeReqOpts = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
};

async function callMiddleware(opts: FakeReqOpts) {
  const { middleware } = await import("@/middleware");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(opts.url, {
    method: opts.method ?? "GET",
    headers: opts.headers,
  });
  return middleware(req);
}

describe("middleware host enforcement (prod)", () => {
  it("redirect 308 quando host !== canonical", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await callMiddleware({
      url: "https://preview.vercel.app/x",
      headers: { host: "preview.vercel.app" },
    });
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("https://quic.pt");
  });

  it("passa quando host = canonical", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await callMiddleware({
      url: "https://quic.pt/x",
      headers: { host: "quic.pt" },
    });
    expect(res.status).toBe(200);
  });

  it("malformed NEXT_PUBLIC_SITE_URL → fail-open", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    const res = await callMiddleware({
      url: "https://quic.pt/x",
      headers: { host: "preview.vercel.app" },
    });
    expect(res.status).toBe(200);
  });

  it("dev: sem redirect mesmo em host diferente", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await callMiddleware({
      url: "http://localhost:3000/x",
      headers: { host: "localhost:3000" },
    });
    expect(res.status).toBe(200);
  });
});

describe("middleware CSP nonce", () => {
  it("HTML route recebe CSP header com nonce", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await callMiddleware({
      url: "https://quic.pt/",
      headers: { host: "quic.pt" },
    });
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("strict-dynamic");
    expect(csp).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  });

  it("dev CSP usa unsafe-eval", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await callMiddleware({
      url: "http://localhost:3000/",
      headers: { host: "localhost:3000" },
    });
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("unsafe-eval");
    expect(csp).not.toContain("strict-dynamic");
  });

  it("API routes não recebem CSP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "GET",
      headers: { host: "quic.pt" },
    });
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("static assets não recebem CSP", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/logo.png",
      headers: { host: "quic.pt" },
    });
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});

describe("middleware CSRF", () => {
  it("POST same-origin via Sec-Fetch-Site passa", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(200);
  });

  it("POST same-site via Sec-Fetch-Site passa", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", "sec-fetch-site": "same-site" },
    });
    expect(res.status).toBe(200);
  });

  it("POST cross-site sem origin válida → 403", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });

  it("POST com Origin igual ao host passa", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", origin: "https://quic.pt" },
    });
    expect(res.status).toBe(200);
  });

  it("POST com Origin allowed via NEXT_PUBLIC_SITE_URL passa", async () => {
    const res = await callMiddleware({
      url: "https://other.test/api/rsvp",
      method: "POST",
      headers: { host: "other.test", origin: "https://quic.pt" },
    });
    expect(res.status).toBe(200);
  });

  it("POST com Origin malformado → 403", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", origin: "javascript:alert(1)" },
    });
    expect(res.status).toBe(403);
  });

  it("POST sem origin nem sec-fetch → 403", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt" },
    });
    expect(res.status).toBe(403);
  });

  it("GET API não exige CSRF", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/qr/x",
      method: "GET",
      headers: { host: "quic.pt" },
    });
    expect(res.status).toBe(200);
  });

  it("HEAD/OPTIONS são safe methods", async () => {
    for (const method of ["HEAD", "OPTIONS"]) {
      const res = await callMiddleware({
        url: "https://quic.pt/api/rsvp",
        method,
        headers: { host: "quic.pt" },
      });
      expect(res.status).toBe(200);
    }
  });

  it("origin com URL inválida no allowed → 403", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url");
    const res = await callMiddleware({
      url: "https://other.test/api/rsvp",
      method: "POST",
      headers: { host: "other.test", origin: "https://attacker.test" },
    });
    expect(res.status).toBe(403);
  });
});

describe("middleware body size", () => {
  it("Content-Length acima de 64KB → 413", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: {
        host: "quic.pt",
        "sec-fetch-site": "same-origin",
        "content-length": String(70_000),
      },
    });
    expect(res.status).toBe(413);
  });

  it("Content-Length dentro do limite passa", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: {
        host: "quic.pt",
        "sec-fetch-site": "same-origin",
        "content-length": "1024",
      },
    });
    expect(res.status).toBe(200);
  });

  it("Content-Length não numérico ignora", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: {
        host: "quic.pt",
        "sec-fetch-site": "same-origin",
        "content-length": "abc",
      },
    });
    expect(res.status).toBe(200);
  });

  it("sem Content-Length passa", async () => {
    const res = await callMiddleware({
      url: "https://quic.pt/api/rsvp",
      method: "POST",
      headers: { host: "quic.pt", "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(200);
  });
});

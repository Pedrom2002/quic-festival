import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

afterEach(() => vi.unstubAllEnvs());

describe("robots", () => {
  it("usa NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
    const r = robots();
    expect(r.host).toBe("https://quic.pt");
    expect(r.sitemap).toBe("https://quic.pt/sitemap.xml");
    const rules = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toEqual(["/"]);
    expect(rules.disallow).toEqual(["/admin", "/admin/", "/api", "/api/", "/auth", "/confirmado"]);
  });

  it("fallback default URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(robots().host).toBe("https://quic-festival.vercel.app");
  });
});

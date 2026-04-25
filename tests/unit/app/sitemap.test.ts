import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("sitemap", () => {
  it("entry homepage com base URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
    const s = sitemap();
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s[0]!.url).toBe("https://quic.pt/");
    expect(s[0]!.changeFrequency).toBe("weekly");
    expect(s[0]!.priority).toBe(1);
    expect(s[0]!.lastModified).toBeInstanceOf(Date);
  });

  it("inclui /privacidade", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://quic.pt");
    const s = sitemap();
    const priv = s.find((e) => e.url.endsWith("/privacidade"));
    expect(priv).toBeDefined();
    expect(priv!.priority).toBeLessThan(1);
  });

  it("fallback default URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(sitemap()[0]!.url).toBe("https://quic-festival.vercel.app/");
  });
});

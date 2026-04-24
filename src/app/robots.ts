import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://quic-festival.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin", "/admin/", "/api", "/api/", "/auth", "/confirmado"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

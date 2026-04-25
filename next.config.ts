import type { NextConfig } from "next";

// CSP é aplicada via middleware.ts (nonce-based per-request).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Bundle analyzer: corre só com ANALYZE=true (npm run analyze).
// `require` runtime tolera ausência do package em CI/prod.
let exported: NextConfig = nextConfig;
if (process.env.ANALYZE === "true") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: true });
    exported = withBundleAnalyzer(nextConfig);
  } catch {
    /* analyzer not installed; continue */
  }
}

export default exported;

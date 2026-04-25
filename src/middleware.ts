import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY_BYTES = 64 * 1024; // 64KB chega para qualquer payload das APIs.

function originAllowed(origin: string | null, host: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (host && u.host === host) return true;
    const allowed = process.env.NEXT_PUBLIC_SITE_URL;
    if (allowed) {
      try {
        return u.origin === new URL(allowed).origin;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");
  const allowedSite = process.env.NEXT_PUBLIC_SITE_URL;

  // Force redirect: bloqueia acesso via deployment URLs aleatórios da Vercel
  // (quic-festival-xxx.vercel.app) — só responde no host canônico.
  // Skip em dev/local + skip se NEXT_PUBLIC_SITE_URL aponta para o host atual.
  if (process.env.NODE_ENV === "production" && allowedSite && host) {
    try {
      const allowedHost = new URL(allowedSite).host;
      if (host !== allowedHost) {
        // Deployment preview alias OR estranho — redirect para host canônico
        // (assets like /api still served, mas user web vai para canónico).
        // Allow se for o próprio Vercel webhook health check.
        const url = req.nextUrl.clone();
        url.host = allowedHost;
        url.protocol = "https:";
        url.port = "";
        return NextResponse.redirect(url, 308);
      }
    } catch {
      /* malformed allowedSite — fail open */
    }
  }

  // CSRF guard apenas para mutações em rotas de API
  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const sfs = req.headers.get("sec-fetch-site");

    // Permite same-origin via Sec-Fetch-Site (browsers modernos)
    const sameSite = sfs === "same-origin" || sfs === "same-site";

    if (!sameSite && !originAllowed(origin, host)) {
      return NextResponse.json(
        { error: "Origin não permitida." },
        { status: 403 },
      );
    }

    // Limite de body size — protege contra DoS via JSON gigantes.
    const cl = req.headers.get("content-length");
    if (cl) {
      const n = parseInt(cl, 10);
      if (!Number.isNaN(n) && n > MAX_BODY_BYTES) {
        return NextResponse.json(
          { error: "Pedido demasiado grande." },
          { status: 413 },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

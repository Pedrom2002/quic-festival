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

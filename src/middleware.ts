import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY_BYTES = 64 * 1024; // 64KB chega para qualquer payload das APIs.
const isProd = process.env.NODE_ENV === "production";

function generateNonce(): string {
  // Edge runtime tem crypto global.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function buildCsp(nonce: string): string {
  // 'strict-dynamic': scripts loaded by trusted (nonce-bearing) scripts are
  // trusted transitively. CSP3-aware browsers ignore explicit allowlists when
  // strict-dynamic is present, so production drops 'https:' / 'unsafe-inline'.
  // Dev keeps the broader policy because Next injects many ad-hoc chunks.
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com`;

  // style-src: idealmente queríamos remover 'unsafe-inline' por completo, mas
  // Tailwind v4 + Next CSS injection ainda usa <style> sem nonce em alguns
  // caminhos. Damos nonce para browsers que o honram; 'unsafe-inline' fica
  // como fallback. A remoção total fica para quando Next emitir nonces para
  // todos os style tags.
  const styleSrc = `'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com https://api.resend.com https://va.vercel-scripts.com https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

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
    /* v8 ignore next */
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

  // ── CSP nonce-based (apenas para requests de página, não APIs/static) ──
  // Skip CSP injection em rotas API (já não fazem render HTML).
  let nonce: string | null = null;
  let csp: string | null = null;
  const isHtmlRoute =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|map|txt|xml)$/i);

  if (isHtmlRoute) {
    nonce = generateNonce();
    csp = buildCsp(nonce);
  }

  // CSRF guard apenas para mutações em rotas de API
  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const sfs = req.headers.get("sec-fetch-site");

    // Apenas same-origin é aceite via Sec-Fetch-Site. 'same-site' permitiria
    // ataques de subdomínio noutro contexto; aqui só temos um host canónico.
    const sameOrigin = sfs === "same-origin";

    if (!sameOrigin && !originAllowed(origin, host)) {
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

  // Propaga nonce para Next via request header (Next 16 lê e injeta automaticamente
  // em scripts próprios) + repete CSP no response.
  const requestHeaders = new Headers(req.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (csp) {
    response.headers.set("Content-Security-Policy", csp);
  }

  return response;
}

export const config = {
  matcher: [
    // Todas as rotas exceto static assets que não passam por middleware.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

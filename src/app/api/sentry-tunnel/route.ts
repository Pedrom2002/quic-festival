// Sentry tunnel — proxies browser SDK envelopes to Sentry's ingest, bypassing
// ad-blockers that block sentry.io directly. Disabled (404) when DSN unset.
//
// Wire on the client side via:
//   Sentry.init({ dsn, tunnel: "/api/sentry-tunnel", ... })
//
// Security:
//   - Verifies envelope DSN matches our SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN)
//     to prevent the route from being a generic open proxy.
//   - Public POST; rate-limited per IP to deter abuse.
//   - Body capped at 256KB (Sentry SDK envelopes are well below this).

import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

function getDsn(): string | null {
  return (
    (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) ?? null
  );
}

export async function POST(req: NextRequest) {
  const dsn = getDsn();
  if (!dsn) {
    return new NextResponse("Sentry not configured", { status: 404 });
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";
  const rl = await rateLimit(`sentry-tunnel:ip:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return new NextResponse(null, { status: 429 });
  }

  const buf = await req.arrayBuffer().catch(() => null);
  if (!buf) return new NextResponse(null, { status: 400 });
  if (buf.byteLength > MAX_BYTES) return new NextResponse(null, { status: 413 });

  // Sentry envelope format: first line is JSON header with the DSN.
  const text = new TextDecoder().decode(buf);
  const firstLine = text.split("\n", 1)[0];
  if (!firstLine) return new NextResponse(null, { status: 400 });

  let header: { dsn?: string };
  try {
    header = JSON.parse(firstLine) as { dsn?: string };
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (!header.dsn) {
    return new NextResponse(null, { status: 400 });
  }

  let envelopeDsn: URL;
  let projectDsn: URL;
  try {
    envelopeDsn = new URL(header.dsn);
    projectDsn = new URL(dsn);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (envelopeDsn.host !== projectDsn.host || envelopeDsn.pathname !== projectDsn.pathname) {
    return new NextResponse(null, { status: 403 });
  }

  // Project ID is the path segment after the leading slash.
  const projectId = projectDsn.pathname.replace(/^\/+/, "");
  const ingestUrl = `https://${envelopeDsn.host}/api/${projectId}/envelope/`;

  try {
    const upstream = await fetch(ingestUrl, {
      method: "POST",
      body: buf,
      headers: { "Content-Type": "application/x-sentry-envelope" },
      cache: "no-store",
    });
    return new NextResponse(null, { status: upstream.status });
  } catch (e) {
    logger.warn({ event: "sentry-tunnel.upstream-fail", err: String(e) });
    return new NextResponse(null, { status: 502 });
  }
}

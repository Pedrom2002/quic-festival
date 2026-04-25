// CSP violation receiver. Browsers POST here with one of two content types:
//   - application/csp-report (legacy)
//   - application/reports+json (Reporting API)
//
// We log structured data via pino. When SENTRY_DSN is set, errors flowing
// through pino reach Sentry too. No DB writes — keep this hot path light.
//
// Security:
//   - Public endpoint by design; CSP report POSTs come from any browser.
//   - Body capped to 64KB by middleware. Reports beyond that are dropped.
//   - No auth, no rate-limit table — but we shrug a per-IP rate-limit so a
//     single misbehaving extension can't flood logs.

import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { ipFromHeaders } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 16 * 1024;

type LegacyReport = {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "original-policy"?: string;
    disposition?: string;
  };
};

type ModernReport = {
  age?: number;
  type?: string;
  url?: string;
  body?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers) ?? "unknown";

  // 60 reports/min/IP — generous but caps the worst case.
  const rl = await rateLimit(`csp:ip:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return new NextResponse(null, { status: 429 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (raw.length > MAX_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const reqId = req.headers.get("x-request-id") ?? undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const log = logger.child({ event: "csp.violation", req_id: reqId, ip, ua });

  // Modern Reporting API sends an array of reports.
  if (Array.isArray(parsed)) {
    for (const r of parsed as ModernReport[]) {
      log.warn({ kind: "report-to", report: r });
    }
    return new NextResponse(null, { status: 204 });
  }

  // Legacy single-report envelope.
  const legacy = (parsed as LegacyReport)["csp-report"];
  if (legacy) {
    log.warn({ kind: "csp-report", report: legacy });
    return new NextResponse(null, { status: 204 });
  }

  log.warn({ kind: "unknown", body: parsed });
  return new NextResponse(null, { status: 204 });
}

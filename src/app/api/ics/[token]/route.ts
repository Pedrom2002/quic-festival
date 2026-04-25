import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildFestivalIcs } from "@/lib/ics";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";
import { verifyQrToken } from "@/lib/qr-token";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const verified = await verifyQrToken(token);
  if (!verified.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";
  const rl = await rateLimit(`ics:ip:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: rl.degraded ? 503 : 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("name,token")
    .eq("token", verified.uuid)
    .maybeSingle();

  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = buildFestivalIcs(guest.name);
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="quic-festival-2026.ics"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, noarchive, nofollow",
    },
  });
}

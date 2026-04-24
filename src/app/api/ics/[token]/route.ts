import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildFestivalIcs } from "@/lib/ics";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!UUID_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";
  const rl = await rateLimit(`ics:ip:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("name,token")
    .eq("token", token)
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

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
    .select("id,name,token,ics")
    .eq("token", verified.uuid)
    .maybeSingle();

  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Prefer the cached ICS payload (rendered at RSVP insert). Fall back to
  // live render for legacy rows where `ics` is null, and back-fill so the
  // next read hits the cache.
  let ics = guest.ics as string | null;
  if (!ics) {
    ics = buildFestivalIcs(guest.name);
    // Best-effort write; failure does not block the response.
    void admin
      .from("guests")
      .update({ ics })
      .eq("id", guest.id)
      .then(({ error }) => {
        if (error) console.warn("[ics] backfill failed", error.code ?? "unknown");
      });
  }

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="quic-festival-2026.ics"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, noarchive, nofollow",
    },
  });
}

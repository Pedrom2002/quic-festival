import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildFestivalIcs } from "@/lib/ics";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("name,token")
    .eq("token", token)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ics = buildFestivalIcs(guest.name);
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="quic-festival-2026.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

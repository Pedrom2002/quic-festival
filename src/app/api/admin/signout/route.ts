import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  await supa.auth.signOut();

  await audit({
    action: "admin.signout",
    actorEmail: user?.email ?? null,
    ip: ipFromHeaders(req.headers),
  });

  return NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    { status: 303 },
  );
}

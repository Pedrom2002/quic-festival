import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "ok" | "fail";

export async function GET() {
  const checks: Record<string, Status> = { supabase: "fail", email: "fail" };

  try {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("admins")
      .select("email", { head: true, count: "exact" })
      .limit(1);
    if (!error) checks.supabase = "ok";
  } catch {
    /* leave fail */
  }

  if (process.env.BREVO_API_KEY) checks.email = "ok";

  const ok = checks.supabase === "ok" && checks.email === "ok";
  return NextResponse.json(
    { ok, checks, ts: new Date().toISOString() },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

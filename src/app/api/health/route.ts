import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "ok" | "fail";

export async function GET() {
  const checks: Record<string, Status> = { supabase: "fail", resend: "fail" };

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

  // Resend has no public health endpoint; assume ok if API key is set.
  // Real failures surface via /api/rsvp logs + Sentry once wired up.
  if (process.env.RESEND_API_KEY) checks.resend = "ok";

  const ok = checks.supabase === "ok" && checks.resend === "ok";
  return NextResponse.json(
    { ok, checks, ts: new Date().toISOString() },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

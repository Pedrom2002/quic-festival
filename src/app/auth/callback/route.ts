import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Allowlist of post-auth landing routes. Anything else falls back to /admin.
const NEXT_ALLOWLIST = new Set([
  "/admin",
  "/admin/scan",
  "/admin/audit",
  "/admin/account",
]);

function safeNext(raw: string | null): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/admin";
  if (/[\r\n]/.test(raw)) return "/admin";
  // Strip query/fragment for the allowlist check, but preserve them on output
  // so deep-links keep working (e.g. /admin?filter=pending).
  const pathOnly = raw.split(/[?#]/)[0]!;
  if (!NEXT_ALLOWLIST.has(pathOnly)) return "/admin";
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supa = await supabaseServer();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/admin/login?err=exchange`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

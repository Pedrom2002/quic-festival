import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeNext(raw: string | null): string {
  if (!raw) return "/admin";
  // Aceita apenas paths internos; rejeita URLs absolutas, protocol-relative,
  // backslashes, ou qualquer coisa que não comece por "/".
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/admin";
  if (/[\r\n]/.test(raw)) return "/admin";
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

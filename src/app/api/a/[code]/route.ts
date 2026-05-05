import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";

export const runtime = "nodejs";

// GET /api/a/[code] — public: validate accreditation link metadata.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!isValidInviteCode(code)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 404 });
  }

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("accreditation_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!data || data.archived_at) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    label: data.label ?? null,
    seats_total: data.max_uses,
    seats_remaining: Math.max(0, data.max_uses - data.uses_count),
    expires_at: data.expires_at ?? null,
  });
}

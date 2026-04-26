// GET /api/invites/[code] — public, devolve metadata mínima do invite para
// renderizar a landing /i/[code] (label + vagas restantes). Não devolve
// max_uses absoluto nem campos sensíveis.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidInviteCode } from "@/lib/invite-code";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!isValidInviteCode(code)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 404 });
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";
  const rl = await rateLimit(`invite:ip:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos." },
      {
        status: rl.degraded ? 503 : 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("invite_links")
    .select("label, max_uses, uses_count, expires_at, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (!data || data.archived_at) {
    return NextResponse.json({ error: "Convite inválido." }, { status: 404 });
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "Convite expirado." }, { status: 410 });
  }

  return NextResponse.json({
    label: data.label,
    seats_total: data.max_uses,
    seats_remaining: Math.max(0, data.max_uses - data.uses_count),
    expires_at: data.expires_at,
  });
}

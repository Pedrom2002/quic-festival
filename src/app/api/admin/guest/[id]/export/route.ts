// GET /api/admin/guest/[id]/export — RGPD right of access.
//
// Devolve JSON estruturado com todos os dados pessoais do guest + audit
// trail relativo a este target_id. Admin envia este JSON ao titular dos
// dados em resposta a um pedido formal (RGPD Art. 15).
//
// Não inclui dados de outros guests. Não inclui email_last_error (pode
// conter info do provider de email). Não inclui token (credencial).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: guest } = await admin
    .from("guests")
    .select(
      "id, created_at, name, email, phone, companion_count, companion_names, checked_in_at, email_sent_at, email_attempts, email_failed_at",
    )
    .eq("id", idCheck.data)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json(
      { error: "Convidado inexistente." },
      { status: 404 },
    );
  }

  const { data: auditTrail } = await admin
    .from("audit_log")
    .select("occurred_at, action, actor_email, ip, meta")
    .eq("target_id", idCheck.data)
    .order("occurred_at", { ascending: true });

  await audit({
    action: "admin.guest.exported",
    actorEmail: guard.user.email,
    targetId: idCheck.data,
    ip: ipFromHeaders(req.headers),
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      generated_by: guard.user.email,
      data_subject: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        registered_at: guest.created_at,
        companion_count: guest.companion_count,
        companion_names: guest.companion_names,
        checked_in_at: guest.checked_in_at,
        email_sent_at: guest.email_sent_at,
        email_attempts: guest.email_attempts,
        email_failed_at: guest.email_failed_at,
      },
      audit_trail: auditTrail ?? [],
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="quic-guest-${guest.id}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

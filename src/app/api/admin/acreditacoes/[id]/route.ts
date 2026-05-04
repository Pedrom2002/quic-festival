import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accreditationArchiveSchema } from "@/lib/validators";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

// PATCH /api/admin/acreditacoes/[id] — archive / unarchive.
export async function PATCH(
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

  const body = await req.json().catch(() => null);
  const parsed = accreditationArchiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("accreditations")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", idCheck.data);

  if (error) {
    return NextResponse.json({ error: "Falha a atualizar." }, { status: 500 });
  }

  await audit({
    action: parsed.data.archived
      ? "admin.accreditation.archived"
      : "admin.accreditation.unarchived",
    actorEmail: guard.user.email,
    targetId: idCheck.data,
    ip: ipFromHeaders(req.headers),
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inviteCreateSchema } from "@/lib/validators";
import { generateInviteCode } from "@/lib/invite-code";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

// GET /api/admin/invites — list all (active first, archived last).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("invite_links")
    .select(
      "id, code, label, max_uses, uses_count, expires_at, archived_at, created_at",
    )
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Falha a listar." }, { status: 500 });
  }
  return NextResponse.json({ invites: data ?? [] });
}

// POST /api/admin/invites — create new invite. Body: { label?, max_uses, expires_at? }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = inviteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pedido inválido.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();

  // Retry up to 3 vezes em caso de colisão de código (extremamente raro).
  let row: { id: string; code: string } | null = null;
  let attempts = 0;
  while (!row && attempts < 3) {
    attempts++;
    const code = generateInviteCode();
    const { data, error } = await admin
      .from("invite_links")
      .insert({
        code,
        label: parsed.data.label ?? null,
        max_uses: parsed.data.max_uses,
        expires_at: parsed.data.expires_at ?? null,
        created_by: guard.user.id,
      })
      .select("id, code")
      .single();
    if (error) {
      /* v8 ignore next */
      if (error.code !== "23505") {
        return NextResponse.json(
          { error: "Falha a criar." },
          { status: 500 },
        );
      }
      continue; // colisão de code, gera novo
    }
    row = data;
  }

  /* v8 ignore next 3 */
  if (!row) {
    return NextResponse.json({ error: "Falha a gerar código." }, { status: 500 });
  }

  await audit({
    action: "admin.invite.created" as const,
    actorEmail: guard.user.email,
    targetId: row.id,
    ip: ipFromHeaders(req.headers),
    meta: { code: row.code, max_uses: parsed.data.max_uses },
  });

  return NextResponse.json({ id: row.id, code: row.code }, { status: 201 });
}

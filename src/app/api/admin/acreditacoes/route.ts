import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accreditationCreateSchema } from "@/lib/validators";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

// GET /api/admin/acreditacoes — list all (active first, archived last).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("accreditations")
    .select("id, name, email, phone, media_company, token, archived_at, created_at")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Falha a listar." }, { status: 500 });
  }
  return NextResponse.json({ accreditations: data ?? [] });
}

// POST /api/admin/acreditacoes — create new accreditation.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = accreditationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pedido inválido.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("accreditations")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      media_company: parsed.data.media_company,
      created_by: guard.user.id,
    })
    .select("id, token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe uma acreditação com este email." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Falha a criar." }, { status: 500 });
  }

  await audit({
    action: "admin.accreditation.created",
    actorEmail: guard.user.email,
    targetId: data.id,
    ip: ipFromHeaders(req.headers),
    meta: { name: parsed.data.name, email: parsed.data.email },
  });

  return NextResponse.json({ id: data.id, token: data.token }, { status: 201 });
}

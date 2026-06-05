import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createTeamMember, getAllTeamMembers } from "@/lib/team-members";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const members = await getAllTeamMembers();
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null) as {
    name?: string;
    role?: string;
    phone?: string | null;
    email?: string;
    slug?: string;
  } | null;

  if (!body?.name || !body?.role || !body?.email || !body?.slug) {
    return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
  }

  try {
    const member = await createTeamMember({
      name: body.name,
      role: body.role,
      phone: body.phone ?? null,
      email: body.email,
      slug: body.slug,
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    if (msg.includes("23505")) {
      return NextResponse.json({ error: "Slug já existe." }, { status: 409 });
    }
    return NextResponse.json({ error: "Falha a criar." }, { status: 500 });
  }
}

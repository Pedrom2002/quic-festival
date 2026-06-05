import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { updateTeamMember, toggleTeamMemberActive } from "@/lib/team-members";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    if (Object.keys(body).length === 1 && "active" in body) {
      await toggleTeamMemberActive(id, body.active as boolean);
      return NextResponse.json({ ok: true });
    }

    const member = await updateTeamMember(id, {
      name: body.name as string | undefined,
      role: body.role as string | undefined,
      phone: body.phone as string | null | undefined,
      email: body.email as string | undefined,
      slug: body.slug as string | undefined,
    });
    return NextResponse.json({ member });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    if (msg.includes("23505")) {
      return NextResponse.json({ error: "Slug já existe." }, { status: 409 });
    }
    return NextResponse.json({ error: "Falha a actualizar." }, { status: 500 });
  }
}

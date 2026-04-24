import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  token: z.string().uuid().optional(),
  checked_in: z.boolean().default(true),
});

export async function PATCH(req: NextRequest) {
  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: isAdmin } = await admin
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!isAdmin) {
    return NextResponse.json({ error: "Sem permissões." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success || (!parsed.data.id && !parsed.data.token)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { id, token, checked_in } = parsed.data;
  const ip = ipFromHeaders(req.headers);

  const lookup = admin.from("guests").select("id,name,companion_count,checked_in_at");
  const { data: guest } = id
    ? await lookup.eq("id", id).maybeSingle()
    : await lookup.eq("token", token!).maybeSingle();

  if (!guest) {
    await audit({
      action: "admin.checkin.not_found",
      actorEmail: user.email,
      ip,
      meta: { token: token ?? null, id: id ?? null },
    });
    return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });
  }

  const wasAlreadyCheckedIn = !!guest.checked_in_at;

  const { error } = await admin
    .from("guests")
    .update({ checked_in_at: checked_in ? new Date().toISOString() : null })
    .eq("id", guest.id);

  if (error) {
    console.error("[checkin]", error.code ?? "unknown");
    return NextResponse.json({ error: "Erro a atualizar." }, { status: 500 });
  }

  await audit({
    action: !checked_in
      ? "admin.checkin.uncheck"
      : wasAlreadyCheckedIn
        ? "admin.checkin.duplicate"
        : "admin.checkin.ok",
    actorEmail: user.email,
    targetId: guest.id,
    ip,
  });

  return NextResponse.json({
    ok: true,
    guest: {
      id: guest.id,
      name: guest.name,
      companion_count: guest.companion_count,
    },
    was_already_checked_in: wasAlreadyCheckedIn && checked_in,
  });
}

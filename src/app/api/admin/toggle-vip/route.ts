import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
  is_vip: z.boolean(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { id, is_vip } = parsed.data;
  const ip = ipFromHeaders(req.headers);

  const { error } = await admin.from("guests").update({ is_vip }).eq("id", id);
  if (error) {
    /* v8 ignore next */
    console.error("[toggle-vip]", error.code ?? "unknown");
    return NextResponse.json({ error: "Erro a atualizar." }, { status: 500 });
  }

  await audit({
    action: is_vip ? "admin.vip.grant" : "admin.vip.revoke",
    actorEmail: user.email,
    targetId: id,
    ip,
  });

  return NextResponse.json({ ok: true, is_vip });
}

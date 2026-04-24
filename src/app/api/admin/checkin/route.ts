import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const update = {
    checked_in_at: checked_in ? new Date().toISOString() : null,
  };

  const query = admin.from("guests").update(update);
  const { error } = id
    ? await query.eq("id", id)
    : await query.eq("token", token!);

  if (error) {
    console.error("[checkin]", error);
    return NextResponse.json({ error: "Erro a atualizar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

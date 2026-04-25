import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminCheck =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminCheck> {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user?.email || !user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sem permissões." }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}

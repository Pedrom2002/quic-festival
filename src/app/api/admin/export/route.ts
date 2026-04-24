import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET() {
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

  const { data, error } = await admin
    .from("guests")
    .select(
      "created_at,name,email,phone,companion_count,companion_names,token,checked_in_at,email_sent_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[export]", error);
    return NextResponse.json({ error: "Erro a obter dados." }, { status: 500 });
  }

  const headers = [
    "Criado em",
    "Nome",
    "Email",
    "Telefone",
    "Acompanhantes",
    "Nomes acompanhantes",
    "Token",
    "Check-in",
    "Email enviado",
  ];

  const rows = (data ?? []).map((g) => ({
    "Criado em": g.created_at,
    Nome: g.name,
    Email: g.email,
    Telefone: g.phone,
    Acompanhantes: g.companion_count,
    "Nomes acompanhantes": (g.companion_names ?? []).join("; "),
    Token: g.token,
    "Check-in": g.checked_in_at ?? "",
    "Email enviado": g.email_sent_at ?? "",
  }));

  const csv = toCsv(rows, headers);
  const filename = `quic-convidados-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

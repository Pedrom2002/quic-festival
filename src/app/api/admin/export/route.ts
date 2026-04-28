import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";
import { audit, ipFromHeaders } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

  const rl = await rateLimit(
    `export:${user.email}`,
    LIMITS.adminExport.perAdmin.max,
    LIMITS.adminExport.perAdmin.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.degraded ? "Serviço indisponível." : "Demasiados pedidos." },
      { status: rl.degraded ? 503 : 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
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

  const rows = (data /* v8 ignore next */ ?? []).map((g) => ({
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

  const csv =
    toCsv(rows, headers) +
    `\r\n"# Exported by ${user.email} at ${new Date().toISOString()}"`;

  // Filename uses Lisbon date so the daily snapshot rolls at PT midnight, not UTC.
  const lisbonDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const filename = `quic-convidados-${lisbonDate}.csv`;

  await audit({
    action: "admin.export",
    actorEmail: user.email,
    ip: ipFromHeaders(req.headers),
    meta: { rows: rows.length },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

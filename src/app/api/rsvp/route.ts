import { NextResponse, type NextRequest } from "next/server";
import { rsvpSchema } from "@/lib/validators";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRsvpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const body = await req.json().catch(() => null);
  const parsed = rsvpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Limite global por IP (10/min) para travar enumeration / spam mesmo com emails diferentes.
  const ipRl = await rateLimit(`rsvp:ip:${ip}`, 10, 60_000);
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta mais tarde." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSeconds) } },
    );
  }
  // Limite por (IP, email) — protege contra retries do mesmo user.
  const rl = await rateLimit(`rsvp:${ip}:${data.email}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta mais tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const companion_count = data.acompanhante === "sim" ? 1 : 0;
  const companion_names =
    companion_count === 1 && data.companion_nome ? [data.companion_nome] : [];

  const supabase = supabaseAdmin();

  const { data: inserted, error: insertError } = await supabase
    .from("guests")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      companion_count,
      companion_names,
    })
    .select("id, token")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Não revela se email já existe — protege contra user enumeration.
      // Devolve 200 fake-success: utilizador legítimo pensará que ficou registado;
      // não é re-enviado email (silently dropped). Atacante não consegue distinguir.
      return NextResponse.json({ ok: true });
    }
    console.error("[rsvp] insert", insertError.code ?? "unknown");
    return NextResponse.json(
      { error: "Não foi possível gravar. Tenta novamente." },
      { status: 500 },
    );
  }

  try {
    await sendRsvpEmail({
      to: data.email,
      name: data.name,
      token: inserted.token,
    });

    await supabase
      .from("guests")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", inserted.id);
  } catch (e) {
    console.error("[rsvp] email", e);
    // Não falha o request — o registo ficou gravado. Admin pode reenviar.
  }

  return NextResponse.json({ token: inserted.token });
}

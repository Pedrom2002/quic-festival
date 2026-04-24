import { NextResponse, type NextRequest } from "next/server";
import { rsvpSchema } from "@/lib/validators";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateQrDataUrl } from "@/lib/qr";
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
  const rateKey = `rsvp:${ip}:${data.email}`;
  const rl = await rateLimit(rateKey, 3, 60_000);
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
      return NextResponse.json(
        { error: "Este email já está registado." },
        { status: 409 },
      );
    }
    console.error("[rsvp] insert", insertError);
    return NextResponse.json(
      { error: "Não foi possível gravar. Tenta novamente." },
      { status: 500 },
    );
  }

  try {
    const qr = await generateQrDataUrl(inserted.token);
    await sendRsvpEmail({
      to: data.email,
      name: data.name,
      qrDataUrl: qr,
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

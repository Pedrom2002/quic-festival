import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRsvpEmail } from "@/lib/email";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
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

  const { data: guest, error: fetchErr } = await admin
    .from("guests")
    .select("id,name,email,token")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (fetchErr || !guest) {
    return NextResponse.json({ error: "Convidado não existe." }, { status: 404 });
  }

  const ip = ipFromHeaders(req.headers);

  try {
    await sendRsvpEmail({
      to: guest.email,
      name: guest.name,
      token: guest.token,
    });
    await admin
      .from("guests")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", guest.id);
  } catch (e) {
    console.error("[resend-email]", e instanceof Error ? e.message : "fail");
    await audit({
      action: "admin.resend_email.fail",
      actorEmail: user.email,
      targetId: guest.id,
      ip,
    });
    return NextResponse.json(
      { error: "Falha a reenviar email." },
      { status: 502 },
    );
  }

  await audit({
    action: "admin.resend_email.ok",
    actorEmail: user.email,
    targetId: guest.id,
    ip,
  });

  return NextResponse.json({ ok: true });
}

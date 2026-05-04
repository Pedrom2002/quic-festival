import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/qr-token";
import { rateLimit } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(36).max(512),
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

  const rl = await rateLimit(
    `vip-access:${user.email}`,
    LIMITS.adminCheckin.perAdmin.max,
    LIMITS.adminCheckin.perAdmin.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.degraded ? "Serviço indisponível." : "Demasiados pedidos." },
      { status: rl.degraded ? 503 : 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { token } = parsed.data;
  const verified = await verifyQrToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: "QR inválido ou expirado." }, { status: 404 });
  }

  const { data: guest } = await admin
    .from("guests")
    .select("id,name,is_vip")
    .eq("token", verified.uuid)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    name: guest.name,
    is_vip: guest.is_vip ?? false,
  });
}

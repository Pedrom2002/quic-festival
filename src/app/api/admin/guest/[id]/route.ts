import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { rateLimit } from "@/lib/rate-limit";
import { audit, ipFromHeaders } from "@/lib/audit";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const ip = ipFromHeaders(req.headers);
  const rl = await rateLimit(
    `guestdel:${ip}:${guard.user.email}`,
    LIMITS.guestDelete.perIpUser.max,
    LIMITS.guestDelete.perIpUser.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas eliminações. Tenta dentro de uns minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const admin = supabaseAdmin();
  const { data: guest } = await admin
    .from("guests")
    .select("id,email")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ error: "Convidado não existe." }, { status: 404 });
  }

  const { error } = await admin.from("guests").delete().eq("id", guest.id);
  if (error) {
    return NextResponse.json({ error: "Falha a eliminar." }, { status: 500 });
  }

  await audit({
    action: "admin.guest.deleted",
    actorEmail: guard.user.email,
    targetId: guest.id,
    ip,
    meta: { email_hash: hashEmail(guest.email) },
  });

  return NextResponse.json({ ok: true });
}

// Stable, non-reversible reference so audit logs keep linkability without
// retaining the deleted PII verbatim.
function hashEmail(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

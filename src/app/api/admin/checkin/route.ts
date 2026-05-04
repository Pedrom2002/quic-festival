import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { audit, ipFromHeaders } from "@/lib/audit";
import { verifyQrToken } from "@/lib/qr-token";
import { rateLimit } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  token: z.string().min(36).max(512).optional(),
  checked_in: z.boolean().default(true),
  day: z.number().int().min(1).max(2).optional(),
});

function festivalDay(): 1 | 2 {
  const lisbon = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(
    new Date(),
  );
  if (lisbon === "2026-05-09") return 2;
  return 1; // 2026-05-08 and all other dates default to day 1
}

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

  const ip = ipFromHeaders(req.headers);
  const rl = await rateLimit(
    `checkin:${user.email}`,
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

  if (!parsed.success || (!parsed.data.id && !parsed.data.token)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { id, token, checked_in, day } = parsed.data;
  const activeDay: 1 | 2 = day === 1 || day === 2 ? day : festivalDay();
  const dayCol = activeDay === 1 ? "checked_in_day1_at" : "checked_in_day2_at";
  const otherDayCol = activeDay === 1 ? "checked_in_day2_at" : "checked_in_day1_at";

  let resolvedToken: string | null = null;
  if (token) {
    const verified = await verifyQrToken(token);
    if (!verified.ok) {
      await audit({
        action: "admin.checkin.not_found",
        actorEmail: user.email,
        ip,
        meta: { reason: verified.reason },
      });
      return NextResponse.json({ error: "QR inválido ou expirado." }, { status: 404 });
    }
    resolvedToken = verified.uuid;
  }

  const lookup = admin
    .from("guests")
    .select(`id,name,companion_count,checked_in_day1_at,checked_in_day2_at`);
  const { data: guest } = id
    ? await lookup.eq("id", id).maybeSingle()
    : await lookup.eq("token", resolvedToken!).maybeSingle();

  if (!guest) {
    await audit({
      action: "admin.checkin.not_found",
      actorEmail: user.email,
      ip,
      meta: { token: token ?? null, id: id ?? null },
    });
    return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });
  }

  const wasAlreadyCheckedIn = !!(guest as Record<string, unknown>)[dayCol];
  const checkedInOtherDay = !!(guest as Record<string, unknown>)[otherDayCol];

  const { error } = await admin
    .from("guests")
    .update({ [dayCol]: checked_in ? new Date().toISOString() : null })
    .eq("id", guest.id);

  if (error) {
    /* v8 ignore next */
    console.error("[checkin]", error.code ?? "unknown");
    return NextResponse.json({ error: "Erro a atualizar." }, { status: 500 });
  }

  await audit({
    action: !checked_in
      ? "admin.checkin.uncheck"
      : wasAlreadyCheckedIn
        ? "admin.checkin.duplicate"
        : "admin.checkin.ok",
    actorEmail: user.email,
    targetId: guest.id,
    ip,
    meta: { day: activeDay },
  });

  return NextResponse.json({
    ok: true,
    guest: {
      id: guest.id,
      name: guest.name,
      companion_count: guest.companion_count,
    },
    day: activeDay,
    was_already_checked_in: wasAlreadyCheckedIn && checked_in,
    checked_in_other_day: checkedInOtherDay,
  });
}

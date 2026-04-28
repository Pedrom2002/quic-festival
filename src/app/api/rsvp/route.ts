import { NextResponse, type NextRequest } from "next/server";
import { rsvpSchema } from "@/lib/validators";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRsvpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { LIMITS, RSVP_OPEN } from "@/lib/limits";
import { signQrToken } from "@/lib/qr-token";
import { ipFromHeaders } from "@/lib/audit";
import { buildFestivalIcs } from "@/lib/ics";
import { verifyTurnstile, isTurnstileEnabled } from "@/lib/turnstile";

export const runtime = "nodejs";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.]{8,200}$/;

export async function POST(req: NextRequest) {
  if (!RSVP_OPEN) {
    return NextResponse.json(
      { error: "Inscrições encerradas." },
      { status: 503 },
    );
  }

  const ip = ipFromHeaders(req.headers) ?? "unknown";

  // ── Idempotency-Key (optional). Caller pode dar uma key estável (ex.: hash
  // local do form) e re-tentar com a mesma key sem disparar email duplicado.
  // Resposta cached é mantida 1h por (IP, key).
  const idempotencyKey = req.headers.get("idempotency-key");
  const supabase = supabaseAdmin();
  if (idempotencyKey) {
    if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      return NextResponse.json(
        { error: "Idempotency-Key inválida." },
        { status: 400 },
      );
    }
    const { data: cached } = await supabase
      .from("idempotency_keys")
      .select("response, status_code")
      .eq("scope", "rsvp")
      .eq("key", `${ip}:${idempotencyKey}`)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return NextResponse.json(cached.response ?? {}, {
        status: cached.status_code ?? 200,
      });
    }
  }

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

  // Acesso só por convite. RSVP público sem inviteCode → 403.
  if (!data.inviteCode) {
    return NextResponse.json(
      { error: "Inscrição apenas por convite." },
      { status: 403 },
    );
  }

  // Turnstile (anti-bot público). Só corre quando ambas as keys estão
  // configuradas — em dev/local sem keys, captcha é skipped silenciosamente.
  if (isTurnstileEnabled()) {
    const cap = await verifyTurnstile(data.captchaToken, ip);
    if (!cap.ok) {
      return NextResponse.json(
        { error: "Captcha inválido. Recarrega a página." },
        { status: 400 },
      );
    }
  }

  // Anti-spam tiered:
  //   1. per IP — blocks volumetric abuse from one source
  //   2. per (IP, email) — blocks retries of same submission
  //   3. per email globally — blocks IP-rotating abuse against same recipient
  //      (caps email vendor cost amplification)
  const ipRl = await rateLimit(
    `rsvp:ip:${ip}`,
    LIMITS.rsvp.perIp.max,
    LIMITS.rsvp.perIp.windowMs,
  );
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta mais tarde." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSeconds) } },
    );
  }
  const rl = await rateLimit(
    `rsvp:${ip}:${data.email}`,
    LIMITS.rsvp.perIpEmail.max,
    LIMITS.rsvp.perIpEmail.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta mais tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }
  const emailGlobalRl = await rateLimit(
    `rsvp:email:${data.email}`,
    LIMITS.rsvp.perEmailGlobal.max,
    LIMITS.rsvp.perEmailGlobal.windowMs,
  );
  if (!emailGlobalRl.ok) {
    // Generic message — does not confirm whether email already exists.
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta mais tarde." },
      { status: 429, headers: { "Retry-After": String(emailGlobalRl.retryAfterSeconds) } },
    );
  }

  const companion_count = data.acompanhante === "sim" ? 1 : 0;
  const companion_names =
    companion_count === 1 && data.companion_nome ? [data.companion_nome] : [];
  const companion_emails =
    companion_count === 1 && data.companion_email ? [data.companion_email] : [];

  // Pre-render ICS at insert time. Cheaper than per-request rendering on
  // every download and naturally tied to the immutable name (0003 trigger
  // prevents authenticated callers rewriting ics drift).
  const ics = buildFestivalIcs(data.name);

  // Pre-check de dedup: se o email já existe, devolve direto o token do
  // registo existente sem tocar no contador de invites. Evita o "counter
  // bump fantasma" (sobe + release) quando alguém re-submete via invite.
  // Race-window: se outro cliente regista o mesmo email entre este SELECT
  // e o INSERT abaixo, o caminho 23505 trata na mesma.
  const { data: existingPre } = await supabase
    .from("guests")
    .select("token")
    .eq("email", data.email)
    .maybeSingle();
  if (existingPre?.token) {
    const dupeToken = await signQrToken(existingPre.token);
    const dupeBody = { token: dupeToken } as const;
    await cacheIdempotency(supabase, ip, idempotencyKey, dupeBody, 200);
    return NextResponse.json(dupeBody);
  }

  // Reclamar lugar do invite (se aplicável). Atómico via SQL function.
  let invite_link_id: string | null = null;
  if (data.inviteCode) {
    const { data: claim, error: claimErr } = await supabase.rpc(
      "claim_invite_seat",
      { p_code: data.inviteCode },
    );
    if (claimErr) {
      console.error("[rsvp] invite-claim", claimErr.code ?? "unknown");
      return NextResponse.json(
        { error: "Falha a validar convite." },
        { status: 500 },
      );
    }
    const result = Array.isArray(claim) ? claim[0] : claim;
    if (!result?.ok) {
      const reason = (result?.reason as string) ?? "not-found";
      const map: Record<string, string> = {
        "not-found": "Convite inválido.",
        expired: "Convite expirado.",
        exhausted: "Convite esgotado.",
      };
      return NextResponse.json(
        { error: map[reason] ?? "Convite inválido.", reason },
        { status: reason === "exhausted" ? 409 : 410 },
      );
    }
    invite_link_id = result.invite_link_id as string;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("guests")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      companion_count,
      companion_names,
      companion_emails,
      ics,
      invite_link_id,
    })
    .select("id, token")
    .single();

  if (insertError) {
    // Insert falhou após claim — liberta o seat para não consumir slot a toa.
    if (invite_link_id) {
      await supabase.rpc("release_invite_seat", { p_invite_link_id: invite_link_id });
    }
    if (insertError.code === "23505") {
      // Email já registado: devolve o token do registo existente para que o
      // form redirecione para /confirmado/<token>. Concessão deliberada à
      // defesa anti user-enumeration: prioridade é UX consistente para um
      // utilizador legítimo a re-submeter.
      const { data: existing } = await supabase
        .from("guests")
        .select("token")
        .eq("email", data.email)
        .maybeSingle();
      if (existing?.token) {
        const dupeToken = await signQrToken(existing.token);
        const dupeBody = { token: dupeToken } as const;
        await cacheIdempotency(supabase, ip, idempotencyKey, dupeBody, 200);
        return NextResponse.json(dupeBody);
      }
      // Fallback raro: PK collision sem row visível (race). Mantém resposta
      // genérica.
      const fallbackBody = { ok: true } as const;
      await cacheIdempotency(supabase, ip, idempotencyKey, fallbackBody, 200);
      return NextResponse.json(fallbackBody);
    }
    console.error("[rsvp] insert", insertError.code ?? "unknown");
    return NextResponse.json(
      { error: "Não foi possível gravar. Tenta novamente." },
      { status: 500 },
    );
  }

  // Token público assinado (ou UUID legacy se secret não definido).
  const publicToken = await signQrToken(inserted.token);

  try {
    await sendRsvpEmail({
      to: data.email,
      name: data.name,
      token: publicToken,
    });

    await supabase
      .from("guests")
      .update({
        email_sent_at: new Date().toISOString(),
        email_attempts: 1,
      })
      .eq("id", inserted.id);
  } catch (e) {
    console.error("[rsvp] email", e);
    await supabase
      .from("guests")
      .update({
        email_attempts: 1,
        email_last_error:
          e instanceof Error ? e.message.slice(0, 500) : "unknown",
      })
      .eq("id", inserted.id);
  }

  // Acompanhante: inserir como guest separado e enviar email com token próprio.
  if (companion_count === 1 && data.companion_nome && data.companion_email) {
    const compIcs = buildFestivalIcs(data.companion_nome);
    const { data: compInserted, error: compInsertError } = await supabase
      .from("guests")
      .insert({
        name: data.companion_nome,
        email: data.companion_email,
        phone: data.companion_tel || data.phone,
        companion_count: 0,
        companion_names: [],
        companion_emails: [],
        ics: compIcs,
        invite_link_id,
      })
      .select("id, token")
      .single();

    if (compInsertError) {
      console.error("[rsvp] companion insert error", JSON.stringify(compInsertError));
    }
    if (!compInsertError && compInserted) {
      const compPublicToken = await signQrToken(compInserted.token);
      try {
        await sendRsvpEmail({
          to: data.companion_email,
          name: data.companion_nome,
          token: compPublicToken,
        });
        await supabase
          .from("guests")
          .update({
            email_sent_at: new Date().toISOString(),
            email_attempts: 1,
          })
          .eq("id", compInserted.id);
      } catch (e) {
        console.error("[rsvp] companion email", e);
        await supabase
          .from("guests")
          .update({
            email_attempts: 1,
            email_last_error:
              e instanceof Error ? e.message.slice(0, 500) : "unknown",
          })
          .eq("id", compInserted.id);
      }
    }
  }

  const responseBody = { token: publicToken };
  await cacheIdempotency(supabase, ip, idempotencyKey, responseBody, 200);
  return NextResponse.json(responseBody);
}

async function cacheIdempotency(
  supabase: ReturnType<typeof supabaseAdmin>,
  ip: string,
  key: string | null,
  response: Record<string, unknown>,
  statusCode: number,
) {
  if (!key) return;
  try {
    await supabase.from("idempotency_keys").insert({
      scope: "rsvp",
      key: `${ip}:${key}`,
      response,
      status_code: statusCode,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
  } catch {
    /* idempotency cache é best-effort */
  }
}

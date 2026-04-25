// Cron job — re-tenta envio de emails RSVP para guests com email_sent_at
// nulo, criados na última hora. Limita a N tentativas por execução para não
// sobrecarregar Resend num único burst.
//
// Protecção:
//   - Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`.
//   - Manual / debug: header `x-cron-secret`.
// Comparação constant-time em ambos os casos.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendRsvpEmail } from "@/lib/email";
import { signQrToken } from "@/lib/qr-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RETRIES_PER_RUN = 25;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) return false;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return constantTimeEqual(auth.slice(7), expected);
  }
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  return constantTimeEqual(headerSecret, expected);
}

async function handle(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();

  const { data: pending, error } = await supabase
    .from("guests")
    .select("id, email, name, token, created_at")
    .is("email_sent_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_RETRIES_PER_RUN);

  if (error) {
    console.error("[cron/email-retry] query", error.code ?? "unknown");
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const g of pending ?? []) {
    try {
      const publicToken = await signQrToken(g.token);
      await sendRsvpEmail({ to: g.email, name: g.name, token: publicToken });
      await supabase
        .from("guests")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", g.id);
      sent++;
    } catch (e) {
      failed++;
      console.warn("[cron/email-retry] send", g.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: pending?.length ?? 0,
    sent,
    failed,
  });
}

export const GET = handle;
export const POST = handle;

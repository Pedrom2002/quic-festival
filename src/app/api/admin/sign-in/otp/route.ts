import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { audit, ipFromHeaders } from "@/lib/audit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  redirectTo: z.string().url().optional(),
  captchaToken: z.string().optional(),
});

// Defense-in-depth (Supabase já valida allow-list mas não confiamos só nele).
function safeRedirect(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    if (allowedOrigin && u.origin !== new URL(allowedOrigin).origin) {
      return undefined;
    }
    if (!u.pathname.startsWith("/auth/callback")) return undefined;
    return u.toString();
  } catch {
    /* v8 ignore next */
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers) ?? "unknown";

  // Anti-spam de magic links: 3 / 10 min / IP.
  const rl = await rateLimit(`otp:ip:${ip}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tenta dentro de uns minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const cap = await verifyTurnstile(parsed.data.captchaToken, ip);
  if (!cap.ok) {
    return NextResponse.json(
      { error: "Captcha inválido. Recarrega a página." },
      { status: 400 },
    );
  }

  const supa = await supabaseServer();
  const { error } = await supa.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: safeRedirect(parsed.data.redirectTo),
    },
  });

  if (error) {
    await audit({
      action: "admin.signin.otp.fail",
      actorEmail: parsed.data.email,
      ip,
      meta: { msg: error.message },
    });
    return NextResponse.json(
      { error: "Não foi possível enviar." },
      { status: 502 },
    );
  }

  await audit({
    action: "admin.signin.otp.sent",
    actorEmail: parsed.data.email,
    ip,
  });

  // Resposta genérica — não confirma se email existe.
  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers) ?? "unknown";

  // Hard rate-limit anti brute-force: 5 tentativas / 5 min / IP.
  const ipRl = await rateLimit(`signin:ip:${ip}`, 5, 5 * 60_000);
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tenta dentro de uns minutos." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // Limite extra por (IP, email) — atrasa credential stuffing.
  const userRl = await rateLimit(
    `signin:${ip}:${parsed.data.email}`,
    5,
    5 * 60_000,
  );
  if (!userRl.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tenta dentro de uns minutos." },
      { status: 429, headers: { "Retry-After": String(userRl.retryAfterSeconds) } },
    );
  }

  const supa = await supabaseServer();
  const { error } = await supa.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    await audit({
      action: "admin.signin.password.fail",
      actorEmail: parsed.data.email,
      ip,
    });
    // Mensagem genérica → não revela se email existe.
    return NextResponse.json(
      { error: "Credenciais inválidas." },
      { status: 401 },
    );
  }

  await audit({
    action: "admin.signin.password.ok",
    actorEmail: parsed.data.email,
    ip,
  });

  return NextResponse.json({ ok: true });
}

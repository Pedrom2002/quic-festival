import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { audit, ipFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(10, "Mínimo 10 caracteres")
    .max(200, "Máximo 200 caracteres"),
});

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);

  const supa = await supabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Confirma que é admin (allowlist).
  const admin = supabaseAdmin();
  const { data: isAdmin } = await admin
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  if (!isAdmin) {
    return NextResponse.json({ error: "Sem permissões." }, { status: 403 });
  }

  // Rate-limit por (IP, user) + global por user (anti-rotação de IPs).
  const rlIp = await rateLimit(`pwchange:${ip}:${user.email}`, 5, 10 * 60_000);
  const rlUser = await rateLimit(`pwchange:user:${user.email}`, 10, 60 * 60_000);
  if (!rlIp.ok || !rlUser.ok) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tenta dentro de uns minutos." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Pedido inválido.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Verifica password atual (sem trocar sessão duplicada — re-auth pontual).
  const { error: reAuthErr } = await supa.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reAuthErr) {
    await audit({
      action: "admin.signin.password.fail",
      actorEmail: user.email,
      ip,
      meta: { context: "password-change" },
    });
    return NextResponse.json(
      { error: "Password atual incorreta." },
      { status: 401 },
    );
  }

  // Atualiza via service role para garantir que passa por validações Auth do projeto.
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.newPassword,
  });

  if (updErr) {
    return NextResponse.json(
      { error: "Falha a atualizar password." },
      { status: 500 },
    );
  }

  // Revoga todas as outras sessões deste user (mantém a atual).
  // Defense-in-depth: se a password antiga estava comprometida, qualquer attacker logado
  // noutro device perde acesso imediato.
  try {
    await supa.auth.signOut({ scope: "others" });
  } catch {
    /* falha silenciosa — password já foi atualizada */
  }

  await audit({
    action: "admin.password.changed",
    actorEmail: user.email,
    ip,
  });

  return NextResponse.json({ ok: true });
}

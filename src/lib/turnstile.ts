// Verificação server-side do token Cloudflare Turnstile.
// Se TURNSTILE_SECRET_KEY não estiver definida, devolve { ok: true, skipped: true }
// para permitir dev/local sem captcha.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Result =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string };

export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string | null,
): Promise<Result> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (!token) return { ok: false, reason: "missing-token" };

  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `verify-${res.status}` };
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!json.success) {
      return {
        ok: false,
        reason: json["error-codes"]?.join(",") ?? "verify-failed",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "verify-exception",
    };
  }
}

export function isTurnstileEnabled(): boolean {
  return !!(
    process.env.TURNSTILE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

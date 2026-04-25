// Signed QR tokens. Substitui o UUID puro por uma string assinada com HMAC-SHA256
// que liga o uuid a uma data de expiração.
//
// Formato: <uuid>.<expMs>.<sig>
//   - uuid:    UUID v4 do guest (existe na DB).
//   - expMs:   timestamp UTC em ms a partir do qual o token deixa de valer.
//   - sig:     base64url(HMAC-SHA256(secret, "<uuid>.<expMs>"))
//
// Comprimento típico: 36 + 1 + 13 + 1 + 43 = 94 chars. Cabe num QR sem stress.
//
// Backward compatibility: `verifyQrToken` aceita também UUIDs puros (legacy)
// quando o secret não está configurado OU quando explicitamente permitido.
// Em produção com secret definido, legacy é rejeitado.

const ENCODER = new TextEncoder();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 meses

function ttlMs(): number {
  const fromEnv = Number(process.env.QR_TOKEN_TTL_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TTL_MS;
}

function secret(): string | null {
  const s = process.env.QR_TOKEN_SECRET;
  return s && s.length >= 16 ? s : null;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string, key: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(payload));
  return new Uint8Array(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Sign a guest UUID into a tokenized string with expiry.
 * Throws if the project secret is missing in production.
 */
export async function signQrToken(uuid: string, ttlMsOverride?: number): Promise<string> {
  if (!UUID_RE.test(uuid)) throw new Error("invalid uuid");

  const s = secret();
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("QR_TOKEN_SECRET em falta em produção");
    }
    // Dev sem secret → emite UUID puro (legacy mode).
    return uuid;
  }

  const exp = Date.now() + (ttlMsOverride ?? ttlMs());
  const payload = `${uuid}.${exp}`;
  const sig = await hmac(payload, s);
  return `${payload}.${base64url(sig)}`;
}

export type VerifyResult =
  | { ok: true; uuid: string; legacy: boolean; expiresAt?: number }
  | { ok: false; reason: "invalid" | "expired" | "bad-signature" | "legacy-rejected" };

/**
 * Verify a QR token. Accepts:
 *   - signed format `<uuid>.<exp>.<sig>` (preferred)
 *   - bare UUID (legacy) — only if `allowLegacy=true` AND secret unset OR forced
 *
 * Returns the underlying uuid on success (use it for DB lookups).
 */
export async function verifyQrToken(
  token: string,
  opts: { allowLegacy?: boolean } = {},
): Promise<VerifyResult> {
  // Legacy bare UUID
  if (UUID_RE.test(token)) {
    const allowLegacy = opts.allowLegacy ?? !secret();
    if (!allowLegacy) return { ok: false, reason: "legacy-rejected" };
    return { ok: true, uuid: token, legacy: true };
  }

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [uuid, expStr, sigStr] = parts as [string, string, string];
  if (!UUID_RE.test(uuid)) return { ok: false, reason: "invalid" };

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "invalid" };
  if (Date.now() > exp) return { ok: false, reason: "expired" };

  const s = secret();
  if (!s) {
    // Token assinado mas sem secret = falha defensiva.
    return { ok: false, reason: "bad-signature" };
  }

  let provided: Uint8Array;
  try {
    provided = base64urlDecode(sigStr);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const expected = await hmac(`${uuid}.${exp}`, s);
  if (!constantTimeEqual(provided, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  return { ok: true, uuid, legacy: false, expiresAt: exp };
}

export const __test__ = { UUID_RE, DEFAULT_TTL_MS };

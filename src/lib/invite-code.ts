// Invite codes: 12-char base32 (Crockford) without lookalikes (no I, L, O, U).
// 32^12 ≈ 1.15e18 — espaço suficientemente grande para tornar enumeração
// impraticável mesmo sem rate-limit (com rate-limit o ataque é absurdo).

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32 chars
const CODE_LEN = 12;

export const INVITE_CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`);

export function isValidInviteCode(value: unknown): value is string {
  return typeof value === "string" && INVITE_CODE_RE.test(value);
}

export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i]! % 32];
  }
  return out;
}

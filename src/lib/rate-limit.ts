// Rate-limit com dois backends:
//   - Upstash Redis REST (prod): cluster-safe.
//   - Fallback LRU in-memory (dev): per-instance, NÃO converge entre lambdas.
//
// Em produção, se Upstash estiver configurado mas falhar, devolvemos fail-closed
// (ok=false, status=503 a partir do caller) para evitar bypass de rate-limit
// durante outage. Em dev/local, o fallback é silencioso.
//
// Contrato: `rateLimit(key, max, windowMs)`.

import { UPSTASH_TIMEOUT_MS } from "@/lib/limits";

type Result = { ok: boolean; retryAfterSeconds: number; degraded?: boolean };

const isProd = process.env.NODE_ENV === "production";

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

function memoryLimit(key: string, max: number, windowMs: number): Result {
  const now = Date.now();
  const e = store.get(key);

  if (!e || e.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (e.count >= max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((e.resetAt - now) / 1000)),
    };
  }
  e.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

async function upstashLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<Result> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  /* v8 ignore next */
  if (!url || !token) throw new Error("upstash-not-configured");

  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  // Pipeline: INCR + EXPIRE NX (só põe TTL na primeira vez)
  const body = [
    ["INCR", redisKey],
    ["EXPIRE", redisKey, String(ttlSeconds), "NX"],
    ["PTTL", redisKey],
  ];

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`upstash ${res.status}`);

  const data = (await res.json()) as Array<{ result: number | string }>;
  const count = Number(data[0]?.result ?? 0);
  const pttl = Number(data[2]?.result ?? windowMs);
  const retry = Math.max(1, Math.ceil(pttl / 1000));

  if (count > max) return { ok: false, retryAfterSeconds: retry };
  return { ok: true, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<Result> {
  const upstashConfigured = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (upstashConfigured) {
    try {
      return await upstashLimit(key, max, windowMs);
    } catch (e) {
      console.warn("[rate-limit] upstash falhou:", e);
      // Fail-closed em produção: melhor 429 falso do que rate-limit ineficaz
      // durante uma falha de backend (atacante poderia provocar a falha e
      // depois inundar a app). O caller traduz isto para 503.
      if (isProd) {
        return { ok: false, retryAfterSeconds: 30, degraded: true };
      }
      // Dev/local: degrade silenciosamente para memória.
    }
  }
  return memoryLimit(key, max, windowMs);
}

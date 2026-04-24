// Rate-limit com dois backends:
//   - Upstash Redis REST (prod) se UPSTASH_REDIS_REST_URL + TOKEN estiverem definidos
//   - Fallback LRU in-memory (dev) caso contrário
//
// Contrato mantém-se igual ao anterior: `rateLimit(key, max, windowMs)`.

type Result = { ok: boolean; retryAfterSeconds: number };

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
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimit(key, max, windowMs);
    } catch (e) {
      console.warn("[rate-limit] upstash falhou, a usar memória:", e);
    }
  }
  return memoryLimit(key, max, windowMs);
}

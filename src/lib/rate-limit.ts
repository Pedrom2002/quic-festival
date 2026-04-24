type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
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

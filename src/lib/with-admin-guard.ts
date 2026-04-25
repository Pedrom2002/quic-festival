// Higher-order wrapper para rotas admin: corre auth+allowlist, rate-limit
// (opcional) e audita falhas/sucesso. Mantém handlers focados na lógica
// específica.
//
// Uso:
//   export const PATCH = withAdminGuard(
//     async ({ req, user, ip }) => { ... },
//     { rateLimit: { key: (u) => `checkin:${u.email}`, max: 60, windowMs: 60_000 } },
//   );

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/audit";

type AdminUser = { id: string; email: string };

type GuardCtx<TParams> = {
  req: NextRequest;
  user: AdminUser;
  ip: string | null;
  params: TParams;
};

type GuardOptions = {
  rateLimit?: {
    key: (user: AdminUser, ip: string | null) => string;
    max: number;
    windowMs: number;
  };
};

export function withAdminGuard<TParams = Record<string, never>>(
  handler: (ctx: GuardCtx<TParams>) => Promise<Response>,
  opts: GuardOptions = {},
) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Promise<TParams> },
  ): Promise<Response> => {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const ip = ipFromHeaders(req.headers);

    if (opts.rateLimit) {
      const key = opts.rateLimit.key(guard.user, ip);
      const rl = await rateLimit(key, opts.rateLimit.max, opts.rateLimit.windowMs);
      if (!rl.ok) {
        const status = rl.degraded ? 503 : 429;
        return NextResponse.json(
          {
            error: rl.degraded
              ? "Serviço de rate-limit indisponível. Tenta dentro de instantes."
              : "Demasiados pedidos. Tenta dentro de uns minutos.",
          },
          {
            status,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          },
        );
      }
    }

    const params = (routeCtx?.params ? await routeCtx.params : ({} as TParams));
    return handler({ req, user: guard.user, ip, params });
  };
}

import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  target_id: string | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
};

const ACTION_FILTERS = [
  ["all", "Todas"],
  ["admin.signin", "Logins"],
  ["admin.checkin", "Check-ins"],
  ["admin.resend_email", "Reenvios"],
  ["admin.export", "Exports"],
  ["admin.signout", "Logouts"],
] as const;

function colorFor(action: string): string {
  if (action.endsWith(".fail")) return "text-rose-300 border-rose-500/40";
  if (action.endsWith(".duplicate"))
    return "text-amber-300 border-amber-500/40";
  if (action.endsWith(".not_found"))
    return "text-rose-300 border-rose-500/40";
  if (action.endsWith(".ok") || action.endsWith(".sent"))
    return "text-emerald-300 border-emerald-500/40";
  return "text-white/80 border-white/15";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;

  const admin = supabaseAdmin();
  let query = admin
    .from("audit_log")
    .select("id,occurred_at,actor_email,action,target_id,ip,meta")
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (filter !== "all") {
    query = query.like("action", `${filter}%`);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-black leading-none">
            Audit log
          </h1>
          <p className="text-sm opacity-60 mt-1">
            Últimas {rows.length} entradas (máx. 200).
          </p>
        </div>
        <a
          href="/admin"
          className="rounded-full border-2 border-white/25 px-4 py-2 text-xs tracking-[.18em] uppercase hover:border-[#FFD27A] transition"
        >
          ← Tabela
        </a>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/15 bg-white/5 p-1 text-xs mb-6 flex-wrap">
        {ACTION_FILTERS.map(([k, label]) => (
          <a
            key={k}
            href={`?filter=${k}`}
            className={`px-3 py-2 rounded-lg tracking-[.14em] uppercase transition ${
              filter === k
                ? "bg-[#FFD27A] text-[#06111B]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border-2 border-rose-500/50 bg-rose-500/10 text-rose-200 p-4 text-sm">
          Erro ao carregar audit log.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#FFD27A]">
            <tr>
              <th className="text-left px-3 py-2">Quando</th>
              <th className="text-left px-3 py-2">Ação</th>
              <th className="text-left px-3 py-2">Quem</th>
              <th className="text-left px-3 py-2">IP</th>
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-left px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 opacity-80 whitespace-nowrap font-mono text-xs">
                  {new Date(r.occurred_at).toLocaleString("pt-PT")}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-mono ${colorFor(r.action)}`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2 opacity-90">
                  {r.actor_email ?? "—"}
                </td>
                <td className="px-3 py-2 opacity-70 font-mono text-xs">
                  {r.ip ?? "—"}
                </td>
                <td className="px-3 py-2 opacity-60 font-mono text-xs">
                  {r.target_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-3 py-2 opacity-60 font-mono text-xs max-w-xs truncate">
                  {r.meta ? JSON.stringify(r.meta) : "—"}
                </td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center opacity-50">
                  Sem entradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

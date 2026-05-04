"use client";

import { useMemo, useState } from "react";

type Guest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  companion_count: number;
  companion_names: string[];
  token: string;
  checked_in_day1_at: string | null;
  checked_in_day2_at: string | null;
  email_sent_at: string | null;
};

type Toast = { id: number; kind: "ok" | "err"; msg: string };
type Filter = "all" | "checked" | "pending";
type SortKey = "created_at" | "name" | "checked_in_day1_at";

export default function GuestsTable({ initial }: { initial: Guest[] }) {
  const [rows, setRows] = useState<Guest[]>(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // eslint-disable-next-line react-hooks/purity
  function pushToast(kind: Toast["kind"], msg: string) {
    // eslint-disable-next-line react-hooks/purity
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows;
    if (s) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          r.phone.includes(s),
      );
    }
    if (filter === "checked") out = out.filter((r) => r.checked_in_day1_at || r.checked_in_day2_at);
    if (filter === "pending") out = out.filter((r) => !r.checked_in_day1_at && !r.checked_in_day2_at);

    const sorted = [...out].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (sortAsc ? 1 : -1);
    });
    return sorted;
  }, [rows, q, filter, sortKey, sortAsc]);

  async function toggleCheckin(g: Guest, day: 1 | 2) {
    setBusy(g.id);
    const col = day === 1 ? "checked_in_day1_at" : "checked_in_day2_at";
    const next = !g[col];
    setRows((prev) =>
      prev.map((r) =>
        r.id === g.id ? { ...r, [col]: next ? new Date().toISOString() : null } : r,
      ),
    );
    const res = await fetch("/api/admin/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id, checked_in: next, day }),
    });
    setBusy(null);
    if (!res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.id === g.id ? { ...r, [col]: g[col] } : r)),
      );
      pushToast("err", "Falha a atualizar check-in.");
      return;
    }
    pushToast("ok", next ? `Check-in D${day} feito.` : `Check-in D${day} removido.`);
  }

  async function resendEmail(g: Guest) {
    setBusy(g.id);
    const res = await fetch("/api/admin/resend-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id }),
    });
    setBusy(null);
    if (!res.ok) {
      pushToast("err", "Falha a reenviar email.");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === g.id ? { ...r, email_sent_at: new Date().toISOString() } : r,
      ),
    );
    pushToast("ok", `Email reenviado para ${g.email}.`);
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc((a) => !a);
    else { setSortKey(k); setSortAsc(false); }
  }

  const arrow = (k: SortKey) => sortKey === k ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por nome, email ou telefone…"
          className="flex-1 min-w-[240px] rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[#FFD27A]"
        />
        <div className="flex gap-1 rounded-xl border border-white/15 bg-white/5 p-1 text-xs">
          {(
            [
              ["all", "Todos"],
              ["pending", "Pendentes"],
              ["checked", "Check-in"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-lg tracking-[.14em] uppercase transition ${
                filter === k
                  ? "bg-[#FFD27A] text-[#06111B]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#FFD27A]">
            <tr>
              <th
                className="text-left px-3 py-2 cursor-pointer select-none"
                onClick={() => toggleSort("name")}
              >
                Nome{arrow("name")}
              </th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Tel</th>
              <th className="text-left px-3 py-2">+1</th>
              <th
                className="text-left px-3 py-2 cursor-pointer select-none"
                onClick={() => toggleSort("checked_in_day1_at")}
              >
                D1{arrow("checked_in_day1_at")}
              </th>
              <th className="text-left px-3 py-2">D2</th>
              <th
                className="text-left px-3 py-2 cursor-pointer select-none"
                onClick={() => toggleSort("created_at")}
              >
                Inscrito{arrow("created_at")}
              </th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-t border-white/5">
                <td className="px-3 py-2">{g.name}</td>
                <td className="px-3 py-2 opacity-80">{g.email}</td>
                <td className="px-3 py-2 opacity-80">{g.phone}</td>
                <td className="px-3 py-2">
                  {g.companion_count > 0 ? (
                    <span title={(g.companion_names ?? []).join(", ")}>
                      +{g.companion_count}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {g.checked_in_day1_at ? (
                    <span className="text-[#FFD27A]" title={new Date(g.checked_in_day1_at).toLocaleString("pt-PT")}>✓</span>
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {g.checked_in_day2_at ? (
                    <span className="text-[#FFD27A]" title={new Date(g.checked_in_day2_at).toLocaleString("pt-PT")}>✓</span>
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </td>
                <td className="px-3 py-2 opacity-60">
                  {new Date(g.created_at).toLocaleDateString("pt-PT")}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => resendEmail(g)}
                    disabled={busy === g.id}
                    className="rounded-full border border-white/25 px-3 py-1 text-xs tracking-[.14em] uppercase opacity-80 hover:opacity-100 hover:border-[#FFD27A] transition disabled:opacity-40 mr-2"
                    title="Reenviar email + QR"
                  >
                    Reenviar
                  </button>
                  <button
                    onClick={() => toggleCheckin(g, 1)}
                    disabled={busy === g.id}
                    className="rounded-full border border-[#FFD27A] text-[#FFD27A] px-2 py-1 text-xs tracking-[.12em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition disabled:opacity-50 mr-1"
                    title="Toggle check-in Dia 1"
                  >
                    {g.checked_in_day1_at ? "D1 ✓" : "D1"}
                  </button>
                  <button
                    onClick={() => toggleCheckin(g, 2)}
                    disabled={busy === g.id}
                    className="rounded-full border border-[#FFD27A]/60 text-[#FFD27A]/80 px-2 py-1 text-xs tracking-[.12em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition disabled:opacity-50"
                    title="Toggle check-in Dia 2"
                  >
                    {g.checked_in_day2_at ? "D2 ✓" : "D2"}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center opacity-50">
                  Sem resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="fixed right-4 bottom-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl px-4 py-3 text-sm shadow-lg border-2 ${
              t.kind === "ok"
                ? "bg-[#F4EBD6] text-[#06111B] border-[#06111B]"
                : "bg-red-100 text-red-900 border-red-900"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

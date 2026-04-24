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
  checked_in_at: string | null;
  email_sent_at: string | null;
};

export default function GuestsTable({ initial }: { initial: Guest[] }) {
  const [rows, setRows] = useState<Guest[]>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        r.phone.includes(s),
    );
  }, [rows, q]);

  async function toggleCheckin(g: Guest) {
    setBusy(g.id);
    const next = !g.checked_in_at;
    const res = await fetch("/api/admin/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id, checked_in: next }),
    });
    setBusy(null);
    if (!res.ok) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === g.id
          ? { ...r, checked_in_at: next ? new Date().toISOString() : null }
          : r,
      ),
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Procurar por nome, email ou telefone…"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[#FFD27A] mb-4"
      />
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#FFD27A]">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Tel</th>
              <th className="text-left px-3 py-2">+1</th>
              <th className="text-left px-3 py-2">Check-in</th>
              <th className="text-left px-3 py-2">Inscrito</th>
              <th></th>
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
                  {g.checked_in_at ? (
                    <span className="text-[#FFD27A]">
                      {new Date(g.checked_in_at).toLocaleString("pt-PT")}
                    </span>
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </td>
                <td className="px-3 py-2 opacity-60">
                  {new Date(g.created_at).toLocaleDateString("pt-PT")}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => toggleCheckin(g)}
                    disabled={busy === g.id}
                    className="rounded-full border border-[#FFD27A] text-[#FFD27A] px-3 py-1 text-xs tracking-[.14em] uppercase hover:bg-[#FFD27A] hover:text-[#06111B] transition disabled:opacity-50"
                  >
                    {g.checked_in_at ? "Desmarcar" : "Check-in"}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center opacity-50">
                  Sem resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

type Accreditation = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  media_company: string;
  token: string;
};

export default function AccreditationsTable({
  initial,
}: {
  initial: Accreditation[];
}) {
  const [rows] = useState<Accreditation[]>(initial);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        r.media_company.toLowerCase().includes(s) ||
        r.phone.includes(s),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar por nome, email, empresa ou telefone…"
          className="flex-1 min-w-[240px] rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[#FFD27A]"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#FFD27A]">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Telemóvel</th>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-left px-3 py-2">Submetido</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2 opacity-80">{a.email}</td>
                <td className="px-3 py-2 opacity-80">{a.phone}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {a.media_company}
                  </span>
                </td>
                <td className="px-3 py-2 opacity-60">
                  {new Date(a.created_at).toLocaleDateString("pt-PT")}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center opacity-50">
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

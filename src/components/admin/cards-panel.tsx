"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/team-members";
import { slugify } from "@/lib/team-members";
import CardsForm from "./cards-form";

export default function CardsPanel({
  initial,
  isAdmin,
}: {
  initial: TeamMember[];
  isAdmin: boolean;
}) {
  const [members, setMembers] = useState<TeamMember[]>(initial);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState(false);
  async function handleToggleActive(member: TeamMember) {
    const res = await fetch(`/api/admin/cards/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, active: !member.active } : m)),
      );
    }
  }

  function handleSaved(saved: TeamMember, isNew: boolean) {
    setAdding(false);
    setEditing(null);
    setMembers((prev) =>
      isNew
        ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        : prev.map((m) => (m.id === saved.id ? saved : m)),
    );
  }

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-4 py-2 text-xs tracking-[.18em] uppercase font-black hover:opacity-90 transition"
          >
            Adicionar Membro
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[#FFD27A]">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Cargo</th>
              <th className="text-left px-3 py-2">Telefone</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 opacity-80">{m.role}</td>
                <td className="px-3 py-2 opacity-80">{m.phone ?? "—"}</td>
                <td className="px-3 py-2 opacity-80">{m.email}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.active ? "bg-green-400" : "bg-rose-400"}`} />
                    {m.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/card/${m.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#FFD27A] hover:underline"
                    >
                      Ver
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://app.quic.pt/card/${m.slug}`);
                      }}
                      className="text-xs opacity-60 hover:opacity-100"
                    >
                      Copiar
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEditing(m)}
                          className="text-xs opacity-60 hover:opacity-100"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`text-xs ${m.active ? "text-rose-400 hover:text-rose-300" : "text-green-400 hover:text-green-300"}`}
                        >
                          {m.active ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!members.length && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center opacity-50">
                  Sem membros. Adiciona o primeiro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <CardsForm
          initial={editing}
          onSaved={(saved) => handleSaved(saved, !editing)}
          onClose={() => { setAdding(false); setEditing(null); }}
          slugify={slugify}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { TeamMember } from "@/lib/team-members";

export default function CardsForm({
  initial,
  onSaved,
  onClose,
  slugify,
}: {
  initial: TeamMember | null;
  onSaved: (member: TeamMember) => void;
  onClose: () => void;
  slugify: (name: string) => string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManual && name) {
      setSlug(slugify(name));
    }
  }, [name, slugManual, slugify]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body = { name, role, phone: phone || null, email, slug };
    const isEdit = !!initial;

    try {
      const res = await fetch(
        isEdit ? `/api/admin/cards/${initial.id}` : "/api/admin/cards",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const json = (await res.json()) as { member: import("@/lib/team-members").TeamMember; error?: string };

      if (!res.ok) {
        setError(json.error ?? "Erro desconhecido.");
        return;
      }

      onSaved(json.member);
    } catch {
      setError("Erro de ligação. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[#FFD27A]";
  const labelClass = "block text-xs tracking-[.15em] uppercase opacity-60 mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#06182A] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-sm tracking-[.18em] uppercase font-black mb-6">
          {initial ? "Editar Membro" : "Novo Membro"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Carlos Vieira"
            />
          </div>
          <div>
            <label className={labelClass}>Cargo *</label>
            <input
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
              placeholder="CEO"
            />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+351 900 000 000"
            />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="nome@quic.pt"
            />
          </div>
          <div>
            <label className={labelClass}>Slug (URL)</label>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
              className={inputClass}
              placeholder="carlos-vieira"
            />
            <p className="text-xs opacity-40 mt-1">app.quic.pt/card/{slug || "…"}</p>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs tracking-[.15em] uppercase opacity-60 hover:opacity-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-6 py-2 text-xs tracking-[.18em] uppercase font-black hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

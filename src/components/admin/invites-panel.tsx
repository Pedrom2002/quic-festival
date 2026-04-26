"use client";

import { useState, useTransition } from "react";

type Invite = {
  id: string;
  code: string;
  label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export default function InvitesPanel({
  initialInvites,
}: {
  initialInvites: Invite[];
}) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("40");
  const [expires, setExpires] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/invites", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      invites?: Invite[];
    };
    if (json.invites) setInvites(json.invites);
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const max = Number(maxUses);
    if (!Number.isInteger(max) || max < 1 || max > 1000) {
      setError("Número de convites tem de estar entre 1 e 1000.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          max_uses: max,
          expires_at: expires
            ? new Date(expires).toISOString()
            : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (!res.ok || !json.code) {
        setError(json.error ?? "Falha a criar.");
        return;
      }
      setSuccess(`Convite criado · código ${json.code}`);
      setLabel("");
      setMaxUses("40");
      setExpires("");
      await refresh();
    });
  }

  async function toggleArchive(invite: Invite) {
    const archived = !invite.archived_at;
    startTransition(async () => {
      const res = await fetch(`/api/admin/invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) {
        setError("Falha a actualizar estado.");
        return;
      }
      await refresh();
    });
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/i/${code}`;
    navigator.clipboard?.writeText(url);
    setSuccess(`Link copiado: ${url}`);
  }

  return (
    <div className="grid gap-8 max-w-5xl">
      <section className="rounded-2xl border-2 border-[#FFD27A]/40 bg-[#06111B]/40 p-6">
        <h1 className="font-serif text-3xl font-black mb-1">
          Convites <em className="not-italic text-[#F2A93C]">/i/</em>
        </h1>
        <p className="text-sm opacity-70 mb-4">
          Gera um link com N convites. Partilha o link — cada submissão
          consome um convite.
        </p>

        <form
          onSubmit={createInvite}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_120px_180px_120px]"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta (ex.: Sonae 8/05)"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            maxLength={120}
          />
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            aria-label="Número de convites"
          />
          <input
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            type="datetime-local"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#FFD27A]"
            aria-label="Expira em"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-3 py-2 text-xs tracking-[.16em] uppercase font-black hover:bg-[#F2A93C] disabled:opacity-50 transition"
          >
            {isPending ? "..." : "Gerar"}
          </button>
        </form>

        {error && (
          <p
            className="mt-3 text-sm text-rose-300"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && !error && (
          <p
            className="mt-3 text-sm text-emerald-300"
            role="status"
          >
            {success}
          </p>
        )}
      </section>

      <section>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.16em] opacity-60">
            <tr className="text-left">
              <th className="py-2">Etiqueta</th>
              <th className="py-2">Código</th>
              <th className="py-2">Vagas</th>
              <th className="py-2">Expira</th>
              <th className="py-2">Estado</th>
              <th className="py-2 text-right">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center opacity-60">
                  Nenhum convite ainda.
                </td>
              </tr>
            )}
            {invites.map((inv) => {
              const remaining = Math.max(0, inv.max_uses - inv.uses_count);
              const expired =
                !!inv.expires_at && new Date(inv.expires_at) < new Date();
              const archived = !!inv.archived_at;
              const exhausted = remaining === 0;
              const stateBadge = archived
                ? { text: "ARQUIVADO", cls: "bg-white/15 text-white/70" }
                : expired
                  ? { text: "EXPIRADO", cls: "bg-rose-700/40 text-rose-200" }
                  : exhausted
                    ? { text: "ESGOTADO", cls: "bg-amber-700/40 text-amber-200" }
                    : { text: "ACTIVO", cls: "bg-emerald-700/40 text-emerald-200" };
              return (
                <tr key={inv.id} className={archived ? "opacity-50" : ""}>
                  <td className="py-3 pr-3">
                    <div className="font-bold">{inv.label ?? "—"}</div>
                    <div className="text-xs opacity-60">
                      {new Date(inv.created_at).toLocaleString("pt-PT")}
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{inv.code}</td>
                  <td className="py-3 pr-3">
                    <div className="font-bold">
                      {inv.uses_count} / {inv.max_uses}
                    </div>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[#FFD27A]"
                        style={{
                          width: `${Math.min(100, (inv.uses_count / inv.max_uses) * 100)}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs opacity-80">
                    {inv.expires_at
                      ? new Date(inv.expires_at).toLocaleString("pt-PT")
                      : "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[.16em] ${stateBadge.cls}`}
                    >
                      {stateBadge.text}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => copyLink(inv.code)}
                        className="rounded border border-white/20 px-2 py-1 text-[11px] tracking-[.16em] uppercase hover:border-[#FFD27A] hover:text-[#FFD27A]"
                      >
                        Copiar link
                      </button>
                      <button
                        onClick={() => toggleArchive(inv)}
                        disabled={isPending}
                        className="rounded border border-white/20 px-2 py-1 text-[11px] tracking-[.16em] uppercase hover:border-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        {archived ? "Reactivar" : "Arquivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

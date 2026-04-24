"use client";

import { useState } from "react";

export default function AccountForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (next.length < 10) {
      setMsg({ kind: "err", text: "Nova password tem que ter ≥ 10 chars." });
      return;
    }
    if (next !== confirm) {
      setMsg({ kind: "err", text: "Confirmação não bate certo." });
      return;
    }
    if (next === current) {
      setMsg({ kind: "err", text: "Nova tem que ser diferente da atual." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg({ kind: "err", text: json.error ?? "Falha." });
        return;
      }
      setMsg({ kind: "ok", text: "Password atualizada." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setMsg({ kind: "err", text: "Sem ligação." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field
        label="Password atual"
        type="password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <Field
        label="Nova password"
        type="password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <Field
        label="Confirmar nova"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={busy}
        className="mt-2 rounded-full border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] px-4 py-3 font-black tracking-[.14em] disabled:opacity-60"
      >
        {busy ? "A GUARDAR…" : "ATUALIZAR PASSWORD"}
      </button>

      {msg && (
        <p
          className={`text-sm ${
            msg.kind === "ok" ? "text-emerald-300" : "text-rose-300"
          }`}
          role={msg.kind === "ok" ? "status" : "alert"}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs tracking-[.16em] uppercase opacity-70 mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[#FFD27A]"
      />
    </label>
  );
}

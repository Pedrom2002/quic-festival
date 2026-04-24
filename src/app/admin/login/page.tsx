"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "password" | "magic";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    if (mode === "password") {
      const res = await fetch("/api/admin/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => ({}))) as {
        error?: string;
      } | null;
      if (!res?.ok) {
        setStatus("error");
        setMessage(json?.error ?? "Erro de rede.");
        return;
      }
      router.push("/admin");
      router.refresh();
      return;
    }

    const res = await fetch("/api/admin/sign-in/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as {
      error?: string;
    } | null;
    if (!res?.ok) {
      setStatus("error");
      setMessage(json?.error ?? "Erro a enviar magic link.");
      return;
    }
    setStatus("sent");
    setMessage("Se o email existir, recebes um link em breve.");
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-[#06182A] text-[#F4EBD6] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border-2 border-[#06111B] bg-[#F4EBD6] text-[#06111B] p-6 shadow-[5px_5px_0_#06111B]"
      >
        <h1 className="font-serif text-2xl font-black leading-tight">
          Admin <em className="text-[#E8613C] italic">QUIC</em>
        </h1>
        <p className="text-sm opacity-70 mt-1 mb-4">
          Entra no painel de gestão.
        </p>

        <div className="flex gap-1 rounded-full border-2 border-[#06111B] p-1 mb-4 text-xs">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 px-3 py-2 rounded-full tracking-[.14em] uppercase font-bold transition ${
              mode === "password"
                ? "bg-[#06111B] text-[#FFD27A]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`flex-1 px-3 py-2 rounded-full tracking-[.14em] uppercase font-bold transition ${
              mode === "magic"
                ? "bg-[#06111B] text-[#FFD27A]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            Magic Link
          </button>
        </div>

        <label className="block text-sm font-bold mb-1">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-b-2 border-[#06111B] bg-transparent py-2 text-base outline-none focus:border-[#F2A93C] mb-3"
          placeholder="tu@exemplo.pt"
        />

        {mode === "password" && (
          <>
            <label className="block text-sm font-bold mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-b-2 border-[#06111B] bg-transparent py-2 text-base outline-none focus:border-[#F2A93C]"
              placeholder="••••••••"
            />
          </>
        )}

        <button
          disabled={status === "sending"}
          className="mt-5 w-full rounded-full border-2 border-[#06111B] bg-[#06111B] text-[#FFD27A] px-4 py-3 font-black tracking-[.14em] disabled:opacity-60"
        >
          {status === "sending"
            ? "A ENTRAR…"
            : mode === "password"
              ? "ENTRAR"
              : "ENVIAR MAGIC LINK"}
        </button>
        {message && (
          <p
            className={`mt-3 text-sm ${status === "error" ? "text-red-700" : "text-green-800"}`}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

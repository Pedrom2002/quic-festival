"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
      setMessage("Vê o teu email e clica no link.");
    }
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
          Magic link para entrar no painel.
        </p>
        <label className="block text-sm font-bold mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-b-2 border-[#06111B] bg-transparent py-2 text-base outline-none focus:border-[#F2A93C]"
          placeholder="tu@exemplo.pt"
        />
        <button
          disabled={status === "sending"}
          className="mt-5 w-full rounded-full border-2 border-[#06111B] bg-[#06111B] text-[#FFD27A] px-4 py-3 font-black tracking-[.14em] disabled:opacity-60"
        >
          {status === "sending" ? "A ENVIAR…" : "ENVIAR MAGIC LINK"}
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

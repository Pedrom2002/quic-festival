"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { accreditationRsvpSchema, type AccreditationRsvpInput } from "@/lib/validators";

export default function AccreditationForm({
  accreditationCode,
}: {
  accreditationCode: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccreditationRsvpInput>({
    resolver: zodResolver(accreditationRsvpSchema),
    defaultValues: { name: "", email: "", phone: "", media_company: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: AccreditationRsvpInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/accreditation-rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, accreditationCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(json?.error ?? "Erro ao submeter. Tenta novamente.");
        return;
      }
      if (json?.token) {
        router.push(`/acreditado/${json.token}`);
      }
    } catch {
      setServerError("Erro de ligação. Tenta novamente.");
    }
  }

  const inputCls =
    "w-full rounded-xl border-2 border-[#06111B]/20 bg-white px-4 py-3 text-sm text-[#06111B] outline-none focus:border-[#FFD27A] placeholder:opacity-40";
  const labelCls = "block text-xs font-bold tracking-[.12em] uppercase opacity-60 mb-1";
  const errorCls = "mt-1 text-xs text-rose-600";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-2xl border-2 border-white/10 bg-white/5 p-6 grid gap-4"
    >
      <div>
        <label htmlFor="ac-name" className={labelCls}>Nome *</label>
        <input
          id="ac-name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Nome completo"
          className={inputCls}
          {...register("name")}
        />
        {errors.name && <p className={errorCls}>{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="ac-email" className={labelCls}>Email *</label>
        <input
          id="ac-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="email@exemplo.com"
          className={inputCls}
          {...register("email")}
        />
        {errors.email && <p className={errorCls}>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="ac-phone" className={labelCls}>Telemóvel *</label>
        <input
          id="ac-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9XXXXXXXX"
          className={inputCls}
          {...register("phone")}
        />
        {errors.phone && <p className={errorCls}>{errors.phone.message}</p>}
      </div>

      <div>
        <label htmlFor="ac-company" className={labelCls}>Empresa de media *</label>
        <input
          id="ac-company"
          type="text"
          autoCapitalize="words"
          placeholder="Ex.: RTP, Público, NiT…"
          className={inputCls}
          {...register("media_company")}
        />
        {errors.media_company && (
          <p className={errorCls}>{errors.media_company.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="mt-1 w-full rounded-xl border-2 border-[#FFD27A] bg-[#FFD27A] text-[#06111B] py-3 text-xs font-black tracking-[.16em] uppercase hover:bg-[#F2A93C] disabled:opacity-50 transition"
      >
        {isSubmitting ? "A submeter…" : "Solicitar Acreditação"}
      </button>

      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-300 text-center" role="alert">
          {serverError}
        </div>
      )}
    </form>
  );
}

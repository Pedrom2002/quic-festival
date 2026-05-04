"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { accreditationRsvpSchema, type AccreditationRsvpInput } from "@/lib/validators";

export default function AccreditationForm({
  accreditationCode,
}: {
  accreditationCode: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

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

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: prefersReduced ? 0 : 0.08 } },
  };
  const item = {
    hidden: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReduced ? 0 : 0.5, ease: [0.2, 0.7, 0.3, 1] as const },
    },
  };

  return (
    <motion.form
      className="form-card"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
    >
      <motion.h2 variants={item}>
        Pede a tua <em>acreditação</em>.
      </motion.h2>
      <motion.p className="subtitle" variants={item}>
        Preenche os dados abaixo para obteres a tua acreditação media para o QUIC Festival 2026.
      </motion.p>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-name">
          Nome <span className="req">*</span>
        </label>
        <input
          id="ac-name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          {...register("name")}
        />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-tel">
          Telemóvel <span className="req">*</span>
        </label>
        <input
          id="ac-tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9XXXXXXXX"
          {...register("phone")}
        />
        {errors.phone && <p className="field-error">{errors.phone.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-email">
          Email <span className="req">*</span>
        </label>
        <input
          id="ac-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="email@redacao.pt"
          {...register("email")}
        />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-company">
          Empresa de media <span className="req">*</span>
        </label>
        <input
          id="ac-company"
          type="text"
          autoCapitalize="words"
          placeholder="Ex.: RTP, Público, NiT…"
          {...register("media_company")}
        />
        {errors.media_company && (
          <p className="field-error">{errors.media_company.message}</p>
        )}
      </motion.div>

      <motion.button
        type="submit"
        className="btn-submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        variants={item}
      >
        <span>{isSubmitting ? "A submeter…" : "Solicitar Acreditação"}</span>
        {isSubmitting ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            className="spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        )}
      </motion.button>

      {serverError && (
        <div className="form-error-banner" role="alert">
          {serverError}
        </div>
      )}

      <motion.p className="fine-print" variants={item}>
        Os teus dados são usados exclusivamente para emissão da acreditação media.{" "}
        <a href="/privacidade" style={{ color: "inherit", textDecoration: "underline" }}>
          Política de privacidade
        </a>
        .
      </motion.p>
    </motion.form>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { rsvpSchema, type RsvpInput } from "@/lib/validators";

const SUCCESS_MESSAGE =
  "Inscrição recebida. Vê o teu email para o QR de entrada.";

export default function RsvpForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RsvpInput>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      acompanhante: undefined,
      companion_nome: "",
      companion_tel: "",
    },
    mode: "onBlur",
  });

  const acompanhante = watch("acompanhante");
  const bringsCompanion = acompanhante === "sim";

  async function onSubmit(values: RsvpInput) {
    setServerError(null);
    setServerInfo(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(json?.error ?? "Algo correu mal. Tenta novamente.");
        return;
      }
      // Sucesso: mensagem genérica + redirecionamento no email. Caminho
      // único, independente de novo registo (json.token) ou duplicado
      // ({ ok: true }), preserva user-enumeration defense.
      setServerInfo(SUCCESS_MESSAGE);
    } catch {
      setServerError("Sem ligação. Verifica a internet e tenta outra vez.");
    }
  }

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: prefersReduced ? 0 : 0.08 },
    },
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
        Confirma a tua <em>presença</em>.
      </motion.h2>
      <motion.p className="subtitle" variants={item}>
        Precisamos só de alguns dados para te pôr na lista.
      </motion.p>

      <motion.div className="field" variants={item}>
        <label htmlFor="nome">
          Nome completo <span className="req">*</span>
        </label>
        <input
          id="nome"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          {...register("name")}
        />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="tel">
          Telefone <span className="req">*</span>
        </label>
        <input
          id="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9XXXXXXXX"
          {...register("phone")}
        />
        {errors.phone && <p className="field-error">{errors.phone.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="email">
          Email <span className="req">*</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="tu@exemplo.pt"
          {...register("email")}
        />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </motion.div>

      <motion.fieldset className="radio-field" variants={item}>
        <legend>
          Levas acompanhante? <span className="req">*</span>
        </legend>
        <div className="radio-group" role="radiogroup">
          <label className="sticker-radio yes">
            <input type="radio" value="sim" {...register("acompanhante")} />
            <span>SIM</span>
          </label>
          <label className="sticker-radio no">
            <input type="radio" value="nao" {...register("acompanhante")} />
            <span>NÃO</span>
          </label>
        </div>
        {errors.acompanhante && (
          <p className="field-error">{errors.acompanhante.message}</p>
        )}
      </motion.fieldset>

      <div
        className={`companion${bringsCompanion ? " open" : ""}`}
        // `inert` removes the subtree from focus + AT navigation when
        // collapsed, satisfying axe `aria-hidden-focus`. Drop `aria-hidden`
        // because `inert` is the focus-aware variant.
        inert={!bringsCompanion}
      >
        <div className="field">
          <label htmlFor="c-nome">
            Nome do acompanhante <span className="req">*</span>
          </label>
          <input
            id="c-nome"
            type="text"
            autoCapitalize="words"
            tabIndex={bringsCompanion ? 0 : -1}
            {...register("companion_nome")}
          />
          {errors.companion_nome && (
            <p className="field-error">{errors.companion_nome.message}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="c-tel">
            Telefone do acompanhante <span className="req">*</span>
          </label>
          <input
            id="c-tel"
            type="tel"
            inputMode="tel"
            placeholder="9XXXXXXXX"
            tabIndex={bringsCompanion ? 0 : -1}
            {...register("companion_tel")}
          />
          {errors.companion_tel && (
            <p className="field-error">{errors.companion_tel.message}</p>
          )}
        </div>
      </div>

      <motion.button
        type="submit"
        className="btn-submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        variants={item}
      >
        <span>{isSubmitting ? "A CONFIRMAR…" : "CONFIRMAR PRESENÇA"}</span>
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
      {serverInfo && (
        <div className="form-info-banner" role="status">
          {serverInfo}
        </div>
      )}

      <motion.p className="fine-print" variants={item}>
        Ao confirmar autorizas o tratamento dos teus dados (nome, email, telefone) apenas para
        gestão da entrada e comunicação relativa ao QUIC Festival 2026, conforme RGPD. Não
        partilhamos com terceiros. Para análise de tráfego usamos Vercel Analytics (estatística
        agregada, sem cookies de marketing). Detalhes em{" "}
        <a href="/privacidade" style={{ color: "inherit", textDecoration: "underline" }}>
          /privacidade
        </a>
        . Pedidos de eliminação:{" "}
        <a href="mailto:ola@quic.pt" style={{ color: "inherit", textDecoration: "underline" }}>
          ola@quic.pt
        </a>
        .
      </motion.p>
    </motion.form>
  );
}

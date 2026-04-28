"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { rsvpSchema, type RsvpInput } from "@/lib/validators";
import Turnstile from "@/components/turnstile";
import { useT } from "@/lib/i18n";

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Props = { inviteCode?: string };

export default function RsvpForm({ inviteCode }: Props = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const captchaRequired = !!SITEKEY;
  const { t } = useT();

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
      companion_email: "",
    },
    mode: "onBlur",
  });

  const acompanhante = watch("acompanhante");
  const bringsCompanion = acompanhante === "sim";

  async function onSubmit(values: RsvpInput) {
    setServerError(null);
    setServerInfo(null);
    if (captchaRequired && !captchaToken) {
      setServerError(t("rsvp.error.captcha"));
      return;
    }
    try {
      const payload: Record<string, unknown> = { ...values };
      if (inviteCode) payload.inviteCode = inviteCode;
      if (captchaToken) payload.captchaToken = captchaToken;
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(json?.error ?? t("rsvp.error.generic"));
        return;
      }
      if (json?.token) {
        router.push(`/confirmado/${json.token}`);
        return;
      }
      // Resposta genérica (e.g. duplicado): não revela se já existia.
      setServerInfo(t("rsvp.info.received"));
    } catch {
      setServerError(t("rsvp.error.network"));
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
        {t("rsvp.title.before")}<em>{t("rsvp.title.em")}</em>{t("rsvp.title.after")}
      </motion.h2>
      <motion.p className="subtitle" variants={item}>
        {t("rsvp.subtitle")}
      </motion.p>

      <motion.div className="field" variants={item}>
        <label htmlFor="nome">
          {t("rsvp.name")} <span className="req">*</span>
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
          {t("rsvp.phone")} <span className="req">*</span>
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
          {t("rsvp.email")} <span className="req">*</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder={t("rsvp.email.placeholder")}
          {...register("email")}
        />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </motion.div>

      <motion.fieldset className="radio-field" variants={item}>
        <legend>
          {t("rsvp.companion.q")} <span className="req">*</span>
        </legend>
        <div className="radio-group" role="radiogroup">
          <label className="sticker-radio yes">
            <input type="radio" value="sim" {...register("acompanhante")} />
            <span>{t("rsvp.yes")}</span>
          </label>
          <label className="sticker-radio no">
            <input type="radio" value="nao" {...register("acompanhante")} />
            <span>{t("rsvp.no")}</span>
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
            {t("rsvp.companion.name")} <span className="req">*</span>
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
            {t("rsvp.companion.phone")} <span className="req">*</span>
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

        <div className="field">
          <label htmlFor="c-email">
            {t("rsvp.companion.email")} <span className="req">*</span>
          </label>
          <input
            id="c-email"
            type="email"
            inputMode="email"
            autoCapitalize="off"
            placeholder={t("rsvp.email.placeholder")}
            tabIndex={bringsCompanion ? 0 : -1}
            {...register("companion_email")}
          />
          {errors.companion_email && (
            <p className="field-error">{errors.companion_email.message}</p>
          )}
        </div>
      </div>

      {captchaRequired && (
        <motion.div variants={item} className="mt-3">
          <Turnstile
            sitekey={SITEKEY}
            theme="light"
            onToken={setCaptchaToken}
          />
        </motion.div>
      )}

      <motion.button
        type="submit"
        className="btn-submit"
        disabled={isSubmitting || (captchaRequired && !captchaToken)}
        aria-busy={isSubmitting}
        variants={item}
      >
        <span>{isSubmitting ? t("rsvp.submitting") : t("rsvp.submit")}</span>
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
        {t("rsvp.fineprint")}
        <a href="/privacidade" style={{ color: "inherit", textDecoration: "underline" }}>
          /privacidade
        </a>
        {t("rsvp.fineprint.delete")}
        <a href="mailto:ola@quic.pt" style={{ color: "inherit", textDecoration: "underline" }}>
          ola@quic.pt
        </a>
        .
      </motion.p>
    </motion.form>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { accreditationRsvpSchema, type AccreditationRsvpInput } from "@/lib/validators";
import { useT } from "@/lib/i18n";

export default function AccreditationForm({
  accreditationCode,
}: {
  accreditationCode: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();
  const { t } = useT();

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
        setServerError(json?.error ?? t("acc.error.generic"));
        return;
      }
      if (json?.token) {
        router.push(`/acreditado/${json.token}`);
      }
    } catch {
      setServerError(t("acc.error.network"));
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
        {t("acc.title.before")}<em>{t("acc.title.em")}</em>{t("acc.title.after")}
      </motion.h2>
      <motion.p className="subtitle" variants={item}>
        {t("acc.subtitle")}
      </motion.p>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-name">
          {t("acc.name")} <span className="req">*</span>
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
          {t("acc.phone")} <span className="req">*</span>
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
          {t("acc.email")} <span className="req">*</span>
        </label>
        <input
          id="ac-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder={t("acc.email.placeholder")}
          {...register("email")}
        />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </motion.div>

      <motion.div className="field" variants={item}>
        <label htmlFor="ac-company">
          {t("acc.company")} <span className="req">*</span>
        </label>
        <input
          id="ac-company"
          type="text"
          autoCapitalize="words"
          placeholder={t("acc.company.placeholder")}
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
        <span>{isSubmitting ? t("acc.submitting") : t("acc.submit")}</span>
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
        {t("acc.fineprint")}
        <a href="/privacidade" style={{ color: "inherit", textDecoration: "underline" }}>
          /privacidade
        </a>
        {t("acc.fineprint.delete")}
        <a href="mailto:ola@quic.pt" style={{ color: "inherit", textDecoration: "underline" }}>
          ola@quic.pt
        </a>
        .
      </motion.p>
    </motion.form>
  );
}

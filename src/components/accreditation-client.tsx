"use client";

import { useEffect, useState } from "react";
import Scene from "@/components/scene";
import AccreditationForm from "@/components/accreditation-form";
import Lineup from "@/components/lineup";
import LangSwitcher from "@/components/lang-switcher";
import { I18nProvider, useT } from "@/lib/i18n";

type Props = {
  code: string;
  label: string | null;
  expired: boolean;
  exhausted: boolean;
};

function AccreditationInner({ code, label, expired, exhausted }: Props) {
  const [mounted, setMounted] = useState(false);
  const { t } = useT();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const blocked = expired || exhausted;

  return (
    <>
      <Scene />
      <LangSwitcher />

      <main className={`site-main${mounted ? " in" : ""}`}>
        <section className="hero">
          <h1 className="title fade-up d2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QUIC Festival 2026" />
          </h1>

          <div className="datas fade-up d3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/datas.png"
              alt="8 e 9 de Maio · Monsanto Open Air, Lisboa · Bilhetes em FNAC, Wortek, El Corte Inglês e Ticketline.pt"
            />
          </div>

          <div className="lineup-slot lineup-desktop-only">
            <Lineup />
          </div>
        </section>

        <section className="form-wrap fade-up d3">
          <div className="invite-banner">
            <span className="invite-tag">{t("acc.banner.tag")}</span>
            {label && (
              <span className="invite-label">
                {t("acc.banner.for")} {label.charAt(0).toUpperCase() + label.slice(1)}
              </span>
            )}
          </div>

          {expired && (
            <div className="invite-warning" role="alert">
              {t("acc.expired")}
            </div>
          )}
          {exhausted && !expired && (
            <div className="invite-warning" role="alert">
              {t("acc.exhausted")}
            </div>
          )}
          {!blocked && <AccreditationForm accreditationCode={code} />}
        </section>

        <div className="lineup-slot lineup-mobile-only">
          <Lineup />
        </div>
      </main>
    </>
  );
}

export default function AccreditationClient(props: Props) {
  return (
    <I18nProvider>
      <AccreditationInner {...props} />
    </I18nProvider>
  );
}

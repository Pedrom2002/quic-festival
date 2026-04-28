"use client";

import { useEffect, useState } from "react";
import Scene from "@/components/scene";
import Lineup from "@/components/lineup";
import LangSwitcher from "@/components/lang-switcher";
import { I18nProvider, useT } from "@/lib/i18n";

function HomeContent() {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

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

          <div className="lineup-slot lineup-desktop-only fade-up d4">
            <Lineup />
          </div>
        </section>

        <section className="form-wrap fade-up d3">
          <div className="form-card invite-only">
            <h2>
              {t("home.invite.title")}
              <em>{t("home.invite.title.em")}</em>
              {t("home.invite.title.after")}
            </h2>
            <p className="subtitle">{t("home.invite.subtitle")}</p>
          </div>
        </section>

        <div className="lineup-slot lineup-mobile-only fade-up d4">
          <Lineup />
        </div>
      </main>
    </>
  );
}

export default function HomePage() {
  return (
    <I18nProvider>
      <HomeContent />
    </I18nProvider>
  );
}

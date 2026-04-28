"use client";

import { useEffect, useState } from "react";
import Scene from "@/components/scene";
import RsvpForm from "@/components/rsvp-form";
import Lineup from "@/components/lineup";
import LangSwitcher from "@/components/lang-switcher";
import { I18nProvider, useT } from "@/lib/i18n";

type Props = {
  code: string;
  label: string | null;
  expired: boolean;
  exhausted: boolean;
};

function InviteInner({ code, label, expired, exhausted }: Props) {
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
            <span className="invite-tag">{t("invite.banner.tag")}</span>
            {label && (
              <span className="invite-label">
                {t("invite.banner.for")} {label.charAt(0).toUpperCase() + label.slice(1)}
              </span>
            )}
          </div>

          {expired && (
            <div className="invite-warning" role="alert">
              Este convite expirou. Contacta o organizador.
            </div>
          )}
          {exhausted && !expired && (
            <div className="invite-warning" role="alert">
              Convite esgotado. Já não há convites neste link.
            </div>
          )}
          {!blocked && <RsvpForm inviteCode={code} />}
        </section>

        <div className="lineup-slot lineup-mobile-only">
          <Lineup />
        </div>
      </main>
    </>
  );
}

export default function InviteClient(props: Props) {
  return (
    <I18nProvider>
      <InviteInner {...props} />
    </I18nProvider>
  );
}

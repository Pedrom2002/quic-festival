"use client";

import { useEffect, useState } from "react";
import Scene from "@/components/scene";
import RsvpForm from "@/components/rsvp-form";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <>
      <Scene />

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
        </section>

        <section className="form-wrap fade-up d3">
          <RsvpForm />
        </section>
      </main>

      <div className="corner-mark">mockup · v0</div>
    </>
  );
}

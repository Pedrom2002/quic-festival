"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const ARTISTS = [
  "Maria Reis",
  "Luca Argel",
  "Benjamim",
  "Conan Osíris",
  "Branko",
  "Sobrado",
  "Papillon",
  "Bispo",
];

const PALETTE = [
  { bg: "#FFD27A", fg: "#06111B" },
  { bg: "#F2A93C", fg: "#06111B" },
  { bg: "#E8613C", fg: "#F4EBD6" },
  { bg: "#3B5BA5", fg: "#F4EBD6" },
];

function pseudoRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function Lineup() {
  const reduced = useReducedMotion();

  const items = useMemo(
    () =>
      ARTISTS.map((name, i) => {
        const r = pseudoRand(i + 1);
        const rot = (r - 0.5) * 6;
        const tone = PALETTE[i % PALETTE.length];
        return { name, rot, ...tone };
      }),
    [],
  );

  return (
    <section className="lineup">
      <div className="lineup-heading">
        <h2>
          Line <em>up</em>.
        </h2>
        <p>Mais anúncios em breve.</p>
      </div>
      <div className="lineup-grid">
        {items.map((it, i) => (
          <motion.div
            key={it.name}
            className="lineup-sticker"
            style={{
              background: it.bg,
              color: it.fg,
              transform: `rotate(${it.rot}deg)`,
            }}
            initial={reduced ? undefined : { opacity: 0, y: 20, scale: 0.92 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ delay: i * 0.05, duration: 0.45, ease: "easeOut" }}
            whileHover={reduced ? undefined : { scale: 1.04, rotate: 0 }}
          >
            <span>{it.name}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";

type Day = {
  date: string;
  acts: { name: string; size: "lg" | "md" | "sm" }[];
};

const DAYS: Day[] = [
  {
    date: "8 de Maio",
    acts: [
      { name: "Nonstop", size: "lg" },
      { name: "Kiko is Hot", size: "md" },
      { name: "DJ Marques", size: "sm" },
    ],
  },
  {
    date: "9 de Maio",
    acts: [
      { name: "Soraia Ramos", size: "lg" },
      { name: "Rony Fuego", size: "md" },
      { name: "DJ Overule", size: "sm" },
    ],
  },
];

export default function Lineup() {
  const reduced = useReducedMotion();

  return (
    <section className="lineup-poster">
      {DAYS.map((day, di) => (
        <motion.div
          key={day.date}
          className="lineup-day"
          initial={reduced ? undefined : { opacity: 0, y: 18 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ delay: di * 0.15, duration: 0.5, ease: "easeOut" }}
        >
          <div className="lineup-day-label">
            <span className="rule" />
            <span className="date">{day.date}</span>
            <span className="rule" />
          </div>
          <ul className="lineup-acts">
            {day.acts.map((a, ai) => (
              <motion.li
                key={a.name}
                className={`act act-${a.size}`}
                initial={reduced ? undefined : { opacity: 0, y: 10 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{
                  delay: di * 0.15 + ai * 0.08,
                  duration: 0.45,
                  ease: "easeOut",
                }}
              >
                {a.name}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      ))}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

const PATHS = [
  "M120,40 C170,20 220,70 240,130 C260,190 200,240 140,230 C70,220 30,170 40,110 C48,68 80,55 120,40 Z",
  "M110,50 C180,40 230,90 230,150 C230,210 160,240 100,220 C50,205 20,150 30,100 C40,60 75,58 110,50 Z",
  "M130,30 C200,30 240,100 230,170 C220,230 150,250 100,225 C55,200 25,145 40,95 C52,55 90,32 130,30 Z",
];

function Blob({
  x,
  y,
  color,
  size,
  delay,
  pm,
}: {
  x: string;
  y: string;
  color: string;
  size: number;
  delay: number;
  pm: { mx: ReturnType<typeof useMotionValue<number>>; my: ReturnType<typeof useMotionValue<number>> };
}) {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 280 280"
      width={size}
      height={size}
      className="absolute"
      style={{
        left: x,
        top: y,
        x: pm.mx,
        y: pm.my,
        filter: `drop-shadow(0 0 40px ${color}55)`,
        mixBlendMode: "screen",
      }}
      aria-hidden="true"
    >
      <motion.path
        fill={color}
        opacity={0.55}
        initial={{ d: PATHS[0] }}
        animate={reduced ? undefined : { d: PATHS }}
        transition={
          reduced
            ? undefined
            : {
                duration: 14,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay,
              }
        }
      />
    </motion.svg>
  );
}

export default function Blobs() {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18 });
  const sy = useSpring(my, { stiffness: 40, damping: 18 });
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (reduced) return;
    function onMove(e: MouseEvent) {
      const nx = (e.clientX / window.innerWidth - 0.5) * 16;
      const ny = (e.clientY / window.innerHeight - 0.5) * 16;
      mx.set(nx);
      my.set(ny);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, reduced]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Blob x="-8%" y="4%" color="#F2A93C" size={420} delay={0} pm={{ mx: sx, my: sy }} />
      <Blob x="62%" y="-6%" color="#E8613C" size={360} delay={2.2} pm={{ mx: sx, my: sy }} />
      <Blob x="18%" y="38%" color="#3B5BA5" size={300} delay={4.4} pm={{ mx: sx, my: sy }} />
    </div>
  );
}

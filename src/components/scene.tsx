"use client";

import { useEffect, useRef } from "react";

export default function Scene() {
  const starsRef = useRef<HTMLDivElement>(null);
  const bulbsRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const starsEl = starsRef.current;
    /* v8 ignore next */
    if (!starsEl) return;

    starsEl.innerHTML = "";
    const mobile = window.innerWidth < 600;
    const N = mobile ? 40 : 80;
    for (let i = 0; i < N; i++) {
      const s = document.createElement("span");
      s.className = "s";
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 55 + "%";
      s.style.animationDelay = Math.random() * 3 + "s";
      s.style.opacity = String(0.4 + Math.random() * 0.6);
      const sc = 0.6 + Math.random() * 1.4;
      s.style.transform = `scale(${sc})`;
      starsEl.appendChild(s);
    }
  }, []);

  useEffect(() => {
    const renderBulbs = () => {
      const wrap = bulbsRef.current;
      const svg = svgRef.current;
      /* v8 ignore next */
      if (!wrap || !svg) return;

      wrap.innerHTML = "";
      const VBW = 1200;
      const VBH = 160;
      const mobile = window.innerWidth < 600;
      const wires = [
        {
          path: svg.querySelector<SVGPathElement>("#wire-1"),
          count: mobile ? 12 : 22,
          size: 8,
        },
        {
          path: svg.querySelector<SVGPathElement>("#wire-2"),
          count: mobile ? 10 : 20,
          size: 7,
        },
      ];

      wires.forEach(({ path, count, size }) => {
        if (!path) return;
        const len = path.getTotalLength();
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const p = path.getPointAtLength(t * len);
          const b = document.createElement("span");
          b.className = "bulb";
          b.style.left = (p.x / VBW) * 100 + "%";
          b.style.top = (p.y / VBH) * 100 + "%";
          b.style.width = size + "px";
          b.style.height = size + "px";
          b.style.animationDelay = Math.random() * 2.6 + "s";
          wrap.appendChild(b);
        }
      });
    };

    renderBulbs();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(renderBulbs, 120);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <div className="scene" aria-hidden="true">
        <div className="stars" ref={starsRef} />

        <div className="lights">
          <svg ref={svgRef} viewBox="0 0 1200 160" preserveAspectRatio="none">
            <path
              id="wire-1"
              d="M0,40 Q 300,140 600,50 T 1200,45"
              fill="none"
              stroke="rgba(244,235,214,.5)"
              strokeWidth="1.4"
            />
            <path
              id="wire-2"
              d="M0,80 Q 300,180 600,90 T 1200,95"
              fill="none"
              stroke="rgba(244,235,214,.3)"
              strokeWidth="1.1"
            />
          </svg>
          <div
            ref={bulbsRef}
            style={{ position: "absolute", inset: 0 }}
          />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="scenery" src="/scenery.png" alt="" aria-hidden="true" />
      </div>

      <div className="grain" />
      <div className="fly f1" />
      <div className="fly f2" />
    </>
  );
}

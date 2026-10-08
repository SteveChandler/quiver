"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { classifyPeriod } from "./period-classification";
import { FigureFrame } from "./figure-frame";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pseudo = (i: number, k: number) => (Math.sin(i * 12.9898 + k * 4.14159) * 43758.5453) % 1;

export default function SwellPeriodMorph() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [period, setPeriod] = useState(6);
  const c = classifyPeriod(period);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // jsdom / no-2d guard

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let phase = 0;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const resize = () => {
      const w = canvas.clientWidth || 680;
      const h = canvas.clientHeight || 230;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.clientWidth || 680;
      const h = canvas.clientHeight || 230;
      const { t } = classifyPeriod(period);
      const ground = period >= 10;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#e2e9e8";
      ctx.fillRect(0, 0, w, h);
      const beachX = w * 0.86;
      ctx.fillStyle = "#D9C49C";
      ctx.fillRect(beachX, 0, w - beachX, h);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(beachX - 3, 0, 3, h);

      const L = lerp(24, 132, t);
      const straight = lerp(6, 1.5, t);
      const chop = 1 - t;
      const lw = lerp(1.3, 3.4, t);
      const crest = (a: number) =>
        `rgba(${Math.round(lerp(127, 11, t))},${Math.round(lerp(167, 58, t))},${Math.round(lerp(184, 117, t))},${a})`;
      const n = Math.ceil((beachX + L) / L) + 1;

      for (let i = 0; i < n; i++) {
        const base = (i * L + phase) % (beachX + L);
        if (base > beachX + 2) continue;
        const lead = ground && base > beachX * 0.62;
        ctx.beginPath();
        ctx.lineWidth = lw;
        ctx.strokeStyle = lead ? "rgba(247,142,66,0.95)" : crest(0.85);
        const jitter = (pseudo(i, 1) - 0.5) * chop * 14;
        for (let y = -4; y <= h + 4; y += 6) {
          const wob = Math.sin(y * 0.05 + i * 0.7 + phase * 0.02) * straight;
          const ch = chop * (Math.sin(y * 0.6 + i * 3.1) + Math.sin(y * 1.7 + i)) * 2.4;
          const x = base + wob + ch + jitter;
          if (y <= -4) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (!ground && chop > 0.15) {
          ctx.beginPath();
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(120,150,165,${0.28 * chop})`;
          for (let y = -4; y <= h + 4; y += 6) {
            const x = base - h * 0.18 + y * 0.34 + Math.sin(y * 0.5 + i) * 3;
            if (y <= -4) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      if (!reduce) {
        phase += lerp(0.35, 0.95, t);
        if (phase > 1e6) phase = 0;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [period]);

  const isGround = c.classification === "ground";

  return (
    <FigureFrame
      kicker="Drag the dial ↓"
      title={<>Groundswell <span className="font-serif italic text-[#F78E42]">vs</span> Wind Swell</>}
      summary="Interactive: dragging the swell-period dial morphs the ocean view from short choppy wind-swell lines into long clean groundswell lines, with live readouts for storm distance, wave quality, and classification."
      caption="Period is the number that separates weak surf from the good stuff."
      downloadTitle="Groundswell vs Wind Swell"
    >
      <div className="relative overflow-hidden rounded-lg border-[1.5px] border-[#11100D] bg-[#e2e9e8]">
        <canvas ref={canvasRef} className="block h-[230px] w-full" />
        <div
          className={`absolute left-2 top-2 rotate-[-2deg] rounded-[3px] px-2 py-1 font-display text-[13px] font-black tracking-wider ${
            isGround ? "bg-[#F78E42] text-[#11100D]" : "bg-[#11100D] text-[#F4EBD8]"
          }`}
        >
          {c.label}
        </div>
        <div className="absolute bottom-2 right-2 font-mono text-[10px] font-bold tracking-widest text-[#7a5a2e]">BEACH →</div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#6b6455]">Swell period</span>
        <input
          type="range"
          min={4}
          max={20}
          step={0.5}
          value={period}
          onChange={(e) => setPeriod(parseFloat(e.target.value))}
          aria-label="Swell period in seconds"
          className="h-1.5 flex-1 cursor-pointer accent-[#F78E42]"
        />
        <span className="min-w-[54px] text-right font-display text-2xl font-black text-[#11100D]">
          {period % 1 === 0 ? period : period.toFixed(1)}
          <small className="ml-0.5 text-sm font-semibold text-[#6b6455]">s</small>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { l: "Storm distance", v: c.distance },
          { l: "Wave quality", v: c.quality },
          { l: "Why it matters", v: c.why },
        ].map((cell) => (
          <div key={cell.l} className="rounded-md border-[1.5px] border-[#11100D] bg-[#fbf5e7] px-2.5 py-2">
            <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-[#6b6455]">{cell.l}</div>
            <div className="font-display text-sm font-bold leading-tight text-[#11100D]">{cell.v}</div>
          </div>
        ))}
      </div>

      <Link
        href="/map?source=learn_groundswell_figure"
        className="mt-4 block rotate-[-0.4deg] rounded-md bg-[#11100D] px-3 py-2.5 text-[13px] leading-snug text-[#F4EBD8]"
      >
        On a Quiver forecast, this is the <b className="text-[#F78E42]">Period</b> number — the fastest read on whether it&apos;s worth paddling out.{" "}
        <span className="whitespace-nowrap font-bold text-[#F78E42]">See it on your beach →</span>
      </Link>
    </FigureFrame>
  );
}

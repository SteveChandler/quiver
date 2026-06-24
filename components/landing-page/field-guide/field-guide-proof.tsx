import type { ReactElement } from "react";

import { QuiverSticker } from "@/components/zine";

interface ProofStat {
  value: string;
  label: string;
}

const STATS: ProofStat[] = [
  { value: "10-day", label: "surf outlooks" },
  { value: "Every 3 hours", label: "forecast refresh" },
  { value: "Sharper calls", label: "session logging" },
];

export function FieldGuideProof(): ReactElement {
  return (
    <div
      data-testid="field-guide-proof"
      className="grid gap-5 sm:grid-cols-3"
    >
      {STATS.map((stat, index) => (
        <div
          key={stat.label}
          className="torn relative bg-[#F4EBD8] p-5 text-center shadow-[2px_4px_0_rgba(0,0,0,0.18)]"
          style={{ transform: `rotate(${index % 2 === 0 ? -1.5 : 1.5}deg)` }}
        >
          <QuiverSticker
            sticker={
              index === 0 ? "navyTape" : index === 1 ? "tealTape" : "goldTape"
            }
            className="absolute -top-3 left-1/2 w-16 -translate-x-1/2"
            sizes="4rem"
          />
          <div className="pt-3 font-[var(--font-zine-display)] text-4xl uppercase leading-none text-[#0B3A75]">
            {stat.value}
          </div>
          <div className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D]/70">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

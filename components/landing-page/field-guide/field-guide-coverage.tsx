import Link from "next/link";
import type { ReactElement } from "react";

import { COVERED_REGIONS } from "@/lib/constants/coverage-areas";

interface CoverageStat {
  label: string;
  value: string;
  suffix?: string;
  note: string;
}

const COVERAGE_STATS: CoverageStat[] = [
  {
    label: "Surf spots",
    value: "279",
    suffix: "+",
    note: "Beach-level forecast pages",
  },
  {
    label: "Covered regions",
    value: String(COVERED_REGIONS.length),
    note: "US coasts, Hawaii, Puerto Rico, Baja",
  },
  {
    label: "Model horizon",
    value: "10-day",
    note: "Forecast outlooks by break",
  },
  {
    label: "Refresh cadence",
    value: "3 hours",
    note: "Updated when source data lands",
  },
];

export function FieldGuideCoverage(): ReactElement {
  return (
    <section
      data-testid="field-guide-coverage"
      className="space-y-4"
      aria-labelledby="field-guide-coverage-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2
          id="field-guide-coverage-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#11100D]"
        >
          Coverage
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#11100D]/55">
          Snapshot: Quiver beach model
        </p>
      </div>

      <div className="overflow-hidden rounded-[18px_8px_20px_10px] border-2 border-[#11100D]/15 bg-[#FFFDF4] shadow-[3px_5px_0_rgba(17,16,13,0.12)]">
        <div className="grid md:grid-cols-4">
          {COVERAGE_STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`min-h-36 p-5 ${
                index < COVERAGE_STATS.length - 1
                  ? "border-b border-[#11100D]/15 md:border-b-0 md:border-r"
                  : ""
              }`}
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[#11100D]/55">
                {stat.label}
              </p>
              <div className="mt-5 font-[var(--font-zine-display)] text-4xl uppercase leading-none text-[#11100D] sm:text-5xl">
                {stat.value}
                {stat.suffix ? (
                  <span className="ml-0.5 text-[#128A48]">{stat.suffix}</span>
                ) : null}
              </div>
              <p className="mt-4 font-mono text-xs leading-relaxed text-[#11100D]/58">
                {stat.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#11100D]/55 sm:flex-row sm:items-center sm:justify-between">
        <p>Sources: NOAA / NDBC / CO-OPS / CDIP / surfer logs</p>
        <Link
          href="/vs/surfline"
          className="text-[#11100D] underline decoration-[#F78E42] decoration-2 underline-offset-4 transition hover:text-[#0B3A75] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
        >
          Vs Surfline -&gt;
        </Link>
      </div>
    </section>
  );
}

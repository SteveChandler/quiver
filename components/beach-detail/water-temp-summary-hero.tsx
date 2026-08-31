import Link from "next/link";
import { ArrowUpRight, Thermometer } from "lucide-react";

import type { WaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

export interface WaterTempSummaryHeroProps {
  beachName: string;
  seasonalTrendsHref: string;
  seasonalTrendsLocation: string;
  waterTempData: WaterTempMetaData;
}

function toCelsius(tempF: number): number {
  return Math.round(((tempF - 32) * 5) / 9);
}

function getTempProfile(tempF: number): string {
  if (tempF >= 75) return "Warm";
  if (tempF >= 65) return "Mild";
  if (tempF >= 55) return "Cool";
  return "Cold";
}

export function WaterTempSummaryHero({
  beachName,
  seasonalTrendsHref,
  seasonalTrendsLocation,
  waterTempData,
}: WaterTempSummaryHeroProps) {
  const { tempF, wetsuitRec } = waterTempData;

  if (tempF === null) return null;

  const tempC = toCelsius(tempF);
  const profile = getTempProfile(tempF);

  return (
    <div
      aria-label={`Current water temperature at ${beachName}`}
      className="flex flex-col gap-4 border-y-2 border-[#11100D] py-4 sm:flex-row sm:items-center sm:gap-6"
      role="group"
    >
      {/* Self-contained stamp: the zine `.stamp-circle` class is namespaced under
          `.zine-tab` and depends on the `#zine-rough-edge` SVG filter, neither of
          which exists outside the zine stage — using it here rendered an
          unstyled, invisible text run. */}
      <div
        aria-hidden="true"
        className="flex size-[120px] shrink-0 -rotate-[8deg] flex-col items-center justify-center rounded-full border-4 border-[#0B3A75] bg-[#F4EBD8]/60 text-center font-heading font-black uppercase leading-[0.95] tracking-[0.06em] text-[#0B3A75]"
      >
        <span className="text-[15px]">Water</span>
        <span className="mt-0.5 text-[28px] leading-none">{tempF}°F</span>
        <span className="text-[15px]">{tempC}°C</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 border-2 border-[#0B3A75] bg-[#F78E42] px-2.5 py-1 font-[var(--font-mono)] text-[11px] font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_#0B3A75]">
            <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
            {profile}
          </span>
          <span className="font-[var(--font-mono)] text-xs font-bold uppercase tracking-[0.12em] text-[#5F5646]">
            {tempF}°F / {tempC}°C
          </span>
        </div>

        {wetsuitRec ? (
          <p className="mt-3 text-[#11100D]">
            <span className="block font-[var(--font-mono)] text-[10px] font-black uppercase tracking-[0.16em] text-[#5F5646]">
              Recommended wetsuit
            </span>
            <strong className="mt-0.5 block font-[var(--font-zine-display)] text-xl font-black uppercase leading-tight sm:text-2xl">
              {wetsuitRec}
            </strong>
          </p>
        ) : null}

        <Link
          href={seasonalTrendsHref}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-[var(--font-mono)] text-xs font-black uppercase tracking-[0.09em] text-[#0B3A75] underline decoration-2 underline-offset-4 transition-colors hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
        >
          Seasonal water trends for {seasonalTrendsLocation}
          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Other Regions Strip (server component)
 *
 * Compact chip wrap of the OTHER regions (excluding the currently-active one),
 * each chip carrying a peak-7-day score badge. Preserves the SEO mass + browse
 * intent that used to be the wall-of-17-cards directory.
 *
 * Each chip links to `/forecast?region={slug}` so the user can preview the
 * region inline without leaving the hub. A "Browse all regions" details block
 * exposes the dedicated `/forecast/{slug}` pages for travelers and crawlers.
 *
 * @module components/forecast/other-regions-strip
 */

import Link from "next/link";

import {
  FORECAST_REGIONS,
  type ForecastRegion,
} from "@/lib/data/forecast-regions";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

interface OtherRegionsStripProps {
  summaries: Record<string, RegionalForecastSummary>;
  excludeSlug: string;
  variant?: "default" | "zine";
}

interface ChipData {
  region: ForecastRegion;
  peakScore: number;
}

function peakWeekScore(summary: RegionalForecastSummary | undefined): number {
  if (!summary || summary.days.length === 0) return 0;
  return Math.max(...summary.days.map((d) => d.score));
}

export function OtherRegionsStrip({
  summaries,
  excludeSlug,
  variant = "default",
}: OtherRegionsStripProps) {
  const isZine = variant === "zine";
  const chips: ChipData[] = Object.values(FORECAST_REGIONS)
    .filter((region) => region.slug !== excludeSlug)
    .map((region) => ({
      region,
      peakScore: peakWeekScore(summaries[region.slug]),
    }))
    // Rank by peak score so the most interesting regions surface first
    .sort((a, b) => b.peakScore - a.peakScore);

  if (chips.length === 0) return null;

  return (
    <section
      id="other-regions-strip"
      aria-labelledby="other-regions-heading"
      className={
        isZine
          ? "torn torn-tb mb-10 border-2 border-[#11100D] bg-[#F0E5CC] p-4 sm:p-5"
          : "mb-10"
      }
      data-testid="other-regions-strip"
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2
          id="other-regions-heading"
          className={
            isZine
              ? "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              : "font-[var(--font-heading)] text-2xl font-bold text-white"
          }
        >
          Going elsewhere?
        </h2>
        <span
          className={
            isZine
              ? "font-mono text-xs uppercase tracking-wide text-[#11100D]/55"
              : "font-mono text-xs uppercase tracking-wide text-white/50"
          }
        >
          {chips.length} regions
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {chips.map(({ region, peakScore }) => {
          const score = peakScore;
          const scoreColors = getScoreColorClasses(score);
          return (
            <li key={region.slug}>
              <Link
                href={`/forecast?region=${region.slug}`}
                data-testid={`other-region-chip-${region.slug}`}
                className={
                  isZine
                    ? "group inline-flex items-center gap-2 rounded-[14px_5px_16px_6px] border-2 border-[#11100D]/35 bg-[#FBF6E8] px-3 py-1.5 text-sm text-[#11100D]/78 shadow-[2px_2px_0_rgba(17,16,13,0.16)] transition hover:-translate-y-0.5 hover:border-[#B56A2B] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0E5CC]"
                    : "group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
                }
              >
                <span>{region.name}</span>
                <span
                  className={`inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${scoreColors.bg} ${isZine ? "border border-[#11100D]/20" : ""}`}
                  aria-label={`Peak score ${score}`}
                >
                  {score > 0 ? score : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <details className="group mt-4" data-testid="other-regions-details">
        <summary
          className={
            isZine
              ? "inline-flex cursor-pointer items-center gap-1 font-mono text-xs uppercase tracking-wide text-[#11100D]/62 transition hover:text-[#B56A2B]"
              : "inline-flex cursor-pointer items-center gap-1 font-mono text-xs uppercase tracking-wide text-white/60 transition hover:text-white"
          }
        >
          <span>Browse all region pages</span>
          <span className="transition group-open:rotate-180">▾</span>
        </summary>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chips.map(({ region }) => (
            <li key={`direct-${region.slug}`}>
              <Link
                href={`/forecast/${region.slug}`}
                className={
                  isZine
                    ? "block rounded-[10px_4px_12px_5px] border border-[#11100D]/20 bg-[#FBF6E8]/70 px-3 py-2 text-sm text-[#11100D]/72 transition hover:border-[#B56A2B] hover:text-[#11100D]"
                    : "block rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
                }
              >
                {region.name}{" "}
                <span
                  className={isZine ? "text-[#11100D]/40" : "text-white/40"}
                >
                  /forecast/{region.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

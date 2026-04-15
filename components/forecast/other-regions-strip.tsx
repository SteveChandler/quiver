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
}: OtherRegionsStripProps) {
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
      className="mb-10"
      data-testid="other-regions-strip"
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2
          id="other-regions-heading"
          className="font-[var(--font-heading)] text-2xl font-bold text-white"
        >
          Going elsewhere?
        </h2>
        <span className="font-mono text-xs uppercase tracking-wide text-white/50">
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
                className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
              >
                <span>{region.name}</span>
                <span
                  className={`inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${scoreColors.bg}`}
                  aria-label={`Peak score ${score}`}
                >
                  {score > 0 ? score : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <details className="mt-4 group" data-testid="other-regions-details">
        <summary className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs uppercase tracking-wide text-white/60 transition hover:text-white">
          <span>Browse all region pages</span>
          <span className="transition group-open:rotate-180">▾</span>
        </summary>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chips.map(({ region }) => (
            <li key={`direct-${region.slug}`}>
              <Link
                href={`/forecast/${region.slug}`}
                className="block rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              >
                {region.name} <span className="text-white/40">/forecast/{region.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

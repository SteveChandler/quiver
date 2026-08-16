"use client";

/**
 * Monthly Breakdown Grid
 *
 * 4-column card grid showing per-month surf data with score gauges.
 * When state profile data is available, uses hardcoded monthly data
 * (wave heights, water temp, wetsuit) instead of estimating from ranges.
 */

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import type { MonthlySurfEntry } from "@/actions/city/best-time-actions";
import type { MonthlyData } from "@/lib/data/monthly-surf-data";

interface MonthlyGridProps {
  monthly: MonthlySurfEntry[];
  waterTempRange: string | null;
  summerWetsuit: string | null;
  winterWetsuit: string | null;
  /** Hardcoded state-level monthly data, used when available */
  stateMonthly?: MonthlyData[];
  /** Month numbers (1-12) considered peak for this city/state */
  peakMonths?: number[];
}

/** Fallback: estimate water temp and wetsuit from regional ranges */
function getMonthContextFromRange(
  month: number,
  waterTempRange: string | null,
  summerWetsuit: string | null,
  winterWetsuit: string | null
): { wetsuit: string; tempLabel: string; waveRange: string | null; crowdLevel: string; bestFor: string | null } {
  let lowTemp = 55;
  let highTemp = 72;
  if (waterTempRange) {
    const parts = waterTempRange.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      lowTemp = parts[0];
      highTemp = parts[1];
    }
  }

  const summerMonths = new Set([6, 7, 8, 9]);
  const winterMonths = new Set([12, 1, 2]);
  const isSummer = summerMonths.has(month);
  const isWinter = winterMonths.has(month);

  const tempLabel = isSummer
    ? `~${highTemp}°F`
    : isWinter
      ? `~${lowTemp}°F`
      : `~${Math.round((lowTemp + highTemp) / 2)}°F`;

  const wetsuit = isSummer
    ? summerWetsuit || "Spring suit"
    : isWinter
      ? winterWetsuit || "4/3mm"
      : summerWetsuit || "3/2mm";

  let crowdLevel = "Moderate";
  if ([6, 7, 8].includes(month)) crowdLevel = "High";
  else if ([12, 1].includes(month)) crowdLevel = "Moderate";
  else if ([3, 4, 5, 9, 10, 11].includes(month)) crowdLevel = "Low-Moderate";

  return { wetsuit, tempLabel, waveRange: null, crowdLevel, bestFor: null };
}

function getCrowdBadgeColor(label: string): string {
  const lower = label.toLowerCase();
  if (lower === "high") return "bg-red-100 text-red-700";
  if (lower.startsWith("low")) return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}

export function MonthlyGrid({
  monthly,
  waterTempRange,
  summerWetsuit,
  winterWetsuit,
  stateMonthly,
  peakMonths,
}: MonthlyGridProps) {
  const peakSet = new Set(peakMonths || []);

  return (
    <ScrollReveal stagger staggerDelay={75}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthly.map((entry) => {
          // Use hardcoded state data when available, otherwise estimate
          const stateEntry = stateMonthly?.[entry.month - 1];
          const context = stateEntry
            ? {
                wetsuit: stateEntry.wetsuit,
                tempLabel: `${stateEntry.waterTemp}°F`,
                waveRange: stateEntry.waveHeightRange,
                crowdLevel: stateEntry.crowdLevel.charAt(0).toUpperCase() + stateEntry.crowdLevel.slice(1),
                bestFor: stateEntry.bestFor,
              }
            : getMonthContextFromRange(entry.month, waterTempRange, summerWetsuit, winterWetsuit);

          const isPeak = peakSet.has(entry.month);
          const crowdColor = getCrowdBadgeColor(context.crowdLevel);

          return (
            <div
              key={entry.month}
              className={`rounded-xl border bg-white p-4 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-[transform,box-shadow] duration-200 ${
                isPeak ? "border-green-400" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {entry.monthName}
                  </h3>
                  {isPeak && (
                    <span className="text-[10px] font-medium text-green-600 uppercase tracking-wide">
                      Peak
                    </span>
                  )}
                </div>
                <AnimatedScoreGauge score={entry.score} size="sm" />
              </div>

              <div className="space-y-2 text-xs text-gray-600">
                {context.waveRange && (
                  <div className="flex items-center justify-between">
                    <span>Waves</span>
                    <span className="font-medium text-gray-900">{context.waveRange}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Water temp</span>
                  <span className="font-medium text-gray-900">{context.tempLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Wetsuit</span>
                  <span className="font-medium text-gray-900 text-right max-w-[120px] truncate">
                    {context.wetsuit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Crowds</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${crowdColor}`}>
                    {context.crowdLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Beaches peaking</span>
                  <span className="font-medium text-gray-900">{entry.bestMonthCount}</span>
                </div>
              </div>

              {context.bestFor && (
                <p className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 leading-snug">
                  {context.bestFor}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollReveal>
  );
}

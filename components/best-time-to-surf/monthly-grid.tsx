"use client";

/**
 * Monthly Breakdown Grid
 *
 * 4-column card grid showing per-month surf data with score gauges.
 */

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import type { MonthlySurfEntry } from "@/actions/city/best-time-actions";

interface MonthlyGridProps {
  monthly: MonthlySurfEntry[];
  waterTempRange: string | null;
  summerWetsuit: string | null;
  winterWetsuit: string | null;
}

/** Map month to approximate water temp and wetsuit based on regional data */
function getMonthContext(
  month: number,
  waterTempRange: string | null,
  summerWetsuit: string | null,
  winterWetsuit: string | null
): { wetsuit: string; tempLabel: string } {
  // Parse temp range like "55-72"
  let lowTemp = 55;
  let highTemp = 72;
  if (waterTempRange) {
    const parts = waterTempRange.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      lowTemp = parts[0];
      highTemp = parts[1];
    }
  }

  // Summer months (Jun-Sep) are warmest, winter (Dec-Feb) coldest
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

  return { wetsuit, tempLabel };
}

function getCrowdLabel(month: number): string {
  // Summer and holidays tend to be more crowded
  if ([6, 7, 8].includes(month)) return "High";
  if ([12, 1].includes(month)) return "Moderate";
  if ([3, 4, 5, 9, 10, 11].includes(month)) return "Low-Moderate";
  return "Moderate";
}

function getCrowdBadgeColor(label: string): string {
  if (label === "High") return "bg-red-100 text-red-700";
  if (label.startsWith("Low")) return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}

export function MonthlyGrid({
  monthly,
  waterTempRange,
  summerWetsuit,
  winterWetsuit,
}: MonthlyGridProps) {
  return (
    <ScrollReveal stagger staggerDelay={50}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthly.map((entry) => {
          const { wetsuit, tempLabel } = getMonthContext(
            entry.month,
            waterTempRange,
            summerWetsuit,
            winterWetsuit
          );
          const crowdLabel = getCrowdLabel(entry.month);
          const crowdColor = getCrowdBadgeColor(crowdLabel);

          return (
            <div
              key={entry.month}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {entry.monthName}
                </h3>
                <AnimatedScoreGauge score={entry.score} size="sm" />
              </div>

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Water temp</span>
                  <span className="font-medium text-gray-900">{tempLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Wetsuit</span>
                  <span className="font-medium text-gray-900 text-right max-w-[120px] truncate">
                    {wetsuit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Crowds</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${crowdColor}`}>
                    {crowdLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Beaches peaking</span>
                  <span className="font-medium text-gray-900">{entry.bestMonthCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollReveal>
  );
}

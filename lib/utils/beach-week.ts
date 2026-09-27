import { partitionToPoint } from "@/components/map/swell-field/field-sampler";
import { rowToSwellPartition } from "@/lib/domains/conditions/map-forecast";
import type { ConditionTier } from "@/lib/utils/condition-tier-utils";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";
import { extractMergedTideSchedule } from "@/lib/utils/tide-schedule";
import { getLocalDateString } from "@/lib/utils/timezone-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface BeachWeekSwell {
  directionDeg: number;
  periodS: number;
  heightFt: number;
}

export interface BeachWeekDay {
  fullDate: string;
  dayName: string;
  isToday: boolean;
  tier: ConditionTier;
  minHeight: number;
  maxHeight: number;
  bestAt: string | null;
  swell: BeachWeekSwell | null;
  lowTide: { at: string; heightFt: number } | null;
  early: boolean;
}

/** Same rule as the planning home: the fifth card on is an early read. */
export const EARLY_READ_DAY_OFFSET = 4;

function primarySwell(row: EnhancedForecastEntity | undefined): BeachWeekSwell | null {
  if (!row) return null;
  const point = partitionToPoint(0, 0, rowToSwellPartition(row), "s1");
  if (!point) return null;
  return { directionDeg: point.dir, periodS: point.periodS, heightFt: point.heightFt };
}

/**
 * One beach's next 7 days from the rows the page already loads. No per-day
 * water temperature: future rows carry the current reading, not a forecast.
 */
export function buildBeachWeek(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  timezone: string,
  days = 7,
): BeachWeekDay[] {
  const summaries = aggregateDayForecasts(forecasts, beach, { maxDays: days, timezone });
  const rowsByInstant = new Map(forecasts.map((row) => [row.forecast_at, row]));
  const lows = extractMergedTideSchedule(forecasts).filter((entry) => entry.type === "low");

  return summaries.map((summary, index) => {
    const low = lows.find(
      (entry) => getLocalDateString(new Date(entry.time * 1000), timezone) === summary.fullDate,
    );
    return {
      fullDate: summary.fullDate,
      dayName: summary.dayName,
      isToday: summary.isToday,
      tier: summary.tier,
      minHeight: summary.minHeight,
      maxHeight: summary.maxHeight,
      bestAt: summary.bestForecastAt ?? null,
      swell: primarySwell(summary.bestForecastAt ? rowsByInstant.get(summary.bestForecastAt) : undefined),
      lowTide: low ? { at: new Date(low.time * 1000).toISOString(), heightFt: low.height } : null,
      early: index >= EARLY_READ_DAY_OFFSET,
    };
  });
}

/**
 * Enriches DaySummary objects with wind conditions and time-slot data
 * derived from the corresponding forecast entries.
 *
 * @module lib/utils/enriched-day-summary
 */

import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  classifyWindDirection,
  type WindClassification,
} from "@/lib/utils/wind-classification";

export type TimeSlot =
  | "dawn-patrol"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening";

export interface EnrichedDaySummary extends DaySummary {
  windConditions: WindClassification;
  bestTimeSlot: TimeSlot;
  windSpeed: string | null;
}

/** Time slot hour boundaries (24h format, based on typical surf session timing) */
const TIME_SLOT_HOURS = {
  DAWN_PATROL_END: 7,
  MORNING_END: 10,
  MIDDAY_END: 13,
  AFTERNOON_END: 16,
} as const;

/** Default hour used when forecast_time is missing or unparseable */
const DEFAULT_FORECAST_HOUR = 12;

function deriveTimeSlot(hour: number): TimeSlot {
  if (hour < TIME_SLOT_HOURS.DAWN_PATROL_END) return "dawn-patrol";
  if (hour < TIME_SLOT_HOURS.MORNING_END) return "morning";
  if (hour < TIME_SLOT_HOURS.MIDDAY_END) return "midday";
  if (hour < TIME_SLOT_HOURS.AFTERNOON_END) return "afternoon";
  return "evening";
}

export function enrichDaySummaries(
  days: DaySummary[],
  forecasts: EnhancedForecastEntity[],
  windOffshoreDeg?: number | null,
): EnrichedDaySummary[] {
  const byDate = new Map<string, EnhancedForecastEntity[]>();
  for (const f of forecasts) {
    if (!f.forecast_date) continue;
    const bucket = byDate.get(f.forecast_date);
    if (bucket) bucket.push(f);
    else byDate.set(f.forecast_date, [f]);
  }

  return days.map((day) => {
    const dayForecasts = byDate.get(day.fullDate);
    if (!dayForecasts || !day.bestTime) {
      return {
        ...day,
        windConditions: "onshore" as const,
        windSpeed: null,
        bestTimeSlot: "morning" as const,
      };
    }

    const targetHour = parseInt(day.bestTime.split(":")[0], 10);
    let closest = dayForecasts[0];
    let minDiff = Infinity;
    for (const f of dayForecasts) {
      const fHour = parseInt(f.forecast_time?.split(":")[0] || String(DEFAULT_FORECAST_HOUR), 10);
      const diff = Math.abs(fHour - targetHour);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }

    return {
      ...day,
      windConditions: classifyWindDirection(closest.wind_direction || "", windOffshoreDeg),
      windSpeed: closest.wind_speed || null,
      bestTimeSlot: deriveTimeSlot(targetHour),
    };
  });
}

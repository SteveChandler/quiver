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
    // Prefer forecast_at (extract date part), fallback to forecast_date
    const dateKey = f.forecast_at ? f.forecast_at.split("T")[0] : f.forecast_date;
    if (!dateKey) continue;
    const bucket = byDate.get(dateKey);
    if (bucket) bucket.push(f);
    else byDate.set(dateKey, [f]);
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
      // Prefer forecast_at for hour extraction, fallback to forecast_time
      const fHour = f.forecast_at
        ? new Date(f.forecast_at).getUTCHours()
        : parseInt(f.forecast_time?.split(":")[0] || String(DEFAULT_FORECAST_HOUR), 10);
      const diff = Math.abs(fHour - targetHour);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }

    // If wind speed is ≤5 mph, classify as "light" regardless of direction.
    // This aligns the display label with the scorer (which gives 20/20 wind
    // points for ≤3 mph) and avoids confusing "Onshore" labels at dawn patrol
    // when wind is essentially calm.
    const windSpeedMph = parseFloat(closest.wind_speed || "0");
    const windConditions: WindClassification =
      !Number.isNaN(windSpeedMph) && windSpeedMph >= 0 && windSpeedMph <= 5
        ? "light"
        : classifyWindDirection(closest.wind_direction || "", windOffshoreDeg);

    return {
      ...day,
      windConditions,
      windSpeed: closest.wind_speed || null,
      bestTimeSlot: deriveTimeSlot(targetHour),
    };
  });
}

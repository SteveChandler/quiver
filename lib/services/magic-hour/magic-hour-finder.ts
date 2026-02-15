/**
 * Magic Hour Finder - Main Orchestration
 *
 * Finds the "Magic Hour" - optimal surf window for a beach within forecast period.
 * Orchestrates the complete analysis pipeline including:
 * - Forecast slot conversion from EnhancedForecastEntity
 * - Time window filtering (next 48 hours by default)
 * - Multi-metric weighted peak finding
 * - Optional interpolation for exact peak time
 *
 * @module magic-hour/magic-hour-finder
 */

import { getLocalHour } from "@/lib/utils/timezone-utils";
import type {
  ForecastSlot,
  BeachMetadata,
  EnhancedForecastEntity,
  MagicHourResult,
  WeightConfig,
} from "./types";
import {
  DIRECTION_MAP,
  DEFAULT_TIMEZONE,
  DEFAULT_SEARCH_WINDOW_MS,
  DAYLIGHT_START_HOUR,
  DAYLIGHT_END_HOUR,
} from "./constants";
import { findWeightedPeak } from "./scoring";

/**
 * Finds the "Magic Hour" - optimal surf window for a beach within forecast period.
 *
 * This is the main entry point that orchestrates:
 * 1. Forecast slot conversion from EnhancedForecastEntity
 * 2. Time window filtering (next 48 hours by default)
 * 3. Multi-metric weighted peak finding
 * 4. Optional interpolation for exact peak time
 *
 * @param forecasts - Array of enhanced forecast entities
 * @param beach - Beach metadata with surf preferences
 * @param options - Optional configuration (weights, target date)
 * @returns Magic Hour result with peak time and quality assessment
 *
 * @example
 * import { decimalToConfidence } from '@/lib/services/forecast/confidence-scorer';
 *
 * const result = findMagicHour(forecasts, beach);
 * if (result.found) {
 *   console.log(`Magic Hour: ${result.windowStart} - ${result.windowEnd}`);
 *   console.log(`Confidence: ${decimalToConfidence(result.confidence)}%`);
 *   console.log(`Swell match: ${result.swellMatch}`);
 *   console.log(`Wind quality: ${result.windQuality}`);
 * } else {
 *   console.log('No optimal surf window found');
 * }
 */
export function findMagicHour(
  forecasts: EnhancedForecastEntity[],
  beach: BeachMetadata,
  options: { weights?: WeightConfig; targetDate?: Date } = {}
): MagicHourResult {
  // Convert to forecast slots
  const slots = convertToSlots(forecasts);

  if (slots.length === 0) {
    return nullResult();
  }

  // Filter to next 48 hours (or target date window)
  const now = options.targetDate ?? new Date();
  const windowEnd = new Date(now.getTime() + DEFAULT_SEARCH_WINDOW_MS);

  const windowedSlots = slots.filter(
    (slot) => slot.local_time >= now && slot.local_time <= windowEnd
  );

  if (windowedSlots.length === 0) {
    return nullResult();
  }

  // Filter to daylight hours only (6 AM - 8 PM) in the beach's local timezone
  // Peak surf times should only be during reasonable daylight hours
  const beachTimezone = beach.timezone || DEFAULT_TIMEZONE;
  const daylightSlots = windowedSlots.filter((slot) => {
    // Use timezone-aware hour conversion for accurate daylight filtering
    const localHour = getLocalHour(slot.local_time, beachTimezone);
    return localHour >= DAYLIGHT_START_HOUR && localHour < DAYLIGHT_END_HOUR;
  });

  // If no daylight slots available, fall back to windowed slots
  // but this shouldn't happen in normal conditions
  const slotsToEvaluate = daylightSlots.length > 0 ? daylightSlots : windowedSlots;

  // Find weighted peak from daylight-filtered slots
  const peak = findWeightedPeak(slotsToEvaluate, beach, options.weights);

  if (!peak) {
    return nullResult();
  }

  return {
    found: true,
    peakTime: peak.peakTime,
    windowStart: peak.windowStart,
    windowEnd: peak.windowEnd,
    confidence: peak.confidence,
    swellMatch: peak.swellMatch,
    windQuality: peak.windQuality,
    tideInRange: peak.tideInRange,
  };
}

/**
 * Converts EnhancedForecastEntity array to ForecastSlot array.
 */
export function convertToSlots(forecasts: EnhancedForecastEntity[]): ForecastSlot[] {
  const slots: ForecastSlot[] = [];
  for (const f of forecasts) {
    try {
      slots.push({
        forecast_at: f.forecast_at,
        forecast_date: f.forecast_date,
        forecast_time: f.forecast_time,
        // forecast_at is already a UTC ISO 8601 timestamp — parse directly.
        local_time: new Date(f.forecast_at),
        tide_height_ft: parseFloat(f.tide_height ?? "0"),
        wind_speed_mph: parseFloat(f.wind_speed ?? "0"),
        wind_direction_deg: f.wind_direction_deg ?? 0,
        wave_height_ft: parseFloat(f.wave_height ?? "0"),
        wave_period_s: parseFloat(f.wave_period ?? "0"),
        wave_direction_deg: parseWindDirection(f.wave_direction ?? "N"),
      });
    } catch (error) {
      console.warn("Failed to convert forecast to slot:", error);
    }
  }
  return slots;
}

/**
 * Parses cardinal direction to degrees.
 */
export function parseWindDirection(dir: string): number {
  return DIRECTION_MAP[dir.toUpperCase()] ?? 0;
}

/**
 * Returns null result when no Magic Hour is found.
 */
export function nullResult(): MagicHourResult {
  return {
    found: false,
    peakTime: null,
    windowStart: null,
    windowEnd: null,
    confidence: 0,
    swellMatch: false,
    windQuality: null,
    tideInRange: false,
  };
}

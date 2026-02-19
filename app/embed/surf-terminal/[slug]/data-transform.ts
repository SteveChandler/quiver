/**
 * Data transformation layer for the Surf Terminal chart widget.
 *
 * Converts EnhancedForecastEntity rows (string-encoded values) into
 * numeric time-series data compatible with lightweight-charts.
 */

import type { EnhancedForecastEntity } from "@/types/forecast";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BeachChartConfig {
  windOffshoreDeg: number;
  windOffshoreTolDeg: number;
  timezone: string;
}

export interface ChartDataPoint {
  /** UTCTimestamp – seconds since Unix epoch */
  time: number;
  value: number;
}

export interface WindDataPoint extends ChartDataPoint {
  color: string;
}

export interface SurfTerminalData {
  waveHeight: ChartDataPoint[];
  mlCorrectedHeight: ChartDataPoint[];
  tideHeight: ChartDataPoint[];
  windSpeed: WindDataPoint[];
  swellPeriod: ChartDataPoint[];
}

/** Wind-direction → bar color mapping */
export const WIND_COLORS = {
  offshore: "#22c55e", // green
  onshore: "#ef4444", // red
  "cross-shore": "#eab308", // yellow
} as const;

// ---------------------------------------------------------------------------
// parseNumericValue
// ---------------------------------------------------------------------------

/**
 * Extract a numeric value from a forecast string such as "3.5 ft", "3-5 ft",
 * "12s", or "8 mph". Returns `null` for missing / unparseable input.
 *
 * When the string contains a range (e.g. "3-5 ft"), returns the average.
 */
export function parseNumericValue(
  value: string | null | undefined
): number | null {
  if (value == null) return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "N/A") return null;

  // Try range pattern first: "3-5 ft", "1.5-3.5 ft"
  const rangeMatch = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2;
  }

  // Single numeric value: "3.5 ft", "12s", "8 mph", "7", "-1.2 ft"
  const singleMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return parseFloat(singleMatch[1]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// classifyWindDirection
// ---------------------------------------------------------------------------

/**
 * Angular difference between two compass bearings, capped at 180°.
 * Mirrors `angleDifference` in lib/scoring/surf-conditions-scorer.ts.
 */
function angleDifference(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Classify observed wind direction relative to a beach's offshore bearing.
 *
 * - **offshore** – within `tolerance` of `offshoreDeg`
 * - **onshore**  – within `tolerance` of `(offshoreDeg + 180) % 360`
 * - **cross-shore** – everything else
 */
export function classifyWindDirection(
  windDeg: number,
  offshoreDeg: number,
  tolerance: number
): "offshore" | "onshore" | "cross-shore" {
  if (angleDifference(windDeg, offshoreDeg) <= tolerance) return "offshore";

  const onshoreDeg = (offshoreDeg + 180) % 360;
  if (angleDifference(windDeg, onshoreDeg) <= tolerance) return "onshore";

  return "cross-shore";
}

// ---------------------------------------------------------------------------
// transformForecastsToChartData
// ---------------------------------------------------------------------------

/**
 * Transform an array of forecast entities into chart-ready time-series data.
 *
 * 1. Sorts by `forecast_at`
 * 2. Filters to `[now, now + timeRangeHours]`
 * 3. Parses string values and builds typed data-point arrays
 * 4. Skips nulls (no interpolation)
 * 5. Colors wind bars by offshore/onshore/cross-shore
 * 6. Includes ML-corrected height only when `is_ml_calibrated` is true
 */
export function transformForecastsToChartData(
  forecasts: EnhancedForecastEntity[],
  config: BeachChartConfig,
  timeRangeHours: number
): SurfTerminalData {
  const result: SurfTerminalData = {
    waveHeight: [],
    mlCorrectedHeight: [],
    tideHeight: [],
    windSpeed: [],
    swellPeriod: [],
  };

  if (forecasts.length === 0) return result;

  const nowMs = Date.now();
  const cutoffMs = nowMs + timeRangeHours * 3600_000;

  // Sort ascending by forecast_at
  const sorted = [...forecasts].sort(
    (a, b) =>
      new Date(a.forecast_at).getTime() - new Date(b.forecast_at).getTime()
  );

  for (const fc of sorted) {
    const fcMs = new Date(fc.forecast_at).getTime();

    // Only include forecasts in the future window [now, now + range]
    if (fcMs < nowMs || fcMs > cutoffMs) continue;

    const timeSec = Math.floor(fcMs / 1000);

    // Wave height
    const wh = parseNumericValue(fc.wave_height);
    if (wh != null) {
      result.waveHeight.push({ time: timeSec, value: wh });
    }

    // ML-corrected height (only if calibrated)
    if (fc.is_ml_calibrated === true) {
      const mlh = parseNumericValue(fc.ml_corrected_height);
      if (mlh != null) {
        result.mlCorrectedHeight.push({ time: timeSec, value: mlh });
      }
    }

    // Tide height
    const th = parseNumericValue(fc.tide_height);
    if (th != null) {
      result.tideHeight.push({ time: timeSec, value: th });
    }

    // Wind speed + color
    const ws = parseNumericValue(fc.wind_speed);
    if (ws != null) {
      let classification: "offshore" | "onshore" | "cross-shore" =
        "cross-shore";
      if (fc.wind_direction_deg != null) {
        classification = classifyWindDirection(
          fc.wind_direction_deg,
          config.windOffshoreDeg,
          config.windOffshoreTolDeg
        );
      }
      result.windSpeed.push({
        time: timeSec,
        value: ws,
        color: WIND_COLORS[classification],
      });
    }

    // Swell period (primary swell)
    const sp = parseNumericValue(fc.swell_1_period);
    if (sp != null) {
      result.swellPeriod.push({ time: timeSec, value: sp });
    }
  }

  return result;
}

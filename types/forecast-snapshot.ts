/**
 * Forecast Snapshot Types
 *
 * Types for the forecast snapshot data returned from the session API.
 * Used to display forecast vs actual comparison in session detail views.
 */

import type { Json } from './database.generated';

/**
 * Individual forecast field diff structure
 * Represents the difference between forecast and actual values
 */
export interface ForecastFieldDiff {
  forecast: number | string;
  actual: number | string;
  diff?: number; // Only present for numeric fields
}

/**
 * Forecast vs Actual diff object
 * Contains only fields that were changed by the user
 */
export interface ForecastVsActual {
  wave_height_ft?: ForecastFieldDiff;
  wind_speed_mph?: ForecastFieldDiff;
  wind_direction?: ForecastFieldDiff;
  water_temp?: ForecastFieldDiff;
  tide_height_ft?: ForecastFieldDiff;
  tide_status?: ForecastFieldDiff;
  [key: string]: ForecastFieldDiff | undefined;
}

/**
 * Raw forecast data as stored in the snapshot
 */
export interface ForecastSnapshotData {
  wave_height?: string | number;
  wave_period?: string | number;
  wind_speed_mph?: number;
  wind_direction?: string;
  tide_height?: string | number;
  tide_status?: string;
  water_temp?: number;
  confidence_score?: number;
  data_source?: string;
  [key: string]: unknown;
}

/**
 * Actual conditions as recorded by user
 */
export interface ActualConditions {
  wave_height_ft?: number;
  wind_speed_mph?: number;
  wind_direction?: string;
  tide_height_ft?: number;
  tide_status?: string;
  water_temp?: number;
  [key: string]: unknown;
}

/**
 * Parsed forecast snapshot from API response
 */
export interface ParsedForecastSnapshot {
  forecast_snapshot: ForecastSnapshotData;
  actual_conditions: ActualConditions;
  forecast_vs_actual: ForecastVsActual | null;
  forecast_confidence_score: number | null;
  data_source: string | null;
}

/**
 * Raw forecast snapshot from Supabase (with Json types)
 */
export interface RawForecastSnapshot {
  forecast_snapshot: Json;
  actual_conditions: Json;
  forecast_vs_actual: Json | null;
  forecast_confidence_score: number | null;
  data_source: string | null;
}

/**
 * Parse raw JSON forecast snapshot into typed structure
 */
export function parseForecastSnapshot(
  raw: RawForecastSnapshot | null | undefined
): ParsedForecastSnapshot | null {
  if (!raw) return null;

  return {
    forecast_snapshot: raw.forecast_snapshot as ForecastSnapshotData,
    actual_conditions: raw.actual_conditions as ActualConditions,
    forecast_vs_actual: raw.forecast_vs_actual as ForecastVsActual | null,
    forecast_confidence_score: raw.forecast_confidence_score,
    data_source: raw.data_source,
  };
}

/**
 * Check if there are any differences to display
 */
export function hasDifferences(snapshot: ParsedForecastSnapshot | null): boolean {
  if (!snapshot?.forecast_vs_actual) return false;
  return Object.keys(snapshot.forecast_vs_actual).length > 0;
}

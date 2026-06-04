import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfWindowSourceFlags } from "@/types/session-intelligence";

export interface SurfWindowSourceSupportHints {
  hasCam?: boolean;
  hasUserReport?: boolean;
  hasBuoy?: boolean;
}

export interface BuildSurfWindowSourceFlagsInput {
  forecast: EnhancedForecastEntity | null;
  beach?: Beach | null;
  hints?: SurfWindowSourceSupportHints;
}

export interface BuildSurfWindowDataNotesInput extends BuildSurfWindowSourceFlagsInput {
  confidenceScore?: number;
}

function sourceValues(forecast: EnhancedForecastEntity): string[] {
  const rawDataSources = forecast.raw_forecast?.data_sources;
  const rawSources = Array.isArray(rawDataSources)
    ? rawDataSources
    : [rawDataSources];
  return [forecast.data_source, ...rawSources]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}

function hasTideEvidence(forecast: EnhancedForecastEntity): boolean {
  return Boolean(
    forecast.tide_status ||
      forecast.tide_height ||
      forecast.next_tide_time ||
      forecast.next_tide_at ||
      forecast.next_tide_type ||
      forecast.next_tide_height ||
      forecast.raw_forecast?.tide_schedule?.length ||
      forecast.raw_forecast?.tide_station
  );
}

function hasBuoyEvidence(
  forecast: EnhancedForecastEntity,
  hints: SurfWindowSourceSupportHints
): boolean {
  if (hints.hasBuoy === true) return true;
  if (forecast.raw_forecast?.cdip_data) return true;
  return sourceValues(forecast).some((value) =>
    value.includes("cdip") || value.includes("buoy")
  );
}

function hasLocalSpotIntel(beach: Beach | null | undefined): boolean {
  if (!beach) return false;
  return Boolean(
    beach.wind_offshore_deg != null ||
      beach.preferred_tide_ft_min != null ||
      beach.preferred_tide_ft_max != null ||
      beach.swell_window_center_deg != null ||
      beach.swell_window_halfwidth_deg != null ||
      beach.best_conditions_prose ||
      beach.real_takeaways?.length
  );
}

export function buildSurfWindowSourceFlags({
  forecast,
  beach,
  hints = {},
}: BuildSurfWindowSourceFlagsInput): SurfWindowSourceFlags {
  return {
    forecastModel: Boolean(forecast),
    tide: forecast ? hasTideEvidence(forecast) : false,
    buoy: forecast ? hasBuoyEvidence(forecast, hints) : false,
    cam: hints.hasCam === true,
    userReport: hints.hasUserReport === true,
    localSpotIntel: hasLocalSpotIntel(beach),
  };
}

export function buildSurfWindowDataNotes({
  forecast,
  beach,
  hints = {},
  confidenceScore,
}: BuildSurfWindowDataNotesInput): string[] {
  const sources = buildSurfWindowSourceFlags({ forecast, beach, hints });
  const notes: string[] = [];

  if (!sources.forecastModel) notes.push("No forecast model row is attached to this window");
  if (!sources.tide) notes.push("Tide data is unavailable for this window");
  if (!sources.buoy) notes.push("No buoy source is attached to this window");
  if (!sources.cam) notes.push("No cam source is attached to this window");
  if (!sources.userReport) notes.push("No user-report source is attached to this window");
  if (confidenceScore != null && confidenceScore < 50) {
    notes.push("Forecast confidence is low");
  }
  if (forecast && (!forecast.wave_height || !forecast.wave_period)) {
    notes.push("Wave details are sparse");
  }

  return notes;
}

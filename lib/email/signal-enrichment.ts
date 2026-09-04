import type { SupabaseClient } from "@supabase/supabase-js";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
import type { Database } from "@/types/database.generated";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { calculateRideableWaves } from "@/lib/domains/wave-frequency";
import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  forecastToSnapshot,
  getConditionCharacter,
} from "@/lib/domains/scoring";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";

const CONTEXT_TAG = "[email-signal-enrichment]";

export type RipRiskLevel = "low" | "moderate" | "high";
export type WaveFrequencyConfidence = "high" | "medium" | "low";
export type WaterQualityStatus = "good" | "advisory" | "closure" | "unknown";

/**
 * Surf-decision signals our redesigned emails surface. Every field degrades to
 * null when its source has no data so a single missing signal can never break
 * an email send.
 */
export interface BeachSignalEnrichment {
  /** NWS surf-zone rip current risk for the day. */
  ripRisk: RipRiskLevel | null;
  /** Physics wave-frequency estimate (rideable waves per hour). */
  rideableWavesPerHour: number | null;
  /** Dominant set/beat interval in seconds (null for single-swell days). */
  setIntervalSeconds: number | null;
  /** Confidence of the wave-frequency estimate. */
  waveFrequencyConfidence: WaveFrequencyConfidence | null;
  /** enhanced_forecasts.confidence_score (0-100). */
  forecastConfidence: number | null;
  /** Human condition label, e.g. "Dialed — everything's lining up". */
  conditionCharacter: string | null;
  /** Current beach_water_quality status; null on missing row or error. */
  waterQuality: WaterQualityStatus | null;
}

const EMPTY_ENRICHMENT: BeachSignalEnrichment = {
  ripRisk: null,
  rideableWavesPerHour: null,
  setIntervalSeconds: null,
  waveFrequencyConfidence: null,
  forecastConfidence: null,
  conditionCharacter: null,
  waterQuality: null,
};

const RIP_RISK_LEVELS: ReadonlySet<string> = new Set<RipRiskLevel>([
  "low",
  "moderate",
  "high",
]);

const WATER_QUALITY_STATUSES: ReadonlySet<string> = new Set<WaterQualityStatus>([
  "good",
  "advisory",
  "closure",
  "unknown",
]);

/**
 * Fetch the surf-decision signals an email needs for one beach on one local
 * date. Each source is wrapped independently — a failing or empty source
 * yields null for its field(s) and never throws out to the caller.
 */
export async function enrichBeachSignals(
  supabase: SupabaseClient<Database>,
  beachId: string,
  localDate: string
): Promise<BeachSignalEnrichment> {
  // Sources are independent: rip risk needs only beach+date, while the
  // wave-frequency/character/confidence signals share the day's forecast rows
  // and the beach profile. Fetch them in parallel so one slow source doesn't
  // serialize the others.
  const [ripRisk, waterQuality, waveAndForecast] = await Promise.all([
    fetchRipRisk(supabase, beachId, localDate),
    fetchWaterQuality(supabase, beachId),
    fetchWaveAndForecastSignals(supabase, beachId, localDate),
  ]);

  return {
    ...EMPTY_ENRICHMENT,
    ripRisk,
    waterQuality,
    ...waveAndForecast,
  };
}

/**
 * Current water-quality status for the beach. The `beach_water_quality` table
 * holds one row per beach (status, status_changed_at, …), so we read it by
 * beach id alone. Unknown/missing/error all degrade to null.
 */
async function fetchWaterQuality(
  supabase: SupabaseClient<Database>,
  beachId: string
): Promise<WaterQualityStatus | null> {
  try {
    const { data, error } = await supabase
      .from("beach_water_quality")
      .select("status")
      .eq("beach_id", beachId)
      .maybeSingle();

    if (error) {
      console.error(`${CONTEXT_TAG} Failed to load water quality:`, error);
      return null;
    }
    const status = data ? (await currentWaterQuality([{ ...data, beach_id: beachId }]))[0].status : null;
    return status && WATER_QUALITY_STATUSES.has(status)
      ? (status as WaterQualityStatus)
      : null;
  } catch (error) {
    console.error(`${CONTEXT_TAG} Failed to load water quality:`, error);
    return null;
  }
}

async function fetchRipRisk(
  supabase: SupabaseClient<Database>,
  beachId: string,
  localDate: string
): Promise<RipRiskLevel | null> {
  try {
    const { data, error } = await supabase
      .from("rip_current_risks")
      .select("risk_level")
      .eq("beach_id", beachId)
      .eq("valid_date", localDate)
      .maybeSingle();

    if (error) {
      console.error(`${CONTEXT_TAG} Failed to load rip current risk:`, error);
      return null;
    }
    const level = data?.risk_level;
    return level && RIP_RISK_LEVELS.has(level) ? (level as RipRiskLevel) : null;
  } catch (error) {
    console.error(`${CONTEXT_TAG} Failed to load rip current risk:`, error);
    return null;
  }
}

type WaveAndForecastSignals = Pick<
  BeachSignalEnrichment,
  | "rideableWavesPerHour"
  | "setIntervalSeconds"
  | "waveFrequencyConfidence"
  | "forecastConfidence"
  | "conditionCharacter"
>;

const NO_WAVE_SIGNALS: WaveAndForecastSignals = {
  rideableWavesPerHour: null,
  setIntervalSeconds: null,
  waveFrequencyConfidence: null,
  forecastConfidence: null,
  conditionCharacter: null,
};

async function fetchWaveAndForecastSignals(
  supabase: SupabaseClient<Database>,
  beachId: string,
  localDate: string
): Promise<WaveAndForecastSignals> {
  const beach = await fetchBeach(supabase, beachId);
  const forecast = await fetchRepresentativeForecast(
    supabase,
    beachId,
    localDate,
    beach?.timezone
  );

  if (!forecast) {
    return NO_WAVE_SIGNALS;
  }

  // confidence_score lives on the forecast row and needs neither the beach
  // profile nor the engines, so it resolves even when the beach is missing.
  const forecastConfidence =
    typeof forecast.confidence_score === "number"
      ? forecast.confidence_score
      : null;

  const waveFrequency = beach
    ? computeWaveFrequency(forecast, beach)
    : null;
  const conditionCharacter = beach
    ? computeConditionCharacter(forecast, beach)
    : null;

  return {
    rideableWavesPerHour: waveFrequency?.rideableWavesPerHour ?? null,
    setIntervalSeconds: waveFrequency?.dominantBeatIntervalS ?? null,
    waveFrequencyConfidence: waveFrequency?.confidence ?? null,
    forecastConfidence,
    conditionCharacter,
  };
}

async function fetchBeach(
  supabase: SupabaseClient<Database>,
  beachId: string
): Promise<Beach | null> {
  try {
    const { data, error } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .maybeSingle();

    if (error) {
      console.error(`${CONTEXT_TAG} Failed to load beach:`, error);
      return null;
    }
    return (data as Beach | null) ?? null;
  } catch (error) {
    console.error(`${CONTEXT_TAG} Failed to load beach:`, error);
    return null;
  }
}

/**
 * Pick the peak-wave-height forecast hour for the beach's local date. Matches
 * the row that drives the surf-call card so wave-frequency height authority
 * stays consistent. Rows are filtered by the beach's local date (not UTC) to
 * avoid late-afternoon date rollovers.
 */
async function fetchRepresentativeForecast(
  supabase: SupabaseClient<Database>,
  beachId: string,
  localDate: string,
  timezone: string | null | undefined
): Promise<EnhancedForecastEntity | null> {
  try {
    // Generous UTC bound (date-1 .. date+2) covers every timezone offset; the
    // precise local-date filter happens below.
    const [startISO, endISO] = utcWindowAroundLocalDate(localDate);
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_at", startISO)
      .lt("forecast_at", endISO)
      .order("forecast_at");

    if (error) {
      console.error(`${CONTEXT_TAG} Failed to load forecasts:`, error);
      return null;
    }

    const rows = (data ?? []) as EnhancedForecastEntity[];
    const tz = resolveBeachTimezone(timezone);
    const localRows = rows.filter(
      (row) =>
        row.forecast_at &&
        getLocalDateString(new Date(row.forecast_at), tz) === localDate
    );
    if (localRows.length === 0) {
      return null;
    }

    return localRows.reduce<EnhancedForecastEntity>((best, row) => {
      return peakHeightFt(row) > peakHeightFt(best) ? row : best;
    }, localRows[0]);
  } catch (error) {
    console.error(`${CONTEXT_TAG} Failed to load forecasts:`, error);
    return null;
  }
}

function computeWaveFrequency(
  forecast: EnhancedForecastEntity,
  beach: Beach
): ReturnType<typeof calculateRideableWaves> | null {
  try {
    return calculateRideableWaves(forecast, beach);
  } catch (error) {
    console.error(`${CONTEXT_TAG} Failed to compute wave frequency:`, error);
    return null;
  }
}

function computeConditionCharacter(
  forecast: EnhancedForecastEntity,
  beach: Beach
): string | null {
  try {
    const profile = beachToSpotProfile(beach);
    const snapshot = forecastToSnapshot(forecast);
    const composite = createDiscoveryScoringEngine().score({
      profile,
      snapshot,
      window: null,
      preferences: null,
    });
    return getConditionCharacter(snapshot, profile, composite).label;
  } catch (error) {
    console.error(
      `${CONTEXT_TAG} Failed to compute condition character:`,
      error
    );
    return null;
  }
}

/** Parse the upper bound of a "3-4 ft" / "3 ft" wave-height string in feet. */
function peakHeightFt(forecast: EnhancedForecastEntity): number {
  const raw = forecast.wave_height;
  if (!raw) return 0;
  const matches = raw.match(/[\d.]+/g);
  if (!matches || matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseFloat(m)).filter((n) => !isNaN(n)));
}

/** UTC [start, end) window guaranteed to contain the full local date everywhere. */
function utcWindowAroundLocalDate(localDate: string): [string, string] {
  const start = new Date(`${localDate}T00:00:00.000Z`);
  const dayMs = 86_400_000;
  const startISO = new Date(start.getTime() - dayMs).toISOString();
  const endISO = new Date(start.getTime() + 2 * dayMs).toISOString();
  return [startISO, endISO];
}

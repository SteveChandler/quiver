/**
 * Checks each recorded swell-event forecast against the beach's buoy once the
 * event has passed, and writes a hit/miss status to swell_event_verifications.
 *
 * Limitation: buoys report total significant wave height (swell plus local wind
 * sea) with no partitions. A wind-sea spike can read as a swell arriving, and a
 * groundswell under a calm sea is compared as total Hs, not the swell alone.
 * Observed period and direction are stored for later tuning but do not affect
 * the status yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/** Initial values; tune them on this table's own data. */
export const VERIFY_RULES = {
  minRiseRatio: 1.25,
  maxPeakErrorHours: 18,
  heightRatioMin: 0.6,
  heightRatioMax: 1.6,
} as const;

const BATCH_LIMIT = 200;
const MIN_OBSERVATIONS = 6;
const OBSERVATION_PAGE_SIZE = 1000;
const MAX_OBSERVATION_PAGES = 10;
const FEET_PER_METER = 3.28084;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type ServiceClient = SupabaseClient<Database>;

type VerificationStatus =
  | "hit"
  | "miss_no_show"
  | "miss_timing"
  | "miss_size"
  | "no_observations";

// swell_event_verifications is newer than types/database.generated.ts.
interface PendingVerification {
  id: string;
  beach_id: string;
  forecast_arrival_at: string | null;
  forecast_peak_at: string;
  forecast_fade_at: string | null;
  forecast_peak_offshore_height_ft: number | string | null;
}

interface VerificationUpdate {
  status: VerificationStatus;
  station_id: string | null;
  observed_baseline_height_ft: number | null;
  observed_peak_height_ft: number | null;
  observed_peak_at: string | null;
  observed_peak_period_s: number | null;
  observed_peak_direction_deg: number | null;
  observation_count: number | null;
  peak_error_hours: number | null;
  height_ratio: number | null;
}

interface WaveObservation {
  observedAt: string;
  heightM: number;
  periodS: number | null;
  directionDeg: number | null;
}

interface SwellEventVerificationSummary {
  pending: number;
  verified: number;
  statusCounts: Record<VerificationStatus, number>;
  errors: number;
  durationMs: number;
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function emptyUpdate(stationId: string | null, observationCount: number | null): VerificationUpdate {
  return {
    status: "no_observations",
    station_id: stationId,
    observed_baseline_height_ft: null,
    observed_peak_height_ft: null,
    observed_peak_at: null,
    observed_peak_period_s: null,
    observed_peak_direction_deg: null,
    observation_count: observationCount,
    peak_error_hours: null,
    height_ratio: null,
  };
}

async function loadPendingVerifications(
  supabase: ServiceClient,
  now: Date,
): Promise<PendingVerification[]> {
  // coalesce(fade, peak + 24h) + 12h < now, split so PostgREST can filter it.
  const fadeCutoff = new Date(now.getTime() - 12 * HOUR_MS).toISOString();
  const peakCutoff = new Date(now.getTime() - 36 * HOUR_MS).toISOString();
  const { data, error } = await supabase
    .from("swell_event_verifications" as never)
    .select(
      "id, beach_id, forecast_arrival_at, forecast_peak_at, forecast_fade_at, forecast_peak_offshore_height_ft",
    )
    .eq("status", "pending")
    .gt("forecast_peak_at", new Date(now.getTime() - 30 * DAY_MS).toISOString())
    .or(`and(forecast_fade_at.is.null,forecast_peak_at.lt.${peakCutoff}),forecast_fade_at.lt.${fadeCutoff}`)
    .order("forecast_peak_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) throw new Error(`Failed to load pending swell verifications: ${error.message}`);
  return (data ?? []) as unknown as PendingVerification[];
}

async function loadObservations(
  supabase: ServiceClient,
  stationId: string,
  start: Date,
  end: Date,
): Promise<WaveObservation[]> {
  const observations: WaveObservation[] = [];
  for (let page = 0; page < MAX_OBSERVATION_PAGES; page += 1) {
    const from = page * OBSERVATION_PAGE_SIZE;
    const { data, error } = await supabase
      .from("unified_wave_observations")
      .select("observed_at, wave_height_m, wave_period_s, wave_direction_deg")
      .eq("station_id", stationId)
      .gte("observed_at", start.toISOString())
      .lte("observed_at", end.toISOString())
      .order("observed_at", { ascending: true })
      .range(from, from + OBSERVATION_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load observations for ${stationId}: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const heightM = finiteOrNull(row.wave_height_m);
      if (!row.observed_at || heightM == null || heightM <= 0) continue;
      observations.push({
        observedAt: row.observed_at,
        heightM,
        periodS: finiteOrNull(row.wave_period_s),
        directionDeg: finiteOrNull(row.wave_direction_deg),
      });
    }
    if (rows.length < OBSERVATION_PAGE_SIZE) break;
  }
  return observations;
}

function classify(args: {
  riseRatio: number;
  peakErrorHours: number;
  heightRatio: number | null;
}): Exclude<VerificationStatus, "no_observations"> {
  if (args.riseRatio < VERIFY_RULES.minRiseRatio) return "miss_no_show";
  if (Math.abs(args.peakErrorHours) > VERIFY_RULES.maxPeakErrorHours) return "miss_timing";
  if (
    args.heightRatio != null
    && (args.heightRatio < VERIFY_RULES.heightRatioMin
      || args.heightRatio > VERIFY_RULES.heightRatioMax)
  ) {
    return "miss_size";
  }
  return "hit";
}

async function verifyRow(
  supabase: ServiceClient,
  row: PendingVerification,
): Promise<VerificationUpdate> {
  const { data: stationId, error } = await supabase.rpc("get_beach_observation_station", {
    p_beach_id: row.beach_id,
  });
  if (error) throw new Error(`Failed to resolve station for ${row.beach_id}: ${error.message}`);
  if (!stationId) return emptyUpdate(null, null);

  const peakAt = Date.parse(row.forecast_peak_at);
  const arrivalAt = row.forecast_arrival_at ? Date.parse(row.forecast_arrival_at) : peakAt - DAY_MS;
  const fadeAt = row.forecast_fade_at ? Date.parse(row.forecast_fade_at) : peakAt + DAY_MS;
  const observations = await loadObservations(
    supabase,
    stationId,
    new Date(arrivalAt - DAY_MS),
    new Date(fadeAt + 12 * HOUR_MS),
  );
  if (observations.length < MIN_OBSERVATIONS) {
    return emptyUpdate(stationId, observations.length);
  }

  const baselineCutoff = arrivalAt - 6 * HOUR_MS;
  const beforeArrival = observations.filter(
    ({ observedAt }) => Date.parse(observedAt) < baselineCutoff,
  );
  const baselineRows = beforeArrival.length > 0
    ? beforeArrival
    : observations.slice(0, Math.max(1, Math.floor(observations.length / 4)));
  const baselineFt = median(baselineRows.map(({ heightM }) => heightM)) * FEET_PER_METER;
  const peak = observations.reduce((best, current) =>
    current.heightM > best.heightM ? current : best);
  const peakFt = peak.heightM * FEET_PER_METER;
  const peakErrorHours = (Date.parse(peak.observedAt) - peakAt) / HOUR_MS;
  const forecastOffshoreFt = finiteOrNull(row.forecast_peak_offshore_height_ft);
  const heightRatio = forecastOffshoreFt != null && forecastOffshoreFt > 0
    ? peakFt / forecastOffshoreFt
    : null;

  return {
    status: classify({ riseRatio: peakFt / baselineFt, peakErrorHours, heightRatio }),
    station_id: stationId,
    observed_baseline_height_ft: round(baselineFt, 2),
    observed_peak_height_ft: round(peakFt, 2),
    observed_peak_at: peak.observedAt,
    observed_peak_period_s: peak.periodS,
    observed_peak_direction_deg: peak.directionDeg,
    observation_count: observations.length,
    peak_error_hours: round(peakErrorHours, 2),
    height_ratio: heightRatio == null ? null : round(heightRatio, 3),
  };
}

async function writeVerification(
  supabase: ServiceClient,
  id: string,
  update: VerificationUpdate,
  now: Date,
): Promise<void> {
  const { error } = await supabase
    .from("swell_event_verifications" as never)
    .update({ ...update, verified_at: now.toISOString() } as never)
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`Failed to write swell verification ${id}: ${error.message}`);
}

export async function runSwellEventVerification(args: {
  now: Date;
  supabase?: ServiceClient;
}): Promise<SwellEventVerificationSummary> {
  const startedAt = Date.now();
  const supabase = args.supabase ?? createSupabaseServiceRoleClient();
  const summary: SwellEventVerificationSummary = {
    pending: 0,
    verified: 0,
    statusCounts: {
      hit: 0,
      miss_no_show: 0,
      miss_timing: 0,
      miss_size: 0,
      no_observations: 0,
    },
    errors: 0,
    durationMs: 0,
  };

  const rows = await loadPendingVerifications(supabase, args.now);
  summary.pending = rows.length;
  for (const row of rows) {
    try {
      const update = await verifyRow(supabase, row);
      await writeVerification(supabase, row.id, update, args.now);
      summary.verified += 1;
      summary.statusCounts[update.status] += 1;
    } catch (error) {
      console.error(`[swell-event-verify] Failed to verify ${row.id}:`, error);
      summary.errors += 1;
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}

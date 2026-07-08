import type { SupabaseClient } from "@supabase/supabase-js";
import type { Beach } from "@/types/database";
import type { NowcastAnchor } from "@/lib/services/observations/nowcast-anchor.types";
import { METERS_TO_FEET } from "@/lib/utils/wave-formatters";

export const SOUTH_OC_SANO_SHADOW_ZONE = "south_oc_sano_shadow_zone" as const;
export const SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG =
  "south_oc_sano_shadow_guardrail" as const;

const GREEN_BEACH_OFFSHORE = "46277";
const RED_BEACH_NEARSHORE = "46275";
const CAPISTRANO_BEACH_NEARSHORE = "46285";
const MAX_OBSERVATION_AGE_MINUTES = 90;
const MIN_CONFIRMED_HS_M = 0.9144;
const MIN_CONFIRMED_PERIOD_S = 15;
const MIN_SOUTH_DIRECTION_DEG = 175;
const MAX_SOUTH_DIRECTION_DEG = 220;
const MAX_NEARSHORE_TO_OFFSHORE_RATIO = 1.8;
const WINDOW_PAST_MS = 30 * 60 * 1000;
const WINDOW_FUTURE_MS = 6 * 60 * 60 * 1000;

export const SOUTH_OC_SANO_SHADOW_STATION_IDS = [
  GREEN_BEACH_OFFSHORE,
  RED_BEACH_NEARSHORE,
  CAPISTRANO_BEACH_NEARSHORE,
] as const;

export const SOUTH_OC_SANO_SHADOW_ZONE_SLUGS = [
  "salt-creek",
  "strands",
  "doheny",
  "doheny-state-beach",
  "poche-beach",
  "204s",
  "san-clemente-pier-northside",
  "t-street",
  "riviera",
  "san-clemente-state-beach",
  "cottons",
  "upper-trestles",
  "lower-trestles",
  "middles",
  "church",
  "old-mans-sano",
  "san-onofre-state-beach",
  "trails",
] as const;

export const TRESTLES_CLUSTER_SLUGS = [
  "cottons",
  "upper-trestles",
  "lower-trestles",
  "middles",
  "church",
] as const;

const NEARSHORE_STATIONS = new Set<string>([
  RED_BEACH_NEARSHORE,
  CAPISTRANO_BEACH_NEARSHORE,
]);
const ZONE_SLUGS = new Set<string>(SOUTH_OC_SANO_SHADOW_ZONE_SLUGS);
const TRESTLES_SLUGS = new Set<string>(TRESTLES_CLUSTER_SLUGS);

export interface SouthOcSanoObservationRow {
  station_id: string;
  observed_at: string;
  wave_height_m: number | string | null;
  wave_period_s: number | string | null;
  wave_direction_deg: number | string | null;
  source: string | null;
  source_network: string | null;
}

export interface SouthOcSanoValidatedObservation {
  stationId: string;
  observedAt: string;
  ageMinutes: number;
  waveHeightM: number;
  waveHeightFt: number;
  wavePeriodS: number;
  waveDirectionDeg: number;
  source: string;
  sourceNetwork: string;
}

export interface SouthOcSanoShadowZoneSnapshot {
  zone: typeof SOUTH_OC_SANO_SHADOW_ZONE;
  observedAtMs: number;
  observations: SouthOcSanoValidatedObservation[];
  confirmedNearshore: SouthOcSanoValidatedObservation | null;
  offshoreContext: SouthOcSanoValidatedObservation | null;
  rejectionReason?: "nearshore_outlier_vs_offshore";
}

export interface SouthOcSanoGuardrailMetadata extends Record<string, unknown> {
  zone: typeof SOUTH_OC_SANO_SHADOW_ZONE;
  branch: "non_cluster_anchor_floor" | "trestles_calibrated_anchor";
  stationIdsUsed: string[];
  stationAgesMinutes: Record<string, number>;
  confirmedNearshoreHsM: number;
  confirmedNearshoreHsFt: number;
  confirmedPeriodS: number;
  confirmedDirectionDeg: number;
  offshoreContextStationId: string | null;
  offshoreContextHsM: number | null;
  offshoreContextAgeMinutes: number | null;
}

export type SouthOcSanoGuardrailResult =
  | {
      kind: "noop";
      reason:
        | "missing_snapshot"
        | "missing_feature_flag"
        | "out_of_zone"
        | "outside_nowcast_window"
        | "no_nearshore_confirmation";
      snapshot?: SouthOcSanoShadowZoneSnapshot | null;
    }
  | {
      kind: "non_cluster_anchor_floor";
      anchor: NowcastAnchor;
      metadata: SouthOcSanoGuardrailMetadata;
    }
  | {
      kind: "trestles_calibrated_anchor";
      anchor: NowcastAnchor;
      metadata: SouthOcSanoGuardrailMetadata;
    };

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isFreshLongPeriodSouthObservation(
  row: SouthOcSanoObservationRow,
  nowMs: number,
): SouthOcSanoValidatedObservation | null {
  if (!row.source || !row.source_network) return null;
  const observedMs = Date.parse(row.observed_at);
  if (!Number.isFinite(observedMs)) return null;

  const ageMinutes = (nowMs - observedMs) / 60000;
  if (ageMinutes < 0 || ageMinutes > MAX_OBSERVATION_AGE_MINUTES) return null;

  const waveHeightM = toFiniteNumber(row.wave_height_m);
  const wavePeriodS = toFiniteNumber(row.wave_period_s);
  const waveDirectionDeg = toFiniteNumber(row.wave_direction_deg);
  if (waveHeightM == null || wavePeriodS == null || waveDirectionDeg == null) {
    return null;
  }
  if (waveHeightM < MIN_CONFIRMED_HS_M) return null;
  if (wavePeriodS < MIN_CONFIRMED_PERIOD_S) return null;
  if (
    waveDirectionDeg < MIN_SOUTH_DIRECTION_DEG ||
    waveDirectionDeg > MAX_SOUTH_DIRECTION_DEG
  ) {
    return null;
  }

  return {
    stationId: row.station_id,
    observedAt: row.observed_at,
    ageMinutes: Math.round(ageMinutes),
    waveHeightM,
    waveHeightFt: waveHeightM * METERS_TO_FEET,
    wavePeriodS,
    waveDirectionDeg,
    source: row.source,
    sourceNetwork: row.source_network,
  };
}

function pickHighestNearshore(
  observations: SouthOcSanoValidatedObservation[],
): SouthOcSanoValidatedObservation | null {
  const nearshore = observations
    .filter((obs) => NEARSHORE_STATIONS.has(obs.stationId))
    .sort((a, b) => b.waveHeightM - a.waveHeightM);
  return nearshore[0] ?? null;
}

export function buildSouthOcSanoShadowZoneSnapshot(
  rows: SouthOcSanoObservationRow[],
  nowMs: number = Date.now(),
): SouthOcSanoShadowZoneSnapshot {
  const observations = rows
    .map((row) => isFreshLongPeriodSouthObservation(row, nowMs))
    .filter((obs): obs is SouthOcSanoValidatedObservation => obs !== null);

  const offshoreContext =
    observations.find((obs) => obs.stationId === GREEN_BEACH_OFFSHORE) ?? null;
  const highestNearshore = pickHighestNearshore(observations);

  if (
    highestNearshore &&
    offshoreContext &&
    highestNearshore.waveHeightM >
      offshoreContext.waveHeightM * MAX_NEARSHORE_TO_OFFSHORE_RATIO
  ) {
    return {
      zone: SOUTH_OC_SANO_SHADOW_ZONE,
      observedAtMs: nowMs,
      observations,
      confirmedNearshore: null,
      offshoreContext,
      rejectionReason: "nearshore_outlier_vs_offshore",
    };
  }

  return {
    zone: SOUTH_OC_SANO_SHADOW_ZONE,
    observedAtMs: nowMs,
    observations,
    confirmedNearshore: highestNearshore ?? null,
    offshoreContext,
  };
}

export async function fetchSouthOcSanoShadowZoneSnapshot(
  supabase: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<SouthOcSanoShadowZoneSnapshot> {
  try {
    const freshSinceIso = new Date(
      nowMs - MAX_OBSERVATION_AGE_MINUTES * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase
      .from("unified_wave_observations" as never)
      .select(
        "station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg, source, source_network",
      )
      .in("station_id", [...SOUTH_OC_SANO_SHADOW_STATION_IDS])
      .gte("observed_at", freshSinceIso)
      .order("observed_at", { ascending: false });

    if (error || !data) {
      return buildSouthOcSanoShadowZoneSnapshot([], nowMs);
    }

    const latestByStation = new Map<string, SouthOcSanoObservationRow>();
    for (const row of data as unknown as SouthOcSanoObservationRow[]) {
      if (!latestByStation.has(row.station_id)) {
        latestByStation.set(row.station_id, row);
      }
    }

    return buildSouthOcSanoShadowZoneSnapshot([...latestByStation.values()], nowMs);
  } catch {
    return buildSouthOcSanoShadowZoneSnapshot([], nowMs);
  }
}

function hasGuardrailFlag(beach: Beach): boolean {
  return Array.isArray(beach.features) &&
    beach.features.includes(SOUTH_OC_SANO_SHADOW_GUARDRAIL_FEATURE_FLAG);
}

function getBeachSlug(beach: Beach): string | null {
  const slug = (beach as unknown as { slug?: string | null }).slug;
  return typeof slug === "string" ? slug : null;
}

function buildMetadata(
  branch: SouthOcSanoGuardrailMetadata["branch"],
  snapshot: SouthOcSanoShadowZoneSnapshot,
  confirmed: SouthOcSanoValidatedObservation,
): SouthOcSanoGuardrailMetadata {
  const stationAgesMinutes = Object.fromEntries(
    snapshot.observations.map((obs) => [obs.stationId, obs.ageMinutes]),
  );

  return {
    zone: SOUTH_OC_SANO_SHADOW_ZONE,
    branch,
    stationIdsUsed: [confirmed.stationId],
    stationAgesMinutes,
    confirmedNearshoreHsM: confirmed.waveHeightM,
    confirmedNearshoreHsFt: confirmed.waveHeightFt,
    confirmedPeriodS: confirmed.wavePeriodS,
    confirmedDirectionDeg: confirmed.waveDirectionDeg,
    offshoreContextStationId: snapshot.offshoreContext?.stationId ?? null,
    offshoreContextHsM: snapshot.offshoreContext?.waveHeightM ?? null,
    offshoreContextAgeMinutes: snapshot.offshoreContext?.ageMinutes ?? null,
  };
}

export function resolveSouthOcSanoShadowGuardrail(args: {
  beach: Beach;
  snapshot: SouthOcSanoShadowZoneSnapshot | null | undefined;
  forecastAtMs: number;
  nowMs: number;
}): SouthOcSanoGuardrailResult {
  if (!args.snapshot) {
    return { kind: "noop", reason: "missing_snapshot", snapshot: args.snapshot };
  }
  if (!hasGuardrailFlag(args.beach)) {
    return { kind: "noop", reason: "missing_feature_flag", snapshot: args.snapshot };
  }

  const slug = getBeachSlug(args.beach);
  if (!slug || !ZONE_SLUGS.has(slug)) {
    return { kind: "noop", reason: "out_of_zone", snapshot: args.snapshot };
  }
  if (
    args.forecastAtMs < args.nowMs - WINDOW_PAST_MS ||
    args.forecastAtMs > args.nowMs + WINDOW_FUTURE_MS
  ) {
    return { kind: "noop", reason: "outside_nowcast_window", snapshot: args.snapshot };
  }

  const confirmed = args.snapshot.confirmedNearshore;
  if (!confirmed) {
    return {
      kind: "noop",
      reason: "no_nearshore_confirmation",
      snapshot: args.snapshot,
    };
  }

  const isTrestles = TRESTLES_SLUGS.has(slug);
  const branch = isTrestles
    ? "trestles_calibrated_anchor"
    : "non_cluster_anchor_floor";
  const metadata = buildMetadata(branch, args.snapshot, confirmed);
  const anchor: NowcastAnchor = {
    beachId: args.beach.id,
    stationId: confirmed.stationId,
    observedAt: confirmed.observedAt,
    waveHeightM: confirmed.waveHeightM,
    wavePeriodS: confirmed.wavePeriodS,
    waveDirectionDeg: confirmed.waveDirectionDeg,
    allowCalibratedShoaling: isTrestles,
    guardrailMetadata: metadata,
  };

  return isTrestles
    ? { kind: "trestles_calibrated_anchor", anchor, metadata }
    : { kind: "non_cluster_anchor_floor", anchor, metadata };
}

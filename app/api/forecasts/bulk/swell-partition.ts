import type { EnhancedForecastEntity } from "@/types/forecast";
import { compassToDegrees } from "@/components/map/swell-map-theme";

/**
 * Parsed primary/secondary swell + wind partition for one beach's current
 * forecast row, ready for the map's flow field. All fields are nullable —
 * live `enhanced_forecasts` rows are sparse.
 */
export interface SwellPartition {
  /** Hourly beach suitability; null when scoring or safety evidence is unavailable. */
  conditionScore?: number | null;
  s1Dir: number | null; // degrees
  swellDirOm?: number | null; // Open-Meteo swell direction (deg), with wave_direction_om fallback — matches native's field-direction source
  swellHeightOmFt?: number | null;
  swellPeriodOmS?: number | null;
  s1PeriodS: number | null;
  s1HeightFt: number | null;
  s2Dir: number | null; // degrees
  s2PeriodS: number | null;
  s2HeightFt: number | null;
  windDir: number | null; // degrees
  windMph: number | null; // mph
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function lerpNullable(
  from: number | null,
  to: number | null,
  progress: number,
): number | null {
  if (from == null && to == null) return null;
  if (from == null) return to;
  if (to == null) return from;
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  if (!Number.isFinite(from)) return to;
  if (!Number.isFinite(to)) return from;
  return from + (to - from) * progress;
}

function lerpDirectionNullable(
  from: number | null,
  to: number | null,
  progress: number,
): number | null {
  if (from == null && to == null) return null;
  if (from == null) return to;
  if (to == null) return from;
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  if (!Number.isFinite(from)) return to;
  if (!Number.isFinite(to)) return from;
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * progress + 360) % 360;
}

export function interpolateSwellPartition(
  from: SwellPartition,
  to: SwellPartition,
  progress: number,
): SwellPartition {
  const t = clamp01(progress);
  return {
    ...("conditionScore" in from || "conditionScore" in to ? {
      conditionScore: from.conditionScore == null || to.conditionScore == null
        ? null : lerpNullable(from.conditionScore, to.conditionScore, t),
    } : {}),
    s1Dir: lerpDirectionNullable(from.s1Dir, to.s1Dir, t),
    swellDirOm: lerpDirectionNullable(
      from.swellDirOm ?? null,
      to.swellDirOm ?? null,
      t,
    ),
    swellHeightOmFt: lerpNullable(from.swellHeightOmFt ?? null, to.swellHeightOmFt ?? null, t),
    swellPeriodOmS: lerpNullable(from.swellPeriodOmS ?? null, to.swellPeriodOmS ?? null, t),
    s1PeriodS: lerpNullable(from.s1PeriodS, to.s1PeriodS, t),
    s1HeightFt: lerpNullable(from.s1HeightFt, to.s1HeightFt, t),
    s2Dir: lerpDirectionNullable(from.s2Dir, to.s2Dir, t),
    s2PeriodS: lerpNullable(from.s2PeriodS, to.s2PeriodS, t),
    s2HeightFt: lerpNullable(from.s2HeightFt, to.s2HeightFt, t),
    windDir: lerpDirectionNullable(from.windDir, to.windDir, t),
    windMph: lerpNullable(from.windMph, to.windMph, t),
  };
}

// Confirmed via Task 2 verification on live `enhanced_forecasts` rows:
// swell_*_height columns store "<n> ft" (e.g. "2 ft") → already feet, no
// meters→feet conversion. Number.parseFloat("2 ft") === 2.
const SWELL_HEIGHT_IS_METERS = false;
const METERS_TO_FEET = 3.28084;

function parseFiniteFloat(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a direction field that may be a numeric string/number ("104", "270")
 * OR compass text ("SSW", "WNW"). Tries a finite float first; on NaN falls
 * back to 16-point compass→degrees; otherwise null.
 */
function parseDirection(value: string | number | null | undefined): number | null {
  const numeric = parseFiniteFloat(value);
  if (numeric != null) return numeric;
  if (typeof value === "string") return compassToDegrees(value);
  return null;
}

function parseSwellHeightFt(value: string | null | undefined): number | null {
  const raw = parseFiniteFloat(value);
  if (raw == null) return null;
  return SWELL_HEIGHT_IS_METERS ? raw * METERS_TO_FEET : raw;
}

type SwellPartitionRow = Pick<
  EnhancedForecastEntity,
  | "swell_1_height"
  | "swell_1_period"
  | "swell_1_direction"
  | "swell_direction_om"
  | "wave_direction_om"
  | "swell_2_height"
  | "swell_2_period"
  | "swell_2_direction"
  | "wind_speed"
> & {
  swell_height_om?: number | null;
  swell_period_om?: number | null;
  // Typed `number | null` in EnhancedForecastEntity, but live `enhanced_forecasts`
  // rows store wind_direction_deg as a compass/numeric STRING — accept both.
  wind_direction_deg?: number | string | null;
};

export function rowToSwellPartition(row: SwellPartitionRow): SwellPartition {
  return {
    s1Dir: parseDirection(row.swell_1_direction),
    swellDirOm: parseDirection(row.swell_direction_om ?? row.wave_direction_om),
    swellHeightOmFt: row.swell_direction_om != null && row.swell_height_om != null ? row.swell_height_om * METERS_TO_FEET : null,
    swellPeriodOmS: parseFiniteFloat(row.swell_period_om),
    s1PeriodS: parseFiniteFloat(row.swell_1_period),
    s1HeightFt: parseSwellHeightFt(row.swell_1_height),
    s2Dir: parseDirection(row.swell_2_direction),
    s2PeriodS: parseFiniteFloat(row.swell_2_period),
    s2HeightFt: parseSwellHeightFt(row.swell_2_height),
    windDir: parseDirection(row.wind_direction_deg),
    // wind_speed live rows store "<n> mph" → already mph, no conversion.
    windMph: parseFiniteFloat(row.wind_speed),
  };
}

/** Map swell uses one complete offshore provider tuple; never mix its direction with a beach partition. */
export function mapSwellPartition(partition: SwellPartition): SwellPartition {
  if (partition.swellDirOm == null || !Number.isFinite(partition.swellDirOm)
    || !partition.swellHeightOmFt || !Number.isFinite(partition.swellHeightOmFt) || partition.swellHeightOmFt <= 0
    || !partition.swellPeriodOmS || !Number.isFinite(partition.swellPeriodOmS) || partition.swellPeriodOmS <= 0) return partition;
  return { ...partition, s1Dir: partition.swellDirOm, s1HeightFt: partition.swellHeightOmFt, s1PeriodS: partition.swellPeriodOmS };
}

export function conditionSummaryFromScore(score: number): import("./route").ConditionSummary {
  if (!Number.isFinite(score)) return "UNKNOWN";
  if (score >= 80) return "EPIC";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "FAIR";
  if (score >= 40) return "RIDEABLE";
  return "MEH";
}

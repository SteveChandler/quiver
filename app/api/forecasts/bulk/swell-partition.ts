import type { EnhancedForecastEntity } from "@/types/forecast";
import { compassToDegrees } from "@/components/map/swell-map-theme";

/**
 * Parsed primary/secondary swell + wind partition for one beach's current
 * forecast row, ready for the map's flow field. All fields are nullable —
 * live `enhanced_forecasts` rows are sparse.
 */
export interface SwellPartition {
  s1Dir: number | null; // degrees
  swellDirOm?: number | null; // Open-Meteo swell direction (deg), with wave_direction_om fallback — matches native's field-direction source
  s1PeriodS: number | null;
  s1HeightFt: number | null;
  s2Dir: number | null; // degrees
  s2PeriodS: number | null;
  s2HeightFt: number | null;
  windDir: number | null; // degrees
  windMph: number | null; // mph
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
  // Typed `number | null` in EnhancedForecastEntity, but live `enhanced_forecasts`
  // rows store wind_direction_deg as a compass/numeric STRING — accept both.
  wind_direction_deg?: number | string | null;
};

export function rowToSwellPartition(row: SwellPartitionRow): SwellPartition {
  return {
    s1Dir: parseDirection(row.swell_1_direction),
    swellDirOm: parseDirection(row.swell_direction_om ?? row.wave_direction_om),
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

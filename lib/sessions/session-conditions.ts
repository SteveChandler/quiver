import {
  resolveDisplaySwell,
  type DisplaySwellRow,
  type DisplaySwellWindow,
} from "@/lib/domains/conditions/display-swell";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

const METERS_TO_FEET = 3.28084;
const MAX_ROW_AGE_MS = 3 * 60 * 60 * 1000;

export type SessionConditionsSource = "forecast_row" | "snapshot_backfill";

export interface SessionConditions {
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  swell_height_ft: number | null;
  offshore_swell_period_s: number | null;
  offshore_swell_direction_deg: number | null;
  offshore_swell_height_ft: number | null;
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  /** Cardinal for the existing sessions.wind_direction column, derived from wind_direction_deg. */
  wind_direction: string | null;
  conditions_forecast_at: string | null;
  conditions_source: SessionConditionsSource | "none";
}

export type SessionConditionsRow = DisplaySwellRow & {
  forecast_at: string;
  wind_speed?: string | null;
  wind_direction?: string | null;
  wind_direction_deg?: number | null;
};

/** The row at or before arrival within 3 h; a later row is a different hour than the one surfed. */
export function pickForecastRowAtOrBefore<T extends { forecast_at: string }>(
  rows: T[],
  arrivalTime: string,
): T | null {
  const arrivalMs = Date.parse(arrivalTime);
  if (!Number.isFinite(arrivalMs)) return null;
  let best: T | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const candidate of rows) {
    const atMs = Date.parse(candidate.forecast_at);
    if (!Number.isFinite(atMs) || atMs > arrivalMs || arrivalMs - atMs > MAX_ROW_AGE_MS) continue;
    if (atMs > bestMs) {
      best = candidate;
      bestMs = atMs;
    }
  }
  return best;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneDecimal(value: number | null, { positive }: { positive: boolean }): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (positive ? value <= 0 : value < 0) return null;
  return Math.round(value * 10) / 10;
}

function wholeDegrees(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return ((Math.round(value) % 360) + 360) % 360;
}

const NONE: SessionConditions = {
  swell_period_s: null,
  swell_direction_deg: null,
  swell_height_ft: null,
  offshore_swell_period_s: null,
  offshore_swell_direction_deg: null,
  offshore_swell_height_ft: null,
  wind_speed_mph: null,
  wind_direction_deg: null,
  wind_direction: null,
  conditions_forecast_at: null,
  conditions_source: "none",
};

/**
 * The conditions a session was surfed in, as the app showed them for that forecast row: swell through
 * resolveDisplaySwell (the same rule as Beach Detail and the surf call), Open-Meteo's primary swell raw
 * beside it, and wind. Every field comes from the one row.
 */
export function resolveSessionConditions(
  row: SessionConditionsRow | null,
  window: DisplaySwellWindow | null,
  source: SessionConditionsSource,
): SessionConditions {
  if (!row) return { ...NONE };

  const display = resolveDisplaySwell(row, window);
  const offshoreHeightM = parseNumber(row.swell_height_om);
  const windSpeed = parseNumber(row.wind_speed);
  const windDeg = wholeDegrees(
    typeof row.wind_direction_deg === "number" ? row.wind_direction_deg : cardinalToDegrees(row.wind_direction),
  );

  const resolved: SessionConditions = {
    swell_period_s: oneDecimal(display.periodSeconds, { positive: true }),
    swell_direction_deg: wholeDegrees(display.directionDeg),
    swell_height_ft: oneDecimal(display.heightFt, { positive: false }),
    offshore_swell_period_s: oneDecimal(parseNumber(row.swell_period_om), { positive: true }),
    offshore_swell_direction_deg: wholeDegrees(parseNumber(row.swell_direction_om)),
    offshore_swell_height_ft: oneDecimal(offshoreHeightM === null ? null : offshoreHeightM * METERS_TO_FEET, { positive: false }),
    wind_speed_mph: windSpeed === null || windSpeed < 0 ? null : Math.round(windSpeed),
    wind_direction_deg: windDeg,
    wind_direction: windDeg === null ? null : degreeToCardinal(windDeg),
    conditions_forecast_at: row.forecast_at,
    conditions_source: source,
  };

  const hasValue = Object.entries(resolved).some(
    ([key, value]) => key !== "conditions_forecast_at" && key !== "conditions_source" && value !== null,
  );
  return hasValue ? resolved : { ...NONE };
}

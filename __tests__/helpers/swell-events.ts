import type { BeachSwellEvent, SwellEventBeach, SwellEventForecastRow } from "@/lib/alerts/swell-events";

export const TIMEZONE = "America/Los_Angeles";
/** Friday 2026-09-25, 08:00 PDT. */
export const NOW = new Date("2026-09-25T15:00:00.000Z");
export const BEACH_ID = "11111111-1111-4111-8111-111111111111";

export interface PartitionSpec {
  heightFt: number;
  periodS: number;
  direction: string | number;
}

/** Late-September Pacific time is PDT (UTC-7). */
export function localIso(dayOffset: number, hour: number): string {
  return new Date(Date.UTC(2026, 8, 25 + dayOffset, hour + 7)).toISOString();
}

export function localDate(dayOffset: number): string {
  return new Date(Date.UTC(2026, 8, 25 + dayOffset)).toISOString().slice(0, 10);
}

export function swellBeach(overrides: Partial<SwellEventBeach> = {}): SwellEventBeach {
  return {
    id: BEACH_ID,
    name: "Test Beach",
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 30,
    swell_access_factors: null,
    terrain_enabled: false,
    shoaling_factors: null,
    deepwater_decay_factor: null,
    ...overrides,
  };
}

export function row(
  at: string,
  primary: PartitionSpec | null,
  secondary: PartitionSpec | null = null,
): SwellEventForecastRow {
  return {
    forecast_at: at,
    swell_1_height: primary ? `${primary.heightFt} ft` : null,
    swell_1_period: primary ? `${primary.periodS}s` : null,
    swell_1_direction: primary ? String(primary.direction) : null,
    swell_2_height: secondary ? `${secondary.heightFt} ft` : null,
    swell_2_period: secondary ? `${secondary.periodS}s` : null,
    swell_2_direction: secondary ? String(secondary.direction) : null,
  };
}

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

/**
 * Three-hourly rows for one local day. `noonBumpFt` makes the local-noon row
 * the day's single highest row, so the peak instant is unambiguous.
 */
export function dayRows(
  dayOffset: number,
  primary: PartitionSpec | null,
  options: { noonBumpFt?: number; secondary?: PartitionSpec | null } = {},
): SwellEventForecastRow[] {
  return HOURS.map((hour) => row(
    localIso(dayOffset, hour),
    primary && hour === 12 && options.noonBumpFt
      ? { ...primary, heightFt: primary.heightFt + options.noonBumpFt }
      : primary,
    options.secondary ?? null,
  ));
}

export const FLAT: PartitionSpec = { heightFt: 1, periodS: 10, direction: 270 };

/** A detected event as the runner receives it after key resolution. */
export function beachSwellEvent(overrides: Partial<BeachSwellEvent> = {}): BeachSwellEvent {
  const beachId = overrides.beachId ?? BEACH_ID;
  return {
    beachId,
    eventKey: `${beachId}:NW:2026-09-20`,
    directionDeg: 315,
    directionBand: "NW",
    directionLabel: "NW",
    periodS: 17,
    peakOffshoreHeightFt: 4.5,
    peakFaceHeightFt: 6,
    baselineFaceHeightFt: 2,
    peakEnergy: 344.25,
    baselineEnergy: 40,
    energyRatio: 8.6,
    exposure: 1,
    arrivalAt: "2026-09-18T15:00:00.000Z",
    peakAt: "2026-09-20T15:00:00.000Z",
    fadeAt: "2026-09-21T07:00:00.000Z",
    peakLocalDate: "2026-09-20",
    ...overrides,
  };
}

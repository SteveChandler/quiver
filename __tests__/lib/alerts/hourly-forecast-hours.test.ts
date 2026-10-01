import { expandForecastHoursToHourly, type AlertTideSample } from "@/lib/alerts/hourly-forecast-hours";
import type { ForecastHour } from "@/lib/alerts/types";

const row = (forecast_at: string, fields: Partial<ForecastHour> = {}): ForecastHour => ({
  forecast_id: `id-${forecast_at}`,
  forecast_at,
  wave_height: 4.5, wave_period: 12, wave_direction: "W",
  swell_1_height: 4, swell_1_period: 12, swell_1_direction: 270,
  wind_speed: 0, wind_direction_deg: 90,
  tide_height: 2.5, tide_status: "Rising",
  ...fields,
});

// Blacks Beach, 2026-10-01 (PDT = UTC-7): 05:00, 08:00, 11:00 local.
const r05 = row("2026-10-01T12:00:00+00:00", { wave_height: 4.5, wind_speed: 0, tide_height: 2.5 });
const r08 = row("2026-10-01T15:00:00+00:00", { wave_height: 4.7, wind_speed: 3.5, tide_height: 3.9 });
const r11 = row("2026-10-01T18:00:00+00:00", { wave_height: 4.5, wind_speed: 7, tide_height: 5.2 });
const noaa: AlertTideSample[] = [
  ["2026-10-01T12:00:00Z", 2.53], ["2026-10-01T13:00:00Z", 2.56], ["2026-10-01T14:00:00Z", 2.84],
  ["2026-10-01T15:00:00Z", 3.38], ["2026-10-01T16:00:00Z", 4.09], ["2026-10-01T17:00:00Z", 4.83],
  ["2026-10-01T18:00:00Z", 5.30],
].map(([time, heightFt]) => ({ time: time as string, heightFt: heightFt as number }));
const maxWave = new Map([[r05.forecast_at, 5], [r08.forecast_at, 5], [r11.forecast_at, 5]]);

describe("expandForecastHoursToHourly", () => {
  it("fills whole hours between 3-hourly rows with linear values and the nearest row's id", () => {
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: maxWave });
    expect(hours.map((h) => h.forecast_at)).toEqual([
      r05.forecast_at, "2026-10-01T13:00:00.000Z", "2026-10-01T14:00:00.000Z", r08.forecast_at,
    ]);
    expect(hours[1].wave_height).toBeCloseTo(4.567, 2);
    expect(hours[2].wind_speed).toBeCloseTo(2.333, 2);
    expect(hours[1].forecast_id).toBe(r05.forecast_id);
    expect(hours[2].forecast_id).toBe(r08.forecast_id);
  });

  it("blends directions the short way round", () => {
    const a = row("2026-10-01T12:00:00+00:00", { wind_direction_deg: 350 });
    const b = row("2026-10-01T15:00:00+00:00", { wind_direction_deg: 20 });
    const { hours } = expandForecastHoursToHourly({ hours: [a, b], maxWaveByForecastAt: new Map() });
    expect(hours[1].wind_direction_deg).toBeCloseTo(0, 0);
  });

  it("never passes a threshold on half the data: one null neighbour gives null", () => {
    const a = row("2026-10-01T12:00:00+00:00", { wind_speed: null });
    const { hours } = expandForecastHoursToHourly({ hours: [a, r08], maxWaveByForecastAt: new Map() });
    expect(hours[1].wind_speed).toBeNull();
  });

  it("does not invent hours across a gap that is not 2 or 3 whole hours", () => {
    const late = row("2026-10-01T21:00:00+00:00");
    const offset = row("2026-10-01T22:30:00+00:00");
    const { hours } = expandForecastHoursToHourly({ hours: [r08, late, offset], maxWaveByForecastAt: new Map() });
    expect(hours.map((h) => h.forecast_at)).toEqual([r08.forecast_at, late.forecast_at, offset.forecast_at]);
  });

  it("takes tide from bracketing NOAA hourly samples and derives the status from them", () => {
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08, r11], maxWaveByForecastAt: maxWave, tideSamples: noaa });
    const at = (iso: string) => hours.find((h) => new Date(h.forecast_at).toISOString() === iso)!;
    expect(at("2026-10-01T15:00:00.000Z").tide_height).toBeCloseTo(3.38, 2); // source row's 3.9 replaced
    expect(at("2026-10-01T16:00:00.000Z").tide_height).toBeCloseTo(4.09, 2);
    expect(at("2026-10-01T14:00:00.000Z").tide_status).toBe("Rising");
  });

  it("follows the NOAA samples through a turning point between two rows", () => {
    const peak: AlertTideSample[] = [
      { time: "2026-10-01T12:00:00Z", heightFt: 4.0 }, { time: "2026-10-01T13:00:00Z", heightFt: 4.6 },
      { time: "2026-10-01T14:00:00Z", heightFt: 4.4 }, { time: "2026-10-01T15:00:00Z", heightFt: 3.6 },
    ];
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: new Map(), tideSamples: peak });
    expect(hours[1].tide_status).toBe("Rising");  // 13:00: 12:00 (4.0) → 14:00 (4.4) is still up
    expect(hours[2].tide_status).toBe("Falling"); // 14:00
  });

  it("falls back to row-tide interpolation when NOAA does not bracket the hour, never to a clamped edge", () => {
    const stale: AlertTideSample[] = [{ time: "2026-09-28T12:00:00Z", heightFt: 1.0 }];
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: maxWave, tideSamples: stale });
    expect(hours[1].tide_height).toBeCloseTo(2.967, 2); // linear 2.5 → 3.9
    expect(hours[1].tide_status).toBe("Rising");
  });

  it("interpolates the wave upper bound for the rideability gate", () => {
    const wide = new Map([[r05.forecast_at, 4], [r08.forecast_at, 7]]);
    const { maxWaveByForecastAt } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: wide });
    expect(maxWaveByForecastAt.get("2026-10-01T13:00:00.000Z")).toBeCloseTo(5, 5);
  });
});

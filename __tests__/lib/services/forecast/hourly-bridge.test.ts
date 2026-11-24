/**
 * @jest-environment node
 *
 * The hourly bridge fills the hours between 3-hourly enhanced_forecasts rows so a scorer sees
 * the tide peak between two slots. The PB Point fixture is the 2026-10-27 case: the tide tops out
 * at 6.8 ft at 17Z (10 AM PDT), between the 15Z and 18Z rows.
 */

jest.mock("@/lib/monitoring/fallback-tracker", () => ({
  trackFallback: jest.fn(),
}));

import { forecastToSnapshot } from "@/lib/domains/scoring/discovery-adapter";
import { bridgeForecastsHourly } from "@/lib/services/forecast/hourly-bridge";
import type { TideSeriesSample } from "@/lib/services/tide-series-loader";
import { resolveForecastTime } from "@/lib/utils/forecast-time-resolver";
import type { EnhancedForecastEntity, TideScheduleEntry } from "@/types/forecast";

const HOUR_MS = 3_600_000;
const PB_POINT = "pacific-beach-point";

const PB_SCHEDULE: TideScheduleEntry[] = [
  { time: Date.parse("2026-10-27T10:12:00Z") / 1000, height: 0.4, type: "low" },
  { time: Date.parse("2026-10-27T17:06:00Z") / 1000, height: 6.8, type: "high" },
  { time: Date.parse("2026-10-27T23:41:00Z") / 1000, height: 1.1, type: "low" },
];

function row(overrides: Partial<EnhancedForecastEntity> & Pick<EnhancedForecastEntity, "id" | "forecast_at">): EnhancedForecastEntity {
  const at = overrides.forecast_at;
  return {
    beach_id: PB_POINT,
    forecast_date: at.slice(0, 10),
    forecast_time: at.slice(11, 19),
    wave_height: "2-3 ft",
    wave_period: "13s",
    wave_direction: "WSW",
    wind_direction_deg: 270,
    swell_1_height: "2.2 ft",
    swell_1_period: "13s",
    swell_1_direction: "WSW",
    swell_2_height: "0.8 ft",
    swell_2_period: "17s",
    swell_2_direction: "SSW",
    wind_wave_height: "0.6 ft",
    wind_wave_period: "6s",
    wind_wave_direction: "W",
    wave_height_om: 0.9,
    wave_period_om: 12.1,
    wave_direction_om: 255,
    swell_height_om: 0.7,
    swell_period_om: 13.2,
    swell_direction_om: 250,
    wind_wave_height_om: 0.2,
    om_fetched_at: "2026-10-27T03:10:00.000Z",
    water_temp: "64°F",
    air_temperature: "66°F",
    wind_speed: "4 mph",
    wind_source: "NWS",
    wind_direction: "W",
    tide_status: "Rising",
    tide_height: "5.7 ft",
    next_tide_time: "10:06 AM",
    next_tide_type: "High",
    next_tide_height: "6.8 ft",
    next_tide_at: "2026-10-27T17:06:00.000Z",
    coops_station_id: "9410230",
    weather_condition: "Sunny",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    created_at: "2026-10-27T03:10:00.000Z",
    updated_at: "2026-10-27T03:10:00.000Z",
    raw_forecast: null,
    ...overrides,
  };
}

const pb15 = row({
  id: "forecast-pb-15",
  forecast_at: "2026-10-27T15:00:00.000Z",
  wave_height: "2-3 ft",
  swell_1_height: "2.2 ft",
  swell_1_period: "13s",
  wind_speed: "4 mph",
  wind_direction: "WNW",
  wind_direction_deg: 292.5,
  tide_height: "5.7 ft",
  tide_status: "Rising",
  raw_forecast: { data_sources: ["NOAA_NWS"], tide_schedule: PB_SCHEDULE },
});

const pb18 = row({
  id: "forecast-pb-18",
  forecast_at: "2026-10-27T18:00:00.000Z",
  wave_height: "3-4 ft",
  swell_1_height: "2.8 ft",
  swell_1_period: "14s",
  wind_speed: "7 mph",
  wind_direction: "W",
  wind_direction_deg: 270,
  weather_condition: "Partly Cloudy",
  tide_height: "6.3 ft",
  tide_status: "Falling",
  next_tide_time: "04:41 PM",
  next_tide_type: "Low",
  next_tide_height: "1.1 ft",
  next_tide_at: "2026-10-27T23:41:00.000Z",
  raw_forecast: { data_sources: ["NOAA_NWS", "CDIP"] },
});

const PB_SERIES: TideSeriesSample[] = [
  { ts: "2026-10-27T15:00:00+00:00", heightFt: 5.7 },
  { ts: "2026-10-27T16:00:00+00:00", heightFt: 6.5 },
  { ts: "2026-10-27T17:00:00+00:00", heightFt: 6.8 },
  { ts: "2026-10-27T18:00:00+00:00", heightFt: 6.3 },
];

function byAt(rows: EnhancedForecastEntity[], iso: string): EnhancedForecastEntity {
  const found = rows.find((value) => Date.parse(value.forecast_at) === Date.parse(iso));
  if (!found) throw new Error(`no row at ${iso}`);
  return found;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("bridgeForecastsHourly: PB Point 2026-10-27", () => {
  const bridged = bridgeForecastsHourly([pb15, pb18], PB_SERIES);

  it("adds 16Z and 17Z between the 15Z and 18Z rows, in order", () => {
    expect(bridged.map((value) => value.id)).toEqual([
      "forecast-pb-15", "forecast-pb-15:h+1", "forecast-pb-15:h+2", "forecast-pb-18",
    ]);
  });

  it("reads 16Z rising and 17Z at the top of the tide, every tide field from the series", () => {
    const h16 = byAt(bridged, "2026-10-27T16:00:00Z");
    const h17 = byAt(bridged, "2026-10-27T17:00:00Z");
    expect(h16).toMatchObject({ tide_height: "6.5 ft", tide_status: "Rising" });
    expect(h16.tide_rate_ft_per_hour).toBeCloseTo(0.55, 5);
    expect(h17).toMatchObject({ tide_height: "6.8 ft", tide_status: "High" });
    expect(h17.tide_rate_ft_per_hour).toBeCloseTo(-0.1, 5);
    expect(h16.raw_forecast?.hourly_bridge?.tide_source).toBe("series");
    expect(h17.raw_forecast?.hourly_bridge?.tide_source).toBe("series");
  });

  it("names the 17:06Z high as the next tide at both hours, from the row that already names it", () => {
    for (const iso of ["2026-10-27T16:00:00Z", "2026-10-27T17:00:00Z"]) {
      expect(byAt(bridged, iso)).toMatchObject({
        next_tide_at: "2026-10-27T17:06:00.000Z",
        next_tide_time: "10:06 AM",
        next_tide_type: "High",
        next_tide_height: "6.8 ft",
      });
    }
  });

  it("gives the stored rows the series rate and leaves their own tide height and status", () => {
    const h15 = byAt(bridged, "2026-10-27T15:00:00Z");
    const h18 = byAt(bridged, "2026-10-27T18:00:00Z");
    expect(h15).toMatchObject({ tide_height: "5.7 ft", tide_status: "Rising" });
    expect(h15.tide_rate_ft_per_hour).toBeCloseTo(0.8, 5);
    expect(h18).toMatchObject({ tide_height: "6.3 ft", tide_status: "Falling" });
    expect(h18.tide_rate_ft_per_hour).toBeCloseTo(-0.5, 5);
    expect(h15.raw_forecast?.hourly_bridge).toBeUndefined();
  });

  it("blends magnitudes in each row's own format and takes text from the nearest row", () => {
    const h16 = byAt(bridged, "2026-10-27T16:00:00Z");
    const h17 = byAt(bridged, "2026-10-27T17:00:00Z");
    expect(h16).toMatchObject({
      wave_height: "2.3-3.3 ft",
      swell_1_height: "2.4 ft",
      swell_1_period: "13.3s",
      wind_speed: "5 mph",
      weather_condition: "Sunny",
    });
    expect(h17).toMatchObject({ swell_1_height: "2.6 ft", wind_speed: "6 mph", weather_condition: "Partly Cloudy" });
    expect(h16.wave_height_om).toBeCloseTo(0.9, 5);
  });

  it("keeps wind text and degrees on one blended direction", () => {
    const h16 = byAt(bridged, "2026-10-27T16:00:00Z");
    expect(h16.wind_direction_deg).toBeCloseTo(285, 5);
    expect(h16.wind_direction).toBe("WNW");
    const h17 = byAt(bridged, "2026-10-27T17:00:00Z");
    expect(h17.wind_direction_deg).toBeCloseTo(277.5, 5);
    expect(h17.wind_direction).toBe("W");
  });

  it("stamps a deterministic identity on the whole UTC hour", () => {
    const h16 = byAt(bridged, "2026-10-27T16:00:00Z");
    expect(h16).toMatchObject({
      id: "forecast-pb-15:h+1",
      forecast_at: "2026-10-27T16:00:00.000Z",
      forecast_date: "2026-10-27",
      forecast_time: "16:00:00",
      beach_id: PB_POINT,
      confidence_score: 85,
      coops_station_id: "9410230",
    });
    expect(h16.raw_forecast).toMatchObject({
      data_sources: ["NOAA_NWS"],
      tide_schedule: PB_SCHEDULE,
      hourly_bridge: { from: pb15.forecast_at, to: pb18.forecast_at, t: 1 / 3, tide_source: "series" },
    });
    expect(byAt(bridged, "2026-10-27T17:00:00Z").raw_forecast).toMatchObject({ data_sources: ["NOAA_NWS", "CDIP"] });
    expect(bridgeForecastsHourly([pb15, pb18], PB_SERIES).map((value) => value.id)).toEqual(bridged.map((value) => value.id));
  });

  it.each(["America/Los_Angeles", undefined])("round-trips resolveForecastTime (tz %s)", (tz) => {
    for (const value of bridged) {
      expect(resolveForecastTime(value, tz).toISOString()).toBe(new Date(value.forecast_at).toISOString());
    }
  });

  it("round-trips forecastToSnapshot with finite waves and parseable partitions", () => {
    for (const value of bridged) {
      const snapshot = forecastToSnapshot(value);
      expect(Number.isFinite(snapshot.waveHeight)).toBe(true);
      expect(snapshot.waveHeight).toBeGreaterThan(0);
      expect(Number.isFinite(snapshot.wavePeriod)).toBe(true);
      expect(snapshot.wavePeriod).toBeGreaterThan(0);
      expect(snapshot.primarySwell).not.toBeNull();
      expect(snapshot.secondarySwell).not.toBeNull();
      expect(snapshot.windWave).not.toBeNull();
      expect(snapshot.tide.heightKnown).toBe(true);
    }
    const peak = forecastToSnapshot(byAt(bridged, "2026-10-27T17:00:00Z"));
    expect(peak.tide).toMatchObject({ heightFt: 6.8, status: "slack-high", direction: "slack" });
    expect(forecastToSnapshot(byAt(bridged, "2026-10-27T16:00:00Z")).tide).toMatchObject({ heightFt: 6.5, status: "rising" });
  });

  it("does not mutate its inputs", () => {
    const rows = deepFreeze([structuredClone(pb15), structuredClone(pb18)]);
    const series = deepFreeze(PB_SERIES.map((sample) => ({ ...sample })));
    const before = JSON.stringify(rows);
    const out = bridgeForecastsHourly(rows, series);
    expect(JSON.stringify(rows)).toBe(before);
    expect(out[0]).not.toBe(rows[0]);
    expect(rows[0].tide_rate_ft_per_hour).toBeUndefined();
  });
});

describe("bridgeForecastsHourly: gap rules", () => {
  const at = (hour: number): string => new Date(Date.parse("2026-10-27T00:00:00Z") + hour * HOUR_MS).toISOString();
  const plain = (id: string, hour: number, overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity =>
    row({ id, forecast_at: at(hour), ...overrides });

  it("fills 2 h and 3 h gaps with one and two hours", () => {
    const out = bridgeForecastsHourly([plain("a", 0), plain("b", 2), plain("c", 5)], null);
    expect(out.map((value) => value.id)).toEqual(["a", "a:h+1", "b", "b:h+1", "b:h+2", "c"]);
  });

  it("never fills a 1 h, 4 h, 6 h or fractional gap, and never invents a missing row", () => {
    const rows = [plain("a", 0), plain("b", 1), plain("c", 5), plain("d", 11)];
    expect(bridgeForecastsHourly(rows, null).map((value) => value.id)).toEqual(["a", "b", "c", "d"]);
    const half = row({ id: "h", forecast_at: "2026-10-27T02:30:00.000Z" });
    expect(bridgeForecastsHourly([plain("a", 0), half], null).map((value) => value.id)).toEqual(["a", "h"]);
    expect(bridgeForecastsHourly([plain("a", 0)], null).map((value) => value.id)).toEqual(["a"]);
  });

  it("honours maxGapHours but never fills beyond 3 h", () => {
    const rows = [plain("a", 0), plain("b", 3), plain("c", 5)];
    expect(bridgeForecastsHourly(rows, null, { maxGapHours: 2 }).map((value) => value.id)).toEqual(["a", "b", "b:h+1", "c"]);
    const wide = [plain("a", 0), plain("b", 4)];
    expect(bridgeForecastsHourly(wide, null, { maxGapHours: 6 }).map((value) => value.id)).toEqual(["a", "b"]);
  });

  it("fills only the hours inside [startMs, endMs)", () => {
    const rows = [plain("a", 0), plain("b", 3), plain("c", 6)];
    const out = bridgeForecastsHourly(rows, null, { startMs: Date.parse(at(2)), endMs: Date.parse(at(5)) });
    expect(out.map((value) => value.id)).toEqual(["a", "a:h+2", "b", "b:h+1", "c"]);
  });

  it("never builds an hour includeHour rejects", () => {
    const rows = [plain("a", 0), plain("b", 3)];
    const asked: number[] = [];
    const out = bridgeForecastsHourly(rows, null, {
      includeHour: (hourMs) => {
        asked.push(hourMs);
        return hourMs !== Date.parse(at(1));
      },
    });
    expect(out.map((value) => value.id)).toEqual(["a", "a:h+2", "b"]);
    expect(asked).toEqual([Date.parse(at(1)), Date.parse(at(2))]);
  });

  it("bridges each beach on its own and only between its own rows", () => {
    const rows = [
      plain("a0", 0), row({ id: "b0", beach_id: "other", forecast_at: at(0) }),
      plain("a3", 3), row({ id: "b2", beach_id: "other", forecast_at: at(2) }),
    ];
    const out = bridgeForecastsHourly(rows, null);
    expect(out.map((value) => value.id)).toEqual(["a0", "b0", "a0:h+1", "b0:h+1", "a0:h+2", "b2", "a3"]);
    expect(out.find((value) => value.id === "b0:h+1")?.beach_id).toBe("other");
  });

  it("takes each beach's series from a map and refuses one bare series for several beaches", () => {
    const rows = [plain("a0", 0), plain("a3", 3), row({ id: "b0", beach_id: "other", forecast_at: at(0) }), row({ id: "b3", beach_id: "other", forecast_at: at(3) })];
    const series = new Map<string, TideSeriesSample[]>([
      [PB_POINT, [0, 1, 2, 3].map((hour) => ({ ts: at(hour), heightFt: 2 + hour }))],
    ]);
    const out = bridgeForecastsHourly(rows, series);
    expect(out.find((value) => value.id === "a0:h+1")).toMatchObject({ tide_height: "3 ft", tide_status: "Rising" });
    expect(out.find((value) => value.id === "b0:h+1")?.raw_forecast?.hourly_bridge?.tide_source).toBe("row_lerp");
    expect(() => bridgeForecastsHourly(rows, series.get(PB_POINT) ?? null)).toThrow(/map by beach_id/);
  });
});

describe("bridgeForecastsHourly: directions and partitions", () => {
  const from = row({ id: "f", forecast_at: "2026-10-27T15:00:00.000Z" });
  const to = row({ id: "t", forecast_at: "2026-10-27T18:00:00.000Z" });

  it("blends directions the short way round 350° → 10°", () => {
    const out = bridgeForecastsHourly([
      { ...from, swell_1_direction: "350", wind_direction_deg: 350, wind_direction: "N", wave_direction_om: 350, swell_direction_om: 350 },
      { ...to, swell_1_direction: "10", wind_direction_deg: 10, wind_direction: "N", wave_direction_om: 10, swell_direction_om: 10 },
    ], null);
    const [h16, h17] = [out[1], out[2]];
    expect(h16.swell_1_direction).toBe("357");
    expect(h17.swell_1_direction).toBe("3");
    expect(h16.wind_direction_deg).toBeCloseTo(356.7, 5);
    expect(h17.wind_direction_deg).toBeCloseTo(3.3, 5);
    expect(h16.wind_direction).toBe("N");
    expect(h16.wave_direction_om).toBeCloseTo(356.667, 2);
    expect(h17.swell_direction_om).toBeCloseTo(3.333, 2);
  });

  it("re-derives compass text from the blended degrees", () => {
    const out = bridgeForecastsHourly([
      { ...from, swell_1_direction: "W", wave_direction: "W" },
      { ...to, swell_1_direction: "SW", wave_direction: "SW" },
    ], null);
    expect(out[1].swell_1_direction).toBe("WSW");
    expect(out[1].wave_direction).toBe("WSW");
    expect(out[2].swell_1_direction).toBe("WSW");
  });

  it.each([
    ["height", { swell_2_height: null }],
    ["period", { swell_2_period: null }],
    ["direction", { swell_2_direction: null }],
    ["a zero height", { swell_2_height: "0 ft" }],
  ])("fades swell_2 in or out, whole, when a neighbour lacks its %s", (_label, missing) => {
    const cases: Array<[EnhancedForecastEntity[], [string, string]]> = [
      [[{ ...from, ...missing }, to], ["0.3 ft", "0.5 ft"]],
      [[from, { ...to, ...missing }], ["0.5 ft", "0.3 ft"]],
    ];
    for (const [rows, heights] of cases) {
      const out = bridgeForecastsHourly(rows, null);
      [out[1], out[2]].forEach((synthetic, index) => {
        expect(synthetic).toMatchObject({ swell_2_height: heights[index], swell_2_period: "17s", swell_2_direction: "SSW" });
        expect(synthetic).toMatchObject({ swell_1_height: "2.2 ft", swell_1_period: "13s", swell_1_direction: "WSW" });
        expect(forecastToSnapshot(synthetic).secondarySwell).toMatchObject({ heightFt: Number.parseFloat(heights[index]), periodS: 17 });
      });
    }
  });

  it("drops a held train once its faded height rounds to nothing", () => {
    const out = bridgeForecastsHourly([{ ...from, swell_2_height: null }, { ...to, swell_2_height: "0.1 ft" }], null);
    expect(out[1]).toMatchObject({ swell_2_height: null, swell_2_period: null, swell_2_direction: null });
    expect(out[2]).toMatchObject({ swell_2_height: "0.1 ft", swell_2_period: "17s", swell_2_direction: "SSW" });
  });

  it("pairs swells by train when swell_1 and swell_2 swap order between rows", () => {
    const out = bridgeForecastsHourly([
      { ...from, swell_1_height: "2.1 ft", swell_1_period: "7s", swell_1_direction: "W", swell_2_height: "2 ft", swell_2_period: "10s", swell_2_direction: "SSW" },
      { ...to, swell_1_height: "2 ft", swell_1_period: "12s", swell_1_direction: "SSW", swell_2_height: "1.9 ft", swell_2_period: "5s", swell_2_direction: "W" },
    ], null);
    // Each hour keeps the nearer row's slot order; no blended WSW 9 s swell appears.
    expect(out[1]).toMatchObject({
      swell_1_height: "2 ft", swell_1_period: "6.3s", swell_1_direction: "W",
      swell_2_height: "2 ft", swell_2_period: "10.7s", swell_2_direction: "SSW",
    });
    expect(out[2]).toMatchObject({
      swell_1_height: "2 ft", swell_1_period: "11.3s", swell_1_direction: "SSW",
      swell_2_height: "2 ft", swell_2_period: "5.7s", swell_2_direction: "W",
    });
  });

  it("gives a contested slot to the train nearer in time when one fades out as another fades in", () => {
    const out = bridgeForecastsHourly([
      { ...from, swell_1_height: "2 ft", swell_1_period: "12s", swell_1_direction: "SSW", swell_2_height: "1.7 ft", swell_2_period: "5s", swell_2_direction: "W" },
      { ...to, swell_1_height: "1.9 ft", swell_1_period: "13s", swell_1_direction: "SSW", swell_2_height: "0.9 ft", swell_2_period: "9s", swell_2_direction: "SSE" },
    ], null);
    expect(out[1]).toMatchObject({ swell_1_period: "12.3s", swell_2_height: "1.1 ft", swell_2_period: "5s", swell_2_direction: "W" });
    expect(out[2]).toMatchObject({ swell_1_period: "12.7s", swell_2_height: "0.6 ft", swell_2_period: "9s", swell_2_direction: "SSE" });
  });

  it("takes wave_period and wave_direction from the dominant blended partition, never a ramp", () => {
    const out = bridgeForecastsHourly([
      { ...from, wave_period: "5s", wave_direction: "W", swell_1_height: "2.4 ft", swell_1_period: "5s", swell_1_direction: "W", swell_2_height: "1.4 ft", swell_2_period: "15s", swell_2_direction: "SW" },
      { ...to, wave_period: "13s", wave_direction: "SSW", swell_1_height: "2.3 ft", swell_1_period: "4s", swell_1_direction: "W", swell_2_height: "2 ft", swell_2_period: "13s", swell_2_direction: "SSW" },
    ], null);
    expect(out.map((value) => [value.wave_period, value.wave_direction])).toEqual([
      ["5s", "W"], ["4.7s", "W"], ["4.3s", "W"], ["13s", "SSW"],
    ]);
  });

  it("blends wave_period and wave_direction as magnitudes when no partition exists", () => {
    const bare = { swell_1_height: null, swell_2_height: null, wind_wave_height: null };
    const out = bridgeForecastsHourly([
      { ...from, ...bare, wave_period: "10s", wave_direction: "W" },
      { ...to, ...bare, wave_period: "13s", wave_direction: "SW" },
    ], null);
    expect(out[1]).toMatchObject({ wave_period: "11s", wave_direction: "WSW" });
  });

  it("takes a partition whole from the nearest row when the two can't be blended", () => {
    const out = bridgeForecastsHourly([
      { ...from, swell_1_height: "2 ft", swell_1_period: "13s", swell_1_direction: "W" },
      { ...to, swell_1_height: "2-3 ft", swell_1_period: "16s", swell_1_direction: "SW" },
    ], null);
    expect(out[1]).toMatchObject({ swell_1_height: "2 ft", swell_1_period: "13s", swell_1_direction: "W" });
    expect(out[2]).toMatchObject({ swell_1_height: "2-3 ft", swell_1_period: "16s", swell_1_direction: "SW" });
  });

  it("fades the Open-Meteo swell triple whole when one row lacks it", () => {
    const out = bridgeForecastsHourly([{ ...from, swell_period_om: null }, to], null);
    expect(out[1]).toMatchObject({ swell_period_om: 13.2, swell_direction_om: 250 });
    expect(out[1].swell_height_om).toBeCloseTo(0.7 / 3, 5);
    const none = bridgeForecastsHourly([{ ...from, swell_period_om: null }, { ...to, swell_height_om: null }], null);
    expect(none[1]).toMatchObject({ swell_height_om: null, swell_period_om: null, swell_direction_om: null });
  });
});

describe("bridgeForecastsHourly: tide sources", () => {
  const from = row({ id: "f", forecast_at: "2026-10-27T15:00:00.000Z", tide_height: "5.7 ft", tide_status: "Rising" });
  const to = row({ id: "t", forecast_at: "2026-10-27T18:00:00.000Z", tide_height: "6.3 ft", tide_status: "Falling" });

  it("falls back to the two rows when the series lacks the hour and says so", () => {
    const out = bridgeForecastsHourly([from, to], null);
    const [h16, h17] = [out[1], out[2]];
    expect(h16).toMatchObject({ tide_height: "5.9 ft", tide_status: "Rising" });
    expect(h16.tide_rate_ft_per_hour).toBeCloseTo(0.2, 5);
    expect(h17).toMatchObject({ tide_height: "6.1 ft", tide_status: "Rising" });
    expect(h16.raw_forecast?.hourly_bridge?.tide_source).toBe("row_lerp");
    expect(out[0].tide_rate_ft_per_hour).toBeUndefined();
  });

  it("never pairs a series height with a row status: a partial series sends that hour to the fallback whole", () => {
    // 16Z is in the series, 17Z is not.
    const partial: TideSeriesSample[] = [
      { ts: "2026-10-27T15:00:00Z", heightFt: 5.7 },
      { ts: "2026-10-27T16:00:00Z", heightFt: 6.5 },
    ];
    const out = bridgeForecastsHourly([from, to], partial);
    expect(out[1]).toMatchObject({ tide_height: "6.5 ft", tide_status: "Rising", tide_rate_ft_per_hour: 0.8 });
    expect(out[1].raw_forecast?.hourly_bridge?.tide_source).toBe("series");
    expect(out[2]).toMatchObject({ tide_height: "6.1 ft", tide_status: "Rising", tide_rate_ft_per_hour: 0.2 });
    expect(out[2].raw_forecast?.hourly_bridge?.tide_source).toBe("row_lerp");
  });

  it("treats a lone series hour with no neighbour as not covered", () => {
    const out = bridgeForecastsHourly([from, to], [{ ts: "2026-10-27T16:00:00Z", heightFt: 9.9 }]);
    expect(out[1].tide_height).toBe("5.9 ft");
    expect(out[1].raw_forecast?.hourly_bridge?.tide_source).toBe("row_lerp");
  });

  it("calls a low turning point Low", () => {
    const series: TideSeriesSample[] = [
      { ts: "2026-10-27T15:00:00Z", heightFt: 0.7 },
      { ts: "2026-10-27T16:00:00Z", heightFt: 0.5 },
      { ts: "2026-10-27T17:00:00Z", heightFt: 0.6 },
      { ts: "2026-10-27T18:00:00Z", heightFt: 1.1 },
    ];
    const out = bridgeForecastsHourly([from, to], series);
    expect(out[1]).toMatchObject({ tide_height: "0.5 ft", tide_status: "Low" });
    expect(out[1].tide_rate_ft_per_hour).toBeCloseTo(-0.05, 5);
    expect(out[2]).toMatchObject({ tide_height: "0.6 ft", tide_status: "Rising" });
    expect(out[2].tide_rate_ft_per_hour).toBeCloseTo(0.3, 5);
  });

  it("calls any turning point High or Low whatever its rate, and keeps the central rate", () => {
    const series: TideSeriesSample[] = [
      { ts: "2026-10-27T15:00:00Z", heightFt: 6.0 },
      { ts: "2026-10-27T16:00:00Z", heightFt: 6.8 },
      { ts: "2026-10-27T17:00:00Z", heightFt: 5.5 },
      { ts: "2026-10-27T18:00:00Z", heightFt: 4.0 },
    ];
    const out = bridgeForecastsHourly([from, to], series);
    expect(out[1]).toMatchObject({ tide_height: "6.8 ft", tide_status: "High" });
    expect(out[1].tide_rate_ft_per_hour).toBeCloseTo(-0.25, 5);
    expect(out[2]).toMatchObject({ tide_height: "5.5 ft", tide_status: "Falling" });
    expect(out[2].tide_rate_ft_per_hour).toBeCloseTo(-1.4, 5);
  });

  it("writes statuses a condition alert's exact tide_direction match accepts", () => {
    const out = bridgeForecastsHourly([pb15, pb18], PB_SERIES);
    // lib/alerts/condition-evaluator.ts compares tide_status.trim().toLowerCase() to rising/falling/high/low.
    for (const value of out) {
      expect(["rising", "falling", "high", "low"]).toContain(value.tide_status?.trim().toLowerCase());
    }
  });

  it("leaves tide empty when neither the series nor the rows have a height", () => {
    const out = bridgeForecastsHourly([{ ...from, tide_height: "-- ft" }, to], null);
    expect(out[1]).toMatchObject({ tide_height: null, tide_status: null, tide_rate_ft_per_hour: null });
    expect(out[1].raw_forecast?.hourly_bridge?.tide_source).toBe("none");
  });

  it("recomputes next_tide from the schedule when neither row names the event", () => {
    const schedule: TideScheduleEntry[] = [
      { time: Date.parse("2026-10-27T16:30:00Z") / 1000, height: 6.84, type: "high" },
      { time: Date.parse("2026-10-27T23:00:00Z") / 1000, height: 1.0, type: "low" },
    ];
    const rows = [
      { ...from, next_tide_at: null, next_tide_time: null, raw_forecast: { tide_schedule: schedule } },
      { ...to, next_tide_at: null, next_tide_time: null },
    ];
    const out = bridgeForecastsHourly(rows, null);
    expect(out[1]).toMatchObject({ next_tide_at: "2026-10-27T16:30:00.000Z", next_tide_type: "High", next_tide_height: "6.8 ft", next_tide_time: null });
    expect(out[2]).toMatchObject({ next_tide_at: "2026-10-27T23:00:00.000Z", next_tide_type: "Low", next_tide_height: "1 ft", next_tide_time: null });

    // With the beach zone the time reads like a stored row's (forecast-builder getTideInfo).
    const local = bridgeForecastsHourly(rows, null, { timezone: "America/Los_Angeles" });
    expect(local[1].next_tide_time).toBe("09:30 AM");
    expect(local[2].next_tide_time).toBe("04:00 PM");
    expect(bridgeForecastsHourly(rows, null, { timezone: "Not/AZone" })[1].next_tide_time).toBeNull();
  });

  it("without a schedule takes next_tide from the neighbour whose event is still ahead", () => {
    const out = bridgeForecastsHourly([
      { ...from, next_tide_at: "2026-10-27T17:30:00.000Z", next_tide_time: "10:30 AM", next_tide_type: "High" },
      { ...to, next_tide_at: "2026-10-27T23:41:00.000Z", next_tide_time: "04:41 PM", next_tide_type: "Low" },
    ], null);
    // 17Z sits nearer the 18Z row, but the 17:30Z high is still ahead of it.
    expect(out[2]).toMatchObject({ next_tide_at: "2026-10-27T17:30:00.000Z", next_tide_time: "10:30 AM", next_tide_type: "High" });
  });
});

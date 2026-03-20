/**
 * Unit tests for scoreForecastSlots and identifyGoldenWindows
 * (exported from the scored forecast route for testability).
 *
 * These tests exercise pure logic without any HTTP layer or Supabase mocking.
 */

import { scoreForecastSlots, identifyGoldenWindows } from "../route";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: new Date(Date.now() + 3_600_000).toISOString(),
    forecast_date: "2026-03-18",
    forecast_time: "09:00:00",
    wave_height: "4-5 ft",
    wave_period: null,
    wave_direction: null,
    swell_1_height: "4",
    swell_1_period: "14",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: "5 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    water_temp: "62°F",
    air_temperature: "65°F",
    tide_status: "Rising",
    tide_height: "2.5",
    next_tide_time: null,
    next_tide_type: null,
    next_tide_height: null,
    next_tide_at: null,
    coops_station_id: null,
    weather_condition: "Clear",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    country: "US",
    center_lat: 32.7,
    center_lng: -117.2,
    break_type: "beach",
    aspect_deg: 270, // west-facing
    swell_access_factors: Array(72).fill(0.8),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Beach;
}

// ---------------------------------------------------------------------------
// scoreForecastSlots
// ---------------------------------------------------------------------------

describe("scoreForecastSlots", () => {
  it("returns one slot per forecast", () => {
    const forecasts = [makeForecast(), makeForecast()];
    const beach = makeBeach();
    const slots = scoreForecastSlots(forecasts, beach);
    expect(slots).toHaveLength(2);
  });

  it("slot has required fields", () => {
    const forecast = makeForecast();
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);

    expect(slot).toHaveProperty("forecastAt");
    expect(slot).toHaveProperty("surfHeight");
    expect(slot.surfHeight).toHaveProperty("min");
    expect(slot.surfHeight).toHaveProperty("max");
    expect(slot).toHaveProperty("swells");
    expect(slot).toHaveProperty("windSpeed");
    expect(slot).toHaveProperty("windDirection");
    expect(slot).toHaveProperty("windDirectionDeg");
    expect(slot).toHaveProperty("isOffshore");
    expect(slot).toHaveProperty("tideHeight");
    expect(slot).toHaveProperty("tideStatus");
    expect(slot).toHaveProperty("waterTemp");
    expect(slot).toHaveProperty("airTemp");
    expect(slot).toHaveProperty("compositeScore");
    expect(slot).toHaveProperty("rideableWavesPerHour");
    expect(slot).toHaveProperty("waveFrequencyConfidence");
    expect(slot).toHaveProperty("forecastDataConfidence");
  });

  it("compositeScore is between 0 and 100", () => {
    const forecast = makeForecast();
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.compositeScore).toBeGreaterThanOrEqual(0);
    expect(slot.compositeScore).toBeLessThanOrEqual(100);
  });

  it("rideableWavesPerHour is non-negative", () => {
    const forecast = makeForecast();
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
  });

  it("surfHeight min <= max", () => {
    const forecast = makeForecast({ wave_height: "3-5 ft" });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.surfHeight.min).toBeLessThanOrEqual(slot.surfHeight.max);
  });

  it("handles flat wave height gracefully", () => {
    const forecast = makeForecast({ wave_height: "Flat" });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.surfHeight.min).toBeGreaterThanOrEqual(0);
    expect(slot.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
  });

  it("handles null wave_height gracefully", () => {
    const forecast = makeForecast({ wave_height: null });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.surfHeight.min).toBeGreaterThanOrEqual(0);
  });

  it("includes swell_1 in swells array when present", () => {
    const forecast = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
    });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.swells.length).toBeGreaterThan(0);
    const swell = slot.swells[0];
    expect(swell.height).toBe(4);
    expect(swell.period).toBe(14);
  });

  it("excludes missing/zero-height swells from swells array", () => {
    const forecast = makeForecast({
      swell_1_height: null,
      swell_1_period: null,
      swell_1_direction: null,
      swell_2_height: null,
      swell_2_period: null,
    });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.swells).toHaveLength(0);
  });

  it("classifies wind as offshore when wind blows away from aspect", () => {
    // Beach faces west (270°). Wind from east (90°) is offshore.
    const forecast = makeForecast({ wind_direction: "E", wind_direction_deg: 90 });
    const beach = makeBeach({ aspect_deg: 270 });
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.isOffshore).toBe(true);
  });

  it("classifies wind as onshore when wind blows toward aspect", () => {
    // Beach faces west (270°). Wind from west (270°) is onshore.
    const forecast = makeForecast({ wind_direction: "W", wind_direction_deg: 270 });
    const beach = makeBeach({ aspect_deg: 270 });
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.isOffshore).toBe(false);
  });

  it("handles optional wind_wave fields gracefully", () => {
    const forecast = makeForecast({
      wind_wave_height: undefined,
      wind_wave_period: undefined,
      wind_wave_direction: undefined,
    });
    const beach = makeBeach();
    expect(() => scoreForecastSlots([forecast], beach)).not.toThrow();
  });

  it("returns empty array for empty forecasts input", () => {
    const beach = makeBeach();
    const slots = scoreForecastSlots([], beach);
    expect(slots).toHaveLength(0);
  });

  it("forecastAt matches forecast forecast_at field", () => {
    const now = new Date(Date.now() + 3_600_000).toISOString();
    const forecast = makeForecast({ forecast_at: now });
    const beach = makeBeach();
    const [slot] = scoreForecastSlots([forecast], beach);
    expect(slot.forecastAt).toBe(now);
  });
});

// ---------------------------------------------------------------------------
// identifyGoldenWindows
// ---------------------------------------------------------------------------

describe("identifyGoldenWindows", () => {
  function makeSlot(
    forecastAt: string,
    compositeScore: number,
    rideableWavesPerHour = 10
  ) {
    return {
      forecastAt,
      surfHeight: { min: 3, max: 5 },
      swells: [],
      windSpeed: 5,
      windDirection: "E",
      windDirectionDeg: 90,
      isOffshore: true,
      tideHeight: 2.5,
      tideStatus: "Rising",
      waterTemp: "62°F",
      airTemp: "65°F",
      compositeScore,
      rideableWavesPerHour,
      waveFrequencyConfidence: "high" as const,
      swellTrains: 1,
      dominantBeatIntervalS: null,
      forecastDataConfidence: 80,
    };
  }

  const BASE = new Date("2026-03-18T06:00:00Z");
  const add3h = (base: Date, n: number) =>
    new Date(base.getTime() + n * 3 * 60 * 60 * 1000).toISOString();

  it("returns empty array when no slots meet threshold", () => {
    const slots = [
      makeSlot(add3h(BASE, 0), 50),
      makeSlot(add3h(BASE, 1), 55),
    ];
    expect(identifyGoldenWindows(slots)).toHaveLength(0);
  });

  it("identifies a single golden window from contiguous high-score slots", () => {
    const slots = [
      makeSlot(add3h(BASE, 0), 65),
      makeSlot(add3h(BASE, 1), 75),
      makeSlot(add3h(BASE, 2), 70),
    ];
    const windows = identifyGoldenWindows(slots);
    expect(windows).toHaveLength(1);
    expect(windows[0].peakScore).toBe(75);
    expect(windows[0].startTime).toBe(add3h(BASE, 0));
  });

  it("separates non-contiguous golden slots into multiple windows", () => {
    const slots = [
      makeSlot(add3h(BASE, 0), 65),
      makeSlot(add3h(BASE, 1), 40), // gap
      makeSlot(add3h(BASE, 2), 70),
      makeSlot(add3h(BASE, 3), 80),
    ];
    const windows = identifyGoldenWindows(slots);
    expect(windows).toHaveLength(2);
  });

  it("endTime is 3 hours after last slot start time", () => {
    const slots = [makeSlot(add3h(BASE, 0), 65)];
    const windows = identifyGoldenWindows(slots);
    expect(windows).toHaveLength(1);
    const expectedEnd = new Date(
      new Date(add3h(BASE, 0)).getTime() + 3 * 60 * 60 * 1000
    ).toISOString();
    expect(windows[0].endTime).toBe(expectedEnd);
  });

  it("durationMinutes is correct for a 3-slot window (9h = 540min)", () => {
    const slots = [
      makeSlot(add3h(BASE, 0), 65),
      makeSlot(add3h(BASE, 1), 70),
      makeSlot(add3h(BASE, 2), 65),
    ];
    const windows = identifyGoldenWindows(slots);
    expect(windows).toHaveLength(1);
    expect(windows[0].durationMinutes).toBe(540);
  });

  it("durationMinutes for a single slot is 180min (one 3h slot)", () => {
    const slots = [makeSlot(add3h(BASE, 0), 65)];
    const windows = identifyGoldenWindows(slots);
    expect(windows[0].durationMinutes).toBe(180);
  });

  it("includes peakWavesPerHour from the peak slot", () => {
    const slots = [
      makeSlot(add3h(BASE, 0), 65, 8),
      makeSlot(add3h(BASE, 1), 80, 15), // peak
      makeSlot(add3h(BASE, 2), 70, 10),
    ];
    const windows = identifyGoldenWindows(slots);
    expect(windows[0].peakWavesPerHour).toBe(15);
    expect(windows[0].peakTime).toBe(add3h(BASE, 1));
  });

  it("returns empty array for empty slots input", () => {
    expect(identifyGoldenWindows([])).toHaveLength(0);
  });

  it("handles slot exactly at threshold (score = 60)", () => {
    const slots = [makeSlot(add3h(BASE, 0), 60)];
    const windows = identifyGoldenWindows(slots);
    expect(windows).toHaveLength(1);
  });

  it("does not include slot just below threshold (score = 59)", () => {
    const slots = [makeSlot(add3h(BASE, 0), 59)];
    expect(identifyGoldenWindows(slots)).toHaveLength(0);
  });
});

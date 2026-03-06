// __tests__/components/ocean-viz/forecast-to-ocean.test.ts

import {
  forecastToOceanUniforms,
  parseSwellToWaveParams,
  windToChopParams,
  parseTideOffset,
  computeTimeOfDay,
  computeWindSwellAlignment,
} from "@/components/ocean-viz/forecast-to-ocean";
import { WAVE_DEFAULTS } from "@/components/ocean-viz/ocean-constants";
import type { EnhancedForecastEntity } from "@/types/forecast";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal valid EnhancedForecastEntity with all nullable fields set to null.
 * Individual tests spread overrides on top.
 */
function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "beach-id",
    forecast_at: "2026-03-04T12:00:00Z",
    forecast_date: "2026-03-04",
    forecast_time: "12:00:00",
    wave_height: null,
    water_temp: null,
    confidence_score: null,
    data_source: "NOAA_NWS",
    created_at: "2026-03-04T00:00:00Z",
    updated_at: "2026-03-04T00:00:00Z",
    ...overrides,
  };
}

// ── forecastToOceanUniforms ───────────────────────────────────────────────────

describe("forecastToOceanUniforms", () => {
  beforeEach(() => {
    // Pin wall clock to noon on 2026-03-04 so timeOfDay is deterministic
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T20:00:00Z")); // noon UTC-8 ≈ 20:00 UTC
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns defaults for all wave bands when forecast is null", () => {
    const uniforms = forecastToOceanUniforms(null);

    expect(uniforms.wave1).toEqual(WAVE_DEFAULTS.wave1);
    expect(uniforms.wave2).toEqual(WAVE_DEFAULTS.wave2);
    expect(uniforms.wave3).toEqual(WAVE_DEFAULTS.wave3);
    expect(uniforms.windChop).toBe(0);
    expect(uniforms.tideOffset).toBe(0);
    expect(uniforms.timeOfDay).toBeGreaterThanOrEqual(0);
    expect(uniforms.timeOfDay).toBeLessThanOrEqual(1);
  });

  it("returns WAVE_DEFAULTS copies (not the same reference) for null forecast", () => {
    const uniforms = forecastToOceanUniforms(null);

    // Mutating the returned object must not corrupt the shared constants
    expect(uniforms.wave1).not.toBe(WAVE_DEFAULTS.wave1);
    expect(uniforms.wave2).not.toBe(WAVE_DEFAULTS.wave2);
    expect(uniforms.wave3).not.toBe(WAVE_DEFAULTS.wave3);
  });

  it("parses a complete forecast with swell, wind, and tide data", () => {
    const forecast = makeForecast({
      swell_1_height: "4-6 ft",
      swell_1_period: "12 s",
      swell_1_direction: "SW",
      swell_2_height: "2-3 ft",
      swell_2_period: "8 s",
      swell_2_direction: "NW",
      wind_speed: "10 mph",
      wind_direction: "W",
      tide_height: "5.0 ft",
    });

    const uniforms = forecastToOceanUniforms(forecast);

    // Primary swell amplitude should reflect 5 ft midpoint
    // 5 ft → 5 * 0.3048 = 1.524 m → 1.524 * 0.1 * 2.5 = 0.381
    expect(uniforms.wave1.amplitude).toBeCloseTo(0.381, 2);

    // Secondary swell amplitude: midpoint 2.5 ft → 0.7620 m → 0.7620 * 0.1 * 2.5 = 0.1905
    expect(uniforms.wave2.amplitude).toBeCloseTo(0.1905, 2);

    // Wind chop intensity: 10 mph / 15 = 0.667
    expect(uniforms.windChop).toBeCloseTo(0.667, 2);

    // Tide offset: (5.0 - 3.0) * 0.3048 * 0.1 = 0.06096
    expect(uniforms.tideOffset).toBeCloseTo(0.061, 2);

    // Foam threshold should be in the valid range
    expect(uniforms.foamThreshold).toBeGreaterThanOrEqual(0.65);
    expect(uniforms.foamThreshold).toBeLessThanOrEqual(0.85);

    expect(uniforms.timeOfDay).toBeGreaterThanOrEqual(0);
    expect(uniforms.timeOfDay).toBeLessThanOrEqual(1);
  });

  it("returns default foamThreshold for null forecast", () => {
    const uniforms = forecastToOceanUniforms(null);
    expect(uniforms.foamThreshold).toBe(0.82);
  });

  it("produces a small sentinel wave for secondary swell when swell_2 fields are all absent", () => {
    // parseWaveHeight(undefined) treats !text as true and returns 0.15 m (the "no data" sentinel).
    // amplitude = 0.15 * 0.1 * 2.5 = 0.0375 — non-zero, so the zero-amplitude guard is NOT
    // triggered and we get a small computed wave rather than WAVE_DEFAULTS.wave1.
    const forecast = makeForecast({
      swell_1_height: "3 ft",
      swell_1_period: "10 s",
      swell_1_direction: "SW",
      // swell_2_* deliberately omitted
    });

    const uniforms = forecastToOceanUniforms(forecast);

    expect(uniforms.wave2.amplitude).toBeCloseTo(0.0375, 3);
    // Frequency/speed are derived from the default fallback period (10 s)
    // wavelength = 1.56 * 100 = 156 m → freq = 2π / 15.6 ≈ 0.4028
    expect(uniforms.wave2.frequency).toBeCloseTo(0.4028, 2);
  });

  it("falls back to wave_height when swell_1_height is null", () => {
    const forecast = makeForecast({
      swell_1_height: null,
      swell_1_period: null,
      swell_1_direction: null,
      wave_height: "4 ft",
      wave_period: "10 s",
      wave_direction: "SW",
    });

    const uniforms = forecastToOceanUniforms(forecast);

    // 4 ft → 4 * 0.3048 = 1.2192 m → 1.2192 * 0.1 * 2.5 = 0.3048
    expect(uniforms.wave1.amplitude).toBeCloseTo(0.3048, 2);
  });

  it("falls back to wave_height when swell_1_height is undefined", () => {
    // EnhancedForecastEntity has swell_1_height as optional — undefined triggers the same path
    const forecast = makeForecast({
      wave_height: "3 ft",
    });
    // swell_1_height not set → undefined → falls through to wave_height

    const uniforms = forecastToOceanUniforms(forecast);

    // 3 ft → 0.9144 m → 0.9144 * 0.1 * 2.5 = 0.2286
    expect(uniforms.wave1.amplitude).toBeCloseTo(0.2286, 2);
  });

  it("produces windChop = 0 and zero-amplitude chop when wind_speed is absent", () => {
    const forecast = makeForecast({ wave_height: "3 ft" });

    const uniforms = forecastToOceanUniforms(forecast);

    expect(uniforms.windChop).toBe(0);
    expect(uniforms.wave3.amplitude).toBe(0);
  });

  it("sets tideOffset to 0 when tide_height is null", () => {
    const forecast = makeForecast({ wave_height: "3 ft", tide_height: null });

    const uniforms = forecastToOceanUniforms(forecast);

    expect(uniforms.tideOffset).toBe(0);
  });
});

// ── parseSwellToWaveParams ────────────────────────────────────────────────────

describe("parseSwellToWaveParams", () => {
  it('parses "4-6 ft" height to a scene-scaled amplitude', () => {
    // midpoint 5 ft → 1.524 m → 1.524 * 0.1 * 2.5 = 0.381
    const params = parseSwellToWaveParams("4-6 ft", "10 s", "SW");

    expect(params.amplitude).toBeCloseTo(0.381, 2);
  });

  it('"Flat" returns a small non-zero amplitude wave (parseWaveHeight returns 0.15 m for "flat")', () => {
    // parseWaveHeight("Flat") returns 0.15 — a sentinel small-wave value, not 0
    // amplitude = 0.15 * 0.1 * 2.5 = 0.0375 → non-zero, so does NOT fall back to defaults
    const params = parseSwellToWaveParams("Flat", "10 s", "SW");

    expect(params.amplitude).toBeCloseTo(0.0375, 3);
    // Should NOT be the default amplitude
    expect(params.amplitude).not.toBe(WAVE_DEFAULTS.wave1.amplitude);
  });

  it("returns a small sentinel wave when height is null (parseWaveHeight treats null as 'no data', not zero)", () => {
    // parseWaveHeight(null) returns 0.15 m — a sentinel small-wave value — because !null is true.
    // This means amplitude = 0.15 * 0.1 * 2.5 = 0.0375, which is > 0, so the zero-amplitude
    // guard does NOT fire and we get a small computed wave, not WAVE_DEFAULTS.wave1.
    const params = parseSwellToWaveParams(null, "10 s", "SW");

    expect(params.amplitude).toBeCloseTo(0.0375, 3);
    expect(params).not.toEqual(WAVE_DEFAULTS.wave1);
  });

  it("returns WAVE_DEFAULTS.wave1 when height is an unparseable string (zero-amplitude guard)", () => {
    // parseWaveHeight("N/A") finds no numeric tokens → returns null → ?? 0 → amplitude = 0
    // The guard `if (amplitude <= 0)` fires and returns WAVE_DEFAULTS.wave1.
    const params = parseSwellToWaveParams("N/A", "10 s", "SW");

    expect(params).toEqual(WAVE_DEFAULTS.wave1);
  });

  it("returns a small sentinel wave when all inputs are null", () => {
    // null height → parseWaveHeight returns 0.15 → amplitude = 0.0375 (non-zero)
    const params = parseSwellToWaveParams(null, null, null);

    expect(params.amplitude).toBeCloseTo(0.0375, 3);
  });

  it('"12 s" period produces correct deep-water frequency and speed', () => {
    // wavelength = 1.56 * 144 = 224.64 m
    // frequency = 2π / (224.64 * 0.1) ≈ 0.2797
    // speed = sqrt(9.81 * 224.64 / (2π)) * 0.1 ≈ 1.873
    const params = parseSwellToWaveParams("4 ft", "12 s", "SW");

    expect(params.frequency).toBeCloseTo(0.2797, 2);
    expect(params.speed).toBeCloseTo(1.873, 2);
  });

  it('"SW" direction maps to refracted vector toward shore', () => {
    // SW = 225° → travel 45° → raw [0.707, 0.707] → refracted toward [0, 1] with 0.65 factor
    const params = parseSwellToWaveParams("4 ft", "10 s", "SW");

    expect(params.direction[0]).toBeCloseTo(0.2658, 2);
    expect(params.direction[1]).toBeCloseTo(0.9640, 2);
  });

  it('"N" direction maps to refracted vector toward shore', () => {
    // N = 0° → travel 180° → raw [-1, 0] → refracted toward [0, 1] with 0.65 factor
    const params = parseSwellToWaveParams("4 ft", "10 s", "N");

    expect(params.direction[0]).toBeCloseTo(-0.4741, 2);
    expect(params.direction[1]).toBeCloseTo(0.8805, 2);
  });

  it('"E" direction maps to [cos(90°), sin(90°)] = [0, 1]', () => {
    const params = parseSwellToWaveParams("4 ft", "10 s", "E");

    expect(params.direction[0]).toBeCloseTo(0, 2);
    expect(params.direction[1]).toBeCloseTo(1, 2);
  });

  it("returns minimum steepness for very short-period waves", () => {
    // "10 ft" + "4 s": period clamped to 4 → t = 0 → steepness = 0.2
    const params = parseSwellToWaveParams("10 ft", "4 s", "SW");

    expect(params.steepness).toBeCloseTo(0.2, 2);
  });

  it("steepness stays below 0.8 for normal long-period swell", () => {
    // "4 ft" + "14 s": large wavelength keeps steepness well under the cap
    const params = parseSwellToWaveParams("4 ft", "14 s", "SW");

    expect(params.steepness).toBeLessThan(0.8);
  });

  it("uses wind direction degrees as fallback when cardinal text is null", () => {
    // Wind dir deg 270 = W → travel 90° → raw [0, 1] → refracted = [0, 1]
    const params = parseSwellToWaveParams("4 ft", "10 s", null, 270);

    expect(params.direction[0]).toBeCloseTo(0, 1);
    expect(params.direction[1]).toBeCloseTo(1, 2);
  });

  it("falls back to WAVE_DEFAULTS.wave1.direction when both direction inputs are null", () => {
    const params = parseSwellToWaveParams("4 ft", "10 s", null, null);

    expect(params.direction).toEqual(WAVE_DEFAULTS.wave1.direction);
  });
});

// ── windToChopParams ──────────────────────────────────────────────────────────

describe("windToChopParams", () => {
  it('"10 mph" produces chopIntensity ≈ 0.667 and correct amplitude', () => {
    // windSpeedMph = 10 → chopIntensity = 10/15 = 0.6667
    // windSpeedMps = 10 * 0.44704 = 4.4704 → amplitude = min(4.4704 * 0.005, 0.05) = 0.02235
    const { chop, chopIntensity } = windToChopParams("10 mph", "W");

    expect(chopIntensity).toBeCloseTo(0.667, 2);
    expect(chop.amplitude).toBeCloseTo(0.02235, 3);
  });

  it('"0 mph" produces chopIntensity = 0 and amplitude = 0', () => {
    const { chop, chopIntensity } = windToChopParams("0 mph", "W");

    expect(chopIntensity).toBe(0);
    expect(chop.amplitude).toBe(0);
  });

  it('"15 mph" caps chopIntensity at exactly 1.0', () => {
    // 15 / 15 = 1.0 — the cap boundary
    const { chopIntensity } = windToChopParams("15 mph", "W");

    expect(chopIntensity).toBeCloseTo(1.0, 2);
  });

  it("speeds above 15 mph do not exceed chopIntensity of 1.0", () => {
    const { chopIntensity } = windToChopParams("25 mph", "W");

    expect(chopIntensity).toBe(1.0);
  });

  it("null wind speed gives zero amplitude and zero chopIntensity", () => {
    const { chop, chopIntensity } = windToChopParams(null, null);

    expect(chopIntensity).toBe(0);
    expect(chop.amplitude).toBe(0);
  });

  it("undefined wind speed gives zero amplitude and zero chopIntensity", () => {
    const { chop, chopIntensity } = windToChopParams(undefined, undefined);

    expect(chopIntensity).toBe(0);
    expect(chop.amplitude).toBe(0);
  });

  it("chop frequency is 3× the default primary swell frequency", () => {
    const { chop } = windToChopParams("10 mph", "W");

    expect(chop.frequency).toBeCloseTo(WAVE_DEFAULTS.wave1.frequency * 3, 4);
  });

  it("chop speed matches WAVE_DEFAULTS.wave3.speed", () => {
    const { chop } = windToChopParams("10 mph", "W");

    expect(chop.speed).toBe(WAVE_DEFAULTS.wave3.speed);
  });

  it('"W" direction maps to refracted vector toward shore [0, 1]', () => {
    const { chop } = windToChopParams("10 mph", "W");

    expect(chop.direction[0]).toBeCloseTo(0, 1);
    expect(chop.direction[1]).toBeCloseTo(1, 2);
  });

  it("amplitude is capped at 0.05 for very high wind speeds", () => {
    // 50 mph → 22.35 m/s → 22.35 * 0.005 = 0.1118 > 0.05 → capped
    const { chop } = windToChopParams("50 mph", "W");

    expect(chop.amplitude).toBe(0.05);
  });
});

// ── parseTideOffset ───────────────────────────────────────────────────────────

describe("parseTideOffset", () => {
  it('"3.0 ft" (at average) returns an offset near zero', () => {
    // (3.0 - 3.0) * 0.3048 * 0.1 = 0
    expect(parseTideOffset("3.0 ft")).toBeCloseTo(0, 4);
  });

  it('"5.0 ft" (high tide) returns a positive offset', () => {
    // (5.0 - 3.0) * 0.3048 * 0.1 = 0.06096
    expect(parseTideOffset("5.0 ft")).toBeCloseTo(0.061, 2);
  });

  it('"1.0 ft" (low tide) returns a negative offset', () => {
    // (1.0 - 3.0) * 0.3048 * 0.1 = -0.06096
    expect(parseTideOffset("1.0 ft")).toBeCloseTo(-0.061, 2);
  });

  it("returns 0 for null input", () => {
    expect(parseTideOffset(null)).toBe(0);
  });

  it("returns 0 for undefined input", () => {
    expect(parseTideOffset(undefined)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseTideOffset("")).toBe(0);
  });

  it('returns 0 for a non-numeric string like "invalid"', () => {
    expect(parseTideOffset("invalid")).toBe(0);
  });

  it('"3.2 ft (rising)" parses the numeric part and ignores the annotation', () => {
    // (3.2 - 3.0) * 0.3048 * 0.1 = 0.2 * 0.03048 = 0.006096
    expect(parseTideOffset("3.2 ft (rising)")).toBeCloseTo(0.0061, 3);
  });

  it('"0 ft" (extreme low) returns the correct negative offset', () => {
    // (0.0 - 3.0) * 0.3048 * 0.1 = -0.09144
    expect(parseTideOffset("0 ft")).toBeCloseTo(-0.0914, 3);
  });

  it("offset scales linearly with height difference", () => {
    const offset4 = parseTideOffset("4.0 ft");
    const offset5 = parseTideOffset("5.0 ft");

    // Each additional foot adds 0.3048 * 0.1 = 0.03048
    expect(offset5 - offset4).toBeCloseTo(0.03048, 4);
  });
});

// ── computeTimeOfDay ──────────────────────────────────────────────────────────

describe("computeTimeOfDay", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("always returns a value in the 0-1 range", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T12:00:00Z"));

    const result = computeTimeOfDay(null);

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("uses wall-clock fraction when sunTimes is null", () => {
    // Set clock to exactly noon UTC; local midnight of that date = 2026-03-04T00:00:00Z
    // msSinceMidnight = 12 * 3600 * 1000 = 43_200_000
    // msPerDay = 86_400_000
    // rawFraction = 0.5
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T12:00:00.000Z"));

    const result = computeTimeOfDay(null);

    // rawFraction is computed in local time; we can only assert it is in range
    // because offset depends on the test runner's timezone (set to UTC by jest.tz-setup.js)
    expect(result).toBeCloseTo(0.5, 2);
  });

  it("uses wall-clock fraction when sunTimes is provided but sunrise/sunset are null", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T06:00:00.000Z"));

    const result = computeTimeOfDay({ sunrise: null, sunset: null });

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("maps noon (midpoint of daylight) to 0.5 when sunrise/sunset straddle current time", () => {
    // Sunrise 06:00, sunset 18:00; current time is noon (12:00)
    // posInDay = 6h, dayDuration = 12h → 0.25 + (6/12) * 0.5 = 0.5
    jest.useFakeTimers();
    const date = "2026-03-04";
    jest.setSystemTime(new Date(`${date}T12:00:00.000Z`));

    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const result = computeTimeOfDay({ sunrise, sunset });

    expect(result).toBeCloseTo(0.5, 2);
  });

  it("returns 0.25 at sunrise (start of daylight arc)", () => {
    // When current time == sunrise, posInDay = 0 → 0.25 + 0 = 0.25
    jest.useFakeTimers();
    const date = "2026-03-04";
    jest.setSystemTime(new Date(`${date}T06:00:00.000Z`));

    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const result = computeTimeOfDay({ sunrise, sunset });

    expect(result).toBeCloseTo(0.25, 2);
  });

  it("returns 0.75 at sunset (end of daylight arc)", () => {
    // When current time == sunset, posInDay == dayDuration → 0.25 + (1) * 0.5 = 0.75
    jest.useFakeTimers();
    const date = "2026-03-04";
    jest.setSystemTime(new Date(`${date}T18:00:00.000Z`));

    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const result = computeTimeOfDay({ sunrise, sunset });

    expect(result).toBeCloseTo(0.75, 2);
  });

  it("uses raw wall-clock fraction before sunrise", () => {
    // Current time 04:00, sunrise 06:00 → before daylight arc → rawFraction
    // rawFraction at 04:00 UTC = 4/24 = 0.1667
    jest.useFakeTimers();
    const date = "2026-03-04";
    jest.setSystemTime(new Date(`${date}T04:00:00.000Z`));

    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const result = computeTimeOfDay({ sunrise, sunset });

    // Must be the raw fraction — outside the 0.25-0.75 daylight band
    expect(result).toBeLessThan(0.25);
    expect(result).toBeCloseTo(4 / 24, 2);
  });

  it("uses raw wall-clock fraction after sunset", () => {
    // Current time 21:00 UTC, sunset 18:00 → after daylight arc
    // rawFraction = 21/24 = 0.875
    jest.useFakeTimers();
    const date = "2026-03-04";
    jest.setSystemTime(new Date(`${date}T21:00:00.000Z`));

    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const result = computeTimeOfDay({ sunrise, sunset });

    expect(result).toBeGreaterThan(0.75);
    expect(result).toBeCloseTo(21 / 24, 2);
  });

  it("daylight result is always within the 0.25 - 0.75 band", () => {
    // Step through several times during daylight and confirm range
    const date = "2026-03-04";
    const sunrise = new Date(`${date}T06:00:00.000Z`);
    const sunset = new Date(`${date}T18:00:00.000Z`);

    const hoursDuringDay = [6, 8, 10, 12, 14, 16, 18];

    for (const h of hoursDuringDay) {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(`${date}T${String(h).padStart(2, "0")}:00:00.000Z`));

      const result = computeTimeOfDay({ sunrise, sunset });

      expect(result).toBeGreaterThanOrEqual(0.25);
      expect(result).toBeLessThanOrEqual(0.75);

      jest.useRealTimers();
    }
  });
});

// ── computeWindSwellAlignment ────────────────────────────────────────────────

describe("computeWindSwellAlignment", () => {
  it("returns 0 for onshore wind (wind and swell same direction)", () => {
    // Wind from W (270°), swell from W → same direction = onshore
    expect(computeWindSwellAlignment(270, "W", "10 mph")).toBeCloseTo(0, 2);
  });

  it("returns 1.0 for offshore wind (wind opposite to swell)", () => {
    // Wind from E (90°), swell from W (270°) → 180° apart = offshore
    expect(computeWindSwellAlignment(90, "W", "10 mph")).toBeCloseTo(1.0, 2);
  });

  it("returns 0.5 for cross-shore wind", () => {
    // Wind from N (0°), swell from W (270°) → 90° apart = cross-shore
    expect(computeWindSwellAlignment(0, "W", "10 mph")).toBeCloseTo(0.5, 2);
  });

  it("returns 1.0 for light wind (<3 mph) regardless of direction", () => {
    expect(computeWindSwellAlignment(270, "W", "2 mph")).toBe(1.0);
    expect(computeWindSwellAlignment(270, "W", "0 mph")).toBe(1.0);
  });

  it("returns 0.5 for null wind direction", () => {
    expect(computeWindSwellAlignment(null, "W", "10 mph")).toBeCloseTo(0.5, 2);
  });

  it("returns 0.5 for null swell direction", () => {
    expect(computeWindSwellAlignment(270, null, "10 mph")).toBeCloseTo(0.5, 2);
  });

  it("returns 1.0 for null wind speed (treated as calm)", () => {
    expect(computeWindSwellAlignment(270, "W", null)).toBe(1.0);
  });
});

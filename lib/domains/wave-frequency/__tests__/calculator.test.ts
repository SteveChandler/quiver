import { calculateRideableWaves } from "../calculator";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal valid forecast factory */
function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: "test-forecast-1",
    beach_id: "beach-1",
    forecast_at: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour from now
    forecast_date: "2026-03-18",
    forecast_time: "08:00:00",
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
    wind_direction: "W",
    wind_direction_deg: null,
    water_temp: null,
    tide_status: null,
    tide_height: "2.5",
    next_tide_time: null,
    next_tide_type: null,
    next_tide_height: null,
    next_tide_at: null,
    coops_station_id: null,
    air_temperature: null,
    weather_condition: "Clear",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tide_type: null,
    swell_period: 14,
    ...overrides,
  } as EnhancedForecastEntity;
}

/** Minimal valid beach factory — west-facing beach break */
function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "Test City",
    state: "CA",
    country: "US",
    center_lat: 34.0,
    center_lng: -118.0,
    break_type: "beach",
    aspect_deg: 270, // west-facing
    swell_access_factors: Array(72).fill(0.8), // uniform access
    // Required Beach fields with safe defaults
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Beach;
}

// ---------------------------------------------------------------------------
// Task 1: Guard T2 division by zero
// ---------------------------------------------------------------------------

describe("Task 1: T2 division-by-zero guard", () => {
  test("swell_2_period of '0' does not crash or produce Infinity", () => {
    const forecast = makeForecast({ swell_2_period: "0", swell_2_height: "3" });
    const beach = makeBeach();
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).not.toBeNaN();
    expect(result.rideableWavesPerHour).not.toBe(Infinity);
    expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
  });

  test("swell_2_period of '0.3' (below 1s threshold) does not crash or produce Infinity", () => {
    const forecast = makeForecast({ swell_2_period: "0.3", swell_2_height: "3" });
    const beach = makeBeach();
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).not.toBeNaN();
    expect(result.rideableWavesPerHour).not.toBe(Infinity);
    expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
  });

  test("valid swell_2_period of '10' still processes normally", () => {
    const forecast = makeForecast({ swell_2_period: "10", swell_2_height: "3" });
    const beach = makeBeach();
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 2: Multi-swell energy gate
// ---------------------------------------------------------------------------

describe("Task 2: Multi-swell energy gate", () => {
  test("trivial 0.5ft secondary swell should NOT dramatically change output vs single swell", () => {
    const beachWithAccess = makeBeach({
      swell_access_factors: Array(72).fill(0.8),
    });

    // Single swell baseline
    const singleSwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: null,
      swell_2_period: null,
    });
    const baseResult = calculateRideableWaves(singleSwell, beachWithAccess);

    // Adding trivial secondary swell
    const withTrivialSwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: "0.5",
      swell_2_period: "8",
    });
    const withTrivialResult = calculateRideableWaves(withTrivialSwell, beachWithAccess);

    // Adding a trivial swell should not drop the frequency by more than 25%
    expect(withTrivialResult.rideableWavesPerHour).toBeGreaterThan(
      baseResult.rideableWavesPerHour * 0.75
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3: Multi-swell double penalty on break factor
// ---------------------------------------------------------------------------

describe("Task 3: Multi-swell break factor double penalty", () => {
  test("adding a complementary swell should NOT drop frequency by more than 50%", () => {
    const beach = makeBeach({
      swell_access_factors: Array(72).fill(0.8),
    });

    // Single swell baseline
    const singleSwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: null,
      swell_2_period: null,
    });
    const baseResult = calculateRideableWaves(singleSwell, beach);

    // Complementary second swell (significantly different period)
    const withComplementarySwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: "2",
      swell_2_period: "8",
    });
    const withSwellResult = calculateRideableWaves(withComplementarySwell, beach);

    // Adding a swell should not reduce frequency by more than 50%
    expect(withSwellResult.rideableWavesPerHour).toBeGreaterThan(
      baseResult.rideableWavesPerHour * 0.5
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4: Swell access considers secondary swell
// ---------------------------------------------------------------------------

describe("Task 4: Secondary swell access factor", () => {
  test("if primary is blocked but secondary is perfectly aligned, should NOT return 0", () => {
    // Build a beach facing west (aspect_deg=270) with directional access factors.
    // West swell (270°) has good access; South swell (180°) is blocked.
    const accessFactors = Array(72).fill(0.0);
    // West bin: 270/5 = bin 54 -> good access
    accessFactors[54] = 0.9;
    // South bin: 180/5 = bin 36 -> blocked
    accessFactors[36] = 0.0;

    const beach = makeBeach({
      aspect_deg: 270,
      swell_access_factors: accessFactors,
    });

    const forecast = makeForecast({
      swell_1_direction: "S",   // primary swell is blocked (S at W-facing beach)
      swell_2_direction: "W",   // secondary swell is perfectly aligned
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: "2",
      swell_2_period: "8",
    });

    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task 5: aspect_deg null/undefined guard
// ---------------------------------------------------------------------------

describe("Task 5: aspect_deg null/undefined guard", () => {
  test("aspect_deg as undefined does not crash; windPenalty defaults to 1.0", () => {
    const beach = makeBeach({ aspect_deg: undefined as unknown as number });
    const forecast = makeForecast({ wind_speed: "20 mph", wind_direction: "W" });
    expect(() => calculateRideableWaves(forecast, beach)).not.toThrow();
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });

  test("aspect_deg as null does not crash", () => {
    const beach = makeBeach({ aspect_deg: null as unknown as number });
    const forecast = makeForecast({ wind_speed: "20 mph", wind_direction: "W" });
    expect(() => calculateRideableWaves(forecast, beach)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Task 6: Quadratic short period penalty
// ---------------------------------------------------------------------------

describe("Task 6: Quadratic short period penalty", () => {
  test("5s period at 2.5ft should be under 50 waves/hr (linear penalty was too lenient)", () => {
    const beach = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(1.0),
    });
    const forecast = makeForecast({
      wave_height: "2-3 ft",
      swell_1_height: "2.5",
      swell_1_period: "5",
      swell_2_height: null,
      swell_2_period: null,
      wind_speed: "0 mph",
    });
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Task 7: Regression test suite
// ---------------------------------------------------------------------------

describe("Task 7: Regression tests", () => {
  test("clean groundswell: 14s period, 4ft, offshore wind → reasonable output (10-40 waves/hr)", () => {
    const beach = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(0.8),
    });
    // Offshore wind = from the east (90°) at a west-facing beach (aspect_deg=270)
    const forecast = makeForecast({
      wave_height: "4-5 ft",
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      swell_2_height: null,
      swell_2_period: null,
      wind_speed: "10 mph",
      wind_direction: "E",
      wind_direction_deg: 90,
    });
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(10);
    expect(result.rideableWavesPerHour).toBeLessThanOrEqual(40);
  });

  test("flat conditions (wave_height below threshold) → 0 waves/hr", () => {
    const beach = makeBeach({ break_type: "beach" });
    const forecast = makeForecast({ wave_height: "1 ft" });
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBe(0);
  });

  test("no period data → 0 waves/hr", () => {
    const beach = makeBeach();
    const forecast = makeForecast({
      swell_1_period: null,
      wave_period: null,
    });
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBe(0);
  });

  test("strong onshore wind reduces frequency compared to calm", () => {
    const beach = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(0.8),
    });
    const calmForecast = makeForecast({
      wave_height: "4-5 ft",
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      wind_speed: "0 mph",
      wind_direction: "W",
    });
    const onshoreForecast = makeForecast({
      wave_height: "4-5 ft",
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      wind_speed: "25 mph",
      wind_direction: "W",  // onshore at west-facing beach
      wind_direction_deg: 270,
    });
    const calm = calculateRideableWaves(calmForecast, beach);
    const onshore = calculateRideableWaves(onshoreForecast, beach);
    expect(onshore.rideableWavesPerHour).toBeLessThan(calm.rideableWavesPerHour);
  });

  test("point break has lower factor than beach break", () => {
    const baseForecast = makeForecast({
      wave_height: "4-5 ft",
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      swell_2_height: null,
      swell_2_period: null,
      wind_speed: "0 mph",
    });
    const beachBreak = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(1.0),
    });
    const pointBreak = makeBeach({
      break_type: "point",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(1.0),
    });
    const beachResult = calculateRideableWaves(baseForecast, beachBreak);
    const pointResult = calculateRideableWaves(baseForecast, pointBreak);
    expect(pointResult.rideableWavesPerHour).toBeLessThan(beachResult.rideableWavesPerHour);
  });
});

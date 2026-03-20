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
    const forecast = makeForecast({
      wave_height: "1 ft",
      swell_1_height: null,
      swell_2_height: null,
      wind_wave_height: null,
    });
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

// ---------------------------------------------------------------------------
// Tide Height Factor
// ---------------------------------------------------------------------------

describe("Tide height factor", () => {
  const baseForecast = () =>
    makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      wind_speed: "0 mph",
    });

  test("null tide_height → no penalty (factor 1.0), output matches no-tide baseline", () => {
    const beach = makeBeach({ break_type: "reef", swell_access_factors: Array(72).fill(1.0) });
    const withTide = calculateRideableWaves(baseForecast(), beach);
    const noTide = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: null }),
      beach
    );
    expect(withTide.rideableWavesPerHour).toBe(noTide.rideableWavesPerHour);
  });

  test("non-numeric tide_height → no penalty", () => {
    const beach = makeBeach({ break_type: "reef", swell_access_factors: Array(72).fill(1.0) });
    const result = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "N/A" }),
      beach
    );
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });

  test("tide within preferred range → no penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const inRange = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "3.0" }),
      beach
    );
    const noTide = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: null }),
      beach
    );
    expect(inRange.rideableWavesPerHour).toBe(noTide.rideableWavesPerHour);
  });

  test("reef 1ft outside preferred range → meaningful reduction (~20%)", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const inRange = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "3.0" }),
      beach
    );
    const outside1ft = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "5.0" }),
      beach
    );
    // Should be noticeably reduced but not destroyed
    expect(outside1ft.rideableWavesPerHour).toBeLessThan(inRange.rideableWavesPerHour);
    expect(outside1ft.rideableWavesPerHour).toBeGreaterThan(inRange.rideableWavesPerHour * 0.5);
  });

  test("reef far outside preferred range → hits floor (0.3x)", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const inRange = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "3.0" }),
      beach
    );
    const farOutside = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "7.0" }),
      beach
    );
    // Should be severely reduced — near the 0.3 floor
    expect(farOutside.rideableWavesPerHour).toBeLessThanOrEqual(
      Math.round(inRange.rideableWavesPerHour * 0.4)
    );
  });

  test("beach break outside range → mild penalty (floor 0.75)", () => {
    const beach = makeBeach({
      break_type: "beach",
      preferred_tide_ft_min: 1.0,
      preferred_tide_ft_max: 3.0,
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const inRange = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "2.0" }),
      beach
    );
    const outside2ft = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "5.0" }),
      beach
    );
    // Beach breaks are forgiving — even 2ft outside should keep > 75% (floor is 0.75)
    expect(outside2ft.rideableWavesPerHour).toBeGreaterThan(
      inRange.rideableWavesPerHour * 0.7
    );
  });

  test("negative tide height below preferred range applies penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_ft_min: 1.0,
      preferred_tide_ft_max: 4.0,
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const inRange = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "2.5" }),
      beach
    );
    const negative = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "-1.0" }),
      beach
    );
    // -1.0 is 2ft below min (1.0), which equals reef falloff → at floor
    expect(negative.rideableWavesPerHour).toBeLessThan(inRange.rideableWavesPerHour);
  });

  test("default range used when beach has no tide preferences", () => {
    const beach = makeBeach({
      break_type: "reef",
      swell_access_factors: Array(72).fill(1.0),
    });

    // Default range is 1.0–4.0, so 3.0 is in range → no penalty
    const inDefault = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "3.0" }),
      beach
    );
    // 7.0 is far outside default range → significant penalty
    const farOutside = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "7.0" }),
      beach
    );
    expect(farOutside.rideableWavesPerHour).toBeLessThan(inDefault.rideableWavesPerHour);
  });
});

// ---------------------------------------------------------------------------
// Tide Direction Factor
// ---------------------------------------------------------------------------

describe("Tide direction factor", () => {
  const baseForecast = () =>
    makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      wind_speed: "0 mph",
      tide_height: "3.0", // in default range to isolate direction effect
    });

  test("null tide_status → no penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "rising",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const noStatus = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: null }),
      beach
    );
    const noPreference = calculateRideableWaves(
      baseForecast(),
      makeBeach({ break_type: "reef", swell_access_factors: Array(72).fill(1.0) })
    );
    expect(noStatus.rideableWavesPerHour).toBe(noPreference.rideableWavesPerHour);
  });

  test("preferred_tide_direction 'either' → no penalty regardless of status", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "either",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const rising = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      beach
    );
    const falling = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "falling" }),
      beach
    );
    expect(rising.rideableWavesPerHour).toBe(falling.rideableWavesPerHour);
  });

  test("matching tide direction → no penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "rising",
      tide_direction_sensitivity: "high",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const match = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      beach
    );
    const noPreference = calculateRideableWaves(
      baseForecast(),
      makeBeach({ break_type: "reef", swell_access_factors: Array(72).fill(1.0) })
    );
    expect(match.rideableWavesPerHour).toBe(noPreference.rideableWavesPerHour);
  });

  test("mismatched direction on high-sensitivity reef → 0.6x penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "rising",
      tide_direction_sensitivity: "high",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const match = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      beach
    );
    const mismatch = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "falling" }),
      beach
    );
    expect(mismatch.rideableWavesPerHour).toBeLessThan(match.rideableWavesPerHour);
    // Should be roughly 60% of match (high sensitivity = 0.6 penalty)
    expect(mismatch.rideableWavesPerHour).toBeLessThanOrEqual(
      Math.round(match.rideableWavesPerHour * 0.7)
    );
  });

  test("mismatched direction on low-sensitivity point → mild penalty (0.95x)", () => {
    const beach = makeBeach({
      break_type: "point",
      preferred_tide_direction: "falling",
      tide_direction_sensitivity: "low",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const match = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "falling" }),
      beach
    );
    const mismatch = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      beach
    );
    // Low sensitivity → very mild penalty
    expect(mismatch.rideableWavesPerHour).toBeGreaterThanOrEqual(
      match.rideableWavesPerHour - 2 // rounding tolerance
    );
  });

  test("slack tide when direction preferred → intermediate penalty", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "rising",
      tide_direction_sensitivity: "high",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const match = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      beach
    );
    const slack = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "slack" }),
      beach
    );
    const mismatch = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "falling" }),
      beach
    );
    // Slack should be between match and full mismatch
    expect(slack.rideableWavesPerHour).toBeLessThanOrEqual(match.rideableWavesPerHour);
    expect(slack.rideableWavesPerHour).toBeGreaterThanOrEqual(mismatch.rideableWavesPerHour);
  });

  test("sensitivity defaults from break type when not set explicitly", () => {
    // Reef defaults to high sensitivity
    const reefBeach = makeBeach({
      break_type: "reef",
      preferred_tide_direction: "rising",
      // no tide_direction_sensitivity → should default to "high"
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const match = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "rising" }),
      reefBeach
    );
    const mismatch = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_status: "falling" }),
      reefBeach
    );
    // High sensitivity → significant penalty
    expect(mismatch.rideableWavesPerHour).toBeLessThanOrEqual(
      Math.round(match.rideableWavesPerHour * 0.7)
    );
  });
});

// ---------------------------------------------------------------------------
// Combined Tide Factors
// ---------------------------------------------------------------------------

describe("Combined tide factors", () => {
  const baseForecast = () =>
    makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_1_direction: "W",
      wind_speed: "0 mph",
    });

  test("worst case reef: wrong height AND wrong direction → near shutdown", () => {
    const beach = makeBeach({
      break_type: "reef",
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: "rising",
      tide_direction_sensitivity: "high",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const optimal = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "3.0", tide_status: "rising" }),
      beach
    );
    const worst = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "7.0", tide_status: "falling" }),
      beach
    );
    // 0.3 × 0.6 = 0.18 → should be < 25% of optimal
    expect(worst.rideableWavesPerHour).toBeLessThanOrEqual(
      Math.round(optimal.rideableWavesPerHour * 0.25)
    );
  });

  test("forgiving beach: wrong height, wrong direction → still surfable", () => {
    const beach = makeBeach({
      break_type: "beach",
      preferred_tide_ft_min: 1.0,
      preferred_tide_ft_max: 3.0,
      preferred_tide_direction: "rising",
      tide_direction_sensitivity: "low",
      swell_access_factors: Array(72).fill(1.0),
    } as Partial<Beach>);

    const worst = calculateRideableWaves(
      makeForecast({ ...baseForecast(), tide_height: "5.0", tide_status: "falling" }),
      beach
    );
    // Beach break floor is 0.75, low sensitivity mismatch is 0.95 → 0.71
    // Should still produce waves
    expect(worst.rideableWavesPerHour).toBeGreaterThan(0);
  });

  test("existing regression: clean groundswell still in range with tide data", () => {
    const beach = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(0.8),
    });
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
      tide_height: "2.5", // in default range
      tide_status: null,
    });
    const result = calculateRideableWaves(forecast, beach);
    expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(10);
    expect(result.rideableWavesPerHour).toBeLessThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// Three-Swell Grouping
// ---------------------------------------------------------------------------

describe("Three-swell grouping", () => {
  const baseBeach = () =>
    makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: Array(72).fill(0.8),
    });

  test("three distinct swells produces higher frequency than two-swell equivalent", () => {
    const beach = baseBeach();

    const twoSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: null,
        wind_wave_period: null,
        wind_speed: "0 mph",
      }),
      beach
    );

    const threeSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: "2",
        wind_wave_period: "6",
        wind_wave_direction: "W",
        wind_speed: "0 mph",
      }),
      beach
    );

    expect(threeSwell.rideableWavesPerHour).toBeGreaterThan(twoSwell.rideableWavesPerHour);
  });

  test("three groundswells (NW + S + W) — California winter scenario", () => {
    const beach = baseBeach();

    const threeSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_1_direction: "NW",
        swell_2_height: "2",
        swell_2_period: "16",
        swell_2_direction: "S",
        wind_wave_height: "2",
        wind_wave_period: "8",
        wind_wave_direction: "W",
        wind_speed: "0 mph",
      }),
      beach
    );

    // Three distinct groundswells should produce meaningful wave count
    expect(threeSwell.rideableWavesPerHour).toBeGreaterThan(0);
    // And more than single swell baseline
    const singleSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_1_direction: "NW",
        swell_2_height: null,
        swell_2_period: null,
        wind_wave_height: null,
        wind_wave_period: null,
        wind_speed: "0 mph",
      }),
      beach
    );
    expect(threeSwell.rideableWavesPerHour).toBeGreaterThan(singleSwell.rideableWavesPerHour);
  });

  test("wind wave below energy gate → falls back to two-swell path", () => {
    const beach = baseBeach();

    const twoSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: null,
        wind_wave_period: null,
        wind_speed: "0 mph",
      }),
      beach
    );

    // Tiny wind chop that doesn't meet energy threshold
    const withTinyChop = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: "0.3",
        wind_wave_period: "4",
        wind_speed: "0 mph",
      }),
      beach
    );

    // Should produce same result — tiny chop doesn't cross energy gate
    expect(withTinyChop.rideableWavesPerHour).toBe(twoSwell.rideableWavesPerHour);
  });

  test("third swell with period too similar to primary → no additional grouping", () => {
    const beach = baseBeach();

    const twoSwell = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: null,
        wind_wave_period: null,
        wind_speed: "0 mph",
      }),
      beach
    );

    // Third swell at 14.5s — too close to primary 14s for meaningful beat
    const similarPeriod = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: "2",
        wind_wave_period: "14.5",
        wind_speed: "0 mph",
      }),
      beach
    );

    // The T3-T1 pair (14.5-14=0.5 < 1.0 threshold) won't generate a beat.
    // But T3-T2 pair (14.5-10=4.5) WILL generate a valid beat → still higher.
    expect(similarPeriod.rideableWavesPerHour).toBeGreaterThanOrEqual(twoSwell.rideableWavesPerHour);
  });

  test("third swell direction extends access factor consideration", () => {
    // Beach where primary swell is blocked, secondary is blocked, but wind wave is aligned
    const accessFactors = Array(72).fill(0.1); // mostly blocked
    accessFactors[54] = 0.9; // W bin (270/5 = 54) — good access

    const beach = makeBeach({
      break_type: "beach",
      aspect_deg: 270,
      swell_access_factors: accessFactors,
    });

    // Primary and secondary from blocked directions, wind wave from W
    const forecast = makeForecast({
      swell_1_height: "3",
      swell_1_period: "14",
      swell_1_direction: "N", // blocked
      swell_2_height: "2",
      swell_2_period: "10",
      swell_2_direction: "N", // blocked
      wind_wave_height: "2",
      wind_wave_period: "6",
      wind_wave_direction: "W", // aligned
      wind_speed: "0 mph",
    });

    const result = calculateRideableWaves(forecast, beach);
    // Access factor should pick up the wind wave's W direction (0.9)
    // rather than being stuck at the blocked N direction (0.1)
    expect(result.rideableWavesPerHour).toBeGreaterThan(0);
  });

  test("three-swell boost is proportional to third swell energy", () => {
    const beach = baseBeach();

    const smallThird = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: "1.5",
        wind_wave_period: "6",
        wind_speed: "0 mph",
      }),
      beach
    );

    const largeThird = calculateRideableWaves(
      makeForecast({
        swell_1_height: "4",
        swell_1_period: "14",
        swell_2_height: "2",
        swell_2_period: "10",
        wind_wave_height: "4",
        wind_wave_period: "6",
        wind_speed: "0 mph",
      }),
      beach
    );

    // Larger third swell → more additional wave events
    expect(largeThird.rideableWavesPerHour).toBeGreaterThanOrEqual(smallThird.rideableWavesPerHour);
  });

  test("existing two-swell regression tests remain unchanged", () => {
    // Reproduce the exact Task 3 test — adding complementary swell
    const beach = makeBeach({ swell_access_factors: Array(72).fill(0.8) });
    const singleSwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: null,
      swell_2_period: null,
      wind_wave_height: null,
      wind_wave_period: null,
    });
    const baseResult = calculateRideableWaves(singleSwell, beach);

    const withSwell = makeForecast({
      swell_1_height: "4",
      swell_1_period: "14",
      swell_2_height: "2",
      swell_2_period: "8",
      wind_wave_height: null,
      wind_wave_period: null,
    });
    const withSwellResult = calculateRideableWaves(withSwell, beach);

    // Same constraint as Task 3: adding a swell should not reduce by > 50%
    expect(withSwellResult.rideableWavesPerHour).toBeGreaterThan(
      baseResult.rideableWavesPerHour * 0.5
    );
  });
});

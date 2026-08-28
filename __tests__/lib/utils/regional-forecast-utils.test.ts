/**
 * Tests for Regional Forecast Utilities
 */

import {
  getBeachesForRegion,
  calculateDayScore,
  detectSwellEvents,
  aggregateRegionalForecast,
  type DaySummary,
  type SwellEvent,
  type BeachConditionSummary,
} from "@/lib/utils/regional-forecast-utils";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock data
const mockRegion: ForecastRegion = {
  slug: "test-region",
  name: "Test Region",
  title: "Test Region Forecast",
  metaDescription: "Test region description",
  states: ["ca"],
  centerLat: 33.0,
  centerLon: -117.0,
  zoom: 10,
};

const mockRegionWithCities: ForecastRegion = {
  ...mockRegion,
  cities: ["San Diego", "Oceanside"],
};

const mockBeaches: Beach[] = [
  {
    id: "beach-1",
    name: "Test Beach 1",
    slug: "test-beach-1",
    city: "San Diego",
    state: "CA",
    center_lat: 32.85,
    center_lng: -117.25,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
  {
    id: "beach-2",
    name: "Test Beach 2",
    slug: "test-beach-2",
    city: "Oceanside",
    state: "CA",
    center_lat: 33.19,
    center_lng: -117.38,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
  {
    id: "beach-3",
    name: "Test Beach 3",
    slug: "test-beach-3",
    city: "Los Angeles",
    state: "CA",
    center_lat: 34.01,
    center_lng: -118.49,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
  {
    id: "beach-4",
    name: "Test Beach 4",
    slug: "test-beach-4",
    city: "Miami",
    state: "FL",
    center_lat: 25.76,
    center_lng: -80.19,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
];

function createMockForecast(
  beachId: string,
  date: string,
  time: string,
  overrides?: Partial<EnhancedForecastEntity>
): EnhancedForecastEntity {
  return {
    id: `forecast-${beachId}-${date}-${time}`,
    beach_id: beachId,
    forecast_at: `${date}T${time}Z`,
    forecast_date: date,
    forecast_time: time,
    wave_height: "2.0",
    wave_period: "13",
    wave_direction: "W",
    swell_1_height: "2.0",
    swell_1_period: "13",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    water_temp: "65",
    air_temperature: "70",
    wind_speed: "0",
    wind_direction: "E (offshore)",
    wind_direction_deg: 90,
    tide_status: "Rising",
    tide_height: "3.5",
    next_tide_time: "14:00",
    next_tide_type: "High",
    next_tide_height: "5.2",
    next_tide_at: null,
    coops_station_id: null,
    weather_condition: "Sunny",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    raw_forecast: null,
    ...overrides,
  };
}

describe("getBeachesForRegion", () => {
  it("should filter beaches by state", () => {
    const beaches = getBeachesForRegion(mockRegion, mockBeaches);
    expect(beaches).toHaveLength(3);
    expect(beaches.every((b) => b.state?.toLowerCase() === "ca")).toBe(true);
  });

  it("should filter beaches by state and cities", () => {
    const beaches = getBeachesForRegion(mockRegionWithCities, mockBeaches);
    expect(beaches).toHaveLength(2);
    expect(beaches.map((b) => b.id)).toEqual(["beach-1", "beach-2"]);
  });

  it("should return empty array when no beaches match", () => {
    const region: ForecastRegion = {
      ...mockRegion,
      states: ["tx"],
    };
    const beaches = getBeachesForRegion(region, mockBeaches);
    expect(beaches).toHaveLength(0);
  });

  it("should be case-insensitive for state matching", () => {
    const region: ForecastRegion = {
      ...mockRegion,
      states: ["CA"], // uppercase
    };
    const beaches = getBeachesForRegion(region, mockBeaches);
    expect(beaches).toHaveLength(3);
  });

  describe("latBounds filtering", () => {
    const beachAt33 = {
      id: "b-33",
      name: "Beach 33",
      slug: "beach-33",
      city: "San Diego",
      state: "CA",
      lat: 33.0,
      center_lat: 33.0,
      center_lng: -117.0,
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as Beach;

    const beachAt35 = {
      id: "b-35",
      name: "Beach 35",
      slug: "beach-35",
      city: "SLO",
      state: "CA",
      lat: 35.0,
      center_lat: 35.0,
      center_lng: -120.0,
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as Beach;

    const beachAt36 = {
      id: "b-36",
      name: "Beach 36",
      slug: "beach-36",
      city: "Santa Cruz",
      state: "CA",
      lat: 36.0,
      center_lat: 36.0,
      center_lng: -122.0,
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as Beach;

    const beachNullLat = {
      id: "b-null",
      name: "Beach Null",
      slug: "beach-null",
      city: "Unknown",
      state: "CA",
      lat: null,
      center_lat: null,
      center_lng: null,
      created_at: "2024-01-01T00:00:00Z",
    } as unknown as Beach;

    const allLatBeaches = [beachAt33, beachAt35, beachAt36, beachNullLat];

    it("should filter beaches by max latitude bound", () => {
      const region: ForecastRegion = { ...mockRegion, latBounds: { max: 35.0 } };
      const result = getBeachesForRegion(region, allLatBeaches);
      expect(result.map((b) => b.id)).toContain("b-33");
      expect(result.map((b) => b.id)).not.toContain("b-36");
    });

    it("should filter beaches by min latitude bound", () => {
      const region: ForecastRegion = { ...mockRegion, latBounds: { min: 35.0 } };
      const result = getBeachesForRegion(region, allLatBeaches);
      expect(result.map((b) => b.id)).toContain("b-36");
      expect(result.map((b) => b.id)).not.toContain("b-33");
    });

    it("should handle exact boundary value (max is exclusive)", () => {
      const regionMax: ForecastRegion = { ...mockRegion, latBounds: { max: 35.0 } };
      const regionMin: ForecastRegion = { ...mockRegion, latBounds: { min: 35.0 } };

      const maxResult = getBeachesForRegion(regionMax, [beachAt35]);
      const minResult = getBeachesForRegion(regionMin, [beachAt35]);

      // max is exclusive: beach at exactly 35.0 should NOT be in max:35.0
      expect(maxResult.map((b) => b.id)).not.toContain("b-35");
      // min is inclusive: beach at exactly 35.0 should be in min:35.0
      expect(minResult.map((b) => b.id)).toContain("b-35");
    });

    it("should include beaches with null lat in lat-bounded regions", () => {
      const region: ForecastRegion = { ...mockRegion, latBounds: { max: 35.0 } };
      const result = getBeachesForRegion(region, [beachNullLat]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("b-null");
    });

    it("should apply both min and max bounds together", () => {
      const region: ForecastRegion = { ...mockRegion, latBounds: { min: 33.0, max: 35.0 } };
      const beachAt32 = { ...beachAt33, id: "b-32", lat: 32.0, center_lat: 32.0 } as unknown as Beach;
      const beachAt34 = { ...beachAt33, id: "b-34", lat: 34.0, center_lat: 34.0 } as unknown as Beach;

      const result = getBeachesForRegion(region, [beachAt32, beachAt34, beachAt36]);
      expect(result.map((b) => b.id)).toEqual(["b-34"]);
    });
  });
});

describe("calculateDayScore", () => {
  it("should score ideal beginner wave height (1-3ft) highly", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "2.0",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("should score offshore winds highly", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("should score longer swell periods higher", () => {
    const shortPeriod = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "2.0",
        swell_1_period: "8",
      }),
    ];
    const longPeriod = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "2.0",
        swell_1_period: "15",
      }),
    ];

    const shortScore = calculateDayScore(shortPeriod, mockBeaches[0]);
    const longScore = calculateDayScore(longPeriod, mockBeaches[0]);

    expect(longScore).toBeGreaterThan(shortScore);
  });

  it("should return 0 for empty forecasts", () => {
    const score = calculateDayScore([], mockBeaches[0]);
    expect(score).toBe(0);
  });

  it("should handle missing data gracefully", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: null,
        wind_direction: null,
        swell_1_period: null,
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should use the best score across multiple forecasts", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "06:00", {
        wave_height: "0.3",
        wind_direction: "E (offshore)",
      }),
      createMockForecast("beach-1", "2024-01-15", "09:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
      }),
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "3.0",
        wind_direction: "W (onshore)",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("detectSwellEvents", () => {
  it("should detect a significant wave height increase", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();

    // Day 1: Small waves
    const day1Forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "2.0",
        swell_1_period: "8",
        swell_1_direction: "W",
      }),
    ];

    // Day 2: Swell arrives (>40% increase)
    const day2Forecasts = [
      createMockForecast("beach-1", "2024-01-16", "12:00", {
        wave_height: "5.0",
        swell_1_period: "14",
        swell_1_direction: "NW",
      }),
    ];

    // Day 3: Peak
    const day3Forecasts = [
      createMockForecast("beach-1", "2024-01-17", "12:00", {
        wave_height: "6.0",
        swell_1_period: "15",
        swell_1_direction: "NW",
      }),
    ];

    forecastMap.set("beach-1", [...day1Forecasts, ...day2Forecasts, ...day3Forecasts]);

    const events = detectSwellEvents(forecastMap);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const firstEvent = events[0];
    expect(firstEvent.heightRange[0]).toBeGreaterThan(3);
    expect(firstEvent.direction).toEqual(expect.any(String));
  });

  it("should not detect events for flat conditions", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "1.5",
      }),
      createMockForecast("beach-1", "2024-01-16", "12:00", {
        wave_height: "1.6",
      }),
      createMockForecast("beach-1", "2024-01-17", "12:00", {
        wave_height: "1.4",
      }),
    ];
    forecastMap.set("beach-1", forecasts);

    const events = detectSwellEvents(forecastMap);

    expect(events).toHaveLength(0);
  });

  it("should return empty array for empty forecast map", () => {
    const events = detectSwellEvents(new Map());
    expect(events).toHaveLength(0);
  });
});

/** Helper: return YYYY-MM-DD for today + offsetDays */
function futureDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

describe("aggregateRegionalForecast", () => {
  it("reports the newest source write represented by the summary", () => {
    const today = futureDateString(0);
    const yesterday = futureDateString(-1);
    const forecastMap = new Map<string, EnhancedForecastEntity[]>([
      [
        "beach-1",
        [
          createMockForecast("beach-1", yesterday, "09:00", {
            updated_at: "2026-08-27T22:00:00.000Z",
          }),
          createMockForecast("beach-1", today, "06:00", {
            updated_at: "2026-08-27T18:00:00.000Z",
          }),
          createMockForecast("beach-1", today, "09:00", {
            updated_at: "2026-08-27T21:00:00.000Z",
          }),
        ],
      ],
    ]);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
    );

    expect(summary.sourceDataUpdatedAt).toBe("2026-08-27T21:00:00.000Z");
  });

  it("should create 7-day forecast summary", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();

    // Create 7 days of forecasts for 2 beaches (today + 6 future days)
    for (let i = 0; i < 7; i++) {
      const dateString = futureDateString(i);

      const beach1Forecasts = [
        createMockForecast("beach-1", dateString, "06:00"),
        createMockForecast("beach-1", dateString, "12:00"),
        createMockForecast("beach-1", dateString, "18:00"),
      ];

      const beach2Forecasts = [
        createMockForecast("beach-2", dateString, "06:00"),
        createMockForecast("beach-2", dateString, "12:00"),
        createMockForecast("beach-2", dateString, "18:00"),
      ];

      forecastMap.set(
        "beach-1",
        (forecastMap.get("beach-1") || []).concat(beach1Forecasts)
      );
      forecastMap.set(
        "beach-2",
        (forecastMap.get("beach-2") || []).concat(beach2Forecasts)
      );
    }

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1]],
      forecastMap
    );

    expect(summary.days).toHaveLength(7);
    expect(summary.bestDay).toEqual(expect.objectContaining({ date: expect.any(Date) }));
    expect(summary.beachConditions).toHaveLength(2);
    expect(summary.stats.totalBeaches).toBe(2);
    expect(summary.stats.beachesWithData).toBe(2);
  });

  it("should identify best day correctly", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const today = futureDateString(0);
    const tomorrow = futureDateString(1);

    // Day 1 (today): Poor conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", today, "12:00", {
        wave_height: "0.3",
        wind_direction: "W (onshore)",
      }),
    ]);

    // Day 2 (tomorrow): Excellent conditions
    forecastMap.set("beach-1", [
      ...forecastMap.get("beach-1")!,
      createMockForecast("beach-1", tomorrow, "12:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
        swell_1_period: "14",
      }),
    ]);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap
    );

    expect(summary.bestDay.score).toBeGreaterThan(summary.days[0].score);
  });

  it("should handle beaches without forecast data", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();

    forecastMap.set("beach-1", [
      createMockForecast("beach-1", futureDateString(0), "12:00"),
    ]);
    // beach-2 has no data

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1]],
      forecastMap
    );

    expect(summary.beachConditions.length).toBeLessThanOrEqual(2);
    expect(summary.stats.beachesWithData).toBe(1);
    expect(summary.stats.totalBeaches).toBe(2);
  });

  it("should rank top beaches correctly", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const today = futureDateString(0);

    // Beach 1: Excellent conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", today, "12:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
        swell_1_period: "14",
      }),
    ]);

    // Beach 2: Poor conditions
    forecastMap.set("beach-2", [
      createMockForecast("beach-2", today, "12:00", {
        wave_height: "0.3",
        wind_direction: "W (onshore)",
        swell_1_period: "6",
      }),
    ]);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1]],
      forecastMap
    );

    const firstDay = summary.days[0];
    expect(firstDay.topBeaches[0].id).toBe("beach-1");
    expect(firstDay.topBeaches[0].score).toBeGreaterThan(
      firstDay.topBeaches[1].score
    );
  });

  it("should calculate beachesWithGoodConditions correctly", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const today = futureDateString(0);

    // Create 3 beaches with varying conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", today, "12:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
      }),
    ]);

    forecastMap.set("beach-2", [
      createMockForecast("beach-2", today, "12:00", {
        wave_height: "3.0",
        wind_direction: "E (offshore)",
      }),
    ]);

    forecastMap.set("beach-3", [
      createMockForecast("beach-3", today, "12:00", {
        wave_height: "0.3",
        wind_direction: "W (onshore)",
      }),
    ]);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1], mockBeaches[2]],
      forecastMap
    );

    const firstDay = summary.days[0];
    // At least 2 beaches should have good conditions (score > 60)
    expect(firstDay.beachesWithGoodConditions).toBeGreaterThanOrEqual(2);
  });

  it("should detect trends correctly", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const today = futureDateString(0);

    // Start with poor conditions and improve significantly
    const forecasts: EnhancedForecastEntity[] = [];

    // Weak morning, then improving into the beginner ideal. Hours are
    // zero-padded and stay inside the day so every row parses as a real
    // instant — `9:00`/`24:00`/`27:00` do not, and silently dropped out.
    const weak: Partial<EnhancedForecastEntity> = {
      wave_height: "0.5",
      wind_direction: "W (onshore)",
      swell_1_period: "6",
    };
    const strong: Partial<EnhancedForecastEntity> = {
      wave_height: "2.0",
      wind_direction: "E (offshore)",
      swell_1_period: "14",
    };
    for (const time of ["06:00", "09:00", "12:00"]) {
      forecasts.push(createMockForecast("beach-1", today, time, weak));
    }
    for (const time of ["15:00", "18:00", "21:00"]) {
      forecasts.push(createMockForecast("beach-1", today, time, strong));
    }
    forecastMap.set("beach-1", forecasts);

    // Anchor "now" before the series starts, otherwise the assertion depends on
    // the wall-clock time the suite happens to run at.
    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
      { now: new Date(`${today}T05:00:00Z`) }
    );

    const beach1Summary = summary.beachConditions.find(
      (b) => b.beachId === "beach-1"
    );
    expect(beach1Summary?.trend).toBe("improving");
  });

  it("should sort beachConditions by currentScore descending", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    const today = futureDateString(0);

    // Beach 1: poor conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", today, "12:00", {
        wave_height: "0.3",
        wind_direction: "W (onshore)",
        swell_1_period: "6",
      }),
    ]);

    // Beach 2: excellent conditions
    forecastMap.set("beach-2", [
      createMockForecast("beach-2", today, "12:00", {
        wave_height: "2.0",
        wind_direction: "E (offshore)",
        swell_1_period: "14",
      }),
    ]);

    // Beach 3: moderate conditions
    forecastMap.set("beach-3", [
      createMockForecast("beach-3", today, "12:00", {
        wave_height: "3.0",
        wind_direction: "N (cross-shore)",
        swell_1_period: "10",
      }),
    ]);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1], mockBeaches[2]],
      forecastMap
    );

    const scores = summary.beachConditions.map((b) => b.currentScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });
});

describe("aggregateRegionalForecast — current-conditions reference instant", () => {
  const today = futureDateString(0);
  const EPIC: Partial<EnhancedForecastEntity> = {
    wave_height: "3.0",
    wind_direction: "E (offshore)",
    swell_1_period: "16",
  };
  const POOR: Partial<EnhancedForecastEntity> = {
    wave_height: "0.3",
    wind_direction: "W (onshore)",
    swell_1_period: "6",
  };

  function dawnAndEvening(
    beachId: string,
    dawn: Partial<EnhancedForecastEntity>,
    evening: Partial<EnhancedForecastEntity>
  ): EnhancedForecastEntity[] {
    return [
      createMockForecast(beachId, today, "06:00", dawn),
      createMockForecast(beachId, today, "21:00", evening),
    ];
  }

  it("scores the hours ahead rather than the already-passed dawn rows", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    forecastMap.set("beach-1", dawnAndEvening("beach-1", EPIC, POOR));

    const beforeDawn = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
      { now: new Date(`${today}T05:00:00Z`) }
    );
    const afternoon = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
      { now: new Date(`${today}T20:00:00Z`) }
    );

    // Same data, later reference instant: the epic dawn window has passed, so
    // the "now" score must fall rather than keep advertising it.
    expect(afternoon.beachConditions[0].currentScore).toBeLessThan(
      beforeDawn.beachConditions[0].currentScore
    );
  });

  it("ranks the beach that is good now above one that was only good at dawn", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    forecastMap.set("beach-1", dawnAndEvening("beach-1", EPIC, POOR));
    forecastMap.set("beach-2", dawnAndEvening("beach-2", POOR, EPIC));

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0], mockBeaches[1]],
      forecastMap,
      { now: new Date(`${today}T20:00:00Z`) }
    );

    expect(summary.beachConditions[0].beachId).toBe("beach-2");
  });

  it("reports the wave height of the upcoming row, not the dawn row", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    forecastMap.set("beach-1", dawnAndEvening("beach-1", EPIC, POOR));

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
      { now: new Date(`${today}T20:00:00Z`) }
    );

    expect(summary.beachConditions[0].currentWaveHeight).toBeCloseTo(0.3);
  });

  it("still ranks a beach once its forecast horizon is exhausted", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();
    forecastMap.set("beach-1", dawnAndEvening("beach-1", EPIC, POOR));

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap,
      { now: new Date(`${today}T23:59:00Z`) }
    );

    expect(summary.beachConditions).toHaveLength(1);
    expect(summary.beachConditions[0].currentScore).toBeGreaterThan(0);
  });
});

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
    forecast_date: date,
    forecast_time: time,
    wave_height: "4.0",
    wave_period: "12",
    wave_direction: "W",
    swell_1_height: "4.0",
    swell_1_period: "12",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    water_temp: "65",
    air_temperature: "70",
    wind_speed: "5",
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
});

describe("calculateDayScore", () => {
  it("should score ideal wave height (3-6ft) highly", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "4.5",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("should score offshore winds highly", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "4.0",
        wind_direction: "E (offshore)",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("should score longer swell periods higher", () => {
    const shortPeriod = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "4.0",
        swell_1_period: "8",
      }),
    ];
    const longPeriod = [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "4.0",
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

  it("should average scores across multiple forecasts", () => {
    const forecasts = [
      createMockForecast("beach-1", "2024-01-15", "06:00", {
        wave_height: "5.0",
        wind_direction: "E (offshore)",
      }),
      createMockForecast("beach-1", "2024-01-15", "09:00", {
        wave_height: "4.5",
        wind_direction: "E (offshore)",
      }),
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "4.0",
        wind_direction: "W (onshore)",
      }),
    ];
    const score = calculateDayScore(forecasts, mockBeaches[0]);
    expect(score).toBeGreaterThanOrEqual(50);
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
    if (events.length > 0) {
      expect(events[0].heightRange[0]).toBeGreaterThan(3);
      expect(events[0].direction).toBeTruthy();
    }
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

describe("aggregateRegionalForecast", () => {
  it("should create 7-day forecast summary", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();

    // Create 7 days of forecasts for 2 beaches
    for (let i = 0; i < 7; i++) {
      const date = new Date("2024-01-15");
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split("T")[0];

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
    expect(summary.bestDay).toBeDefined();
    expect(summary.beachConditions).toHaveLength(2);
    expect(summary.stats.totalBeaches).toBe(2);
    expect(summary.stats.beachesWithData).toBe(2);
  });

  it("should identify best day correctly", () => {
    const forecastMap = new Map<string, EnhancedForecastEntity[]>();

    // Day 1: Poor conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "1.0",
        wind_direction: "W (onshore)",
      }),
    ]);

    // Day 2: Excellent conditions
    forecastMap.set("beach-1", [
      ...forecastMap.get("beach-1")!,
      createMockForecast("beach-1", "2024-01-16", "12:00", {
        wave_height: "5.0",
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
      createMockForecast("beach-1", "2024-01-15", "12:00"),
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

    // Beach 1: Excellent conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "5.0",
        wind_direction: "E (offshore)",
        swell_1_period: "14",
      }),
    ]);

    // Beach 2: Poor conditions
    forecastMap.set("beach-2", [
      createMockForecast("beach-2", "2024-01-15", "12:00", {
        wave_height: "1.0",
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

    // Create 3 beaches with varying conditions
    forecastMap.set("beach-1", [
      createMockForecast("beach-1", "2024-01-15", "12:00", {
        wave_height: "5.0",
        wind_direction: "E (offshore)",
      }),
    ]);

    forecastMap.set("beach-2", [
      createMockForecast("beach-2", "2024-01-15", "12:00", {
        wave_height: "4.0",
        wind_direction: "E (offshore)",
      }),
    ]);

    forecastMap.set("beach-3", [
      createMockForecast("beach-3", "2024-01-15", "12:00", {
        wave_height: "1.0",
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

    // Start with poor conditions and improve significantly
    const forecasts: EnhancedForecastEntity[] = [];

    // First forecast: poor conditions (low score)
    forecasts.push(
      createMockForecast("beach-1", "2024-01-15", "06:00", {
        wave_height: "1.5",
        wind_direction: "W (onshore)",
        swell_1_period: "6",
      })
    );

    // Next forecasts: improving conditions (higher scores)
    for (let i = 1; i < 8; i++) {
      forecasts.push(
        createMockForecast("beach-1", "2024-01-15", `${6 + i * 3}:00`, {
          wave_height: `${4 + i * 0.3}`, // Building to ideal range
          wind_direction: "E (offshore)",
          swell_1_period: `${12 + i}`, // Improving period
        })
      );
    }
    forecastMap.set("beach-1", forecasts);

    const summary = aggregateRegionalForecast(
      mockRegion,
      [mockBeaches[0]],
      forecastMap
    );

    const beach1Summary = summary.beachConditions.find(
      (b) => b.beachId === "beach-1"
    );
    expect(beach1Summary?.trend).toBe("improving");
  });
});

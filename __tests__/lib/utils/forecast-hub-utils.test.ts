/**
 * Tests for Forecast Hub Utilities
 *
 * Tests the main data-fetching and aggregation functions used by the /forecast hub page
 * and landing page conditions snapshot.
 */

import {
  getRegionalSummaries,
  getBestRegionToday,
  getTopBeachesRightNow,
  type TopBeachEntry,
} from "@/lib/utils/forecast-hub-utils";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock dependencies
jest.mock("@/actions/beach/beach-query-actions");
jest.mock("@/lib/utils/forecast-service-utils");
jest.mock("@/lib/utils/beach-url-utils");
jest.mock("@/lib/utils/regional-forecast-utils");

import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import {
  getBeachesForRegion,
  aggregateRegionalForecast,
} from "@/lib/utils/regional-forecast-utils";

// Mock FORECAST_REGIONS separately
jest.mock("@/lib/data/forecast-regions", () => ({
  FORECAST_REGIONS: {},
}));

import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";

// Mock data
const mockRegion1: ForecastRegion = {
  slug: "test-region-1",
  name: "Test Region 1",
  title: "Test Region 1 Forecast",
  metaDescription: "Test region 1 description",
  states: ["ca"],
  centerLat: 33.0,
  centerLon: -117.0,
  zoom: 10,
};

const mockRegion2: ForecastRegion = {
  slug: "test-region-2",
  name: "Test Region 2",
  title: "Test Region 2 Forecast",
  metaDescription: "Test region 2 description",
  states: ["ca"],
  centerLat: 34.0,
  centerLon: -118.0,
  zoom: 10,
};

const mockBeaches: Beach[] = [
  {
    id: "beach-1",
    name: "Test Beach 1",
    slug: "test-beach-1",
    city: "San Diego",
    state: "CA",
    country: "USA",
    center_lat: 32.85,
    center_lng: -117.25,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
  {
    id: "beach-2",
    name: "Test Beach 2",
    slug: "test-beach-2",
    city: "Los Angeles",
    state: "CA",
    country: "USA",
    center_lat: 34.01,
    center_lng: -118.49,
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as Beach,
  {
    id: "beach-3",
    name: "Test Beach 3",
    slug: "test-beach-3",
    city: "San Diego",
    state: "CA",
    country: "USA",
    center_lat: 32.75,
    center_lng: -117.15,
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

function createMockRegionalSummary(
  region: ForecastRegion,
  firstDayScore: number,
  beachConditions: any[] = []
): RegionalForecastSummary {
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  return {
    region,
    generatedAt: today,
    days: [
      {
        date: today,
        dateString: todayString,
        dayOfWeek: today.toLocaleDateString("en-US", { weekday: "long" }),
        score: firstDayScore,
        avgWaveHeight: 4.0,
        waveRange: [3.0, 5.0],
        dominantWindDirection: "E",
        windConditions: "offshore" as const,
        bestTimeSlot: "dawn-patrol" as const,
        topBeaches: [],
        beachesWithGoodConditions: 2,
      },
    ],
    bestDay: {
      date: today,
      dateString: todayString,
      dayOfWeek: today.toLocaleDateString("en-US", { weekday: "long" }),
      score: firstDayScore,
      avgWaveHeight: 4.0,
      waveRange: [3.0, 5.0],
      dominantWindDirection: "E",
      windConditions: "offshore" as const,
      bestTimeSlot: "dawn-patrol" as const,
      topBeaches: [],
      beachesWithGoodConditions: 2,
    },
    upcomingSwells: [],
    beachConditions,
    stats: {
      totalBeaches: 2,
      beachesWithData: 2,
      avgRegionScore: firstDayScore,
    },
  };
}

describe("forecast-hub-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up FORECAST_REGIONS mock data
    Object.keys(FORECAST_REGIONS).forEach((key) => {
      delete FORECAST_REGIONS[key];
    });
    FORECAST_REGIONS["test-region-1"] = mockRegion1;
    FORECAST_REGIONS["test-region-2"] = mockRegion2;
  });

  describe("getRegionalSummaries", () => {
    it("returns empty object when getBeaches fails", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const result = await getRegionalSummaries();

      expect(result).toEqual({});
      expect(getBeaches).toHaveBeenCalledTimes(1);
    });

    it("returns empty object when getBeaches returns no data", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      const result = await getRegionalSummaries();

      expect(result).toEqual({});
      expect(getBeaches).toHaveBeenCalledTimes(1);
    });

    it("returns summaries for all regions when data is available", async () => {
      // Mock beaches response
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      // Mock getBeachesForRegion to return different beaches for each region
      (getBeachesForRegion as jest.Mock)
        .mockReturnValueOnce([mockBeaches[0], mockBeaches[2]]) // region 1: beach-1, beach-3
        .mockReturnValueOnce([mockBeaches[1]]); // region 2: beach-2

      // Mock forecast batch fetch
      const mockForecastMap = new Map();
      mockForecastMap.set("beach-1", {
        forecasts: [createMockForecast("beach-1", "2024-01-15", "09:00")],
      });
      mockForecastMap.set("beach-2", {
        forecasts: [createMockForecast("beach-2", "2024-01-15", "09:00")],
      });
      mockForecastMap.set("beach-3", {
        forecasts: [createMockForecast("beach-3", "2024-01-15", "09:00")],
      });
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        mockForecastMap
      );

      // Mock aggregateRegionalForecast
      (aggregateRegionalForecast as jest.Mock)
        .mockReturnValueOnce(createMockRegionalSummary(mockRegion1, 75))
        .mockReturnValueOnce(createMockRegionalSummary(mockRegion2, 65));

      const result = await getRegionalSummaries();

      expect(result).toHaveProperty("test-region-1");
      expect(result).toHaveProperty("test-region-2");
      expect(result["test-region-1"].region).toEqual(mockRegion1);
      expect(result["test-region-2"].region).toEqual(mockRegion2);
      expect(getBeaches).toHaveBeenCalledTimes(1);
      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        ["beach-1", "beach-3", "beach-2"], // All unique beach IDs
        168 // 7 days in hours
      );
    });

    it("fetches all beaches once and reuses for all regions", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([mockBeaches[0]]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );
      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 50)
      );

      await getRegionalSummaries();

      // Should only fetch beaches once despite having 2 regions
      expect(getBeaches).toHaveBeenCalledTimes(1);
      // Should call getBeachesForRegion for each region
      expect(getBeachesForRegion).toHaveBeenCalledTimes(2);
    });

    it("handles regions with no beaches gracefully", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      // Return empty array for both regions
      (getBeachesForRegion as jest.Mock).mockReturnValue([]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );
      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 0)
      );

      const result = await getRegionalSummaries();

      // Should still create summaries, just with empty data
      expect(result).toHaveProperty("test-region-1");
      expect(result).toHaveProperty("test-region-2");
    });
  });

  describe("getBestRegionToday", () => {
    it("returns null when summaries are empty", () => {
      const result = getBestRegionToday({});

      expect(result).toBeNull();
    });

    it("returns null when all scores are 0", () => {
      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 0),
        "test-region-2": createMockRegionalSummary(mockRegion2, 0),
      };

      const result = getBestRegionToday(summaries);

      expect(result).toBeNull();
    });

    it("returns the region with the highest first-day score", () => {
      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 75),
        "test-region-2": createMockRegionalSummary(mockRegion2, 85),
      };

      const result = getBestRegionToday(summaries);

      expect(result).not.toBeNull();
      expect(result!.region).toEqual(mockRegion2);
      expect(result!.summary).toEqual(summaries["test-region-2"]);
    });

    it("handles tie-breaking (first found wins)", () => {
      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 80),
        "test-region-2": createMockRegionalSummary(mockRegion2, 80),
      };

      const result = getBestRegionToday(summaries);

      expect(result).not.toBeNull();
      // First one in iteration order wins (order not guaranteed in Object.entries,
      // but we can at least verify one was returned)
      expect([mockRegion1, mockRegion2]).toContainEqual(result!.region);
    });

    it("handles missing days array gracefully", () => {
      const summary = createMockRegionalSummary(mockRegion1, 75);
      summary.days = [];

      const summaries = {
        "test-region-1": summary,
      };

      const result = getBestRegionToday(summaries);

      // Should return null because days[0] is undefined
      expect(result).toBeNull();
    });

    it("uses first day score as today score", () => {
      const summary = createMockRegionalSummary(mockRegion1, 90);
      // Add a second day with higher score
      summary.days.push({
        date: new Date(),
        dateString: "2024-01-16",
        dayOfWeek: "Tuesday",
        score: 95, // Higher score but not used for "today"
        avgWaveHeight: 5.0,
        waveRange: [4.0, 6.0],
        dominantWindDirection: "E",
        windConditions: "offshore" as const,
        bestTimeSlot: "dawn-patrol" as const,
        topBeaches: [],
        beachesWithGoodConditions: 3,
      });

      const summaries = {
        "test-region-1": summary,
      };

      const result = getBestRegionToday(summaries);

      expect(result).not.toBeNull();
      // Should use first day score (90) not second day score (95)
      expect(result!.summary.days[0].score).toBe(90);
    });
  });

  describe("getTopBeachesRightNow", () => {
    it("returns empty array when no beach conditions exist", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      // Create summaries with empty beachConditions
      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 50, [])
      );

      const result = await getTopBeachesRightNow();

      expect(result).toEqual([]);
    });

    it("returns beaches sorted by score descending", async () => {
      // Temporarily use only one region to avoid duplicates
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });
      FORECAST_REGIONS["test-region-1"] = mockRegion1;

      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue(mockBeaches);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      // Create beach conditions with varying scores
      const beachConditions = [
        {
          beachId: "beach-1",
          beachName: "Test Beach 1",
          beachSlug: "test-beach-1",
          currentScore: 65,
          currentWaveHeight: 3.5,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 70,
        },
        {
          beachId: "beach-2",
          beachName: "Test Beach 2",
          beachSlug: "test-beach-2",
          currentScore: 85,
          currentWaveHeight: 4.5,
          trend: "improving" as const,
          bestDay: "Thursday",
          bestDayScore: 90,
        },
        {
          beachId: "beach-3",
          beachName: "Test Beach 3",
          beachSlug: "test-beach-3",
          currentScore: 75,
          currentWaveHeight: 4.0,
          trend: "declining" as const,
          bestDay: "Tuesday",
          bestDayScore: 80,
        },
      ];

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      (getBeachHrefSafe as jest.Mock).mockImplementation(
        ({ slug, city, state }) => `/${state.toLowerCase()}/${city.toLowerCase()}/${slug}`
      );

      const result = await getTopBeachesRightNow();

      expect(result).toHaveLength(3);
      // Should be sorted by score descending: beach-2 (85), beach-3 (75), beach-1 (65)
      expect(result[0].beachId).toBe("beach-2");
      expect(result[0].score).toBe(85);
      expect(result[1].beachId).toBe("beach-3");
      expect(result[1].score).toBe(75);
      expect(result[2].beachId).toBe("beach-1");
      expect(result[2].score).toBe(65);
    });

    it("respects the limit parameter", async () => {
      // Temporarily use only one region to avoid duplicates
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });
      FORECAST_REGIONS["test-region-1"] = mockRegion1;

      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue(mockBeaches);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      const beachConditions = Array.from({ length: 10 }, (_, i) => ({
        beachId: `beach-${i}`,
        beachName: `Beach ${i}`,
        beachSlug: `beach-${i}`,
        currentScore: 100 - i * 5,
        currentWaveHeight: 4.0,
        trend: "steady" as const,
        bestDay: "Wednesday",
        bestDayScore: 100 - i * 5,
      }));

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/test-url");

      // Test default limit (5)
      const result1 = await getTopBeachesRightNow();
      expect(result1).toHaveLength(5);

      // Test custom limit (3)
      const result2 = await getTopBeachesRightNow(3);
      expect(result2).toHaveLength(3);

      // Test limit larger than available beaches
      const result3 = await getTopBeachesRightNow(20);
      expect(result3).toHaveLength(10); // Only 10 beaches available
    });

    it("includes all required fields in each entry", async () => {
      // Temporarily use only one region to avoid duplicates
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });
      FORECAST_REGIONS["test-region-1"] = mockRegion1;

      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([mockBeaches[0]]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      const beachConditions = [
        {
          beachId: "beach-1",
          beachName: "Test Beach 1",
          beachSlug: "test-beach-1",
          currentScore: 75,
          currentWaveHeight: 4.0,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 80,
        },
      ];

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/ca/san-diego/test-beach-1");

      const result = await getTopBeachesRightNow();

      expect(result).toHaveLength(1);
      const entry = result[0];

      expect(entry).toHaveProperty("beachId", "beach-1");
      expect(entry).toHaveProperty("beachName", "Test Beach 1");
      expect(entry).toHaveProperty("score", 75);
      expect(entry).toHaveProperty("waveHeight", 4.0);
      expect(entry).toHaveProperty("regionName", "Test Region 1");
      expect(entry).toHaveProperty("href", "/ca/san-diego/test-beach-1");
    });

    it("generates proper URLs via getBeachHrefSafe", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([mockBeaches[0]]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      const beachConditions = [
        {
          beachId: "beach-1",
          beachName: "Test Beach 1",
          beachSlug: "test-beach-1",
          currentScore: 75,
          currentWaveHeight: 4.0,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 80,
        },
      ];

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/ca/san-diego/test-beach-1");

      await getTopBeachesRightNow();

      expect(getBeachHrefSafe).toHaveBeenCalledWith({
        id: "beach-1",
        slug: "test-beach-1",
        city: "San Diego",
        state: "CA",
        country: "USA",
      });
    });

    it("handles missing beach data gracefully (null href)", async () => {
      // Temporarily use only one region to avoid duplicates
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });
      FORECAST_REGIONS["test-region-1"] = mockRegion1;

      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([mockBeaches[0]]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      // Beach condition for a beach that doesn't exist in mockBeaches
      const beachConditions = [
        {
          beachId: "beach-999",
          beachName: "Missing Beach",
          beachSlug: "missing-beach",
          currentScore: 75,
          currentWaveHeight: 4.0,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 80,
        },
      ];

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      const result = await getTopBeachesRightNow();

      expect(result).toHaveLength(1);
      expect(result[0].href).toBeNull();
      // Should not have called getBeachHrefSafe since beach not found
      expect(getBeachHrefSafe).not.toHaveBeenCalled();
    });

    it("aggregates beaches from multiple regions", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock)
        .mockReturnValueOnce([mockBeaches[0]]) // region 1
        .mockReturnValueOnce([mockBeaches[1]]); // region 2

      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      const beachConditions1 = [
        {
          beachId: "beach-1",
          beachName: "Test Beach 1",
          beachSlug: "test-beach-1",
          currentScore: 70,
          currentWaveHeight: 3.5,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 75,
        },
      ];

      const beachConditions2 = [
        {
          beachId: "beach-2",
          beachName: "Test Beach 2",
          beachSlug: "test-beach-2",
          currentScore: 80,
          currentWaveHeight: 4.5,
          trend: "improving" as const,
          bestDay: "Thursday",
          bestDayScore: 85,
        },
      ];

      (aggregateRegionalForecast as jest.Mock)
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion1, 70, beachConditions1)
        )
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion2, 80, beachConditions2)
        );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/test-url");

      const result = await getTopBeachesRightNow();

      // Should have beaches from both regions
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.beachId).sort()).toEqual(["beach-1", "beach-2"]);

      // Should have correct region names
      const beach1Entry = result.find((b) => b.beachId === "beach-1");
      const beach2Entry = result.find((b) => b.beachId === "beach-2");

      expect(beach1Entry?.regionName).toBe("Test Region 1");
      expect(beach2Entry?.regionName).toBe("Test Region 2");
    });

    it("uses regionName from summary for all beaches in beachConditions", async () => {
      // Temporarily use only one region to avoid duplicates
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });
      FORECAST_REGIONS["test-region-1"] = mockRegion1;

      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock).mockReturnValue([]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map()
      );

      // Beach condition without corresponding beach in allBeaches
      // but it will still get the region name from the summary
      const beachConditions = [
        {
          beachId: "beach-orphan",
          beachName: "Orphan Beach",
          beachSlug: "orphan-beach",
          currentScore: 75,
          currentWaveHeight: 4.0,
          trend: "steady" as const,
          bestDay: "Wednesday",
          bestDayScore: 80,
        },
      ];

      (aggregateRegionalForecast as jest.Mock).mockReturnValue(
        createMockRegionalSummary(mockRegion1, 75, beachConditions)
      );

      const result = await getTopBeachesRightNow();

      expect(result).toHaveLength(1);
      // Region name comes from the summary that contains this beach condition
      expect(result[0].regionName).toBe("Test Region 1");
      // href will be null since beach not in allBeaches
      expect(result[0].href).toBeNull();
    });
  });
});

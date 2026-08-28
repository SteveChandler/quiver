/**
 * Tests for Forecast Hub Utilities
 *
 * Tests the main data-fetching and aggregation functions used by the /forecast hub page
 * and landing page conditions snapshot.
 */

import {
  getCachedRegionalForecastPageData,
  getRegionalSummaries,
  getRegionalSummary,
  getBestRegionToday,
  getBestRegionForUser,
  getClosestRegion,
  getTopBeachesRightNow,
  type TopBeachEntry,
} from "@/lib/utils/forecast-hub-utils";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock dependencies
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((loader: unknown) => loader),
}));
jest.mock("@/lib/services/beach-query-service");
jest.mock("@/lib/utils/forecast-service-utils");
jest.mock("@/lib/utils/beach-url-utils");
jest.mock("@/lib/utils/regional-forecast-utils");
jest.mock("@/lib/utils/distance-utils");
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: jest.fn(async ({ candidates }) =>
    candidates.map((candidate: { candidateId: string } | null) => ({
      candidateId: candidate?.candidateId ?? null,
      evaluation: {
        outcome: "allow",
        holdIds: [],
        holdEpoch: "test-hold-epoch",
      },
      recommendationAvailability: {
        state: "available",
        holdEpoch: "test-hold-epoch",
      },
    })),
  ),
}));
jest.mock("@/lib/recommendations/major-event-hold/adapters/regional", () => ({
  buildRegionalMajorEventHoldCandidates: jest.fn(
    (summary: RegionalForecastSummary) =>
      (summary.bestSurfWindows ?? []).map((window) => ({
        candidateId: `regional-window:${window.windowId}`,
        beachId: window.beach.id,
        startsAt: window.startIso,
        endsAt: window.endIso,
      })),
  ),
  sanitizeRegionalForecastForMajorEventHold: jest.fn(
    (summary: RegionalForecastSummary) => ({
      ...summary,
      bestSurfWindows: (summary.bestSurfWindows ?? []).slice(0, 5),
      recommendationAvailability: {
        state: "available",
        holdEpoch: "test-hold-epoch",
      },
    }),
  ),
}));

// attachRegionPhotos + getTopBeachesRightNow hit the service-role Supabase
// client to fetch approved beach photos. CI has no SUPABASE_SERVICE_ROLE_KEY,
// so the real client init throws and pollutes console.error. Stub both so
// photo attachment silently no-ops (summaries retain null photoUrl fields,
// which matches the photos-unavailable branch the callers already handle).
let mockPhotoBeachIds: string[] = [];
let mockHeldBeachIds = new Set<string>();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: (table: string) => ({
      select: () => ({
        in: (_field: string, beachIds: string[]) => {
          if (table === "beach_photos") mockPhotoBeachIds = beachIds;
          if (table === "water_quality_held_beaches") {
            return Promise.resolve({
              data: beachIds
                .filter((beachId) => mockHeldBeachIds.has(beachId))
                .map((beach_id) => ({ beach_id })),
              error: null,
            });
          }
          if (table === "beach_water_quality") {
            return Promise.resolve({ data: [], error: null });
          }
          return {
            order: () => Promise.resolve({ data: [], error: null }),
          };
        },
      }),
    }),
  })),
}));
jest.mock("@/lib/supabase/query-builders", () => ({
  withApprovedPhotos: async (query: unknown) => {
    const result = await (query as Promise<{ data: unknown; error: unknown }>);
    return result ?? { data: [], error: null };
  },
}));

import { getBeachesFromDb } from "@/lib/services/beach-query-service";
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
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import {
  buildRegionalMajorEventHoldCandidates,
  sanitizeRegionalForecastForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/regional";

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

const SURF_WINDOW_NOW = new Date("2026-02-10T15:00:00Z");

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
    bestSurfWindows: [],
    photoUrl: null,
    photoBeachName: null,
    secondaryPhotoUrl: null,
    secondaryPhotoBeachName: null,
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
    mockPhotoBeachIds = [];
    mockHeldBeachIds.clear();

    // Set up FORECAST_REGIONS mock data
    Object.keys(FORECAST_REGIONS).forEach((key) => {
      delete FORECAST_REGIONS[key];
    });
    FORECAST_REGIONS["test-region-1"] = mockRegion1;
    FORECAST_REGIONS["test-region-2"] = mockRegion2;
  });

  describe("getCachedRegionalForecastPageData", () => {
    it("revives cached summary dates without viewer-specific state", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });
      (getBeachesForRegion as jest.Mock).mockReturnValue([mockBeaches[0]]);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map(),
      );
      const summary = createMockRegionalSummary(mockRegion1, 75);
      summary.sourceDataUpdatedAt = "2026-08-27T21:00:00.000Z";
      (aggregateRegionalForecast as jest.Mock).mockReturnValue(summary);

      const result = await getCachedRegionalForecastPageData(mockRegion1);

      expect(result.beaches).toEqual([mockBeaches[0]]);
      expect(result.summary.generatedAt).toBeInstanceOf(Date);
      expect(result.summary.days[0]?.date).toBeInstanceOf(Date);
      expect(result.summary.bestDay.date).toBeInstanceOf(Date);
      expect(result.summary.sourceDataUpdatedAt).toBe(
        "2026-08-27T21:00:00.000Z",
      );
    });
  });

  describe("getRegionalSummaries", () => {
    it("returns empty object when getBeachesFromDb fails", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const result = await getRegionalSummaries();

      expect(result).toEqual({});
      expect(getBeachesFromDb).toHaveBeenCalledTimes(1);
    });

    it("returns empty object when getBeachesFromDb returns no data", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      const result = await getRegionalSummaries();

      expect(result).toEqual({});
      expect(getBeachesFromDb).toHaveBeenCalledTimes(1);
    });

    it("returns summaries for all regions when data is available", async () => {
      // Mock beaches response
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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
      expect(getBeachesFromDb).toHaveBeenCalledTimes(1);
      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        ["beach-1", "beach-3", "beach-2"], // All unique beach IDs
        168 // 7 days in hours
      );
    });

    it("continues filtering held beaches from forecast-hub recommendations", async () => {
      const heldBeach = {
        ...mockBeaches[0],
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Held Beach",
      } as Beach;
      const safeBeach = {
        ...mockBeaches[1],
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Safe Beach",
      } as Beach;
      mockHeldBeachIds.add(heldBeach.id);
      (getBeachesForRegion as jest.Mock).mockImplementation(
        (_region: ForecastRegion, regionBeaches: Beach[]) => regionBeaches,
      );
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(new Map());
      (aggregateRegionalForecast as jest.Mock).mockImplementation(
        (_region: ForecastRegion, regionBeaches: Beach[]) =>
          createMockRegionalSummary(mockRegion1, regionBeaches.length),
      );
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: true,
        data: [heldBeach, safeBeach],
      });

      await getRegionalSummaries();

      expect(aggregateRegionalForecast).toHaveBeenCalledWith(
        expect.anything(),
        [safeBeach],
        expect.any(Map),
        // Same reference instant the window selector is given.
        expect.objectContaining({ now: expect.any(Date) }),
      );
      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        [safeBeach.id],
        168,
      );
    });

    it("attaches up to five regional surf windows from the existing forecast batch", async () => {
      const forecastDate = "2026-02-10";
      const regionalBeaches = Array.from({ length: 7 }, (_, index) => {
        const rank = index + 1;
        return {
          ...mockBeaches[0],
          id: `region-beach-${rank}`,
          name: `Test Beach ${rank}`,
          slug: `test-beach-${rank}`,
        } as Beach;
      });

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: true,
        data: [...regionalBeaches, mockBeaches[1]],
      });

      (getBeachesForRegion as jest.Mock)
        .mockReturnValueOnce(regionalBeaches)
        .mockReturnValueOnce([mockBeaches[1]]);

      const mockForecastMap = new Map();
      regionalBeaches.forEach((beach, index) => {
        mockForecastMap.set(beach.id, {
          forecasts: [
            createMockForecast(
              beach.id,
              forecastDate,
              `${String(16 + index).padStart(2, "0")}:00`
            ),
          ],
        });
      });
      mockForecastMap.set("beach-2", {
        forecasts: [createMockForecast("beach-2", forecastDate, "17:00")],
      });
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        mockForecastMap
      );

      (aggregateRegionalForecast as jest.Mock)
        .mockReturnValueOnce(createMockRegionalSummary(mockRegion1, 75))
        .mockReturnValueOnce(createMockRegionalSummary(mockRegion2, 65));

      const result = await getRegionalSummaries(undefined, {
        now: SURF_WINDOW_NOW,
        baseUrl: "https://example.com",
        profileExperience: "intermediate",
      });

      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledTimes(1);
      const regionOne = result["test-region-1"];
      const regionTwo = result["test-region-2"];
      expect(regionOne?.generatedAt).toEqual(SURF_WINDOW_NOW);
      expect(regionTwo?.generatedAt).toEqual(SURF_WINDOW_NOW);
      expect(regionOne).toMatchObject({
        region: expect.objectContaining({ slug: "test-region-1" }),
      });
      expect(regionTwo).toMatchObject({
        region: expect.objectContaining({ slug: "test-region-2" }),
      });
      const regionOneWindows = regionOne?.bestSurfWindows ?? [];
      const regionTwoWindows = regionTwo?.bestSurfWindows ?? [];

      expect(regionOneWindows).toHaveLength(5);
      expect(regionOneWindows.map((item) => item.rank)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      expect(regionTwoWindows).toHaveLength(1);
      expect(regionTwoWindows[0]).toMatchObject({
        appDeepLink: expect.stringContaining("window="),
      });
      const regionOneSanitizeCall = (
        sanitizeRegionalForecastForMajorEventHold as jest.Mock
      ).mock.calls.find(
        ([summary]: [RegionalForecastSummary]) =>
          summary.region.slug === "test-region-1",
      );
      expect(regionOneSanitizeCall?.[0].bestSurfWindows).toHaveLength(7);
      expect(buildRegionalMajorEventHoldCandidates).toHaveBeenCalledWith(
        regionOneSanitizeCall?.[0],
      );
      expect(evaluateMajorEventHoldCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ profileExperience: "intermediate" }),
      );
    });

    it("fetches all beaches once and reuses for all regions", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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
      expect(getBeachesFromDb).toHaveBeenCalledTimes(1);
      // Should call getBeachesForRegion for each region
      expect(getBeachesForRegion).toHaveBeenCalledTimes(2);
    });

    it("handles regions with no beaches gracefully", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

  describe("getRegionalSummary", () => {
    it("selects hero photos only after held beaches are removed", async () => {
      const held = {
        beachId: "held-beach",
        beachName: "Held Beach",
        beachSlug: "held-beach",
        state: "CA",
        city: "San Diego",
        country: "USA",
        currentScore: 95,
        currentWaveHeight: 6,
        trend: "steady" as const,
        bestDay: "Monday",
        bestDayScore: 95,
      };
      const allowed = {
        ...held,
        beachId: "allowed-beach",
        beachName: "Allowed Beach",
        beachSlug: "allowed-beach",
        currentScore: 80,
        bestDayScore: 80,
      };
      const summary = createMockRegionalSummary(mockRegion1, 80, [
        held,
        allowed,
      ]);
      (getBeachesForRegion as jest.Mock).mockReturnValue(mockBeaches);
      (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
        new Map(),
      );
      (aggregateRegionalForecast as jest.Mock).mockReturnValue(summary);
      (sanitizeRegionalForecastForMajorEventHold as jest.Mock).mockReturnValueOnce({
        ...summary,
        beachConditions: [allowed],
        recommendationAvailability: {
          state: "available",
          holdEpoch: "test-hold-epoch",
        },
      });

      await getRegionalSummary(mockRegion1, mockBeaches, {
        includeBestSurfWindows: false,
      });

      expect(mockPhotoBeachIds).toEqual(["allowed-beach"]);
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
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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

    it("filters to closest region when userCoords provided", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
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
          currentScore: 90,
          currentWaveHeight: 5.0,
          trend: "improving" as const,
          bestDay: "Thursday",
          bestDayScore: 95,
        },
      ];

      (aggregateRegionalForecast as jest.Mock)
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion1, 70, beachConditions1)
        )
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion2, 90, beachConditions2)
        );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/test-url");

      // Mock distance: region 1 is closer (10 miles), region 2 is farther (100 miles)
      (calculateDistanceInMiles as jest.Mock).mockImplementation(
        (_from: any, to: any) => {
          if (to.lat === mockRegion1.centerLat) return 10;
          if (to.lat === mockRegion2.centerLat) return 100;
          return 999;
        }
      );

      // User coords near region 1
      const result = await getTopBeachesRightNow(5, {
        lat: 33.0,
        lon: -117.0,
      });

      // Should only return beaches from closest region (region 1)
      expect(result).toHaveLength(1);
      expect(result[0].beachId).toBe("beach-1");
      expect(result[0].regionName).toBe("Test Region 1");
    });

    it("returns global results when userCoords not provided", async () => {
      (getBeachesFromDb as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      (getBeachesForRegion as jest.Mock)
        .mockReturnValueOnce([mockBeaches[0]])
        .mockReturnValueOnce([mockBeaches[1]]);

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
          currentScore: 90,
          currentWaveHeight: 5.0,
          trend: "improving" as const,
          bestDay: "Thursday",
          bestDayScore: 95,
        },
      ];

      (aggregateRegionalForecast as jest.Mock)
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion1, 70, beachConditions1)
        )
        .mockReturnValueOnce(
          createMockRegionalSummary(mockRegion2, 90, beachConditions2)
        );

      (getBeachHrefSafe as jest.Mock).mockReturnValue("/test-url");

      // No userCoords — should return beaches from all regions
      const result = await getTopBeachesRightNow(5);

      expect(result).toHaveLength(2);
      expect(result.map((b) => b.beachId).sort()).toEqual(["beach-1", "beach-2"]);
    });
  });

  describe("getBestRegionForUser", () => {
    beforeEach(() => {
      // Reset distance mock for these tests
      (calculateDistanceInMiles as jest.Mock).mockReset();
    });

    it("returns closest region (not highest-scoring) when coords provided", () => {
      // Region 1: closer but lower score, Region 2: farther but higher score
      (calculateDistanceInMiles as jest.Mock).mockImplementation(
        (_from: any, to: any) => {
          if (to.lat === mockRegion1.centerLat) return 20; // closer
          if (to.lat === mockRegion2.centerLat) return 50; // farther
          return 999;
        }
      );

      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 60), // lower score
        "test-region-2": createMockRegionalSummary(mockRegion2, 90), // higher score
      };

      const result = getBestRegionForUser(summaries, {
        lat: 33.0,
        lon: -117.0,
      });

      expect(result).not.toBeNull();
      // Should pick region 1 (closer) not region 2 (higher score)
      expect(result!.region.slug).toBe("test-region-1");
      expect(result!.isLocationPersonalized).toBe(true);
    });

    it("skips closest region if it has no summary data", () => {
      (calculateDistanceInMiles as jest.Mock).mockImplementation(
        (_from: any, to: any) => {
          if (to.lat === mockRegion1.centerLat) return 20; // closer
          if (to.lat === mockRegion2.centerLat) return 50; // farther
          return 999;
        }
      );

      // Only region 2 has summary data
      const summaries = {
        "test-region-2": createMockRegionalSummary(mockRegion2, 85),
      };

      const result = getBestRegionForUser(summaries, {
        lat: 33.0,
        lon: -117.0,
      });

      expect(result).not.toBeNull();
      // Should fall to region 2 since region 1 has no summary
      expect(result!.region.slug).toBe("test-region-2");
      expect(result!.isLocationPersonalized).toBe(true);
    });

    it("falls back to global best when no coords provided", () => {
      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 60),
        "test-region-2": createMockRegionalSummary(mockRegion2, 90),
      };

      const result = getBestRegionForUser(summaries, null);

      expect(result).not.toBeNull();
      // Should pick highest-scoring region globally
      expect(result!.region.slug).toBe("test-region-2");
      expect(result!.isLocationPersonalized).toBe(false);
    });

    it("falls back to global best when no regions within range", () => {
      // All regions beyond 300 miles
      (calculateDistanceInMiles as jest.Mock).mockReturnValue(500);

      const summaries = {
        "test-region-1": createMockRegionalSummary(mockRegion1, 60),
        "test-region-2": createMockRegionalSummary(mockRegion2, 90),
      };

      const result = getBestRegionForUser(summaries, {
        lat: 40.0,
        lon: -74.0,
      });

      expect(result).not.toBeNull();
      expect(result!.region.slug).toBe("test-region-2");
      expect(result!.isLocationPersonalized).toBe(false);
    });
  });

  describe("getClosestRegion", () => {
    beforeEach(() => {
      (calculateDistanceInMiles as jest.Mock).mockReset();
    });

    it("returns the closest region by distance", () => {
      (calculateDistanceInMiles as jest.Mock).mockImplementation(
        (_from: any, to: any) => {
          if (to.lat === mockRegion1.centerLat) return 15;
          if (to.lat === mockRegion2.centerLat) return 80;
          return 999;
        }
      );

      const result = getClosestRegion({ lat: 33.0, lon: -117.0 });

      expect(result).not.toBeNull();
      expect(result!.slug).toBe("test-region-1");
    });

    it("returns null when FORECAST_REGIONS is empty", () => {
      Object.keys(FORECAST_REGIONS).forEach((key) => {
        delete FORECAST_REGIONS[key];
      });

      const result = getClosestRegion({ lat: 33.0, lon: -117.0 });

      expect(result).toBeNull();
    });
  });
});

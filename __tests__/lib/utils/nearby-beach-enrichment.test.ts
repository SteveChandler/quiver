/**
 * Unit Tests for nearby-beach-enrichment utility
 *
 * Tests the enrichBeachesWithConditions function:
 * - Empty input handling
 * - Forecast data enrichment (scores and wave heights)
 * - Photo URL enrichment from beach_photos table
 * - Null value handling when data is missing
 * - First photo deduplication per beach
 */

import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import type { Beach } from "@/types/database";

// Mock dependencies
jest.mock("@/lib/utils/forecast-service-utils", () => ({
  getBatchFreshForecastsFromCache: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/utils/regional-forecast-utils", () => ({
  calculateDayScore: jest.fn(),
}));

jest.mock("@/lib/supabase/query-builders", () => ({
  withApprovedPhotos: jest.fn(),
}));

describe("enrichBeachesWithConditions", () => {
  const { getBatchFreshForecastsFromCache } = require("@/lib/utils/forecast-service-utils");
  const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
  const { calculateDayScore } = require("@/lib/utils/regional-forecast-utils");
  const { withApprovedPhotos } = require("@/lib/supabase/query-builders");

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            order: jest.fn(() => ({ data: null })),
          })),
        })),
      })),
    };

    createSupabaseServiceRoleClient.mockReturnValue(mockSupabase);

    // Mock withApprovedPhotos to return the query result
    withApprovedPhotos.mockImplementation((query: unknown) => query);
  });

  function createMockBeach(overrides: Partial<Beach> = {}): Beach {
    return {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
      city: "San Diego",
      state: "CA",
      center_lat: 32.8,
      center_lng: -117.2,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ...overrides,
    } as Beach;
  }

  describe("Empty Input", () => {
    it("returns empty array for empty input", async () => {
      const result = await enrichBeachesWithConditions([]);

      expect(result).toEqual([]);
      expect(getBatchFreshForecastsFromCache).not.toHaveBeenCalled();
      expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    });
  });

  describe("Forecast Enrichment", () => {
    it("enriches beaches with forecast scores and wave heights", async () => {
      const beaches = [
        createMockBeach({ id: "beach-1", name: "Beach One" }),
        createMockBeach({ id: "beach-2", name: "Beach Two" }),
      ];

      // Mock forecast data
      const forecastMap = new Map([
        [
          "beach-1",
          {
            forecasts: [
              { wave_height: "6.5", timestamp: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
        [
          "beach-2",
          {
            forecasts: [
              { wave_height: "4.2", timestamp: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
      ]);

      getBatchFreshForecastsFromCache.mockResolvedValue(forecastMap);
      calculateDayScore
        .mockReturnValueOnce(8.5) // Beach 1 score
        .mockReturnValueOnce(7.2); // Beach 2 score

      const result = await enrichBeachesWithConditions(beaches);

      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        ["beach-1", "beach-2"],
        24
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "beach-1",
        score: 8.5,
        waveHeight: 6.5,
        photoUrl: null,
      });
      expect(result[1]).toMatchObject({
        id: "beach-2",
        score: 7.2,
        waveHeight: 4.2,
        photoUrl: null,
      });
    });

    it("returns null score when no forecast data", async () => {
      const beaches = [createMockBeach({ id: "beach-1" })];

      // Mock empty forecast map
      getBatchFreshForecastsFromCache.mockResolvedValue(new Map());

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0].score).toBeNull();
      expect(result[0].waveHeight).toBeNull();
    });

    it("returns null score when calculateDayScore returns 0", async () => {
      const beaches = [createMockBeach({ id: "beach-1" })];

      const forecastMap = new Map([
        [
          "beach-1",
          {
            forecasts: [
              { wave_height: "2.0", timestamp: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
      ]);
      getBatchFreshForecastsFromCache.mockResolvedValue(forecastMap);
      calculateDayScore.mockReturnValue(0);

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0].score).toBeNull();
    });

    it("handles wave height parsing from string", async () => {
      const beaches = [createMockBeach({ id: "beach-1" })];

      const forecastMap = new Map([
        [
          "beach-1",
          {
            forecasts: [
              { wave_height: "8.75", timestamp: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
      ]);
      getBatchFreshForecastsFromCache.mockResolvedValue(forecastMap);
      calculateDayScore.mockReturnValue(9);

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0].waveHeight).toBe(8.75);
    });
  });

  describe("Photo Enrichment", () => {
    it("returns null photoUrl when no photos exist", async () => {
      const beaches = [createMockBeach({ id: "beach-1" })];

      getBatchFreshForecastsFromCache.mockResolvedValue(new Map());

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0].photoUrl).toBeNull();
    });

    it("enriches beaches with photo URLs", async () => {
      const beaches = [
        createMockBeach({ id: "beach-1" }),
        createMockBeach({ id: "beach-2" }),
      ];

      getBatchFreshForecastsFromCache.mockResolvedValue(new Map());

      // Mock Supabase with photo data
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [
                  { beach_id: "beach-1", image_url: "https://example.com/photo1.jpg" },
                  { beach_id: "beach-2", image_url: "https://example.com/photo2.jpg" },
                ],
              })),
            })),
          })),
        })),
      };

      createSupabaseServiceRoleClient.mockReturnValue(mockSupabase);

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0].photoUrl).toBe("https://example.com/photo1.jpg");
      expect(result[1].photoUrl).toBe("https://example.com/photo2.jpg");
    });

    it("uses first photo per beach (deduplication)", async () => {
      const beaches = [createMockBeach({ id: "beach-1" })];

      getBatchFreshForecastsFromCache.mockResolvedValue(new Map());

      // Mock multiple photos for same beach
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [
                  { beach_id: "beach-1", image_url: "https://example.com/first.jpg" },
                  { beach_id: "beach-1", image_url: "https://example.com/second.jpg" },
                  { beach_id: "beach-1", image_url: "https://example.com/third.jpg" },
                ],
              })),
            })),
          })),
        })),
      };

      createSupabaseServiceRoleClient.mockReturnValue(mockSupabase);

      const result = await enrichBeachesWithConditions(beaches);

      // Should use the first photo in the results
      expect(result[0].photoUrl).toBe("https://example.com/first.jpg");
    });
  });

  describe("Combined Enrichment", () => {
    it("combines forecast and photo data correctly", async () => {
      const beaches = [
        createMockBeach({ id: "beach-1", name: "Beach One" }),
        createMockBeach({ id: "beach-2", name: "Beach Two" }),
      ];

      // Mock forecast data
      const forecastMap = new Map([
        [
          "beach-1",
          {
            forecasts: [
              { wave_height: "5.0", timestamp: "2024-01-01T12:00:00Z" },
            ],
          },
        ],
      ]);
      getBatchFreshForecastsFromCache.mockResolvedValue(forecastMap);
      calculateDayScore.mockReturnValue(7.5);

      // Mock photo data
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [
                  { beach_id: "beach-1", image_url: "https://example.com/photo1.jpg" },
                ],
              })),
            })),
          })),
        })),
      };

      createSupabaseServiceRoleClient.mockReturnValue(mockSupabase);

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0]).toMatchObject({
        id: "beach-1",
        name: "Beach One",
        score: 7.5,
        waveHeight: 5.0,
        photoUrl: "https://example.com/photo1.jpg",
      });

      expect(result[1]).toMatchObject({
        id: "beach-2",
        name: "Beach Two",
        score: null,
        waveHeight: null,
        photoUrl: null,
      });
    });

    it("preserves original beach properties", async () => {
      const beaches = [
        createMockBeach({
          id: "beach-1",
          name: "Test Beach",
          slug: "test-beach",
          city: "San Diego",
          state: "CA",
          lat: 32.8,
          lon: -117.2,
        }),
      ];

      getBatchFreshForecastsFromCache.mockResolvedValue(new Map());

      const result = await enrichBeachesWithConditions(beaches);

      expect(result[0]).toMatchObject({
        id: "beach-1",
        name: "Test Beach",
        slug: "test-beach",
        city: "San Diego",
        state: "CA",
        center_lat: 32.8,
        center_lng: -117.2,
        score: null,
        waveHeight: null,
        photoUrl: null,
      });
    });
  });
});

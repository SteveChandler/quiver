/**
 * Tests for ForecastStorageService
 *
 * These tests verify the storage service behavior including:
 * - Cleanup throttling (only runs once per hour per beach)
 * - Supabase typing
 */

// Track delete calls to verify throttling
const deleteMock = jest.fn();
const upsertMock = jest.fn();
// Result of the existing-real-rows lookup made before FALLBACK rows are written
const existingRowsResult: { data: Array<{ forecast_at: string }> | null; error: { message: string } | null } = {
  data: [],
  error: null,
};
const selectMock = jest.fn();

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      upsert: upsertMock.mockReturnValue({ data: [], error: null }),
      select: selectMock.mockImplementation(() => {
        const query = {
          eq: jest.fn(() => query),
          neq: jest.fn(() => query),
          gte: jest.fn(() => query),
          lte: jest.fn(async () => existingRowsResult),
        };
        return query;
      }),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: deleteMock.mockReturnValue({ error: null, count: 0 }),
        })),
      })),
    })),
  })),
}));

import { ForecastStorageService } from "@/lib/services/forecast/storage-service";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

describe("ForecastStorageService", () => {
  let service: ForecastStorageService;

  // Minimal mock beach - using unknown for test flexibility
  const mockBeach = {
    id: "beach-123",
    name: "Test Beach",
    center_lat: 33.5,
    center_lng: -117.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    timezone: "America/Los_Angeles",
    slug: "test-beach",
  } as unknown as Beach;

  // Minimal mock forecast - using unknown for test flexibility
  const mockForecast = {
    id: "forecast-1",
    beach_id: "beach-123",
    forecast_at: `${new Date().toISOString().split("T")[0]}T09:00Z`,
    forecast_date: new Date().toISOString().split("T")[0],
    forecast_time: "09:00",
    data_source: "CDIP",
    updated_at: new Date().toISOString(),
    wave_height: "3.5 ft",
    water_temp: "62°F",
    confidence_score: 80,
    created_at: new Date().toISOString(),
  } as unknown as EnhancedForecastEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    existingRowsResult.data = [];
    existingRowsResult.error = null;
    // Reset the static throttle map between tests
    // @ts-expect-error - accessing private static for testing
    ForecastStorageService.lastCleanupTime = new Map();
    service = new ForecastStorageService({ verboseLogging: false });
  });

  describe("cleanup throttling", () => {
    it("calls cleanup on first store operation", async () => {
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);

      // Delete should be called once (cleanup runs)
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });

    it("skips cleanup on subsequent store operations within throttle window", async () => {
      // First call - cleanup should run
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(1);

      // Second call immediately after - cleanup should be skipped
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Third call - still skipped
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(1); // Still 1
    });

    it("runs cleanup for different beaches independently", async () => {
      const beach2: Beach = { ...mockBeach, id: "beach-456" };
      const forecast2: EnhancedForecastEntity = { ...mockForecast, beach_id: "beach-456" };

      // First beach - cleanup runs
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(1);

      // Second beach - cleanup runs (different beach ID)
      await service.storeEnhancedForecasts(beach2, [forecast2]);
      expect(deleteMock).toHaveBeenCalledTimes(2);

      // First beach again - skipped (throttled)
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(2); // Still 2
    });

    it("runs cleanup after throttle window expires", async () => {
      // First call - cleanup runs
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(1);

      // Simulate time passing (1 hour + 1 minute)
      // @ts-expect-error - accessing private static for testing
      const throttleMap = ForecastStorageService.lastCleanupTime;
      throttleMap.set(mockBeach.id, Date.now() - 61 * 60 * 1000);

      // Second call after throttle expired - cleanup runs again
      await service.storeEnhancedForecasts(mockBeach, [mockForecast]);
      expect(deleteMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("storeEnhancedForecasts", () => {
    it("returns success for valid forecasts", async () => {
      const result = await service.storeEnhancedForecasts(mockBeach, [mockForecast]);

      expect(result.success).toBe(true);
      expect(upsertMock).toHaveBeenCalled();
    });

    it("deduplicates forecasts with same key", async () => {
      const duplicateForecasts: EnhancedForecastEntity[] = [
        mockForecast,
        { ...mockForecast, id: "forecast-2" }, // Same beach_id, date, time
      ];

      await service.storeEnhancedForecasts(mockBeach, duplicateForecasts);

      // Should only upsert 1 unique forecast
      const upsertCallArgs = upsertMock.mock.calls[0][0];
      expect(upsertCallArgs).toHaveLength(1);
    });

    it("deduplicates using forecast_at when available", async () => {
      const forecastWithAt = {
        ...mockForecast,
        forecast_at: "2026-02-14T17:00:00Z",
      } as unknown as EnhancedForecastEntity;

      const duplicateForecasts: EnhancedForecastEntity[] = [
        forecastWithAt,
        { ...forecastWithAt, id: "forecast-2" }, // Same beach_id + forecast_at
      ];

      await service.storeEnhancedForecasts(mockBeach, duplicateForecasts);

      // Should only upsert 1 unique forecast (deduped by beach_id|forecast_at)
      const upsertCallArgs = upsertMock.mock.calls[0][0];
      expect(upsertCallArgs).toHaveLength(1);
    });

    it("treats different forecast_at values as distinct forecasts", async () => {
      const forecast1 = {
        ...mockForecast,
        forecast_at: "2026-02-14T17:00:00Z",
      } as unknown as EnhancedForecastEntity;

      const forecast2 = {
        ...mockForecast,
        id: "forecast-2",
        forecast_at: "2026-02-14T18:00:00Z",
      } as unknown as EnhancedForecastEntity;

      await service.storeEnhancedForecasts(mockBeach, [forecast1, forecast2]);

      // Should upsert 2 distinct forecasts (different forecast_at values)
      const upsertCallArgs = upsertMock.mock.calls[0][0];
      expect(upsertCallArgs).toHaveLength(2);
    });

    it("uses onConflict with beach_id,forecast_at", async () => {
      const forecastWithAt = {
        ...mockForecast,
        forecast_at: "2026-02-14T17:00:00Z",
      } as unknown as EnhancedForecastEntity;

      await service.storeEnhancedForecasts(mockBeach, [forecastWithAt]);

      // Verify upsert was called with the new conflict clause
      expect(upsertMock).toHaveBeenCalledWith(
        expect.any(Array),
        { onConflict: "beach_id,forecast_at" }
      );
    });
  });
  describe("FALLBACK rows never overwrite real forecasts", () => {
    const fallbackAt = (forecastAt: string) =>
      ({
        ...mockForecast,
        id: `fb-${forecastAt}`,
        forecast_at: forecastAt,
        data_source: "FALLBACK",
        wave_height: "9-12 ft",
      }) as unknown as EnhancedForecastEntity;

    const upsertedTimes = () =>
      (upsertMock.mock.calls[0]?.[0] ?? []).map((row: { forecast_at: string }) => row.forecast_at);

    it("skips FALLBACK slots that already hold a real forecast and writes the rest", async () => {
      existingRowsResult.data = [{ forecast_at: "2026-10-18T18:00:00+00:00" }];

      await service.storeEnhancedForecasts(mockBeach, [
        fallbackAt("2026-10-18T18:00:00.000Z"),
        fallbackAt("2026-10-18T21:00:00.000Z"),
      ]);

      expect(upsertedTimes()).toEqual(["2026-10-18T21:00:00.000Z"]);
      expectConsoleWarnings([/Kept 1 real forecast slots/]);
    });

    it("still writes real rows over existing rows", async () => {
      existingRowsResult.data = [{ forecast_at: "2026-10-18T18:00:00+00:00" }];
      const real = {
        ...mockForecast,
        forecast_at: "2026-10-18T18:00:00.000Z",
        data_source: "OPEN_METEO",
      } as unknown as EnhancedForecastEntity;

      await service.storeEnhancedForecasts(mockBeach, [real]);

      expect(selectMock).not.toHaveBeenCalled();
      expect(upsertedTimes()).toEqual(["2026-10-18T18:00:00.000Z"]);
    });

    it("writes FALLBACK rows when no real forecast exists for the slot", async () => {
      await service.storeEnhancedForecasts(mockBeach, [fallbackAt("2026-10-30T00:00:00.000Z")]);

      expect(selectMock).toHaveBeenCalledWith("forecast_at");
      expect(upsertedTimes()).toEqual(["2026-10-30T00:00:00.000Z"]);
    });

    it("skips FALLBACK rows when the lookup fails, but keeps real rows", async () => {
      existingRowsResult.error = { message: "statement timeout" };
      const real = {
        ...mockForecast,
        forecast_at: "2026-10-18T15:00:00.000Z",
        data_source: "OPEN_METEO",
      } as unknown as EnhancedForecastEntity;

      const result = await service.storeEnhancedForecasts(mockBeach, [
        real,
        fallbackAt("2026-10-18T18:00:00.000Z"),
      ]);

      expect(result.success).toBe(true);
      expect(upsertedTimes()).toEqual(["2026-10-18T15:00:00.000Z"]);
      expectConsoleWarnings([/Could not check existing forecasts/]);
    });
  });
});

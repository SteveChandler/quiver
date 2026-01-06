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

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      upsert: upsertMock.mockReturnValue({ data: [], error: null }),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: deleteMock.mockReturnValue({ error: null, count: 0 }),
        })),
      })),
    })),
  })),
}));

import { ForecastStorageService } from "@/lib/services/forecast/storage-service";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

describe("ForecastStorageService", () => {
  let service: ForecastStorageService;

  // Minimal mock beach - using unknown for test flexibility
  const mockBeach = {
    id: "beach-123",
    name: "Test Beach",
    region_id: "region-1",
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
  });
});

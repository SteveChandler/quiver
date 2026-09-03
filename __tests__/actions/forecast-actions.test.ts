import { describe, it, expect, beforeEach, vi } from "../setup/vitest-shim";
import * as ForecastActionsModule from "@/actions/forecast-actions";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Unwrap server action wrappers to direct functions
const getBeachForecasts = ForecastActionsModule.getBeachForecasts;
const getLatestBeachForecast = ForecastActionsModule.getLatestBeachForecast;
const getEnhancedBeachForecasts = ForecastActionsModule.getEnhancedBeachForecasts;
const getBeachForecastPreview = ForecastActionsModule.getBeachForecastPreview;
const getForecastForToday = ForecastActionsModule.getForecastForToday;
const updateBeachForecasts = ForecastActionsModule.updateBeachForecasts;
const updateAllBeachForecasts = ForecastActionsModule.updateAllBeachForecasts;

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createSupabaseServiceRoleClient: jest.fn(),
  createSupabaseServerClient: jest.fn(),
}));

// Mock the forecast utility modules
jest.mock("@/lib/utils/forecast-server-utils", () => ({
  __esModule: true,
  updateBeachForecast: jest.fn(),
}));

jest.mock("@/lib/utils/forecast-service-utils", () => ({
  __esModule: true,
  updateBeachForecast: jest.fn(),
  updateAllBeachForecasts: jest.fn(),
}));

jest.mock("@/lib/utils/current-forecast-utils", () => ({
  __esModule: true,
  getCurrentForecast: jest.fn((forecasts) => forecasts[0] || null),
  formatCurrentTime: jest.fn(() => "12:00:00"),
}));

jest.mock("@/lib/utils/forecast-client-utils", () => ({
  __esModule: true,
  isDataStale: jest.fn(() => false),
}));

jest.mock("@/lib/utils/forecast-at-adapter", () => ({
  __esModule: true,
  extractForecastDate: jest.fn((forecastAt: string) => forecastAt?.split("T")[0] || ""),
}));

const makeChain = () => {
  const obj: any = {};
  obj.select = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.in = jest.fn(() => obj);
  obj.order = jest.fn(() => obj);
  obj.limit = jest.fn();
  obj.gte = jest.fn(() => obj);
  obj.lte = jest.fn(() => obj);
  obj.lt = jest.fn(() => obj);
  return obj;
};

let forecastsChain: any;
let enhancedForecastsChain: any;
let tenDayViewChain: any;
let mockSupabaseClient: any;

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

beforeEach(() => {
  vi.clearAllMocks();

  // Recreate chains fresh for each test
  forecastsChain = makeChain();
  enhancedForecastsChain = makeChain();
  tenDayViewChain = makeChain();

  mockSupabaseClient = {
    from: jest.fn((table: string) => {
      if (table === "forecasts") return forecastsChain;
      if (table === "enhanced_forecasts") return enhancedForecastsChain;
      if (table === "ten_day_enhanced_forecasts") return tenDayViewChain;
      return makeChain();
    }),
    // getBeachForecastPreview now also fetches a live observation via the
    // get_nowcast_anchors RPC. Default to "no observation" so existing tests
    // remain focused on forecast-side behavior.
    rpc: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  (createSupabaseServiceRoleClient as unknown as jest.Mock).mockResolvedValue(
    mockSupabaseClient
  );
  (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  });
});

describe("Forecast Actions", () => {
  describe("getBeachForecasts", () => {
    it("should fetch forecasts for a specific beach with date filtering", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "beach-123",
          forecast_date: today,
          forecast_time: "09:00:00",
          wave_height: "3-4 ft",
          wind_speed: "10 mph",
        },
        {
          id: "forecast-2",
          beach_id: "beach-123",
          forecast_date: today,
          forecast_time: "12:00:00",
          wave_height: "4-5 ft",
          wind_speed: "12 mph",
        },
      ];

      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: mockForecasts,
        error: null,
      });

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockForecasts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("enhanced_forecasts");
      expect(enhancedForecastsChain.select).toHaveBeenCalledWith("*");
      expect(enhancedForecastsChain.eq).toHaveBeenCalledWith("beach_id", "beach-123");
      expect(enhancedForecastsChain.gte).toHaveBeenCalledWith(
        "forecast_at",
        `${today}T00:00:00Z`
      );
      expect(enhancedForecastsChain.limit).toHaveBeenCalledWith(50);
    });

    it("should order forecasts by forecast_at ascending", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await getBeachForecasts("beach-123");

      expect(enhancedForecastsChain.order).toHaveBeenCalledWith("forecast_at", {
        ascending: true,
      });
      expect(enhancedForecastsChain.order).toHaveBeenCalledTimes(1);
    });

    it("should handle database errors gracefully", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection failed" },
      });

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle unexpected errors", async () => {
      enhancedForecastsChain.limit.mockRejectedValueOnce(new Error("Network error"));

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should return empty array when no forecasts exist", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getLatestBeachForecast", () => {
    it("should fetch latest forecasts including past data", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "beach-123",
          forecast_date: today,
          forecast_time: "18:00:00",
          wave_height: "5-6 ft",
        },
      ];

      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: mockForecasts,
        error: null,
      });

      const result = await getLatestBeachForecast("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockForecasts);
      expect(enhancedForecastsChain.order).toHaveBeenCalledWith("forecast_at", {
        ascending: false,
      });
      expect(enhancedForecastsChain.order).toHaveBeenCalledTimes(1);
      expect(enhancedForecastsChain.limit).toHaveBeenCalledWith(5);
    });

    it("should handle database errors", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: null,
        error: { message: "Query failed" },
      });

      const result = await getLatestBeachForecast("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
    });
  });

  describe("getEnhancedBeachForecasts", () => {
    it("should fetch enhanced forecasts with metadata from view", async () => {
      const mockEnhancedForecasts: EnhancedForecastEntity[] = [
        {
          id: "enhanced-1",
          beach_id: "beach-123",
          forecast_at: `${today}T12:00:00Z`,
          forecast_date: today,
          forecast_time: "12:00:00",
          wave_height: "3-4 ft",
          wind_speed: "10 mph",
          wind_direction: "SW",
          tide_status: "Rising",
          confidence_score: 85,
          data_source: "CDIP",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          wave_period: "8s",
          wave_direction: "SW",
          tide_height: "2.5 ft",
          next_tide_time: "18:00",
          next_tide_type: "High",
          next_tide_height: "5.2 ft",
          water_temp: "68°F",
          air_temperature: "72°F",
          weather_condition: "Sunny",
          raw_forecast: {
            data_sources: ["CDIP", "NOAA_NWS"],
            cdip_data: {
              stationId: "094",
              stationName: "Oceanside",
            },
          },
        },
      ];

      // Mock the view query - single order() on forecast_at returns a promise
      const mockOrderChain = {
        then: jest.fn((resolve) => resolve({ data: mockEnhancedForecasts, error: null })),
      };
      tenDayViewChain.select.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.eq.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.order.mockReturnValueOnce(mockOrderChain);

      const result = await getEnhancedBeachForecasts("beach-123", 12);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0]).toHaveProperty("metadata");
      expect(result.data![0].metadata).toMatchObject({
        primarySource: "CDIP",
        allSources: ["CDIP", "NOAA_NWS"],
        confidenceScore: 85,
        cdipStation: "094",
        cdipStationName: "Oceanside",
        isRealTimeData: true,
        isStaleData: false,
      });
    });

    it("should query enhanced_forecasts directly when a startDate is provided", async () => {
      const historicalStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const mockTableChain = {
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockTableChain);

      await getEnhancedBeachForecasts("beach-123", 1, {
        startDate: historicalStartDate,
      });

      expect(tenDayViewChain.select).not.toHaveBeenCalled();
      expect(enhancedForecastsChain.gte).toHaveBeenCalledWith(
        "forecast_at",
        `${historicalStartDate}T00:00:00Z`
      );
    });

    it("should fallback to enhanced_forecasts table when view fails", async () => {
      const mockEnhancedForecasts: EnhancedForecastEntity[] = [
        {
          id: "enhanced-1",
          beach_id: "beach-123",
          forecast_at: `${today}T12:00:00Z`,
          forecast_date: today,
          forecast_time: "12:00:00",
          wave_height: "3-4 ft",
          wind_speed: "10 mph",
          wind_direction: "SW",
          tide_status: "Rising",
          confidence_score: 75,
          data_source: "NOAA_NWS",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          wave_period: "7s",
          wave_direction: "W",
          tide_height: "3.0 ft",
          next_tide_time: "16:00",
          next_tide_type: "Low",
          next_tide_height: "1.0 ft",
          water_temp: "66°F",
          air_temperature: "70°F",
          weather_condition: "Cloudy",
          raw_forecast: null,
        },
      ];

      // View fails
      const mockViewChain = {
        then: jest.fn((resolve) => resolve({ data: null, error: { message: "View not found" } })),
      };
      tenDayViewChain.select.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.eq.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.order.mockReturnValueOnce(mockViewChain);

      // Table succeeds
      const mockTableChain = {
        then: jest.fn((resolve) => resolve({ data: mockEnhancedForecasts, error: null })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockTableChain);

      const result = await getEnhancedBeachForecasts("beach-123", 10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(enhancedForecastsChain.gte).toHaveBeenCalledWith(
        "forecast_at",
        `${today}T00:00:00Z`
      );
    });

    it("should handle database errors", async () => {
      // View fails
      const mockViewChain = {
        then: jest.fn((resolve) => resolve({ data: null, error: { message: "View error" } })),
      };
      tenDayViewChain.select.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.eq.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.order.mockReturnValueOnce(mockViewChain);

      // Table also fails
      const mockTableChain = {
        then: jest.fn((resolve) => resolve({ data: null, error: { message: "Table error" } })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockTableChain);

      const result = await getEnhancedBeachForecasts("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Table error");
    });
  });

  describe("getBeachForecastPreview", () => {
    it("should return enhanced forecast preview with metadata", async () => {
      const mockEnhancedForecasts = [
        {
          forecast_date: today,
          forecast_time: "12:00:00",
          wave_height: "4-5 ft",
          wind_speed: "12 mph",
          wind_direction: "W",
          weather_condition: "Sunny",
          confidence_score: 90,
          data_source: "CDIP",
        },
      ];

      const mockChain = {
        then: jest.fn((resolve) => resolve({ data: mockEnhancedForecasts, error: null })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockChain);

      const result = await getBeachForecastPreview("beach-123");

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nowcast_anchors", expect.any(Object),
      );
      expect(mockSupabaseClient.rpc.mock.results[0].value.eq).toHaveBeenCalledWith(
        "beach_id", "beach-123",
      );
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        type: "enhanced",
        wave_height: "4-5 ft",
        wind_speed: "12 mph",
        wind_direction: "W",
        weather_condition: "Sunny",
        confidence_score: 90,
      });
      expect(result.data!.metadata).toMatchObject({
        primarySource: "CDIP",
        confidenceScore: 90,
        isRealTimeData: true,
      });
    });

    it("should return null data when enhanced forecasts query errors", async () => {
      // The basic `forecasts` table fallback was removed 2026-04-25 — it
      // didn't exist in prod (42P01) and only served to render raw,
      // non-face-height numbers that disagreed with every other surface.
      // When enhanced fails, we now surface null and let WaveHeightDisplay
      // render "—" rather than fabricating a wrong number.
      const mockEnhancedChain = {
        then: jest.fn((resolve) => resolve({ data: null, error: { message: "No enhanced data" } })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockEnhancedChain);

      const result = await getBeachForecastPreview("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      // Defense-in-depth: confirm we did NOT query the dropped `forecasts`
      // relation. (Calling it would hit a 42P01 in prod.)
      expect(forecastsChain.select).not.toHaveBeenCalled();
    });

    it("should return null data when no forecasts available", async () => {
      const mockEnhancedChain = {
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockEnhancedChain);

      const result = await getBeachForecastPreview("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(forecastsChain.select).not.toHaveBeenCalled();
    });
  });

  describe("updateBeachForecasts", () => {
    it("should update forecasts for a specific beach", async () => {
      const { updateBeachForecast } = await import(
        "@/lib/utils/forecast-service-utils"
      );

      const mockUpdateResult = {
        success: true,
        forecastsCreated: 48,
      };

      (updateBeachForecast as jest.Mock).mockResolvedValueOnce(
        mockUpdateResult
      );

      const result = await updateBeachForecasts("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdateResult);
      expect(updateBeachForecast).toHaveBeenCalledWith("beach-123");
    });

    it("should handle update errors", async () => {
      const { updateBeachForecast } = await import(
        "@/lib/utils/forecast-service-utils"
      );

      (updateBeachForecast as jest.Mock).mockRejectedValueOnce(
        new Error("API rate limit exceeded")
      );

      const result = await updateBeachForecasts("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API rate limit exceeded");
    });
  });

  describe("updateAllBeachForecasts", () => {
    it("should update forecasts for all beaches", async () => {
      const { updateAllBeachForecasts: updateAll } = await import(
        "@/lib/utils/forecast-service-utils"
      );

      const mockResults = {
        results: [
          { beachId: "beach-1", success: true, forecastsCreated: 48 },
          { beachId: "beach-2", success: true, forecastsCreated: 48 },
          { beachId: "beach-3", success: false, error: "No data" },
        ],
      };

      (updateAll as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await updateAllBeachForecasts();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        total: 3,
        successful: 2,
        failed: 1,
        results: mockResults.results,
      });
    });

    it("should handle errors during batch update", async () => {
      const { updateAllBeachForecasts: updateAll } = await import(
        "@/lib/utils/forecast-service-utils"
      );

      (updateAll as jest.Mock).mockRejectedValueOnce(
        new Error("Batch update failed")
      );

      const result = await updateAllBeachForecasts();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Batch update failed");
    });

    it("should handle empty results gracefully", async () => {
      const { updateAllBeachForecasts: updateAll } = await import(
        "@/lib/utils/forecast-service-utils"
      );

      (updateAll as jest.Mock).mockResolvedValueOnce({ results: [] });

      const result = await updateAllBeachForecasts();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid beach IDs gracefully", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getBeachForecasts("invalid-beach-id");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle empty strings as beach IDs", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getBeachForecasts("");

      expect(result.success).toBe(true);
      expect(enhancedForecastsChain.eq).toHaveBeenCalledWith("beach_id", "");
    });

    it("should handle missing forecast fields gracefully", async () => {
      const incompleteForecasts = [
        {
          id: "incomplete-1",
          beach_id: "beach-123",
          forecast_date: today,
          // Missing forecast_time, wave_height, etc.
        },
      ];

      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: incompleteForecasts,
        error: null,
      });

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(incompleteForecasts);
    });

    it("should handle network timeouts", async () => {
      enhancedForecastsChain.limit.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await getBeachForecasts("beach-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });
  });

  describe("Date Range Logic", () => {
    it("should filter forecasts to future dates only in getBeachForecasts", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await getBeachForecasts("beach-123");

      expect(enhancedForecastsChain.gte).toHaveBeenCalledWith(
        "forecast_at",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/)
      );
    });

    it("should calculate correct end date in getEnhancedBeachForecasts", async () => {
      // View fails, fallback to table
      const mockViewChain = {
        then: jest.fn((resolve) => resolve({ data: null, error: { message: "No view" } })),
      };
      tenDayViewChain.select.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.eq.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.order.mockReturnValueOnce(mockViewChain);

      const mockTableChain = {
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
      };
      enhancedForecastsChain.select.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.eq.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.gte.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.lt.mockReturnValueOnce(enhancedForecastsChain);
      enhancedForecastsChain.order.mockReturnValueOnce(mockTableChain);

      const daysParam = 7;
      await getEnhancedBeachForecasts("beach-123", daysParam);

      const startDate = today;
      const expectedEndDate = new Date(
        new Date().getTime() + daysParam * 86400000
      )
        .toISOString()
        .split("T")[0];
      // dayAfterEndDate = endDate + 1 day
      const expectedDayAfterEndDate = new Date(
        new Date(expectedEndDate + 'T00:00:00Z').getTime() + 86400000
      )
        .toISOString()
        .split("T")[0];

      expect(enhancedForecastsChain.gte).toHaveBeenCalledWith(
        "forecast_at",
        `${startDate}T00:00:00Z`
      );
      expect(enhancedForecastsChain.lt).toHaveBeenCalledWith(
        "forecast_at",
        `${expectedDayAfterEndDate}T00:00:00Z`
      );
    });
  });

  describe("Response Structure Validation", () => {
    it("should return consistent success/error structure for getBeachForecasts", async () => {
      enhancedForecastsChain.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getBeachForecasts("beach-123");

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
      if (result.success) {
        expect(result).toHaveProperty("data");
      } else {
        expect(result).toHaveProperty("error");
      }
    });

    it("should include metadata in enhanced forecasts response", async () => {
      const mockEnhancedForecasts: EnhancedForecastEntity[] = [
        {
          id: "enhanced-1",
          beach_id: "beach-123",
          forecast_at: `${today}T12:00:00Z`,
          forecast_date: today,
          forecast_time: "12:00:00",
          wave_height: "3-4 ft",
          wind_speed: "10 mph",
          wind_direction: "SW",
          tide_status: "Rising",
          confidence_score: 85,
          data_source: "NOAA_NWS",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          wave_period: "8s",
          wave_direction: "SW",
          tide_height: "2.5 ft",
          next_tide_time: "18:00",
          next_tide_type: "High",
          next_tide_height: "5.2 ft",
          water_temp: "68°F",
          air_temperature: "72°F",
          weather_condition: "Sunny",
          raw_forecast: null,
        },
      ];

      const mockChain = {
        then: jest.fn((resolve) => resolve({ data: mockEnhancedForecasts, error: null })),
      };
      tenDayViewChain.select.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.eq.mockReturnValueOnce(tenDayViewChain);
      tenDayViewChain.order.mockReturnValueOnce(mockChain);

      const result = await getEnhancedBeachForecasts("beach-123");

      expect(result.success).toBe(true);
      expect(result.data![0]).toHaveProperty("metadata");
      expect(result.data![0].metadata).toMatchObject({
        primarySource: expect.any(String),
        allSources: expect.any(Array),
        confidenceScore: expect.any(Number),
        lastUpdated: expect.any(String),
        isRealTimeData: expect.any(Boolean),
        isStaleData: expect.any(Boolean),
      });
    });
  });
});

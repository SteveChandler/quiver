/**
 * Test to verify consistency between home page and beach details page forecast data
 * This ensures both pages show the same tide status and wind speed information
 */

import {
  getForecastForToday,
  getEnhancedBeachForecasts,
} from "@/actions/forecast-actions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Mock the Supabase client
jest.mock("@/lib/supabase/server");

// Mock data that represents a typical enhanced forecast
const mockEnhancedForecast = {
  id: "test-forecast-1",
  beach_id: "test-beach-123",
  forecast_date: new Date().toISOString().split("T")[0], // Today
  forecast_time: "12:00:00",
  wave_height: "3-4 ft",
  wave_period: "7.2s",
  wave_direction: "SW",
  wind_speed: "10 mph",
  wind_direction: "SW",
  tide_status: "Falling", // This should be consistent between both pages
  tide_height: "2.5 ft",
  next_tide_time: "18:30",
  next_tide_type: "Low",
  next_tide_height: "0.2 ft",
  water_temp: "74°F",
  air_temperature: "72°F",
  weather_condition: "Partly Cloudy",
  confidence_score: 85,
  data_source: "NOAA_WAVEWATCH",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("Forecast Consistency Test", () => {
  const testBeachId = "test-beach-123";

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a comprehensive mock that handles all the chaining
    const createMockQuery = () => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    });

    const mockSupabase = {
      ...createMockQuery(),
      order: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({
          data: [mockEnhancedForecast],
          error: null,
        }),
      })),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(
      mockSupabase
    );
  });

  describe("Home Page vs Beach Details Data Consistency", () => {
    it("should return the same forecast data from both getForecastForToday and getEnhancedBeachForecasts", async () => {
      // Get forecast data as home page would (getForecastForToday)
      const homeForecast = await getForecastForToday(testBeachId);

      // Get forecast data as beach details page would (getEnhancedBeachForecasts + take first)
      const beachDetailResult = await getEnhancedBeachForecasts(
        testBeachId,
        10
      );
      const beachDetailForecasts = beachDetailResult.success
        ? beachDetailResult.data
        : [];
      const beachDetailForecast =
        beachDetailForecasts && beachDetailForecasts.length > 0
          ? beachDetailForecasts[0] // Beach details page uses forecasts[0] directly
          : null;

      // Both should return forecast data
      expect(homeForecast).not.toBeNull();
      expect(beachDetailForecast).not.toBeNull();

      // Verify they are the same forecast (by ID and core data)
      expect(homeForecast?.id).toBe(beachDetailForecast?.id);
      expect(homeForecast?.forecast_date).toBe(
        beachDetailForecast?.forecast_date
      );
      expect(homeForecast?.forecast_time).toBe(
        beachDetailForecast?.forecast_time
      );
    });

    it("should show consistent tide status between home page and beach details", async () => {
      // Get forecasts from both sources
      const homeForecast = await getForecastForToday(testBeachId);

      const beachDetailResult = await getEnhancedBeachForecasts(
        testBeachId,
        10
      );
      const beachDetailForecasts = beachDetailResult.success
        ? beachDetailResult.data
        : [];
      const beachDetailForecast =
        beachDetailForecasts && beachDetailForecasts.length > 0
          ? beachDetailForecasts[0] // Beach details page uses forecasts[0] directly
          : null;

      // Both should have the same tide status
      expect(homeForecast?.tide_status).toBe(beachDetailForecast?.tide_status);
      expect(homeForecast?.tide_status).toBe("Falling"); // Expected correct value

      // Verify tide status is not "incoming" (the incorrect value)
      expect(homeForecast?.tide_status).not.toBe("incoming");
      expect(homeForecast?.tide_status).not.toBe("Incoming");
    });

    it("should show consistent wind speed between home page and beach details", async () => {
      // Get forecasts from both sources
      const homeForecast = await getForecastForToday(testBeachId);

      const beachDetailResult = await getEnhancedBeachForecasts(
        testBeachId,
        10
      );
      const beachDetailForecasts = beachDetailResult.success
        ? beachDetailResult.data
        : [];
      const beachDetailForecast =
        beachDetailForecasts && beachDetailForecasts.length > 0
          ? beachDetailForecasts[0] // Beach details page uses forecasts[0] directly
          : null;

      // Both should have the same wind speed
      expect(homeForecast?.wind_speed).toBe(beachDetailForecast?.wind_speed);
      expect(homeForecast?.wind_speed).toBe("10 mph"); // Expected correct value
    });

    it("should use the same data source and return consistent data", async () => {
      // Both functions should return data from the same source and be consistent
      const homeForecast = await getForecastForToday(testBeachId);
      const beachDetailResult = await getEnhancedBeachForecasts(
        testBeachId,
        10
      );

      // Verify both are using the enhanced forecast data (has tide_status and wind_speed)
      expect(homeForecast).toHaveProperty("tide_status");
      expect(homeForecast).toHaveProperty("wind_speed");
      expect(beachDetailResult.success).toBe(true);
      expect(beachDetailResult.data?.[0]).toHaveProperty("tide_status");
      expect(beachDetailResult.data?.[0]).toHaveProperty("wind_speed");
    });
  });

  describe("Integration Test", () => {
    it("should demonstrate the bug fix by showing consistent data", async () => {
      // This test documents the fix for the original bug
      const homeForecast = await getForecastForToday(testBeachId);
      const beachDetailResult = await getEnhancedBeachForecasts(
        testBeachId,
        10
      );
      const beachDetailForecast = beachDetailResult.data?.[0];

      console.log("🏠 Home page tide status:", homeForecast?.tide_status);
      console.log(
        "🏖️ Beach details tide status:",
        beachDetailForecast?.tide_status
      );
      console.log("🏠 Home page wind speed:", homeForecast?.wind_speed);
      console.log(
        "🏖️ Beach details wind speed:",
        beachDetailForecast?.wind_speed
      );

      // Assert consistency - this test should now pass after the fix
      expect(homeForecast?.tide_status).toBe(beachDetailForecast?.tide_status);
      expect(homeForecast?.wind_speed).toBe(beachDetailForecast?.wind_speed);

      // Verify we're getting the correct data format
      expect(homeForecast?.tide_status).toMatch(
        /^(Rising|Falling|High|Low|High Slack|Low Slack)$/
      );
      expect(homeForecast?.wind_speed).toMatch(/^\d+\s*mph$/i);

      // Most importantly, verify the bug is fixed
      expect(homeForecast?.tide_status).not.toBe("incoming");
      expect(homeForecast?.tide_status).not.toBe("Incoming");
    });
  });
});

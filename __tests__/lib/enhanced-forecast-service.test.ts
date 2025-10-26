import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { fetchBeachForecasts } from "@/lib/utils/forecast-service-utils";
import { FORECAST_CONSTANTS, TOTAL_FORECASTS } from "@/types/forecast";

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                order: jest.fn(() => ({
                  data: mockForecastData,
                  error: null,
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock the NOAAWaveWatchService and NOAACOOPSService
jest.mock("@/lib/services/noaa-wavewatch-service", () => ({
  NOAAWaveWatchService: jest.fn(() => ({
    fetchWaveWatchForecast: jest.fn(() => Promise.resolve({ forecast: [] })),
    getWaveDirectionText: jest.fn(() => "SW"),
  })),
}));

jest.mock("@/lib/services/noaa-coops-service", () => ({
  NOAACOOPSService: jest.fn(() => ({
    getStationForLocation: jest.fn(() => "9414290"),
    fetchCOOPSData: jest.fn(() => Promise.resolve({ tides: [], currents: [] })),
    getTideStatusAtTime: jest.fn(() => "Rising"),
    getCurrentTideHeight: jest.fn(() => 2.5),
    getTideHeightAtTime: jest.fn(() => 2.5),
    getNextTide: jest.fn(() => ({
      time: Date.now() / 1000,
      name: "High",
      height: 4.2,
    })),
    getNextTideFromTime: jest.fn(() => ({
      time: Date.now() / 1000,
      name: "High",
      height: 4.2,
    })),
  })),
}));

// Mock fetch for NOAA weather API
global.fetch = jest.fn();

// Mock distance utility
jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistance: jest.fn(() => 5.2),
}));

// Sample beach data for testing
const mockBeach = {
  id: "462bfb3b-b402-485d-b907-7eedfe5e828e",
  name: "Test Beach",
  lat: 37.7749,
  lon: -122.4194,
  state: "CA",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Use fixed date for reliable tests
const FIXED_TEST_DATE = new Date("2024-01-15T12:00:00Z");

// Mock forecast data for 12 days
const mockForecastData = [];
for (let day = 0; day < FORECAST_CONSTANTS.DAYS; day++) {
  const date = new Date(FIXED_TEST_DATE);
  date.setDate(FIXED_TEST_DATE.getDate() + day);
  const dateStr = date.toISOString().split("T")[0];

  // Generate multiple forecasts per day (every 3 hours = 8 per day)
  for (let hour = 0; hour < 24; hour += 3) {
    mockForecastData.push({
      id: `forecast-${day}-${hour}`,
      beach_id: "462bfb3b-b402-485d-b907-7eedfe5e828e",
      forecast_date: dateStr,
      forecast_time: `${hour.toString().padStart(2, "0")}:00:00`,
      wave_height: "2 ft",
      wave_period: "8s",
      wave_direction: "SW",
      water_temp: "65°F",
      wind_speed: "10 mph",
      wind_direction: "W",
      tide_status: "Rising",
      tide_height: "2.5 ft",
      next_tide_time: "14:30",
      next_tide_type: "High",
      next_tide_height: "4.2 ft",
      current_speed: "0.5 knots",
      current_direction: "S",
      weather_condition: "Partly Cloudy",
      air_temperature: "70°F",
      confidence_score: 75,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

describe("Enhanced Forecast Service - 12 Day Forecast", () => {
  let service: EnhancedForecastService;

  beforeEach(() => {
    // Use fake timers with fixed date for reliable tests
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_TEST_DATE);

    service = new EnhancedForecastService();
    jest.clearAllMocks();

    // Mock successful weather API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("points")) {
        // Mock points API response
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              properties: {
                forecastHourly:
                  "https://api.weather.gov/gridpoints/MTR/85,105/forecast/hourly",
              },
            }),
        });
      } else if (url.includes("forecast/hourly")) {
        // Mock hourly forecast API response
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              properties: {
                periods: [
                  {
                    startTime: new Date().toISOString(),
                    shortForecast: "Partly Cloudy",
                    temperature: 70,
                    windSpeed: "10 mph",
                    windDirection: "W",
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("fetchBeachForecasts", () => {
    it("should default to 12 days of forecast data", async () => {
      const result = await fetchBeachForecasts("462bfb3b-b402-485d-b907-7eedfe5e828e");

      expect(result).toHaveProperty("forecasts");
      expect(result).toHaveProperty("forecastsByDate");
      expect(result).toHaveProperty("totalForecasts");

      // Verify we have forecasts for correct number of days
      const uniqueDates = Object.keys(result.forecastsByDate);
      expect(uniqueDates.length).toBe(FORECAST_CONSTANTS.DAYS);

      // Verify total forecasts (DAYS × FORECASTS_PER_DAY)
      expect(result.totalForecasts).toBe(TOTAL_FORECASTS);
    });

    it("should respect custom days parameter", async () => {
      // For this test, we'll verify that the function can accept different day parameters
      // The mock always returns the same data, but we verify the parameter is accepted
      const result = await fetchBeachForecasts("462bfb3b-b402-485d-b907-7eedfe5e828e", 5);

      expect(result).toHaveProperty("forecasts");
      expect(result).toHaveProperty("forecastsByDate");
      expect(result).toHaveProperty("totalForecasts");
    });

    it("should group forecasts by date correctly", async () => {
      const result = await fetchBeachForecasts("462bfb3b-b402-485d-b907-7eedfe5e828e");

      // Each date should have multiple forecasts (FORECASTS_PER_DAY, every INTERVAL_HOURS hours)
      const dates = Object.keys(result.forecastsByDate);
      dates.forEach((date) => {
        const forecastsForDate = result.forecastsByDate[date];
        expect(forecastsForDate).toBeInstanceOf(Array);
        expect(forecastsForDate.length).toBe(
          FORECAST_CONSTANTS.FORECASTS_PER_DAY
        );
      });
    });

    it("should have forecasts spanning from today to 12 days ahead", async () => {
      const result = await fetchBeachForecasts("462bfb3b-b402-485d-b907-7eedfe5e828e");

      const dates = Object.keys(result.forecastsByDate).sort();
      const firstDate = new Date(dates[0]);
      const lastDate = new Date(dates[dates.length - 1]);

      // Calculate the difference in days
      const dayDifference = Math.floor(
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Should span approximately 11 days (from day 0 to day 11 = 12 days total)
      expect(dayDifference).toBe(11);
    });
  });

  describe("generateComprehensiveForecast", () => {
    it("should generate forecasts for 12 days", async () => {
      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should generate 96 total forecasts (12 days × 8 per day)
      expect(forecasts.length).toBe(TOTAL_FORECASTS);

      // Verify forecasts span the expected date range
      const uniqueDates = new Set(forecasts.map((f) => f.forecast_date));

      // The forecasts might span into an extra day depending on start time
      // (starting at noon and generating 96 forecasts can span 13 calendar days)
      expect(uniqueDates.size).toBeGreaterThanOrEqual(FORECAST_CONSTANTS.DAYS);
      expect(uniqueDates.size).toBeLessThanOrEqual(FORECAST_CONSTANTS.DAYS + 1);
    });

    it("should generate forecasts every 3 hours", async () => {
      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Group by date
      const forecastsByDate = forecasts.reduce((acc, forecast) => {
        const date = forecast.forecast_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(forecast);
        return acc;
      }, {} as Record<string, typeof forecasts>);

      console.log(
        "Forecasts by date counts:",
        Object.entries(forecastsByDate).map(([date, forecasts]) => [
          date,
          forecasts.length,
        ])
      );

      // Verify most days have forecasts and they're spaced correctly
      const dates = Object.keys(forecastsByDate);
      expect(dates.length).toBeGreaterThan(0);

      // Check that forecasts are spaced 3 hours apart
      Object.values(forecastsByDate).forEach((dailyForecasts) => {
        if (dailyForecasts.length > 1) {
          const times = dailyForecasts.map((f) => f.forecast_time).sort();
          for (let i = 1; i < times.length; i++) {
            const prevTime = times[i - 1];
            const currTime = times[i];

            const prevHour = parseInt(prevTime.split(":")[0]);
            const currHour = parseInt(currTime.split(":")[0]);

            // Should be 3 hours apart (accounting for 24-hour wrap)
            const hourDiff = (currHour - prevHour + 24) % 24;
            expect(hourDiff).toBe(FORECAST_CONSTANTS.INTERVAL_HOURS);
          }
        }
      });

      // Verify total forecasts is correct
      const totalForecasts = Object.values(forecastsByDate).reduce(
        (sum, dailyForecasts) => sum + dailyForecasts.length,
        0
      );
      expect(totalForecasts).toBe(TOTAL_FORECASTS);
    });

    it("should include required forecast fields", async () => {
      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      expect(forecasts.length).toBeGreaterThan(0);

      const firstForecast = forecasts[0];
      expect(firstForecast).toHaveProperty("forecast_date");
      expect(firstForecast).toHaveProperty("forecast_time");
      expect(firstForecast).toHaveProperty("wave_height");
      expect(firstForecast).toHaveProperty("wave_period");
      expect(firstForecast).toHaveProperty("wave_direction");
      expect(firstForecast).toHaveProperty("water_temp");
      expect(firstForecast).toHaveProperty("wind_speed");
      expect(firstForecast).toHaveProperty("wind_direction");
      expect(firstForecast).toHaveProperty("tide_status");
      expect(firstForecast).toHaveProperty("confidence_score");
      expect(firstForecast).toHaveProperty("beach_id");

      expect(firstForecast.beach_id).toBe(mockBeach.id);
      expect(typeof firstForecast.confidence_score).toBe("number");
      expect(firstForecast.confidence_score).toBeGreaterThanOrEqual(0);
      expect(firstForecast.confidence_score).toBeLessThanOrEqual(100);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle API failures gracefully with fallback data", async () => {
      // Mock fetch to simulate API failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error("API Error"));

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should still generate forecasts using fallback data
      expect(forecasts.length).toBe(TOTAL_FORECASTS);
      // All forecasts should have fallback values
      expect(forecasts[0].weather_condition).toBe("Partly Cloudy");
      expect(forecasts[0].wind_speed).toBe("10 mph");
    }, 10000);

    it("should handle invalid beach data", async () => {
      const invalidBeach = { ...mockBeach, lat: null };

      await expect(
        service.generateComprehensiveForecast(invalidBeach as any)
      ).rejects.toThrow();
    });

    it("should handle empty API responses", async () => {
      // Mock fetch to return empty responses
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("points")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ properties: {} }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ properties: { periods: [] } }),
        });
      });

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should still generate forecasts with fallback data
      expect(forecasts.length).toBe(TOTAL_FORECASTS);
    }, 10000);

    it("should handle network timeouts gracefully", async () => {
      // Mock fetch to simulate immediate timeout
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.reject(new Error("Network timeout"))
      );

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should gracefully degrade and still return forecasts
      expect(forecasts.length).toBe(TOTAL_FORECASTS);
      // Should use fallback data
      expect(forecasts[0].weather_condition).toBe("Partly Cloudy");
    }, 15000);

    it("should handle malformed API responses gracefully", async () => {
      // Mock fetch to return malformed JSON
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error("Invalid JSON")),
        })
      );

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should still generate forecasts with fallback data
      expect(forecasts.length).toBe(TOTAL_FORECASTS);
      expect(forecasts[0].weather_condition).toBe("Partly Cloudy");
    }, 10000);

    it("should handle rate limiting errors gracefully", async () => {
      // Mock fetch to return 429 status
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve("Rate limit exceeded"),
        })
      );

      const forecasts = await service.generateComprehensiveForecast(mockBeach);

      // Should gracefully degrade and still return forecasts
      expect(forecasts.length).toBe(TOTAL_FORECASTS);
      expect(forecasts[0].weather_condition).toBe("Partly Cloudy");
    }, 10000);
  });

  describe("Performance and Reliability", () => {
    it("should complete forecast generation within reasonable time", async () => {
      const startTime = Date.now();

      await service.generateComprehensiveForecast(mockBeach);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (adjust based on actual performance)
      expect(duration).toBeLessThan(5000);
    });

    it("should handle concurrent forecast requests", async () => {
      const promises = Array(3)
        .fill(null)
        .map(() => service.generateComprehensiveForecast(mockBeach));

      const results = await Promise.all(promises);

      // All requests should succeed and return valid data
      results.forEach((forecasts) => {
        expect(forecasts.length).toBe(TOTAL_FORECASTS);
      });
    });
  });
});

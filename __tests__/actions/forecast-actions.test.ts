import {
  getBeachForecasts,
  getLatestBeachForecast,
  getBeachForecastPreview,
  checkEnhancedForecastExists,
  getEnhancedBeachForecasts,
} from "@/actions/forecast-actions";

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  single: jest.fn(),
};

const createMockSupabaseServiceRoleClient = require("@/lib/supabase/server")
  .createSupabaseServiceRoleClient as jest.Mock;

describe("Forecast Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockSupabaseServiceRoleClient.mockResolvedValue(mockSupabaseClient);
  });

  describe("getBeachForecasts", () => {
    it("should fetch beach forecasts successfully", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "beach-1",
          forecast_date: "2024-01-01",
          forecast_time: "06:00",
          wave_height: "3-4 ft",
          wind_speed: "10 mph",
          wind_direction: "SW",
          weather_condition: "Sunny",
        },
        {
          id: "forecast-2",
          beach_id: "beach-1",
          forecast_date: "2024-01-01",
          forecast_time: "12:00",
          wave_height: "4-5 ft",
          wind_speed: "12 mph",
          wind_direction: "W",
          weather_condition: "Partly Cloudy",
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: mockForecasts,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getBeachForecasts("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockForecasts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("forecasts");
    });

    it("should handle database errors", async () => {
      const mockError = { message: "Database connection failed" };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: null,
                    error: mockError,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getBeachForecasts("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle unexpected errors", async () => {
      createMockSupabaseServiceRoleClient.mockRejectedValue(
        new Error("Unexpected error")
      );

      const result = await getBeachForecasts("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected error");
    });
  });

  describe("getLatestBeachForecast", () => {
    it("should fetch latest beach forecast successfully", async () => {
      const mockLatestForecasts = [
        {
          id: "forecast-latest",
          beach_id: "beach-1",
          forecast_date: "2024-01-01",
          forecast_time: "18:00",
          wave_height: "5-6 ft",
          wind_speed: "15 mph",
          wind_direction: "NW",
          weather_condition: "Clear",
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockLatestForecasts,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getLatestBeachForecast("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLatestForecasts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("forecasts");
    });
  });

  describe("getBeachForecastPreview", () => {
    it("should return enhanced forecast when available", async () => {
      const mockEnhancedForecast = [
        {
          wave_height: 4.5,
          wind_speed: 12,
          wind_direction: "SW",
          weather_condition: "Sunny",
          confidence_score: 85,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockEnhancedForecast,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getBeachForecastPreview("beach-1");

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe("enhanced");
      expect(result.data?.wave_height).toBe(4.5);
      expect(result.data?.confidence_score).toBe(85);
    });

    it("should fallback to basic forecast when enhanced is not available", async () => {
      const mockBasicForecast = [
        {
          wave_height: 3.0,
          wind_speed: 10,
          wind_direction: "W",
          weather_condition: "Cloudy",
        },
      ];

      // Mock enhanced forecast returning empty
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        // Mock basic forecast returning data
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: mockBasicForecast,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });

      const result = await getBeachForecastPreview("beach-1");

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe("basic");
      expect(result.data?.wave_height).toBe(3.0);
      expect(result.data?.confidence_score).toBeNull();
    });

    it("should return null when no forecast data is available", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getBeachForecastPreview("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("checkEnhancedForecastExists", () => {
    it("should check if enhanced forecast exists and is fresh", async () => {
      const mockEnhancedForecast = [
        {
          id: "enhanced-1",
          forecast_date: "2024-01-01",
          updated_at: new Date().toISOString(),
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockEnhancedForecast,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await checkEnhancedForecastExists("beach-1");

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isStale).toBe(false);
      expect(result.lastUpdated).toBe(mockEnhancedForecast[0].updated_at);
    });

    it("should detect stale enhanced forecasts", async () => {
      const mockStaleEnhancedForecast = [
        {
          id: "enhanced-1",
          forecast_date: "2024-01-01",
          updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockStaleEnhancedForecast,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await checkEnhancedForecastExists("beach-1");

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isStale).toBe(true);
    });

    it("should return false when no enhanced forecast exists", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await checkEnhancedForecastExists("beach-1");

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.isStale).toBe(false);
      expect(result.lastUpdated).toBeNull();
    });
  });

  describe("getEnhancedBeachForecasts", () => {
    it("should fetch enhanced beach forecasts for specified days", async () => {
      const mockEnhancedForecasts = [
        {
          id: "enhanced-1",
          beach_id: "beach-1",
          forecast_date: "2024-01-01",
          forecast_time: "06:00",
          wave_height: 4.5,
          wind_speed: 12,
          wind_direction: "SW",
          weather_condition: "Sunny",
          confidence_score: 85,
        },
        {
          id: "enhanced-2",
          beach_id: "beach-1",
          forecast_date: "2024-01-02",
          forecast_time: "06:00",
          wave_height: 5.0,
          wind_speed: 15,
          wind_direction: "W",
          weather_condition: "Partly Cloudy",
          confidence_score: 80,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockEnhancedForecasts,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getEnhancedBeachForecasts("beach-1", 12);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEnhancedForecasts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "enhanced_forecasts"
      );
    });

    it("should use default 12 days when no days specified", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getEnhancedBeachForecasts("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should handle null beach ID", async () => {
      const result = await getBeachForecasts("");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle Supabase client creation errors", async () => {
      createMockSupabaseServiceRoleClient.mockRejectedValue(
        new Error("Failed to create client")
      );

      const result = await getBeachForecasts("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create client");
    });
  });
});

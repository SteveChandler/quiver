import { NextRequest } from "next/server";
import { GET } from "@/app/api/session-planner/optimal-times/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mockUser,
  mockForecasts,
  mockOptimalTimesResponse,
  createMockRequest,
  simulateAuthError,
  simulateDatabaseError,
  setupMockSupabase,
} from "../../../../setup/session-planner-test-utils";

// Mock the dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/api-response-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    json: async () => ({
      success: true,
      data,
    }),
    status: 200,
    ok: true,
  })),
  createErrorResponse: jest.fn((message, details, status = 500) => ({
    json: async () => ({
      success: false,
      error: message,
      details,
      status: status || 500,
    }),
    status: status || 500,
    ok: false,
  })),
}));

const mockSupabaseServerClient =
  createSupabaseServerClient as jest.MockedFunction<
    typeof createSupabaseServerClient
  >;

describe("/api/session-planner/optimal-times", () => {
  setupMockSupabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET request", () => {
    it("should return optimal times for valid beach and date", async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockForecasts,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.beachId).toBe("beach-456");
      expect(result.data.date).toBe("2024-01-17");
      expect(result.data.optimalTimes).toHaveLength(2);
      expect(result.data.optimalTimes[0].time).toBe("06:00:00");
      expect(result.data.optimalTimes[0].score).toBeGreaterThan(0);
      expect(result.data.optimalTimes[0].conditions).toHaveProperty(
        "waveHeight"
      );
      expect(result.data.optimalTimes[0].conditions).toHaveProperty(
        "windSpeed"
      );
      expect(result.data.optimalTimes[0].rating).toMatch(
        /^(poor|fair|good|excellent)$/
      );
      expect(result.data.optimalTimes[0].reasons).toBeInstanceOf(Array);
      expect(result.data.forecastSource).toBe("enhanced");
    });

    it("should return error for missing beach ID", async () => {
      const request = createMockRequest({
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Beach ID is required");
      expect(result.status).toBe(400);
    });

    it("should return error for missing date", async () => {
      const request = createMockRequest({
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Date is required");
      expect(result.status).toBe(400);
    });

    it("should fallback to basic forecasts when enhanced forecasts are not available", async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          if (table === "forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockForecasts,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.forecastSource).toBe("basic");
      expect(result.data.optimalTimes).toHaveLength(2);
    });

    it("should return error when no forecast data is available", async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          if (table === "forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "No forecast data available for this beach and date"
      );
      expect(result.status).toBe(404);
    });

    it("should handle database error when fetching enhanced forecasts", async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue(simulateDatabaseError()),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch forecast data");
    });

    it("should handle database error when fetching basic forecasts fallback", async () => {
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          if (table === "forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue(simulateDatabaseError()),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "No forecast data available for this beach and date"
      );
      expect(result.status).toBe(404);
    });

    it("should analyze wave height scoring correctly", async () => {
      const mockGoodConditions = [
        {
          ...mockForecasts[0],
          wave_height: "4.0",
          wind_speed: "5mph",
          wind_direction: "NE",
          confidence_score: 0.85,
        },
        {
          ...mockForecasts[1],
          wave_height: "1.5",
          wind_speed: "15mph",
          wind_direction: "W",
          confidence_score: 0.6,
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockGoodConditions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(2);

      // First condition should score higher (better wave height and wind)
      expect(result.data.optimalTimes[0].score).toBeGreaterThan(
        result.data.optimalTimes[1].score
      );

      // Should have good wave height reason
      expect(result.data.optimalTimes[0].reasons).toContain(
        "Good wave height (4ft)"
      );
      expect(result.data.optimalTimes[0].reasons).toContain(
        "Light winds (5mph)"
      );
    });

    it("should handle wind direction scoring correctly", async () => {
      const mockWindConditions = [
        {
          ...mockForecasts[0],
          wind_direction: "NE", // Offshore
          wind_speed: "8mph",
        },
        {
          ...mockForecasts[1],
          wind_direction: "W", // Onshore
          wind_speed: "8mph",
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockWindConditions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(2);

      // Offshore wind should score higher
      expect(result.data.optimalTimes[0].score).toBeGreaterThan(
        result.data.optimalTimes[1].score
      );

      // Should have offshore wind reason
      expect(result.data.optimalTimes[0].reasons).toContain(
        "Offshore winds (NE)"
      );
    });

    it("should assign correct wave quality ratings", async () => {
      const mockExcellentConditions = [
        {
          ...mockForecasts[0],
          wave_height: "4.5",
          wind_speed: "5mph",
          wind_direction: "NE",
          confidence_score: 0.9,
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockExcellentConditions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(1);
      expect(result.data.optimalTimes[0].rating).toBe("excellent");
      expect(result.data.optimalTimes[0].conditions.waveQuality).toBe(
        "Excellent"
      );
    });

    it("should limit results to top 6 time slots", async () => {
      const mockManyForecasts = Array.from({ length: 10 }, (_, i) => ({
        ...mockForecasts[0],
        forecast_time: `${6 + i}:00:00`,
        wave_height: `${3 + i}`,
      }));

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockManyForecasts,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(6);
    });

    it("should sort results by score descending", async () => {
      const mockVariedConditions = [
        {
          ...mockForecasts[0],
          wave_height: "2.0",
          wind_speed: "15mph",
          forecast_time: "06:00:00",
        },
        {
          ...mockForecasts[1],
          wave_height: "4.5",
          wind_speed: "5mph",
          forecast_time: "07:00:00",
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockVariedConditions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(2);

      // First should be higher score (better conditions)
      expect(result.data.optimalTimes[0].score).toBeGreaterThan(
        result.data.optimalTimes[1].score
      );

      // Better conditions should be first
      expect(result.data.optimalTimes[0].time).toBe("07:00:00");
    });

    it("should handle network or unexpected errors", async () => {
      mockSupabaseServerClient.mockRejectedValue(new Error("Network error"));

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to analyze optimal surf times");
      expect(result.details).toBe("Network error");
    });

    it("should handle edge cases with missing forecast data fields", async () => {
      const mockIncompleteForecasts = [
        {
          ...mockForecasts[0],
          wave_height: null,
          wind_speed: null,
          wind_direction: null,
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "enhanced_forecasts") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockIncompleteForecasts,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        beachId: "beach-456",
        date: "2024-01-17",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.optimalTimes).toHaveLength(1);
      expect(result.data.optimalTimes[0].conditions.waveHeight).toBe(0);
      expect(result.data.optimalTimes[0].conditions.windSpeed).toBe(0);
      expect(result.data.optimalTimes[0].conditions.windDirection).toBe(
        "Variable"
      );
    });
  });
});

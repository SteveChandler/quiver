import { NextRequest } from "next/server";
import { GET } from "@/app/api/session-planner/gear-suggestions/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mockUser,
  mockBoards,
  mockSessions,
  mockGearSuggestionsResponse,
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

describe("/api/session-planner/gear-suggestions", () => {
  setupMockSupabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET request", () => {
    it("should return gear suggestions for authenticated user with valid parameters", async () => {
      // Mock Supabase client
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockBoards,
                error: null,
              }),
            };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              not: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.userId).toBe(mockUser.id);
      expect(result.data.conditions).toEqual({
        waveHeight: 4,
        windSpeed: 8,
        beachId: "beach-456",
      });
      expect(result.data.suggestions).toHaveLength(2);
      expect(result.data.suggestions[0].board.id).toBe("board-1");
      expect(result.data.suggestions[0].score).toBeGreaterThan(0);
      expect(result.data.suggestions[0].confidence).toBeGreaterThan(0);
      expect(result.data.suggestions[0].reasons).toBeInstanceOf(Array);
      expect(result.data.analysisResults.totalSessions).toBe(2);
      expect(result.data.analysisResults.analyzedSessions).toBe(2);
    });

    it("should return error for missing wave height parameter", async () => {
      const request = createMockRequest({
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Wave height and wind speed are required");
      expect(result.status).toBe(400);
    });

    it("should return error for missing wind speed parameter", async () => {
      const request = createMockRequest({
        waveHeight: "4",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Wave height and wind speed are required");
      expect(result.status).toBe(400);
    });

    it("should return error for unauthenticated user", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue(simulateAuthError()),
        },
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(result.status).toBe(401);
    });

    it("should handle user with no boards", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
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
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(0);
      expect(result.data.analysisResults.totalSessions).toBe(0);
      expect(result.data.analysisResults.recommendationBasis).toBe(
        "No boards found"
      );
    });

    it("should handle database error when fetching boards", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
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
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch user boards");
    });

    it("should handle database error when fetching sessions", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockBoards,
                error: null,
              }),
            };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              not: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue(simulateDatabaseError()),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch user sessions");
    });

    it("should handle different wave heights correctly", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: "longboard-1",
                    name: "Long Rider",
                    board_type: "Longboard",
                    dimensions: '9\'2" x 22" x 3"',
                    user_id: mockUser.id,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              not: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      // Test small waves (should favor longboards)
      const request = createMockRequest({
        waveHeight: "2",
        windSpeed: "5",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(1);
      expect(result.data.suggestions[0].board.board_type).toBe("Longboard");
      expect(result.data.suggestions[0].score).toBeGreaterThan(30); // Longboards score well in small waves
    });

    it("should handle beach-specific recommendations", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockBoards,
                error: null,
              }),
            };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              not: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: mockSessions.map((session) => ({
                  ...session,
                  beach_id: "beach-456", // Same beach as request
                })),
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(2);
      // Should get beach-specific bonus points
      expect(result.data.suggestions[0].reasons).toContain(
        "Good performance at this beach (4/5)"
      );
    });

    it("should handle invalid wave height parameter", async () => {
      const request = createMockRequest({
        waveHeight: "invalid",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Wave height and wind speed are required");
      expect(result.status).toBe(400);
    });

    it("should handle invalid wind speed parameter", async () => {
      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "invalid",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Wave height and wind speed are required");
      expect(result.status).toBe(400);
    });

    it("should sort suggestions by score descending", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "boards") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockBoards,
                error: null,
              }),
            };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              not: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(2);
      // First suggestion should have higher or equal score than second
      expect(result.data.suggestions[0].score).toBeGreaterThanOrEqual(
        result.data.suggestions[1].score
      );
    });

    it("should handle network or unexpected errors", async () => {
      mockSupabaseServerClient.mockRejectedValue(new Error("Network error"));

      const request = createMockRequest({
        waveHeight: "4",
        windSpeed: "8",
        beachId: "beach-456",
      });

      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to generate gear suggestions");
      expect(result.details).toBe("Network error");
    });
  });
});

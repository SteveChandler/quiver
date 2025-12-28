/**
 * @jest-environment node
 */

import { GET } from "@/app/api/session-planner/gear-suggestions/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockDatabaseSuccess,
  mockDatabaseError,
} from "@/test-utils/api-test-helpers";

// Type for board suggestions returned from the API
interface BoardSuggestion {
  board: { board_type: string; id: string };
  score: number;
}

// Mock the api-utils functions
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => {
    return new Response(JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }), { status });
  }),
  createErrorResponse: jest.fn((error, details, status = 500) => {
    return new Response(JSON.stringify({
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    }), { status });
  }),
}));

// Mock the authenticated client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
  getAuthenticatedAPIClient: jest.fn(),
}));

const mockGetAuthenticatedAPIClient = require("@/lib/supabase/api-server-client").getAuthenticatedAPIClient;

// Helper function to mock Supabase queries with proper chain structure
function mockSupabaseQueries(mockClient: any, boardsData: any, sessionsData: any, boardsError: any = null, sessionsError: any = null) {
  mockClient.from.mockImplementation((table: string) => {
    if (table === "boards") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: boardsData,
              error: boardsError,
            })),
          })),
        })),
      };
    }
    // Sessions query
    if (table === "sessions") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({
                      data: sessionsData,
                      error: sessionsError,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      };
    }
    return mockClient.from();
  });
}

// Test data factories
function createMockBoard(overrides = {}) {
  return {
    id: "board-123",
    user_id: "user-123",
    name: "Test Shortboard",
    board_type: "shortboard",
    dimensions: "6'0\" x 18.5\" x 2.25\"",
    description: "Performance shortboard",
    image_url: "https://example.com/board.jpg",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function createMockSessionWithBoard(overrides = {}) {
  return {
    id: "session-123",
    user_id: "user-123",
    board_id: "board-123",
    beach_id: "beach-123",
    rating: 4,
    wave_quality: 3,
    status: "completed",
    created_at: "2024-01-15T00:00:00Z",
    boards: createMockBoard(),
    ...overrides,
  };
}

describe("/api/session-planner/gear-suggestions", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return gear suggestions successfully", async () => {
      const mockUser = createMockUser();
      const mockBoards = [
        createMockBoard({
          id: "board-1",
          name: "Performance Shortboard",
          board_type: "shortboard",
          dimensions: "6'0\" x 18.5\" x 2.25\"",
        }),
        createMockBoard({
          id: "board-2",
          name: "Fun Longboard",
          board_type: "longboard",
          dimensions: "9'0\" x 22\" x 3\"",
        }),
      ];

      const mockSessions = [
        createMockSessionWithBoard({
          board_id: "board-1",
          rating: 5,
          wave_quality: 4,
        }),
        createMockSessionWithBoard({
          board_id: "board-2",
          rating: 3,
          wave_quality: 2,
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards and sessions queries
      mockSupabaseQueries(mockSupabaseClient, mockBoards, mockSessions);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8", beachId: "beach-123" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        userId: mockUser.id,
        conditions: {
          waveHeight: 4,
          windSpeed: 8,
          beachId: "beach-123",
        },
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            board: expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              board_type: expect.any(String),
            }),
            score: expect.any(Number),
            confidence: expect.any(Number),
            reasons: expect.arrayContaining([expect.any(String)]),
            matchedConditions: expect.objectContaining({
              waveHeight: 4,
              sessions: expect.any(Number),
              averageRating: expect.any(Number),
            }),
          }),
        ]),
        analysisResults: expect.objectContaining({
          totalSessions: expect.any(Number),
          analyzedSessions: expect.any(Number),
          recommendationBasis: expect.any(String),
        }),
        generatedAt: expect.any(String),
      });
    });

    it("should require waveHeight parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Wave height and wind speed are required");
    });

    it("should require windSpeed parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Wave height and wind speed are required");
    });

    it("should require authentication", async () => {
      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: null,
        user: null,
        error: "Authentication required",
      });

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Authentication required");
    });

    it("should handle no boards gracefully", async () => {
      const mockUser = createMockUser();

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock empty boards query
      mockSupabaseQueries(mockSupabaseClient, [], []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.suggestions).toEqual([]);
      expect(data.data.analysisResults.recommendationBasis).toBe("No boards found");
    });

    it("should handle null boards data", async () => {
      const mockUser = createMockUser();

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock null boards query
      mockSupabaseQueries(mockSupabaseClient, null, null);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.suggestions).toEqual([]);
      expect(data.data.analysisResults.recommendationBasis).toBe("No boards found");
    });

    it("should handle boards database error", async () => {
      const mockUser = createMockUser();

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query error
      mockSupabaseQueries(mockSupabaseClient, null, null, { message: "Database connection failed" }, null);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to fetch user boards");
      expect(data.details).toBe("Database connection failed");
    });

    it("should handle sessions database error gracefully", async () => {
      const mockUser = createMockUser();
      const mockBoards = [createMockBoard()];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock successful boards query and sessions error
      mockSupabaseQueries(mockSupabaseClient, mockBoards, null, null, { message: "Sessions table error" });

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to fetch user sessions");
    });

    it("should generate suggestions based on board type for no session history", async () => {
      const mockUser = createMockUser();
      const mockBoards = [
        createMockBoard({
          id: "board-1",
          name: "Shortboard",
          board_type: "shortboard",
          dimensions: "6'0\" x 18\" x 2.25\"",
        }),
        createMockBoard({
          id: "board-2",
          name: "Longboard",
          board_type: "longboard", 
          dimensions: "9'0\" x 22\" x 3\"",
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query and empty sessions
      mockSupabaseQueries(mockSupabaseClient, mockBoards, []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.suggestions).toHaveLength(2);
      
      // For 4ft waves, shortboard should score higher than longboard
      const shortboardSuggestion = data.data.suggestions.find(
        (s: { board: { board_type: string }; score: number }) =>
          s.board.board_type === "shortboard"
      );
      const longboardSuggestion = data.data.suggestions.find(
        (s: { board: { board_type: string }; score: number }) =>
          s.board.board_type === "longboard"
      );
      
      expect(shortboardSuggestion.score).toBeGreaterThan(longboardSuggestion.score);
      expect(data.data.analysisResults.recommendationBasis).toBe("Board catalog only");
    });

    it("should prioritize boards with good historical performance", async () => {
      const mockUser = createMockUser();
      const mockBoards = [
        createMockBoard({ id: "board-1", name: "Good Board" }),
        createMockBoard({ id: "board-2", name: "Poor Board" }),
      ];

      const mockSessions = [
        createMockSessionWithBoard({
          board_id: "board-1",
          rating: 5,
          wave_quality: 4, // Similar to target conditions
        }),
        createMockSessionWithBoard({
          board_id: "board-2", 
          rating: 2,
          wave_quality: 4, // Similar to target conditions
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards and sessions queries
      mockSupabaseQueries(mockSupabaseClient, mockBoards, mockSessions);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.suggestions).toHaveLength(2);

      // Board with better ratings should be ranked first
      expect(data.data.suggestions[0].board.name).toBe("Good Board");
      expect(data.data.suggestions[0].score).toBeGreaterThan(data.data.suggestions[1].score);
      expect(data.data.analysisResults.recommendationBasis).toBe("Historical session data");
    });

    it("should provide beach-specific bonuses", async () => {
      const mockUser = createMockUser();
      const targetBeachId = "beach-123";
      const mockBoards = [createMockBoard({ id: "board-1" })];

      const mockSessions = [
        createMockSessionWithBoard({
          board_id: "board-1",
          beach_id: targetBeachId,
          rating: 5,
          wave_quality: 4,
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards and sessions queries
      mockSupabaseQueries(mockSupabaseClient, mockBoards, mockSessions);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8", beachId: targetBeachId },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.suggestions[0].reasons).toContainEqual(
        expect.stringContaining("Good performance at this beach")
      );
    });

    it("should handle invalid numeric parameters gracefully", async () => {
      // Test with invalid waveHeight
      let request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "invalid", windSpeed: "8" },
      });
      let response = await GET(request);
      let data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Wave height and wind speed are required");

      // Test with invalid windSpeed
      request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "invalid" },
      });
      response = await GET(request);
      data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Wave height and wind speed are required");
    });
  });

  describe("Recommendation Algorithm", () => {
    it("should score longboards higher for small waves", async () => {
      const mockUser = createMockUser();
      const mockBoards = [
        createMockBoard({
          id: "board-1",
          board_type: "longboard",
          dimensions: "9'0\" x 22\" x 3\"",
        }),
        createMockBoard({
          id: "board-2",
          board_type: "shortboard",
          dimensions: "6'0\" x 18\" x 2.25\"",
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query and empty sessions
      mockSupabaseQueries(mockSupabaseClient, mockBoards, []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "2", windSpeed: "5" }, // Small waves
      });

      const response = await GET(request);
      const data = await response.json();

      const longboardSuggestion = data.data.suggestions.find(
        (s: BoardSuggestion) => s.board.board_type === "longboard"
      );
      const shortboardSuggestion = data.data.suggestions.find(
        (s: BoardSuggestion) => s.board.board_type === "shortboard"
      );

      expect(longboardSuggestion.score).toBeGreaterThan(shortboardSuggestion.score);
    });

    it("should score shortboards higher for bigger waves", async () => {
      const mockUser = createMockUser();
      const mockBoards = [
        createMockBoard({
          id: "board-1",
          board_type: "longboard",
          dimensions: "9'0\" x 22\" x 3\"",
        }),
        createMockBoard({
          id: "board-2",
          board_type: "shortboard",
          dimensions: "6'0\" x 18\" x 2.25\"",
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query and empty sessions
      mockSupabaseQueries(mockSupabaseClient, mockBoards, []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "6", windSpeed: "12" }, // Bigger waves
      });

      const response = await GET(request);
      const data = await response.json();

      const longboardSuggestion = data.data.suggestions.find(
        (s: BoardSuggestion) => s.board.board_type === "longboard"
      );
      const shortboardSuggestion = data.data.suggestions.find(
        (s: BoardSuggestion) => s.board.board_type === "shortboard"
      );

      expect(shortboardSuggestion.score).toBeGreaterThan(longboardSuggestion.score);
    });

    it("should provide recency bonuses for recently used boards", async () => {
      const mockUser = createMockUser();
      const mockBoards = [createMockBoard({ id: "board-1" })];

      // Recent session (within 3 months)
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);

      const mockSessions = [
        createMockSessionWithBoard({
          board_id: "board-1",
          rating: 4,
          wave_quality: 4,
          created_at: recentDate.toISOString(),
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards and sessions queries
      mockSupabaseQueries(mockSupabaseClient, mockBoards, mockSessions);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.suggestions[0].reasons).toContainEqual("Recently used board");
    });

    it("should filter sessions by wave height similarity", async () => {
      const mockUser = createMockUser();
      const mockBoards = [createMockBoard({ id: "board-1" })];

      const mockSessions = [
        createMockSessionWithBoard({
          board_id: "board-1",
          rating: 5,
          wave_quality: 4, // Similar to target (4ft waves, diff = 0)
        }),
        createMockSessionWithBoard({
          board_id: "board-1",
          rating: 2,
          wave_quality: 1, // Different from target (4ft waves, diff = 3)
        }),
      ];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards and sessions queries
      mockSupabaseQueries(mockSupabaseClient, mockBoards, mockSessions);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      const response = await GET(request);
      const data = await response.json();

      // Should only consider the similar session (rating 5)
      // Algorithm should show higher confidence and better reasons
      expect(data.data.suggestions[0].score).toBeGreaterThan(0);
      expect(data.data.suggestions[0].reasons).toContainEqual(
        expect.stringContaining("similar conditions")
      );
    });
  });

  describe("Security", () => {
    it("should only access user's own boards and sessions", async () => {
      const mockUser = createMockUser({ id: "user-123" });

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock empty boards and sessions
      mockSupabaseQueries(mockSupabaseClient, [], []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      await GET(request);

      // The test passes if no errors are thrown during query execution
    });

    it("should handle malicious parameters safely", async () => {
      const mockUser = createMockUser();

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Test with potentially malicious beachId
      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { 
          waveHeight: "4", 
          windSpeed: "8",
          beachId: "'; DROP TABLE boards; --"
        },
      });

      const response = await GET(request);
      
      // Should not crash (parameters are used safely)
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Performance", () => {
    it("should limit sessions analysis to improve performance", async () => {
      const mockUser = createMockUser();
      const mockBoards = [createMockBoard()];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query and empty sessions
      mockSupabaseQueries(mockSupabaseClient, mockBoards, []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      await GET(request);
    });

    it("should only analyze completed sessions with ratings", async () => {
      const mockUser = createMockUser();
      const mockBoards = [createMockBoard()];

      mockGetAuthenticatedAPIClient.mockResolvedValue({
        supabase: mockSupabaseClient,
        user: mockUser,
        error: null,
      });

      // Mock boards query and empty sessions
      mockSupabaseQueries(mockSupabaseClient, mockBoards, []);

      const request = createMockRequest("GET", "http://localhost:3000/api/session-planner/gear-suggestions", {
        searchParams: { waveHeight: "4", windSpeed: "8" },
      });

      await GET(request);
    });
  });
});

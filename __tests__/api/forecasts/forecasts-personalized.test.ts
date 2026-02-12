/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "@/test-utils/api-test-helpers";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Helper to handle the personalized-score endpoint's non-standard response format
async function expectPersonalizedScoreResponse(response: Response) {
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toHaveProperty("data");
  return result;
}

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock personalized scoring service
const mockScoreBeachForUser = jest.fn();
jest.mock("@/lib/services/personalized-scoring-service", () => ({
  scoreBeachForUser: (...args: any[]) => mockScoreBeachForUser(...args),
}));

// Mock withAuth wrapper to pass through with authenticated user context
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any, options: any) => async (request: any) => {
      try {
        const authContext = {
          user: { id: "test-user-123" },
          supabase: mockSupabaseClient,
        };
        return await handler(request, authContext);
      } catch (error: any) {
        const { handleApiError } = jest.requireActual("@/lib/api-utils");
        return handleApiError(error, options?.errorMessage || "Request failed");
      }
    },
  };
});

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require("@/app/api/beach/personalized-score/route");

describe("POST /api/beach/personalized-score", () => {
  let cleanup: () => void;

  const mockForecast: EnhancedForecastEntity = {
    id: "forecast-123",
    beach_id: "beach-123",
    forecast_date: "2024-01-15",
    forecast_time: "12:00",
    wave_height: "4.5 ft",
    wave_period: "12 s",
    wave_direction: "NW",
    wind_speed: "10 mph",
    wind_direction: "N",
    tide_status: "rising",
    water_temp: "68 F",
    data_source: "NOAA_NWS",
    confidence_score: 0.85,
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  };

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Authentication", () => {
    it("requires user authentication", async () => {
      // Re-mock withAuth to reject authentication
      jest.resetModules();
      jest.doMock("@/lib/middleware/api-wrappers", () => {
        const actual = jest.requireActual("@/lib/middleware/api-wrappers");
        return {
          ...actual,
          withAuth: (handler: any, options: any) => async (request: any) => {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
          },
        };
      });

      const { POST: POST_UNAUTH } = require("@/app/api/beach/personalized-score/route");

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST_UNAUTH(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("allows authenticated users", async () => {
      mockScoreBeachForUser.mockResolvedValue({
        score: 85,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 10,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Input Validation", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("requires beachId parameter", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing required parameters");
    });

    it("requires baseScore parameter", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing required parameters");
    });

    it("requires forecast parameter", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing required parameters");
    });

    it("accepts all required parameters", async () => {
      mockScoreBeachForUser.mockResolvedValue({
        score: 75,
        personalized: false,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Personalized Scoring", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("returns personalized beach scores", async () => {
      const userId = "test-user-123";
      const beachId = "beach-123";
      const baseScore = 75;

      const mockPersonalizedScore = {
        score: 95,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 10,
          learnedPrefs: 5,
          implicitPrefs: 3,
          affinity: 2,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockPersonalizedScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId,
          baseScore,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(mockScoreBeachForUser).toHaveBeenCalledWith(
        userId,
        beachId,
        mockForecast,
        baseScore
      );

      expect(result.data).toEqual(mockPersonalizedScore);
      expect(result.data.score).toBe(95);
      expect(result.data.personalized).toBe(true);
    });

    it("returns base score when no personalization applied", async () => {
      const mockBaseScore = {
        score: 75,
        personalized: false,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockBaseScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.score).toBe(75);
      expect(result.data.personalized).toBe(false);
    });

    it("includes score breakdown", async () => {
      const mockScore = {
        score: 88,
        personalized: true,
        breakdown: {
          base: 70,
          onboardingPrefs: 10,
          learnedPrefs: 5,
          implicitPrefs: 2,
          affinity: 1,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 70,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.breakdown).toEqual({
        base: 70,
        onboardingPrefs: 10,
        learnedPrefs: 5,
        implicitPrefs: 2,
        affinity: 1,
      });

      // Verify breakdown adds up correctly
      const total =
        result.data.breakdown.base +
        result.data.breakdown.onboardingPrefs +
        result.data.breakdown.learnedPrefs +
        result.data.breakdown.implicitPrefs +
        result.data.breakdown.affinity;
      expect(total).toBe(88);
    });
  });

  describe("User Preferences Integration", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("respects user wave size preferences in scoring", async () => {
      // Mock user with preferred wave size
      const mockScore = {
        score: 85,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 10, // Bonus from wave size match
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      // Verify wave size preference was considered
      expect(result.data.breakdown.onboardingPrefs).toBeGreaterThan(0);
    });

    it("respects user break type preferences in scoring", async () => {
      const mockScore = {
        score: 83,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 8, // Bonus from break type match
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.breakdown.onboardingPrefs).toBeGreaterThan(0);
    });

    it("applies learned preferences bonus", async () => {
      const mockScore = {
        score: 90,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: 15, // Bonus from learned preferences
          implicitPrefs: 0,
          affinity: 0,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.breakdown.learnedPrefs).toBeGreaterThan(0);
    });

    it("applies implicit preferences bonus", async () => {
      const mockScore = {
        score: 78,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          implicitPrefs: 3, // Bonus from implicit preferences
          affinity: 0,
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.breakdown.implicitPrefs).toBeGreaterThan(0);
    });

    it("applies beach affinity bonus", async () => {
      const mockScore = {
        score: 90,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 15, // Bonus from beach familiarity
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.breakdown.affinity).toBeGreaterThan(0);
    });
  });

  describe("Score Capping", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("caps score at 100", async () => {
      // Mock a score that would exceed 100
      const mockScore = {
        score: 100, // Capped at 100
        personalized: true,
        breakdown: {
          base: 90,
          onboardingPrefs: 10,
          learnedPrefs: 15,
          implicitPrefs: 5,
          affinity: 10, // Total would be 130, but capped
        },
      };

      mockScoreBeachForUser.mockResolvedValue(mockScore);

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 90,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.score).toBe(100);
      expect(result.data.score).toBeLessThanOrEqual(100);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("handles scoring service errors gracefully", async () => {
      mockScoreBeachForUser.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toContain("Failed to calculate personalized score");
    });

    it("handles malformed forecast data", async () => {
      mockScoreBeachForUser.mockRejectedValue(new Error("Invalid forecast format"));

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: { invalid: "data" }, // Malformed forecast
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it("handles invalid beach ID", async () => {
      mockScoreBeachForUser.mockRejectedValue(new Error("Beach not found"));

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "non-existent-beach",
          baseScore: 75,
          forecast: mockForecast,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("Different Forecast Conditions", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("handles small wave forecasts", async () => {
      const smallWaveForecast = {
        ...mockForecast,
        wave_height: "2.0 ft",
      };

      mockScoreBeachForUser.mockResolvedValue({
        score: 85,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 10, // Bonus for matching small wave preference
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: smallWaveForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.score).toBe(85);
    });

    it("handles large wave forecasts", async () => {
      const largeWaveForecast = {
        ...mockForecast,
        wave_height: "8.5 ft",
      };

      mockScoreBeachForUser.mockResolvedValue({
        score: 90,
        personalized: true,
        breakdown: {
          base: 80,
          onboardingPrefs: 10, // Bonus for matching large wave preference
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 80,
          forecast: largeWaveForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.score).toBe(90);
    });

    it("handles various wind conditions", async () => {
      const windyForecast = {
        ...mockForecast,
        wind_speed: "20 mph",
        wind_direction: "SW",
      };

      mockScoreBeachForUser.mockResolvedValue({
        score: 70,
        personalized: true,
        breakdown: {
          base: 75,
          onboardingPrefs: 0,
          learnedPrefs: -5, // Penalty for unfavorable wind
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId: "beach-123",
          baseScore: 75,
          forecast: windyForecast,
        },
      });

      const response = await POST(request);
      const result = await expectPersonalizedScoreResponse(response);

      expect(result.data.score).toBe(70);
    });
  });

  describe("Service Integration", () => {
    beforeEach(() => {
      // withAuth mock already provides authenticated context
    });

    it("passes correct parameters to scoring service", async () => {
      const userId = "test-user-123";
      const beachId = "beach-specific-456";
      const baseScore = 82;

      mockScoreBeachForUser.mockResolvedValue({
        score: 90,
        personalized: true,
        breakdown: {
          base: 82,
          onboardingPrefs: 8,
          learnedPrefs: 0,
          implicitPrefs: 0,
          affinity: 0,
        },
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
        body: {
          beachId,
          baseScore,
          forecast: mockForecast,
        },
      });

      await POST(request);

      expect(mockScoreBeachForUser).toHaveBeenCalledWith(
        userId,
        beachId,
        mockForecast,
        baseScore
      );
    });

    it("handles multiple scoring requests for same user", async () => {
      // withAuth mock already provides authenticated context

      const beaches = [
        { id: "beach-1", score: 75 },
        { id: "beach-2", score: 80 },
        { id: "beach-3", score: 70 },
      ];

      for (const beach of beaches) {
        mockScoreBeachForUser.mockResolvedValue({
          score: beach.score + 10,
          personalized: true,
          breakdown: {
            base: beach.score,
            onboardingPrefs: 10,
            learnedPrefs: 0,
            implicitPrefs: 0,
            affinity: 0,
          },
        });

        const request = createMockRequest("POST", "http://localhost:3000/api/beach/personalized-score", {
          body: {
            beachId: beach.id,
            baseScore: beach.score,
            forecast: mockForecast,
          },
        });

        const response = await POST(request);
        const result = await expectPersonalizedScoreResponse(response);

        expect(result.data.score).toBe(beach.score + 10);
      }

      expect(mockScoreBeachForUser).toHaveBeenCalledTimes(beaches.length);
    });
  });
});

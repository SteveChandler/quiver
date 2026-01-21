/**
 * @jest-environment node
 */

/**
 * Tests for GET /api/profile - onboarding_completed_at field
 *
 * These tests verify that the profile API correctly returns the
 * onboarding_completed_at field, which is critical for the onboarding
 * modal to correctly determine whether to show for existing users.
 *
 * Bug context: The onboarding modal was showing for all users because
 * the API was not returning onboarding_completed_at in the response.
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";
import {
  createMockProfileDTO,
  expectOnboardingField,
} from "@/test-utils/profile-api-test-helpers";

// Create mock client before mocking modules
const mockSupabaseClient = createMockSupabaseClient();

// Mock the auth wrapper to pass through and provide context
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: any) => async (request: any) => {
    // Simulate authenticated context
    const context = {
      user: { id: "test-user-123" },
      supabase: mockSupabaseClient,
    };
    return handler(request, context);
  },
  createSuccessResponse: jest.requireActual("@/lib/middleware/api-wrappers").createSuccessResponse,
  createNotFoundError: jest.requireActual("@/lib/middleware/api-wrappers").createNotFoundError,
}));

// Mock the profile fetcher
jest.mock("@/lib/profile/fetchers", () => ({
  getProfileDTOById: jest.fn(),
}));

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("@/app/api/profile/route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getProfileDTOById } = require("@/lib/profile/fetchers");

describe("GET /api/profile - onboarding_completed_at field", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementation for each test
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    }));
  });

  it("should return onboarding_completed_at when user has completed onboarding", async () => {
    const userId = "test-user-123";
    const completionDate = "2025-01-15T10:00:00.000Z";

    // Mock using helper - cleaner and more maintainable
    getProfileDTOById.mockResolvedValue(
      createMockProfileDTO({
        id: userId,
        full_name: "Test User",
        home_beach_id: "beach-123",
        homeBeachName: "Test Beach",
        home_beach: { id: "beach-123", name: "Test Beach" },
        experience_level: "intermediate",
        onboarding_completed_at: completionDate,
      })
    );

    const request = createMockRequest("GET", "http://localhost:3000/api/profile");
    const response = await GET(request);

    const data = await expectSuccessResponse(response, 200);
    expectOnboardingField(data.data, completionDate);
  });

  it("should return null onboarding_completed_at for users who have not completed onboarding", async () => {
    const userId = "test-user-123";

    // Mock using helper with null onboarding
    getProfileDTOById.mockResolvedValue(
      createMockProfileDTO({
        id: userId,
        full_name: "New User",
        onboarding_completed_at: null,
      })
    );

    const request = createMockRequest("GET", "http://localhost:3000/api/profile");
    const response = await GET(request);

    const data = await expectSuccessResponse(response, 200);
    expectOnboardingField(data.data, null);
  });

  it("should handle missing onboarding data gracefully (returns null)", async () => {
    const userId = "test-user-123";

    // Mock using helper - onboarding_completed_at intentionally omitted to test fallback
    getProfileDTOById.mockResolvedValue(
      createMockProfileDTO({
        id: userId,
        full_name: "Edge Case User",
        home_beach_id: "beach-456",
        homeBeachName: "Another Beach",
        home_beach: { id: "beach-456", name: "Another Beach" },
        onboarding_completed_at: undefined as any, // Explicitly test undefined handling
      })
    );

    const request = createMockRequest("GET", "http://localhost:3000/api/profile");
    const response = await GET(request);

    const data = await expectSuccessResponse(response, 200);
    // Should default to null when data is missing (defensive coding)
    expectOnboardingField(data.data, null);
  });
});

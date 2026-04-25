/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockUser,
  createMockProfile,
  createMockUserSession,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockDatabaseSuccess,
  mockDatabaseError,
} from "@/test-utils/api-test-helpers";
import {
  setupProfileApiMocks,
  expectOnboardingField,
} from "@/test-utils/profile-api-test-helpers";

// Mock the Supabase API server client
const mockSupabaseClient = createMockSupabaseClient();

// withAuth is now optional-auth on this route. Mock it to inspect
// `mockSupabaseClient.auth.getUser()` so the handler receives the user
// exactly as the real wrapper would.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: (handler: any) => handler,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        const { data, error } = await mockSupabaseClient.auth.getUser();
        const user = error ? null : data?.user ?? null;
        if (!options.optional && !user) {
          const { createAuthError } = jest.requireActual("@/lib/api-utils");
          return createAuthError(
            options.authErrorMessage ?? "Authentication required"
          );
        }
        const resolvedParams = context?.params
          ? typeof context.params === "object" && "then" in context.params
            ? await context.params
            : context.params
          : {};
        return await handler(request, {
          params: resolvedParams,
          user,
          supabase: mockSupabaseClient,
        });
      },
  };
});

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocks
 
const { GET } = require("@/app/api/profile/[id]/route");

describe("/api/profile/[id]", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
    
    // Reset mock to return fresh chain objects for each call
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      range: jest.fn().mockReturnThis(),
      textSearch: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    }));
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return user profile successfully", async () => {
      const targetUserId = "user-123";
      const mockProfile = createMockProfile({
        id: targetUserId,
        full_name: "John Surfer",
        home_beach_id: "beach-1",
        followers_count: 25,
        following_count: 15,
      });

      const mockSessions = [
        createMockUserSession({ rating: 4, status: "completed" }),
        createMockUserSession({ rating: 5, status: "completed" }),
        createMockUserSession({ rating: 3, status: "completed" }),
      ];

      // Mock unauthenticated request (public profile view)
      mockUnauthenticatedUser(mockSupabaseClient);

      // Set up mock to track calls and return appropriate data
      let callCount = 0;
      (mockSupabaseClient.from as jest.Mock).mockImplementation((tableName: string) => {
        callCount++;

        if (tableName === 'profiles') {
          // First call is profiles
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve({
              data: mockProfile,
              error: null,
            })),
          };
        } else if (tableName === 'sessions') {
          // Second call is sessions
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: mockSessions,
            error: null,
          };
        } else if (tableName === 'beaches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve({
              data: { name: 'Malibu' },
              error: null,
            })),
          };
        }

        // Default fallback
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: null,
          error: null,
        };
      });

      const request = createMockRequest("GET");
      const response = await GET(request, { params: Promise.resolve({ id: targetUserId }) });

      const data = await expectSuccessResponse(response, 200);
      expect(data.data).toMatchObject({
        id: targetUserId,
        full_name: "John Surfer",
        followers_count: 25,
        following_count: 15,
        session_count: 3,
        average_rating: 4.0,
        isFollowing: false,
        isOwnProfile: false,
      });
    });

    it("should return onboarding_completed_at when user has completed onboarding", async () => {
      const targetUserId = "user-onboarding-complete";
      const completionDate = "2025-01-10T14:30:00.000Z";

      mockUnauthenticatedUser(mockSupabaseClient);

      // Using new helper - much cleaner setup
      setupProfileApiMocks(mockSupabaseClient, {
        profileData: createMockProfile({
          id: targetUserId,
          full_name: "Completed User",
          onboarding_completed_at: completionDate,
        }),
        sessions: [],
      });

      const request = createMockRequest("GET");
      const response = await GET(request, { params: Promise.resolve({ id: targetUserId }) });

      const data = await expectSuccessResponse(response, 200);
      expectOnboardingField(data.data, completionDate);
    });

    it("should return null onboarding_completed_at for users who have not completed", async () => {
      const targetUserId = "user-onboarding-incomplete";

      mockUnauthenticatedUser(mockSupabaseClient);

      // Using new helper - much cleaner setup
      setupProfileApiMocks(mockSupabaseClient, {
        profileData: createMockProfile({
          id: targetUserId,
          full_name: "New User",
          onboarding_completed_at: null,
        }),
        sessions: [],
      });

      const request = createMockRequest("GET");
      const response = await GET(request, { params: Promise.resolve({ id: targetUserId }) });

      const data = await expectSuccessResponse(response, 200);
      expectOnboardingField(data.data, null);
    });

    it("should handle concurrent profile requests", async () => {
      const targetUserId = "user-123";
      const mockProfile = createMockProfile({ id: targetUserId });

      mockUnauthenticatedUser(mockSupabaseClient);

      // Set up mock to handle multiple calls correctly
      (mockSupabaseClient.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve({
              data: mockProfile,
              error: null,
            })),
          };
        } else if (tableName === 'sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            data: [],
            error: null,
          };
        }

        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          data: null,
          error: null,
        };
      });

      // Simulate concurrent requests
      const requests = Array.from({ length: 3 }, () => 
        createMockRequest("GET")
      );
      const responses = await Promise.all(
        requests.map(request => GET(request, { params: Promise.resolve({ id: targetUserId }) }))
      );

      for (const response of responses) {
        const data = await expectSuccessResponse(response, 200);
        expect((data as any).data.id).toBe(targetUserId);
      }
    });
  });
});

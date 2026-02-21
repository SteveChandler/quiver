/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: any;

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
}));

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: () => mockSupabaseClient,
}));

jest.mock("@/lib/profile/fetchers", () => ({
  getProfileDTOById: jest.fn(),
}));

// Import after mocks
 
const { GET } = require("@/app/api/users/[id]/profile/route");

describe("/api/users/[id]/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  it("returns 400 on invalid user id (UUID)", async () => {
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/users/not-a-uuid/profile"
    );
    const res = await GET(req as any, { params: { id: "not-a-uuid" } });
    await expectErrorResponse(res, 400);
  });

  it("returns combined profile with stats for public view", async () => {
    mockUnauthenticatedUser(mockSupabaseClient as any);

    const userId = "550e8400-e29b-41d4-a716-446655440000";

    // profiles select
    const profilesChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: {
            id: userId,
            full_name: "Quiver Tester",
            followers_count: 2,
            following_count: 3,
            created_at: new Date().toISOString(),
            avatar_url: null,
            email: null,
            bio: null,
            location: null,
            experience_level: null,
            instagram: null,
            home_beach: null,
            onboarding_completed_at: "2025-01-15T10:00:00.000Z",
          },
          error: null,
        })
      ),
    };

    // sessions select
    const sessionsChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({
          data: [
            { id: 1, rating: 4, status: "completed" },
            { id: 2, rating: 5, status: "completed" },
          ],
          error: null,
        })
      ),
    };

    // getProfileDTOById mocked at module level; set per-test implementation
    const { getProfileDTOById } = require("@/lib/profile/fetchers");
    getProfileDTOById.mockResolvedValue({
      id: userId,
      full_name: "Quiver Tester",
      home_beach_id: null,
      homeBeachName: null,
      home_beach: null,
    });

    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesChain;
      if (table === "sessions") return sessionsChain;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const req = createMockRequest(
      "GET",
      `http://localhost:3000/api/users/${userId}/profile`
    );
    const res = await GET(req as any, { params: { id: userId } });
    const body = await expectSuccessResponse(res, 200);

    expect((body as any).data).toMatchObject({
      id: userId,
      full_name: "Quiver Tester",
      followers_count: 2,
      following_count: 3,
      session_count: 2,
      average_rating: 4.5,
      isFollowing: false,
      isOwnProfile: false,
      onboarding_completed_at: "2025-01-15T10:00:00.000Z",
    });
  });

  it("returns onboarding_completed_at when user has completed onboarding", async () => {
    mockUnauthenticatedUser(mockSupabaseClient as any);
    const userId = "550e8400-e29b-41d4-a716-446655440001";
    const completionDate = "2025-01-10T14:30:00.000Z";

    const profilesChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: {
            id: userId,
            full_name: "Completed User",
            followers_count: 0,
            following_count: 0,
            created_at: new Date().toISOString(),
            onboarding_completed_at: completionDate,
          },
          error: null,
        })
      ),
    };

    const sessionsChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({ data: [], error: null })
      ),
    };

    const { getProfileDTOById } = require("@/lib/profile/fetchers");
    getProfileDTOById.mockResolvedValue({
      id: userId,
      full_name: "Completed User",
      home_beach_id: "beach-123",
      homeBeachName: "Test Beach",
      home_beach: { id: "beach-123", name: "Test Beach" },
    });

    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesChain;
      if (table === "sessions") return sessionsChain;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const req = createMockRequest(
      "GET",
      `http://localhost:3000/api/users/${userId}/profile`
    );
    const res = await GET(req as any, { params: { id: userId } });
    const body = await expectSuccessResponse(res, 200);

    expect((body as any).data.onboarding_completed_at).toBe(completionDate);
  });

  it("returns null onboarding_completed_at for users who have not completed onboarding", async () => {
    mockUnauthenticatedUser(mockSupabaseClient as any);
    const userId = "550e8400-e29b-41d4-a716-446655440002";

    const profilesChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() =>
        Promise.resolve({
          data: {
            id: userId,
            full_name: "New User",
            followers_count: 0,
            following_count: 0,
            created_at: new Date().toISOString(),
            onboarding_completed_at: null,
          },
          error: null,
        })
      ),
    };

    const sessionsChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((onResolve: any) =>
        onResolve({ data: [], error: null })
      ),
    };

    const { getProfileDTOById } = require("@/lib/profile/fetchers");
    getProfileDTOById.mockResolvedValue({
      id: userId,
      full_name: "New User",
      home_beach_id: null,
      homeBeachName: null,
      home_beach: null,
    });

    (mockSupabaseClient as any).from.mockImplementation((table: string) => {
      if (table === "profiles") return profilesChain;
      if (table === "sessions") return sessionsChain;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });

    const req = createMockRequest(
      "GET",
      `http://localhost:3000/api/users/${userId}/profile`
    );
    const res = await GET(req as any, { params: { id: userId } });
    const body = await expectSuccessResponse(res, 200);

    expect((body as any).data.onboarding_completed_at).toBeNull();
  });
});



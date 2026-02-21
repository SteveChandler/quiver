/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: MockSupabaseClient;

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// Import after mocks
 
const { GET: getBadgeDefinitions } = require("@/app/api/gamification/badge-definitions/route");
 
const { GET: getUserBadges, POST, PUT, PATCH, DELETE } = require("@/app/api/gamification/user-badges/route");

describe("GET /api/gamification/badge-definitions", () => {
  const user = createMockUser();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      await expectErrorResponse(res, 401);
    });

    it("returns 401 when auth check fails", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", name: "AuthError", status: 401 } as any,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      await expectErrorResponse(res, 401);
    });
  });

  describe("Badge definitions retrieval", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns all badge definitions ordered by category and slug", async () => {
      const mockBadges = [
        {
          badge_slug: "first_session",
          name: "First Session",
          description: "Log your first surf session",
          icon: "🏄",
          category: "activity",
          xp_reward: 10,
        },
        {
          badge_slug: "ten_sessions",
          name: "10 Sessions",
          description: "Log 10 surf sessions",
          icon: "🌊",
          category: "activity",
          xp_reward: 50,
        },
        {
          badge_slug: "local_hero",
          name: "Local Hero",
          description: "Visit your home beach 5 times",
          icon: "⭐",
          category: "social",
          xp_reward: 30,
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };

      // Mock the first order call (category)
      chain.order.mockImplementationOnce(function(this: any) {
        return {
          ...this,
          order: jest.fn().mockResolvedValue({
            data: mockBadges,
            error: null,
          }),
        };
      });

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual(mockBadges);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("badge_definitions");
      expect(chain.select).toHaveBeenCalledWith("*");
    });

    it("returns empty array when no badges exist", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };

      chain.order.mockImplementationOnce(function(this: any) {
        return {
          ...this,
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      });

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual([]);
    });

    it("handles null data gracefully", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };

      chain.order.mockImplementationOnce(function(this: any) {
        return {
          ...this,
          order: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      });

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual([]);
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns 500 when database query fails", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };

      chain.order.mockImplementationOnce(function(this: any) {
        return {
          ...this,
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error", code: "PGRST001" },
          }),
        };
      });

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/badge-definitions"
      );

      const res = await getBadgeDefinitions(req as any);
      await expectErrorResponse(res, 500, "Failed to load badge definitions");
    });
  });
});

describe("GET /api/gamification/user-badges", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";
  const user = createMockUser({ id: userId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      await expectErrorResponse(res, 401);
    });

    it("returns 401 when auth check fails", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", name: "AuthError", status: 401 } as any,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      await expectErrorResponse(res, 401);
    });
  });

  describe("User badges retrieval", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns user's unlocked badges with definitions", async () => {
      const mockUserBadges = [
        {
          badge_slug: "first_session",
          unlocked_at: "2024-01-15T10:30:00Z",
          context: { session_id: "session-123" },
          badge_definitions: {
            name: "First Session",
            description: "Log your first surf session",
            icon: "🏄",
            category: "activity",
            xp_reward: 10,
          },
        },
        {
          badge_slug: "ten_sessions",
          unlocked_at: "2024-01-20T14:45:00Z",
          context: { session_count: 10 },
          badge_definitions: {
            name: "10 Sessions",
            description: "Log 10 surf sessions",
            icon: "🌊",
            category: "activity",
            xp_reward: 50,
          },
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUserBadges,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual(mockUserBadges);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("user_badges");
      expect(chain.eq).toHaveBeenCalledWith("user_id", userId);
      expect(chain.order).toHaveBeenCalledWith("unlocked_at", { ascending: false });
    });

    it("returns empty array when user has no badges", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual([]);
    });

    it("handles null data gracefully", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).badges).toEqual([]);
    });

    it("includes badge context data in response", async () => {
      const mockUserBadges = [
        {
          badge_slug: "early_bird",
          unlocked_at: "2024-01-18T06:00:00Z",
          context: {
            session_id: "session-456",
            time: "06:00 AM",
            beach_name: "La Jolla Shores",
          },
          badge_definitions: {
            name: "Early Bird",
            description: "Log a session before 7 AM",
            icon: "🌅",
            category: "timing",
            xp_reward: 20,
          },
        },
      ];

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUserBadges,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      const body = await expectSuccessResponse(res, 200);

      const badges = (body.data as any).badges;
      expect(badges[0].context).toEqual({
        session_id: "session-456",
        time: "06:00 AM",
        beach_name: "La Jolla Shores",
      });
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns 500 when database query fails", async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(chain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/user-badges"
      );

      const res = await getUserBadges(req as any);
      await expectErrorResponse(res, 500, "Failed to load user badges");
    });
  });

  describe("Method validation", () => {
    it("returns 405 for POST requests", async () => {
      const res = await POST();

      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Method Not Allowed");
      expect(res.headers.get("Allow")).toBe("GET");
    });

    it("returns 405 for PUT requests", async () => {
      const res = await PUT();
      expect(res.status).toBe(405);
    });

    it("returns 405 for PATCH requests", async () => {
      const res = await PATCH();
      expect(res.status).toBe(405);
    });

    it("returns 405 for DELETE requests", async () => {
      const res = await DELETE();
      expect(res.status).toBe(405);
    });
  });
});

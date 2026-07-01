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
 
const { GET } = require("@/app/api/gamification/xp-status/route");

describe("GET /api/gamification/xp-status", () => {
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
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      await expectErrorResponse(res, 401);
    });

    it("returns 401 when auth check fails", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", name: "AuthError", status: 401 } as any,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      await expectErrorResponse(res, 401);
    });
  });

  describe("XP status calculation", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("creates user_xp row if it doesn't exist", async () => {
      // First query to check if row exists returns null
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      // Final select to get the data
      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 0,
            level: 1,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain; // Check if exists
        return selectChain; // Get the data
      });
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { user_id: userId, xp_total: 0, level: 1 },
        error: null,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(0);
      expect(xp.level).toBe(1);
      expect(xp.level_title).toBe("Kook");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("ensure_user_xp", {
        p_user_id: userId,
      });
    });

    it("returns level 1 (Kook) for new user with 0 XP", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 0,
            level: 1,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(0);
      expect(xp.level).toBe(1);
      expect(xp.level_title).toBe("Kook");
      expect(xp.progress_to_next).toBe(0);
      expect(xp.xp_to_next_level).toBe(100);
      expect(xp.next_level_title).toBe("Grom");
    });

    it("returns level 2 (Grom) for user with 150 XP", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 150,
            level: 2,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(150);
      expect(xp.level).toBe(2);
      expect(xp.level_title).toBe("Grom");
      // 150 XP, level 2 starts at 100, level 3 at 300
      // Progress: (150-100)/(300-100) = 50/200 = 25%
      expect(xp.progress_to_next).toBe(25);
      expect(xp.xp_to_next_level).toBe(150); // 300 - 150
      expect(xp.next_level_title).toBe("Paddler");
    });

    it("returns level 5 (Rip Rider) for user with 1200 XP", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 1200,
            level: 5,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(1200);
      expect(xp.level).toBe(5);
      expect(xp.level_title).toBe("Rip Rider");
      // 1200 XP, level 5 starts at 1000, level 6 at 1500
      // Progress: (1200-1000)/(1500-1000) = 200/500 = 40%
      expect(xp.progress_to_next).toBe(40);
      expect(xp.xp_to_next_level).toBe(300); // 1500 - 1200
      expect(xp.next_level_title).toBe("Barrel Hunter");
    });

    it("returns level 9 (Quiver King/Queen) for max level user", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 5000,
            level: 9,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(5000);
      expect(xp.level).toBe(9);
      expect(xp.level_title).toBe("Quiver King/Queen");
      expect(xp.progress_to_next).toBe(100);
      expect(xp.xp_to_next_level).toBe(0);
      expect(xp.next_level_title).toBe("Max Level");
    });

    it("calculates correct progress at exact level threshold", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 1000,
            level: 5,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(1000);
      expect(xp.level).toBe(5);
      expect(xp.progress_to_next).toBe(0); // Just reached level 5
      expect(xp.xp_to_next_level).toBe(500); // 1500 - 1000
    });

    it("includes timestamps in response", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 500,
            level: 4,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-20T15:30:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.created_at).toBe("2024-01-01T00:00:00Z");
      expect(xp.updated_at).toBe("2024-01-20T15:30:00Z");
    });
  });

  describe("Edge cases", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("handles user one XP away from next level", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 299,
            level: 2,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      expect(xp.xp_total).toBe(299);
      expect(xp.level).toBe(2);
      expect(xp.xp_to_next_level).toBe(1); // 300 - 299
      // Progress: (299-100)/(300-100) = 199/200 = 99.5% rounded to 100%
      expect(xp.progress_to_next).toBe(100);
    });

    it("calculates level title correctly based on XP total", async () => {
      // Test that level_title is calculated from XP total via calculateLevel()
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            xp_total: 250,
            level: 2,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      const body = await expectSuccessResponse(res, 200);

      const xp = (body.data as any).xp;
      // 250 XP puts user at level 2 (Grom) - between 100-299 XP
      expect(xp.level_title).toBe("Grom");
      expect(xp.level).toBe(2);
      expect(xp.xp_total).toBe(250);
      // Progress toward level 3: (250-100)/(300-100) = 150/200 = 75%
      expect(xp.progress_to_next).toBe(75);
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns 500 when initial check fails", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(checkChain);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      await expectErrorResponse(res, 500, "Failed to load XP status");
    });

    it("returns 500 when select query fails", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "xp-123" },
          error: null,
        }),
      };

      const selectChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "PGRST001" },
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return selectChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      await expectErrorResponse(res, 500, "Failed to load XP status");
    });

    it("handles insert failure when creating new user_xp row", async () => {
      const checkChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const insertChain: any = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Insert failed", code: "PGRST001" },
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkChain;
        return insertChain;
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/gamification/xp-status"
      );

      const res = await GET(req as any);
      // Should continue even if insert fails (race condition handling)
      // Will retry select
      await expectErrorResponse(res, 500);
    });
  });

  describe("Level thresholds validation", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    const testCases = [
      { xp: 0, level: 1, title: "Kook", nextTitle: "Grom", xpToNext: 100 },
      { xp: 100, level: 2, title: "Grom", nextTitle: "Paddler", xpToNext: 200 },
      { xp: 300, level: 3, title: "Paddler", nextTitle: "Wavestorm Warrior", xpToNext: 300 },
      { xp: 600, level: 4, title: "Wavestorm Warrior", nextTitle: "Rip Rider", xpToNext: 400 },
      { xp: 1000, level: 5, title: "Rip Rider", nextTitle: "Barrel Hunter", xpToNext: 500 },
      { xp: 1500, level: 6, title: "Barrel Hunter", nextTitle: "Point Breaker", xpToNext: 700 },
      { xp: 2200, level: 7, title: "Point Breaker", nextTitle: "Lineup Legend", xpToNext: 800 },
      { xp: 3000, level: 8, title: "Lineup Legend", nextTitle: "Quiver King/Queen", xpToNext: 1000 },
      { xp: 4000, level: 9, title: "Quiver King/Queen", nextTitle: "Max Level", xpToNext: 0 },
    ];

    testCases.forEach(({ xp, level, title, nextTitle, xpToNext }) => {
      it(`returns correct level info for ${xp} XP (${title})`, async () => {
        const checkChain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "xp-123" },
            error: null,
          }),
        };

        const selectChain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              xp_total: xp,
              level: level,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        };

        let callCount = 0;
        mockSupabaseClient.from.mockImplementation(() => {
          callCount++;
          if (callCount === 1) return checkChain;
          return selectChain;
        });

        const req = createMockRequest(
          "GET",
          "http://localhost:3000/api/gamification/xp-status"
        );

        const res = await GET(req as any);
        const body = await expectSuccessResponse(res, 200);

        const xpData = (body.data as any).xp;
        expect(xpData.level_title).toBe(title);
        expect(xpData.next_level_title).toBe(nextTitle);
        expect(xpData.xp_to_next_level).toBe(xpToNext);
      });
    });
  });
});

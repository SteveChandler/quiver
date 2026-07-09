/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Mock profile fetchers
jest.mock("@/lib/profile/fetchers", () => ({
  getProfileWithHomeBeachById: jest.fn(),
}));

// Import after mocks
const { GET, POST, PUT, PATCH, DELETE } = require("@/app/api/users/[id]/stats/route");
const { getProfileWithHomeBeachById } = require("@/lib/profile/fetchers");

describe("GET /api/users/[id]/stats", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";
  const otherUserId = "550e8400-e29b-41d4-a716-446655440001";
  const user = createMockUser({ id: userId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  it("uses the shared API wrapper module for security headers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/users/[id]/stats/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      expect(res.status).toBe(401);
      await expectErrorResponse(res, 401);
    });

    it("returns 401 when auth check fails", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", name: "AuthError", status: 401 } as any,
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      expect(res.status).toBe(401);
      await expectErrorResponse(res, 401);
    });
  });

  describe("Validation", () => {
    it("returns 400 when user id is not a valid UUID", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/not-a-uuid/stats"
      );

      const res = await GET(req as any, { params: { id: "not-a-uuid" } });
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid user");
    });

    it("returns 400 when user id is missing", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users//stats"
      );

      const res = await GET(req as any, { params: { id: "" } });
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid user");
    });

    it("returns 400 when user id is undefined", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/undefined/stats"
      );

      const res = await GET(req as any, { params: { id: undefined as any } });
      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid user");
    });
  });

  describe("Authorization", () => {
    it("returns 403 when requesting stats for another user", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${otherUserId}/stats`
      );

      const res = await GET(req as any, { params: { id: otherUserId } });
      expect(res.status).toBe(403);
      await expectErrorResponse(res, 403, "Forbidden");
    });

    it("allows user to request their own stats", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      // Mock profile fetcher
      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: "beach-123",
        },
        homeBeachName: "Ocean Beach",
      });

      // Mock session count
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      // Mock board count
      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
      };

      // Mock wave quality data
      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ wave_quality: 4 }, { wave_quality: 5 }, { wave_quality: 3 }],
          error: null,
        }),
      };

      // Mock RPC for most visited beach
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ beach_name: "La Jolla Shores", visit_count: 10 }],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).stats).toMatchObject({
        sessionCount: 5,
        boardCount: 3,
      });
      expect(sessionCountChain.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
      expect(boardCountChain.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
    });
  });

  describe("Stats calculation", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: "beach-123",
        },
        homeBeachName: "Ocean Beach",
      });
    });

    it("returns correct stats for user with sessions and boards", async () => {
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 10, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            { wave_quality: 5 },
            { wave_quality: 4 },
            { wave_quality: 4 },
            { wave_quality: 3 },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ beach_name: "Windansea", visit_count: 8 }],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      expect(stats.sessionCount).toBe(10);
      expect(stats.boardCount).toBe(5);
      expect(stats.averageRating).toBe(4); // (5+4+4+3)/4 = 4
      expect(stats.homeBeachId).toBe("beach-123");
      expect(stats.homeBeachName).toBe("Ocean Beach");
      expect(stats.mostVisitedBeach).toBe("Windansea");
      expect(stats.mostVisitedBeachCount).toBe(8);
    });

    it("handles user with no sessions", async () => {
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      expect(stats.sessionCount).toBe(0);
      expect(stats.boardCount).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.mostVisitedBeach).toBeNull();
      expect(stats.mostVisitedBeachCount).toBe(0);
    });

    it("handles user with no home beach", async () => {
      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: null,
        },
        homeBeachName: null,
      });

      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ wave_quality: 4 }],
          error: null,
        }),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      expect(stats.homeBeachId).toBeNull();
      expect(stats.homeBeachName).toBeNull();
    });

    it("calculates average rating correctly with decimals", async () => {
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            { wave_quality: 5 },
            { wave_quality: 4 },
            { wave_quality: 4 },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      // (5+4+4)/3 = 4.333... rounded to 4.3
      expect(stats.averageRating).toBe(4.3);
    });

    it("handles null wave_quality values", async () => {
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 4, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            { wave_quality: 5 },
            { wave_quality: null },
            { wave_quality: 4 },
            { wave_quality: null },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      // (5+0+4+0)/4 = 2.25 rounded to 2.3
      expect(stats.averageRating).toBe(2.3);
    });

    it("handles RPC error for most visited beach gracefully", async () => {
      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [{ wave_quality: 4 }],
          error: null,
        }),
      };

      // RPC fails
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function failed", code: "PGRST202" },
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      const stats = (body.data as any).stats;
      // Should still return other stats even if RPC fails
      expect(stats.sessionCount).toBe(5);
      expect(stats.mostVisitedBeach).toBeNull();
      expect(stats.mostVisitedBeachCount).toBe(0);
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      mockAuthenticatedUser(mockSupabaseClient, user);
    });

    it("returns 500 when session count query fails", async () => {
      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: null,
        },
        homeBeachName: null,
      });

      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: "Query failed", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") return sessionCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      expect(res.status).toBe(500);
      await expectErrorResponse(res, 500, "Failed to load user stats");
    });

    it("returns 500 when board count query fails", async () => {
      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: null,
        },
        homeBeachName: null,
      });

      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: "Query failed", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") return sessionCountChain;
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      expect(res.status).toBe(500);
      await expectErrorResponse(res, 500, "Failed to load user stats");
    });

    it("returns 500 when wave quality query fails", async () => {
      getProfileWithHomeBeachById.mockResolvedValue({
        profile: {
          id: userId,
          full_name: "Test User",
          home_beach_id: null,
        },
        homeBeachName: null,
      });

      const sessionCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      };

      const boardCountChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };

      const qualityChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Query failed", code: "PGRST001" },
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "sessions") {
          callCount++;
          if (callCount === 1) return sessionCountChain;
          if (callCount === 2) return qualityChain;
        }
        if (table === "boards") return boardCountChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/stats`
      );

      const res = await GET(req as any, { params: { id: userId } });
      expect(res.status).toBe(500);
      await expectErrorResponse(res, 500, "Failed to load user stats");
    });
  });

  describe("Method validation", () => {
    it("returns 405 for POST requests", async () => {
      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${userId}/stats`
      );

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

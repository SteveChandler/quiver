import { describe, it, expect, beforeEach, vi } from "../setup/vitest-shim";
import * as DashboardActionsModule from "@/actions/dashboard-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Unwrap server action wrappers to direct functions
const getProfileStrength = DashboardActionsModule.getProfileStrength;
const getUserBoards = DashboardActionsModule.getUserBoards;

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createSupabaseServerClient: jest.fn(),
}));

const makeChain = () => {
  const obj: any = {};
  obj.select = jest.fn(() => obj);
  obj.insert = jest.fn(() => obj);
  obj.update = jest.fn(() => obj);
  obj.delete = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.order = jest.fn(() => obj);
  obj.single = jest.fn();
  obj.maybeSingle = jest.fn();
  return obj;
};

const profilesChain = makeChain();
const boardsChain = makeChain();
const mockSupabaseClient: any = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((table: string) => {
    if (table === "profiles") return profilesChain;
    if (table === "boards") return boardsChain;
    return makeChain();
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(
    mockSupabaseClient
  );
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
});

describe("Dashboard Actions", () => {
  describe("getProfileStrength", () => {
    it("calculates 100% completion with all fields filled", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: "intermediate",
        surf_styles: ["longboard", "shortboard"],
        full_name: "John Doe",
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 2,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      expect(result.data?.percent).toBe(100);
      expect(result.data?.missing).toEqual([]);
    });

    it("calculates weighted points correctly with partial profile (home beach + experience only)", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: "intermediate",
        surf_styles: null,
        full_name: null,
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      // home_beach_id: 29 + experience_level: 21 = 50
      expect(result.data?.percent).toBe(50);
      expect(result.data?.missing).toEqual([
        "surf_styles",
        "full_name",
        "boards",
      ]);
    });

    it("calculates 0% with completely empty profile", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: null,
        experience_level: null,
        surf_styles: null,
        full_name: null,
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      expect(result.data?.percent).toBe(0);
      expect(result.data?.missing).toEqual([
        "home_beach_id",
        "experience_level",
        "surf_styles",
        "full_name",
        "boards",
      ]);
    });

    it("treats empty surf_styles array as incomplete", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: "intermediate",
        surf_styles: [], // Empty array should be treated as incomplete
        full_name: "John Doe",
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 1,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      // All fields except surf_styles: 29+21+14+14 = 78
      expect(result.data?.percent).toBe(78);
      expect(result.data?.missing).toContain("surf_styles");
    });

    it("includes boards in calculation when count > 0", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: null,
        experience_level: null,
        surf_styles: null,
        full_name: null,
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 3,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      // Only boards: 14
      expect(result.data?.percent).toBe(14);
      expect(result.data?.missing).not.toContain("boards");
      expect(result.data?.missing).toEqual([
        "home_beach_id",
        "experience_level",
        "surf_styles",
        "full_name",
      ]);
    });

    it("excludes boards when count is 0", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: null,
        surf_styles: null,
        full_name: null,
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      expect(result.data?.percent).toBe(29); // Only home_beach_id
      expect(result.data?.missing).toContain("boards");
    });

    it("excludes boards when count is null", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: null,
        surf_styles: null,
        full_name: null,
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: null,
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      expect(result.data?.percent).toBe(29); // Only home_beach_id
      expect(result.data?.missing).toContain("boards");
    });

    it("returns error when profile fetch fails", async () => {
      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: "Profile not found" },
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch profile: Profile not found");
    });

    it("returns error when boards fetch fails", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456",
        experience_level: "intermediate",
        surf_styles: ["longboard"],
        full_name: "John Doe",
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: null,
        error: { message: "Boards query failed" },
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch boards: Boards query failed");
    });

    it("returns error when user is not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("calculates correctly with mixed complete and incomplete fields", async () => {
      const mockProfile = {
        id: "user-123",
        home_beach_id: "beach-456", // 29 points
        experience_level: "intermediate", // 21 points
        surf_styles: ["longboard"], // 22 points
        full_name: null, // 0 points
      };

      profilesChain.select().eq().single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      boardsChain.select.mockReturnValueOnce(boardsChain);
      boardsChain.eq.mockResolvedValueOnce({
        count: 1, // 14 points
        error: null,
      });

      const result = await getProfileStrength();

      expect(result.success).toBe(true);
      // 29 + 21 + 22 + 14 = 86
      expect(result.data?.percent).toBe(86);
      expect(result.data?.missing).toEqual(["full_name"]);
    });
  });

  describe("getUserBoards", () => {
    it("fetches user boards successfully", async () => {
      const mockBoards = [
        {
          id: "board-1",
          name: "My Longboard",
          board_type: "longboard",
          dimensions: "9'6\" x 23\" x 3\"",
          volume: "72L",
        },
        {
          id: "board-2",
          name: "Shortboard",
          board_type: "shortboard",
          dimensions: "6'2\" x 19\" x 2.5\"",
          volume: "28L",
        },
      ];

      boardsChain.select().eq().order.mockResolvedValueOnce({
        data: mockBoards,
        error: null,
      });

      const result = await getUserBoards();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBoards);
      expect(result.data).toHaveLength(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("boards");
      expect(boardsChain.select).toHaveBeenCalledWith(
        "id, name, board_type, dimensions, volume"
      );
      expect(boardsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(boardsChain.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("returns empty array when user has no boards", async () => {
      boardsChain.select().eq().order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getUserBoards();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns empty array when data is null", async () => {
      boardsChain.select().eq().order.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await getUserBoards();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns error when boards fetch fails", async () => {
      boardsChain.select().eq().order.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const result = await getUserBoards();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch boards: Database error");
    });

    it("returns error when user is not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await getUserBoards();

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("orders boards by created_at descending (newest first)", async () => {
      const mockBoards = [
        {
          id: "board-new",
          name: "New Board",
          board_type: "funboard",
          dimensions: "7'6\" x 21\" x 2.75\"",
          volume: "50L",
        },
        {
          id: "board-old",
          name: "Old Board",
          board_type: "longboard",
          dimensions: "9'0\" x 22\" x 3\"",
          volume: "68L",
        },
      ];

      boardsChain.select().eq().order.mockResolvedValueOnce({
        data: mockBoards,
        error: null,
      });

      const result = await getUserBoards();

      expect(result.success).toBe(true);
      expect(boardsChain.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(result.data?.[0].id).toBe("board-new");
    });
  });
});

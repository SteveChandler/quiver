import { describe, it, expect, beforeEach, vi } from "../setup/vitest-shim";
import * as CheckInActionsModule from "@/actions/check-in-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// unwrap server action wrappers to direct functions if needed
const submitCheckIn = CheckInActionsModule.submitCheckIn;
const getRecentCheckIns = CheckInActionsModule.getRecentCheckIns;
const getForecastAccuracyStats = CheckInActionsModule.getForecastAccuracyStats;
const getUserCheckIns = CheckInActionsModule.getUserCheckIns;
const getBeachCheckIns = CheckInActionsModule.getBeachCheckIns;
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

// Mock the Supabase client
jest.mock("@/lib/supabase/api-server-client", () => ({
  __esModule: true,
  createAPIServerClient: jest.fn(),
}));

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
  obj.range = jest.fn(() => obj);
  obj.single = jest.fn();
  obj.maybeSingle = jest.fn();
  return obj;
};

const beachesChain = makeChain();
const checkinsChain = makeChain();
const conditionReportsChain = makeChain();
const mockSupabaseClient: any = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((table: string) => {
    if (table === "beaches") return beachesChain;
    if (table === "check_ins") return checkinsChain;
    if (table === "condition_reports") return conditionReportsChain;
    return makeChain();
  }),
  rpc: jest.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createAPIServerClient as unknown as jest.Mock).mockReturnValue(
    mockSupabaseClient
  );
  (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(
    mockSupabaseClient
  );
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
});

describe("Check-in Actions", () => {

  describe("submitCheckIn", () => {
    it("creates condition report with normalized values", async () => {
      const mockResponse = {
        id: "report-1",
      };

      beachesChain.select().eq().single.mockResolvedValueOnce({ data: { id: "beach-123" }, error: null });
      conditionReportsChain
        .insert
        .mockReturnValueOnce(conditionReportsChain);
      conditionReportsChain.select.mockReturnValueOnce(conditionReportsChain);
      conditionReportsChain.single.mockResolvedValueOnce({ data: mockResponse, error: null });
      checkinsChain
        .select.mockReturnValueOnce(checkinsChain);
      checkinsChain.eq.mockReturnValueOnce(checkinsChain);
      checkinsChain.single.mockResolvedValueOnce({
        data: {
          id: "report-1",
          profiles: { username: "surfer", profile_picture_url: null },
        },
        error: null,
      });

      const result = await submitCheckIn("beach-123", {
        wave_height: 6,
        wind_speed: 12,
        wind_direction: "NE",
        water_temp: 65,
        crowd_level: 4,
        vibe: "Fun session",
        forecast_accuracy_rating: "accurate",
      });

      expect(conditionReportsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          beach_id: "beach-123",
          kind: "check_in",
          wave_height_m: expect.any(Number),
          wind_speed_ms: expect.any(Number),
          wind_direction_deg: 45,
          water_temp_c: expect.any(Number),
          crowd_level: 4,
          vibe: "Fun session",
          forecast_accuracy: "accurate",
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("report-1");
    });

    it("returns error when Supabase insert fails", async () => {
      beachesChain.select().eq().single.mockResolvedValueOnce({ data: { id: "beach-123" }, error: null });
      conditionReportsChain
        .insert.mockReturnValueOnce(conditionReportsChain);
      conditionReportsChain.select.mockReturnValueOnce(conditionReportsChain);
      conditionReportsChain.single.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });

      const result = await submitCheckIn("beach-123", {
        forecast_accuracy_rating: "accurate",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to submit check-in");
    });
  });

  describe("getRecentCheckIns", () => {
    it("should fetch recent check-ins using RPC function", async () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-1",
          wave_height: 3.5,
          checked_in_at: "2025-01-16T10:00:00Z",
          username: "surfer1",
          profile_picture_url: null,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockCheckIns,
        error: null,
      });

      const result = await getRecentCheckIns(
        "beach-123",
        24,
        10
      );

      expect(result).toEqual(mockCheckIns);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_recent_check_ins",
        {
          beach_uuid: "beach-123",
          hours_back: 24,
          limit_count: 10,
        }
      );
    });

    it("should handle RPC errors", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC error" },
      });

      await expect(getRecentCheckIns("beach-123")).rejects.toThrow(
        "Failed to fetch recent check-ins"
      );
    });
  });

  describe("getForecastAccuracyStats", () => {
    it("should fetch forecast accuracy statistics", async () => {
      const mockStats = [
        {
          total_reports: 10,
          accurate_count: 7,
          somewhat_count: 2,
          inaccurate_count: 1,
          accuracy_percentage: 70.0,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockStats,
        error: null,
      });

      const result = await getForecastAccuracyStats(
        "beach-123",
        7
      );

      expect(result).toEqual({
        total_reports: 10,
        accurate_count: 7,
        somewhat_count: 2,
        inaccurate_count: 1,
        accuracy_percentage: 70.0,
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_forecast_accuracy_stats",
        {
          beach_uuid: "beach-123",
          days_back: 7,
        }
      );
    });

    it("should return default stats when no data", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getForecastAccuracyStats("beach-123");

      expect(result).toEqual({
        total_reports: 0,
        accurate_count: 0,
        somewhat_count: 0,
        inaccurate_count: 0,
        accuracy_percentage: 0,
      });
    });
  });

  // Both updateCheckIn and deleteCheckIn are wrapped in makeAuthenticatedAction,
  // which (a) returns { success: true, data } on success or { success: false, error }
  // on thrown errors (never throws to the caller), and (b) routes table reads through
  // checkinsChain because the route calls supabase.from("check_ins"). Earlier tests
  // wired mocks to the default catch-all chain via mockSupabaseClient.from() with no
  // argument, which is a different jest.fn() instance than checkinsChain.

  describe("updateCheckIn", () => {
    it("should successfully update user's own check-in", async () => {
      const mockUpdatedCheckIn = {
        id: "checkin-123",
        user_id: "user-123",
        wave_height: 4.0,
        forecast_accuracy_rating: "somewhat" as const,
      };

      checkinsChain.single.mockResolvedValueOnce({
        data: mockUpdatedCheckIn,
        error: null,
      });

      const result = await CheckInActionsModule.updateCheckIn(
        "checkin-123",
        {
          wave_height: 4.0,
          forecast_accuracy_rating: "somewhat",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedCheckIn);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });

    it("should fail if check-in not found", async () => {
      checkinsChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      const result = await CheckInActionsModule.updateCheckIn("checkin-123", {
        wave_height: 4.0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update check-in");
    });
  });

  describe("deleteCheckIn", () => {
    it("should successfully delete user's own check-in", async () => {
      // The delete chain awaits the second .eq() — make it resolve to no error.
      checkinsChain.eq.mockReturnValueOnce(checkinsChain);
      checkinsChain.eq.mockResolvedValueOnce({ error: null });

      const result = await CheckInActionsModule.deleteCheckIn("checkin-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });

    it("should fail when delete returns an error", async () => {
      checkinsChain.eq.mockReturnValueOnce(checkinsChain);
      checkinsChain.eq.mockResolvedValueOnce({
        error: { message: "Delete failed" },
      });

      const result = await CheckInActionsModule.deleteCheckIn("checkin-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete check-in");
    });
  });

  describe("getUserCheckIns", () => {
    it("should fetch user's check-in history", async () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-123",
          wave_height: 3.5,
          beaches: { name: "Ocean Beach", location_text: "San Diego, CA" },
        },
      ];

      checkinsChain.select().eq().order().range.mockResolvedValueOnce({
        data: mockCheckIns,
        error: null,
      });

      const result = await getUserCheckIns("user-123", 20, 0);

      expect(result).toEqual(mockCheckIns);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });
  });

  describe("getBeachCheckIns", () => {
    it("should fetch all check-ins for a beach with user info", async () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          beach_id: "beach-123",
          wave_height: 3.5,
          profiles: { username: "surfer1", profile_picture_url: null },
        },
      ];

      checkinsChain.select().eq().order().range.mockResolvedValueOnce({
        data: mockCheckIns,
        error: null,
      });

      const result = await getBeachCheckIns("beach-123", 20, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "checkin-1",
        beach_id: "beach-123",
        wave_height: 3.5,
        profiles: { username: "surfer1", profile_picture_url: null },
        user: {
          username: "surfer1",
          profile_picture_url: null,
        },
      });
    });

    it("should handle missing user profiles gracefully", async () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          beach_id: "beach-123",
          wave_height: 3.5,
          profiles: null,
        },
      ];

      // Use the same chain instance returned for the "check_ins" table
      checkinsChain.select().eq().order().range.mockResolvedValueOnce({
        data: mockCheckIns,
        error: null,
      });

      const result = await getBeachCheckIns("beach-123");

      expect(result[0].user).toEqual({
        username: null,
        profile_picture_url: null,
      });
    });
  });
});

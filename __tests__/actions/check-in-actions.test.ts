import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  submitCheckIn,
  getRecentCheckIns,
  getForecastAccuracyStats,
  updateCheckIn,
  deleteCheckIn,
  getUserCheckIns,
  getBeachCheckIns,
} from "@/actions/check-in-actions";
import { createApiServerSupabaseClient } from "@/lib/supabase/api-server-client";

// Mock the Supabase client
vi.mock("@/lib/supabase/api-server-client");

const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        range: vi.fn(),
        order: vi.fn(() => ({
          range: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    })),
  })),
  rpc: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createApiServerSupabaseClient as any).mockReturnValue(mockSupabaseClient);
});

describe("Check-in Actions", () => {
  describe("submitCheckIn", () => {
    it("should successfully submit a check-in", async () => {
      const mockBeach = { id: "beach-123" };
      const mockCheckIn = {
        id: "checkin-123",
        user_id: "user-123",
        beach_id: "beach-123",
        wave_height: 3.5,
        forecast_accuracy_rating: "accurate" as const,
      };

      // Mock beach validation
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: mockBeach,
        error: null,
      });

      // Mock check-in creation
      mockSupabaseClient.from().insert().select().single.mockResolvedValueOnce({
        data: mockCheckIn,
        error: null,
      });

      const result = await submitCheckIn("user-123", "beach-123", {
        wave_height: 3.5,
        wind_speed: 10,
        wind_direction: "OFFSHORE",
        water_temp: 68,
        crowd_level: 2,
        vibe: "super fun",
        forecast_accuracy_rating: "accurate",
      });

      expect(result).toEqual(mockCheckIn);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });

    it("should throw error if beach not found", async () => {
      mockSupabaseClient
        .from()
        .select()
        .eq()
        .single.mockResolvedValueOnce({
          data: null,
          error: { message: "Beach not found" },
        });

      await expect(
        submitCheckIn("user-123", "invalid-beach", {
          forecast_accuracy_rating: "accurate",
        })
      ).rejects.toThrow("Beach not found");
    });

    it("should throw error if forecast accuracy rating is missing", async () => {
      await expect(
        submitCheckIn("user-123", "beach-123", {
          wave_height: 3.5,
        } as any)
      ).rejects.toThrow("Forecast accuracy rating is required");
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

      const result = await getRecentCheckIns("beach-123", 24, 10);

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

      const result = await getForecastAccuracyStats("beach-123", 7);

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

  describe("updateCheckIn", () => {
    it("should successfully update user's own check-in", async () => {
      const mockUpdatedCheckIn = {
        id: "checkin-123",
        user_id: "user-123",
        wave_height: 4.0,
        forecast_accuracy_rating: "somewhat" as const,
      };

      mockSupabaseClient
        .from()
        .update()
        .eq()
        .eq()
        .select()
        .single.mockResolvedValueOnce({
          data: mockUpdatedCheckIn,
          error: null,
        });

      const result = await updateCheckIn("user-123", "checkin-123", {
        wave_height: 4.0,
        forecast_accuracy_rating: "somewhat",
      });

      expect(result).toEqual(mockUpdatedCheckIn);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });

    it("should throw error if check-in not found", async () => {
      mockSupabaseClient
        .from()
        .update()
        .eq()
        .eq()
        .select()
        .single.mockResolvedValueOnce({
          data: null,
          error: { message: "Not found" },
        });

      await expect(
        updateCheckIn("user-123", "checkin-123", {
          wave_height: 4.0,
        })
      ).rejects.toThrow("Failed to update check-in");
    });
  });

  describe("deleteCheckIn", () => {
    it("should successfully delete user's own check-in", async () => {
      mockSupabaseClient.from().delete().eq().eq.mockResolvedValueOnce({
        error: null,
      });

      const result = await deleteCheckIn("user-123", "checkin-123");

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("check_ins");
    });

    it("should handle delete errors", async () => {
      mockSupabaseClient
        .from()
        .delete()
        .eq()
        .eq.mockResolvedValueOnce({
          error: { message: "Delete failed" },
        });

      await expect(deleteCheckIn("user-123", "checkin-123")).rejects.toThrow(
        "Failed to delete check-in"
      );
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

      mockSupabaseClient
        .from()
        .select()
        .eq()
        .order()
        .range.mockResolvedValueOnce({
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

      mockSupabaseClient
        .from()
        .select()
        .eq()
        .order()
        .range.mockResolvedValueOnce({
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

      mockSupabaseClient
        .from()
        .select()
        .eq()
        .order()
        .range.mockResolvedValueOnce({
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

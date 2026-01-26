/**
 * @jest-environment node
 */

import {
  getImplicitPreferences,
  matchesInferredWaveRange,
  matchesInferredBreakType,
  isWithinTravelRadius,
  isTopEngagedBeach,
  calculateImplicitBonus,
} from "@/lib/services/implicit-preferences-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

describe("Implicit Preferences Service", () => {
  const mockSupabaseClient = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  describe("getImplicitPreferences", () => {
    it("should fetch user implicit preferences successfully", async () => {
      const mockPreferences = {
        user_id: "user-123",
        inferred_wave_min_ft: 2.0,
        inferred_wave_max_ft: 6.0,
        break_type_weights: {
          beach: 0.8,
          reef: 0.3,
          point: 0.1,
        },
        time_slot_weights: {},
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.1611,
        typical_travel_radius_miles: 25.0,
        top_engaged_beach_ids: ["beach-1", "beach-2", "beach-3"],
        confidence: 0.8,
        event_count: 100,
        last_computed_at: "2026-01-25T00:00:00Z",
        computed_from: "2026-01-01T00:00:00Z",
        computed_to: "2026-01-25T00:00:00Z",
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPreferences,
              error: null,
            }),
          }),
        }),
      });

      const result = await getImplicitPreferences("user-123");

      expect(result).toEqual(mockPreferences);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "user_implicit_preferences"
      );
    });

    it("should return null when user has no implicit preferences", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "No rows found" },
            }),
          }),
        }),
      });

      const result = await getImplicitPreferences("user-456");

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST500", message: "Database error" },
            }),
          }),
        }),
      });

      await expect(getImplicitPreferences("user-789")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("matchesInferredWaveRange", () => {
    const mockPreferences = {
      user_id: "user-123",
      inferred_wave_min_ft: 3.0,
      inferred_wave_max_ft: 8.0,
      break_type_weights: {},
      time_slot_weights: {},
      location_centroid_lat: null,
      location_centroid_lon: null,
      typical_travel_radius_miles: null,
      top_engaged_beach_ids: [],
      confidence: 0.5,
      event_count: 10,
      last_computed_at: "2026-01-25T00:00:00Z",
      computed_from: null,
      computed_to: null,
    };

    it("should return true when wave height is within range", () => {
      const forecast = {
        wave_height_ft: 5.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(true);
    });

    it("should return true when wave height equals minimum", () => {
      const forecast = {
        wave_height_ft: 3.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(true);
    });

    it("should return true when wave height equals maximum", () => {
      const forecast = {
        wave_height_ft: 8.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(true);
    });

    it("should return false when wave height is below minimum", () => {
      const forecast = {
        wave_height_ft: 2.5,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(false);
    });

    it("should return false when wave height is above maximum", () => {
      const forecast = {
        wave_height_ft: 8.5,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(false);
    });

    it("should return false when wave height is missing", () => {
      const forecast = {
        wave_height_ft: null,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };

      expect(matchesInferredWaveRange(forecast, mockPreferences)).toBe(false);
    });
  });

  describe("matchesInferredBreakType", () => {
    const mockPreferences = {
      user_id: "user-123",
      inferred_wave_min_ft: 3.0,
      inferred_wave_max_ft: 8.0,
      break_type_weights: {
        beach: 0.8,
        reef: 0.3,
        point: 0.15,
      },
      time_slot_weights: {},
      location_centroid_lat: null,
      location_centroid_lon: null,
      typical_travel_radius_miles: null,
      top_engaged_beach_ids: [],
      confidence: 0.5,
      event_count: 10,
      last_computed_at: "2026-01-25T00:00:00Z",
      computed_from: null,
      computed_to: null,
    };

    it("should return true when break type weight is above threshold (0.2)", () => {
      expect(matchesInferredBreakType("beach", mockPreferences)).toBe(true);
      expect(matchesInferredBreakType("reef", mockPreferences)).toBe(true);
    });

    it("should return true when break type weight equals threshold", () => {
      const prefsWithExactThreshold = {
        ...mockPreferences,
        break_type_weights: {
          beach: 0.2,
        },
      };

      expect(matchesInferredBreakType("beach", prefsWithExactThreshold)).toBe(
        true
      );
    });

    it("should return false when break type weight is below threshold", () => {
      expect(matchesInferredBreakType("point", mockPreferences)).toBe(false);
    });

    it("should return false when break type is not in weights", () => {
      expect(matchesInferredBreakType("jetty", mockPreferences)).toBe(false);
    });

    it("should return false when break type is null/undefined", () => {
      expect(matchesInferredBreakType(null as any, mockPreferences)).toBe(
        false
      );
      expect(matchesInferredBreakType(undefined as any, mockPreferences)).toBe(
        false
      );
    });

    it("should handle empty break_type_weights object", () => {
      const emptyWeightsPrefs = {
        ...mockPreferences,
        break_type_weights: {},
      };

      expect(matchesInferredBreakType("beach", emptyWeightsPrefs)).toBe(false);
    });
  });

  describe("isWithinTravelRadius", () => {
    const mockPreferences = {
      user_id: "user-123",
      inferred_wave_min_ft: 3.0,
      inferred_wave_max_ft: 8.0,
      break_type_weights: {},
      time_slot_weights: {},
      location_centroid_lat: 32.7157,  // San Diego
      location_centroid_lon: -117.1611,
      typical_travel_radius_miles: 25.0,
      top_engaged_beach_ids: [],
      confidence: 0.5,
      event_count: 10,
      last_computed_at: "2026-01-25T00:00:00Z",
      computed_from: null,
      computed_to: null,
    };

    it("should return true when beach is within travel radius", () => {
      // La Jolla (~10 miles from San Diego)
      const result = isWithinTravelRadius(
        32.8328,
        -117.2713,
        mockPreferences
      );

      expect(result).toBe(true);
    });

    it("should return true when beach is at edge of travel radius", () => {
      // Oceanside (~20 miles from San Diego, within 25 mile radius)
      const result = isWithinTravelRadius(
        32.9108,
        -117.3789,
        mockPreferences
      );

      // This should be within the 25 mile radius
      expect(result).toBe(true);
    });

    it("should return false when beach is outside travel radius", () => {
      // San Francisco (~500 miles from San Diego)
      const result = isWithinTravelRadius(
        37.7749,
        -122.4194,
        mockPreferences
      );

      expect(result).toBe(false);
    });

    it("should return false when user location is not set", () => {
      const noLocationPrefs = {
        ...mockPreferences,
        location_centroid_lat: null,
        location_centroid_lon: null,
      };

      const result = isWithinTravelRadius(
        32.8328,
        -117.2713,
        noLocationPrefs
      );

      expect(result).toBe(false);
    });

    it("should handle zero travel radius", () => {
      const zeroRadiusPrefs = {
        ...mockPreferences,
        typical_travel_radius_miles: 0,
      };

      const result = isWithinTravelRadius(
        32.7157,
        -117.1611,
        zeroRadiusPrefs
      );

      // Same location should still be within 0 radius
      expect(result).toBe(true);
    });
  });

  describe("isTopEngagedBeach", () => {
    const mockPreferences = {
      user_id: "user-123",
      inferred_wave_min_ft: 3.0,
      inferred_wave_max_ft: 8.0,
      break_type_weights: {},
      time_slot_weights: {},
      location_centroid_lat: null,
      location_centroid_lon: null,
      typical_travel_radius_miles: null,
      top_engaged_beach_ids: ["beach-1", "beach-2", "beach-3"],
      confidence: 0.5,
      event_count: 10,
      last_computed_at: "2026-01-25T00:00:00Z",
      computed_from: null,
      computed_to: null,
    };

    it("should return true when beach is in top engaged list", () => {
      expect(isTopEngagedBeach("beach-1", mockPreferences)).toBe(true);
      expect(isTopEngagedBeach("beach-2", mockPreferences)).toBe(true);
      expect(isTopEngagedBeach("beach-3", mockPreferences)).toBe(true);
    });

    it("should return false when beach is not in top engaged list", () => {
      expect(isTopEngagedBeach("beach-4", mockPreferences)).toBe(false);
    });

    it("should return false when beachId is null/undefined", () => {
      expect(isTopEngagedBeach(null as any, mockPreferences)).toBe(false);
      expect(isTopEngagedBeach(undefined as any, mockPreferences)).toBe(false);
    });

    it("should handle empty top_engaged_beach_ids array", () => {
      const emptyPrefs = {
        ...mockPreferences,
        top_engaged_beach_ids: [],
      };

      expect(isTopEngagedBeach("beach-1", emptyPrefs)).toBe(false);
    });
  });

  describe("calculateImplicitBonus", () => {
    const mockPreferences = {
      user_id: "user-123",
      inferred_wave_min_ft: 3.0,
      inferred_wave_max_ft: 8.0,
      break_type_weights: {
        beach: 0.8,
        reef: 0.3,
      },
      time_slot_weights: {},
      location_centroid_lat: null,
      location_centroid_lon: null,
      typical_travel_radius_miles: null,
      top_engaged_beach_ids: ["beach-1", "beach-2"],
      confidence: 0.5,
      event_count: 10,
      last_computed_at: "2026-01-25T00:00:00Z",
      computed_from: null,
      computed_to: null,
    };

    it("should calculate full bonus when all conditions match", () => {
      const forecast = {
        wave_height_ft: 5.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "beach";
      const isTopEngaged = true;
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      // Wave range: 10 * 0.3 = 3
      // Break type: 8 * 0.3 = 2.4
      // Top engaged: 2 (flat)
      // Total: 7.4
      expect(result.total).toBeCloseTo(7.4, 2);
      expect(result.breakdown.waveRange).toBeCloseTo(3.0, 2);
      expect(result.breakdown.breakType).toBeCloseTo(2.4, 2);
      expect(result.breakdown.topEngaged).toBe(2.0);
    });

    it("should calculate partial bonus when only wave range matches", () => {
      const forecast = {
        wave_height_ft: 5.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "point"; // Not in preferences
      const isTopEngaged = false; // Not top engaged
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      // Wave range: 10 * 0.3 = 3
      // Break type: 0 (doesn't match)
      // Top engaged: 0 (not in list)
      // Total: 3
      expect(result.total).toBeCloseTo(3.0, 2);
      expect(result.breakdown.waveRange).toBeCloseTo(3.0, 2);
      expect(result.breakdown.breakType).toBe(0);
      expect(result.breakdown.topEngaged).toBe(0);
    });

    it("should calculate partial bonus when only break type matches", () => {
      const forecast = {
        wave_height_ft: 10.0, // Outside range
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "reef";
      const isTopEngaged = false;
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      // Wave range: 0 (outside range)
      // Break type: 8 * 0.3 = 2.4
      // Top engaged: 0
      // Total: 2.4
      expect(result.total).toBeCloseTo(2.4, 2);
      expect(result.breakdown.waveRange).toBe(0);
      expect(result.breakdown.breakType).toBeCloseTo(2.4, 2);
      expect(result.breakdown.topEngaged).toBe(0);
    });

    it("should calculate partial bonus when only top engaged matches", () => {
      const forecast = {
        wave_height_ft: 10.0, // Outside range
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "point"; // Not preferred
      const isTopEngaged = true; // Top engaged
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      // Wave range: 0
      // Break type: 0
      // Top engaged: 2 (flat)
      // Total: 2
      expect(result.total).toBe(2.0);
      expect(result.breakdown.waveRange).toBe(0);
      expect(result.breakdown.breakType).toBe(0);
      expect(result.breakdown.topEngaged).toBe(2.0);
    });

    it("should return zero bonus when no conditions match", () => {
      const forecast = {
        wave_height_ft: 10.0, // Outside range
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "jetty"; // Not preferred
      const isTopEngaged = false; // Not top engaged
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      expect(result.total).toBe(0);
      expect(result.breakdown.waveRange).toBe(0);
      expect(result.breakdown.breakType).toBe(0);
      expect(result.breakdown.topEngaged).toBe(0);
    });

    it("should scale bonus with different implicit weights", () => {
      const forecast = {
        wave_height_ft: 5.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "beach";
      const isTopEngaged = true;

      // Test with weight 0.5
      const result1 = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        0.5
      );

      // Wave range: 10 * 0.5 = 5
      // Break type: 8 * 0.5 = 4
      // Top engaged: 2 (flat)
      // Total: 11
      expect(result1.total).toBeCloseTo(11.0, 2);

      // Test with weight 0.1
      const result2 = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        0.1
      );

      // Wave range: 10 * 0.1 = 1
      // Break type: 8 * 0.1 = 0.8
      // Top engaged: 2 (flat)
      // Total: 3.8
      expect(result2.total).toBeCloseTo(3.8, 2);
    });

    it("should handle zero implicit weight", () => {
      const forecast = {
        wave_height_ft: 5.0,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "beach";
      const isTopEngaged = true;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        0
      );

      // Wave range: 10 * 0 = 0
      // Break type: 8 * 0 = 0
      // Top engaged: 2 (flat, always applies)
      // Total: 2
      expect(result.total).toBe(2.0);
      expect(result.breakdown.waveRange).toBe(0);
      expect(result.breakdown.breakType).toBe(0);
      expect(result.breakdown.topEngaged).toBe(2.0);
    });

    it("should handle missing forecast data gracefully", () => {
      const forecast = {
        wave_height_ft: null,
        wave_period_s: 12,
        wind_speed_mph: 10,
      };
      const breakType = "beach";
      const isTopEngaged = true;
      const implicitWeight = 0.3;

      const result = calculateImplicitBonus(
        forecast,
        breakType,
        isTopEngaged,
        mockPreferences,
        implicitWeight
      );

      // Wave range: 0 (missing data)
      // Break type: 8 * 0.3 = 2.4
      // Top engaged: 2
      // Total: 4.4
      expect(result.total).toBeCloseTo(4.4, 2);
      expect(result.breakdown.waveRange).toBe(0);
      expect(result.breakdown.breakType).toBeCloseTo(2.4, 2);
      expect(result.breakdown.topEngaged).toBe(2.0);
    });
  });
});

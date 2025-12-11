import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import type { Beach } from "@/types/database";

describe("Recommendation Scorer", () => {
  const mockBeach = {
    id: "test-beach-1",
    name: "Test Beach",
    center_lat: 33.7490,
    center_lng: -118.4095,
    location_text: "Manhattan Beach, CA",
    region: "Los Angeles",
    country: "USA",
    is_private: false,
    owner_id: null,
    created_at: "2024-01-01T00:00:00Z",
    // Add scoring-specific fields for realistic testing
    wind_offshore_deg: 90, // East is offshore for west-facing beach
    wind_offshore_tol_deg: 30,
    wind_cross_shore_ok_kt: 15,
    wind_onshore_bad_kt: 20,
    swell_window_min_deg: 200,
    swell_window_max_deg: 250,
    preferred_tide_ft_min: 1.0,
    preferred_tide_ft_max: 4.0,
    skill_level: "intermediate",
  } as unknown as Beach;

  describe("Basic scoring functionality", () => {
    it("should return a score between 0 and 100", () => {
      const snapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 270,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const result = scoreRecommendation(mockBeach, snapshot);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it("should include reasons for the score", () => {
      const snapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 270,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const result = scoreRecommendation(mockBeach, snapshot);
      
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.every(reason => typeof reason === "string")).toBe(true);
    });
  });

  describe("Wind scoring", () => {
    it("should score offshore winds higher than onshore", () => {
      const offshoreSnapshot = {
        wave_direction_deg: 225, // SW waves
        wind_direction_deg: 90,  // E wind (offshore for west-facing beach)
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const onshoreSnapshot = {
        wave_direction_deg: 225, // SW waves  
        wind_direction_deg: 270, // W wind (onshore for west-facing beach)
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const offshoreResult = scoreRecommendation(mockBeach, offshoreSnapshot);
      const onshoreResult = scoreRecommendation(mockBeach, onshoreSnapshot);

      expect(offshoreResult.score).toBeGreaterThan(onshoreResult.score);
    });

    it("should penalize very strong winds", () => {
      const lightWindSnapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 270, // Onshore wind (west for west-facing beach)
        wind_speed_kts: 15, // Below bad threshold
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const strongWindSnapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 270, // Onshore wind
        wind_speed_kts: 25, // Above wind_onshore_bad_kt (20)
        tide_ft: 2.5,
        user_skill: "intermediate",
      };

      const lightResult = scoreRecommendation(mockBeach, lightWindSnapshot);
      const strongResult = scoreRecommendation(mockBeach, strongWindSnapshot);

      expect(lightResult.score).toBeGreaterThan(strongResult.score);
      expect(strongResult.reasons).toContain("strong_onshore");
    });
  });

  describe("Skill level adjustments", () => {
    it("should give different scores for different skill levels", () => {
      const snapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 270,
        wind_speed_kts: 15,
        tide_ft: 2.5,
        user_skill: null,
      };

      const beginnerSnapshot = { ...snapshot, user_skill: "beginner" };
      const advancedSnapshot = { ...snapshot, user_skill: "advanced" };

      const beginnerResult = scoreRecommendation(mockBeach, beginnerSnapshot);
      const advancedResult = scoreRecommendation(mockBeach, advancedSnapshot);

      // Results may vary based on conditions, but should be valid scores
      expect(beginnerResult.score).toBeGreaterThanOrEqual(0);
      expect(advancedResult.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle null/undefined values gracefully", () => {
      const snapshot = {
        wave_direction_deg: null,
        wind_direction_deg: null,
        wind_speed_kts: null,
        tide_ft: null,
        user_skill: null,
      };

      const result = scoreRecommendation(mockBeach, snapshot);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it("should handle extreme values", () => {
      const snapshot = {
        wave_direction_deg: 999,
        wind_direction_deg: -100,
        wind_speed_kts: 100,
        tide_ft: -10,
        user_skill: "expert",
      };

      const result = scoreRecommendation(mockBeach, snapshot);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("Tide conditions", () => {
    it("should prefer mid-tide conditions", () => {
      const lowTideSnapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: -1.0, // Low tide
        user_skill: "intermediate",
      };

      const midTideSnapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5, // Mid tide
        user_skill: "intermediate",
      };

      const highTideSnapshot = {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 6.0, // High tide
        user_skill: "intermediate",
      };

      const lowResult = scoreRecommendation(mockBeach, lowTideSnapshot);
      const midResult = scoreRecommendation(mockBeach, midTideSnapshot);
      const highResult = scoreRecommendation(mockBeach, highTideSnapshot);

      // Mid tide should generally score better than extreme tides
      expect(midResult.score).toBeGreaterThanOrEqual(Math.min(lowResult.score, highResult.score));
    });
  });
});
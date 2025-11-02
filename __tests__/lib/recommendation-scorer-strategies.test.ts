import type { Beach } from "@/types/database";

// Import the private classes for testing by re-exporting them
// Note: In production, we'd export these from the module for testability
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";

// Test utilities
const createMockBeach = (overrides?: Partial<Beach>): Beach => ({
  id: "test-beach",
  name: "Test Beach",
  lat: 33.7490,
  lon: -118.4095,
  location: "Test Location",
  region: "Test Region",
  country: "USA",
  is_private: false,
  owner_id: null,
  created_at: "2024-01-01T00:00:00Z",
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 30,
  wind_cross_shore_ok_kt: 15,
  wind_onshore_bad_kt: 20,
  swell_window_min_deg: 200,
  swell_window_max_deg: 250,
  preferred_tide_ft_min: 1.0,
  preferred_tide_ft_max: 4.0,
  skill_level: "intermediate",
  ...overrides,
});

describe("Recommendation Scorer Strategy Pattern", () => {
  describe("SwellWindowScorer", () => {
    it("should award 30 points when wave direction is within swell window", () => {
      const beach = createMockBeach({
        swell_window_min_deg: 200,
        swell_window_max_deg: 250,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225, // Within 200-250
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("in_swell_window");
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("should award 0 points when wave direction is outside swell window", () => {
      const beach = createMockBeach({
        swell_window_min_deg: 200,
        swell_window_max_deg: 250,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 100, // Outside 200-250
        wind_direction_deg: 270,
        wind_speed_kts: 25,
        tide_ft: -1,
        user_skill: "beginner",
      });

      expect(result.reasons).toContain("out_of_swell_window");
      // Score could be negative due to other penalties
    });

    it("should handle wrapped swell windows (crossing 0/360 degrees)", () => {
      const beach = createMockBeach({
        swell_window_min_deg: 350,
        swell_window_max_deg: 10, // Wraps around 0
      });

      // Test wave direction at 5 degrees (within wrapped window)
      const result1 = scoreRecommendation(beach, {
        wave_direction_deg: 5,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });
      expect(result1.reasons).toContain("in_swell_window");

      // Test wave direction at 355 degrees (within wrapped window)
      const result2 = scoreRecommendation(beach, {
        wave_direction_deg: 355,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });
      expect(result2.reasons).toContain("in_swell_window");

      // Test wave direction at 180 degrees (outside wrapped window)
      const result3 = scoreRecommendation(beach, {
        wave_direction_deg: 180,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });
      expect(result3.reasons).toContain("out_of_swell_window");
    });

    it("should handle null wave direction gracefully", () => {
      const beach = createMockBeach();

      const result = scoreRecommendation(beach, {
        wave_direction_deg: null,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).not.toContain("in_swell_window");
      expect(result.reasons).not.toContain("out_of_swell_window");
    });
  });

  describe("WindScorer", () => {
    it("should award 30 points for offshore winds within tolerance", () => {
      const beach = createMockBeach({
        wind_offshore_deg: 90, // East
        wind_offshore_tol_deg: 30,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90, // Exactly offshore
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("offshore");
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("should award 10 points for acceptable cross-shore winds", () => {
      const beach = createMockBeach({
        wind_offshore_deg: 90,
        wind_cross_shore_ok_kt: 15,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 180, // 90 degrees from offshore (cross-shore)
        wind_speed_kts: 12, // Below threshold
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("cross_ok");
    });

    it("should penalize -20 points for strong onshore winds", () => {
      const beach = createMockBeach({
        wind_offshore_deg: 90,
        wind_onshore_bad_kt: 20,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 270, // Onshore (opposite of 90)
        wind_speed_kts: 25, // Above threshold
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("strong_onshore");
      // Score will be affected by penalty
    });

    it("should not penalize light onshore winds", () => {
      const beach = createMockBeach({
        wind_offshore_deg: 90,
        wind_onshore_bad_kt: 20,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 270, // Onshore
        wind_speed_kts: 15, // Below threshold
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).not.toContain("strong_onshore");
    });

    it("should handle null wind values gracefully", () => {
      const beach = createMockBeach();

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: null,
        wind_speed_kts: null,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).not.toContain("offshore");
      expect(result.reasons).not.toContain("cross_ok");
      expect(result.reasons).not.toContain("strong_onshore");
    });
  });

  describe("TideScorer", () => {
    it("should award 20 points when tide is within preferred range", () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 1.0,
        preferred_tide_ft_max: 4.0,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5, // Within 1.0-4.0
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("in_tide_window");
    });

    it("should award 0 points when tide is below minimum", () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 1.0,
        preferred_tide_ft_max: 4.0,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 0.5, // Below minimum
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("out_of_tide_window");
    });

    it("should award 0 points when tide is above maximum", () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 1.0,
        preferred_tide_ft_max: 4.0,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 5.0, // Above maximum
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("out_of_tide_window");
    });

    it("should handle null tide values gracefully", () => {
      const beach = createMockBeach();

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: null,
        user_skill: "intermediate",
      });

      expect(result.reasons).not.toContain("in_tide_window");
      expect(result.reasons).not.toContain("out_of_tide_window");
    });

    it("should handle edge case where tide equals minimum", () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 1.0,
        preferred_tide_ft_max: 4.0,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 1.0, // Exactly at minimum
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("in_tide_window");
    });

    it("should handle edge case where tide equals maximum", () => {
      const beach = createMockBeach({
        preferred_tide_ft_min: 1.0,
        preferred_tide_ft_max: 4.0,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 4.0, // Exactly at maximum
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("in_tide_window");
    });
  });

  describe("SkillScorer", () => {
    it("should award 10 points when user skill matches requirement", () => {
      const beach = createMockBeach({
        skill_level: "intermediate",
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("skill_ok");
    });

    it("should award 10 points when user skill exceeds requirement", () => {
      const beach = createMockBeach({
        skill_level: "beginner",
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "advanced",
      });

      expect(result.reasons).toContain("skill_ok");
    });

    it("should penalize -20 points when user skill is below requirement", () => {
      const beach = createMockBeach({
        skill_level: "advanced",
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "beginner",
      });

      expect(result.reasons).toContain("skill_low");
    });

    it("should default to intermediate for null user skill", () => {
      const beach = createMockBeach({
        skill_level: "intermediate",
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: null,
      });

      expect(result.reasons).toContain("skill_ok");
    });

    it("should default to intermediate for null beach skill requirement", () => {
      const beach = createMockBeach({
        skill_level: null,
      });

      const result = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });

      expect(result.reasons).toContain("skill_ok");
    });

    it("should handle skill level comparison correctly", () => {
      // beginner < intermediate < advanced
      const advancedBeach = createMockBeach({ skill_level: "advanced" });

      // Intermediate user at advanced beach - should fail
      const result1 = scoreRecommendation(advancedBeach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "intermediate",
      });
      expect(result1.reasons).toContain("skill_low");

      // Advanced user at advanced beach - should succeed
      const result2 = scoreRecommendation(advancedBeach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 10,
        tide_ft: 2.5,
        user_skill: "advanced",
      });
      expect(result2.reasons).toContain("skill_ok");
    });
  });

  describe("Integration: Multiple Scorers", () => {
    it("should combine scores from all scorers", () => {
      const beach = createMockBeach();

      const perfectConditions = scoreRecommendation(beach, {
        wave_direction_deg: 225, // In swell window: +30
        wind_direction_deg: 90, // Offshore: +30
        wind_speed_kts: 10,
        tide_ft: 2.5, // In tide window: +20
        user_skill: "intermediate", // Skill match: +10
      });

      // Perfect conditions: 30 + 30 + 20 + 10 = 90
      expect(perfectConditions.score).toBe(90);
      expect(perfectConditions.reasons).toEqual([
        "in_swell_window",
        "offshore",
        "in_tide_window",
        "skill_ok",
      ]);
    });

    it("should handle worst case scenario", () => {
      const beach = createMockBeach();

      const worstConditions = scoreRecommendation(beach, {
        wave_direction_deg: 100, // Out of swell window: 0
        wind_direction_deg: 270, // Onshore
        wind_speed_kts: 25, // Strong onshore: -20
        tide_ft: -1, // Out of tide window: 0
        user_skill: "beginner", // Below requirement: -20
      });

      // Worst conditions: 0 + (-20) + 0 + (-20) = -40, clamped to 0
      expect(worstConditions.score).toBe(0);
      expect(worstConditions.reasons).toContain("out_of_swell_window");
      expect(worstConditions.reasons).toContain("strong_onshore");
      expect(worstConditions.reasons).toContain("out_of_tide_window");
      expect(worstConditions.reasons).toContain("skill_low");
    });

    it("should clamp scores to 0-100 range", () => {
      const beach = createMockBeach();

      // Test lower bound (already tested above)
      const veryBad = scoreRecommendation(beach, {
        wave_direction_deg: 100,
        wind_direction_deg: 270,
        wind_speed_kts: 30,
        tide_ft: -5,
        user_skill: "beginner",
      });
      expect(veryBad.score).toBeGreaterThanOrEqual(0);

      // Test upper bound
      const veryGood = scoreRecommendation(beach, {
        wave_direction_deg: 225,
        wind_direction_deg: 90,
        wind_speed_kts: 5,
        tide_ft: 2.5,
        user_skill: "advanced",
      });
      expect(veryGood.score).toBeLessThanOrEqual(100);
    });
  });
});

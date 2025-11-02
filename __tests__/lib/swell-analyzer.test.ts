/**
 * Tests for Swell Analyzer Module
 * Phase 7.2.2: SwellAnalyzer extraction validation
 */

import {
  primarySecondarySwell,
  analyzeSwellMatch,
  isAngleInWindow,
} from "@/lib/analyzers/swell-analyzer";
import type {
  ForecastSlice,
  BeachPreferences,
} from "@/types/morning-intel";

describe("SwellAnalyzer Module", () => {
  describe("isAngleInWindow", () => {
    it("should return true when angle is within normal window (no wraparound)", () => {
      expect(isAngleInWindow(180, 170, 190)).toBe(true);
      expect(isAngleInWindow(170, 170, 190)).toBe(true);
      expect(isAngleInWindow(190, 170, 190)).toBe(true);
    });

    it("should return false when angle is outside normal window", () => {
      expect(isAngleInWindow(160, 170, 190)).toBe(false);
      expect(isAngleInWindow(200, 170, 190)).toBe(false);
    });

    it("should handle 0/360 wraparound correctly (window crosses 0°)", () => {
      // Window: 350° to 10°
      expect(isAngleInWindow(355, 350, 10)).toBe(true);
      expect(isAngleInWindow(0, 350, 10)).toBe(true);
      expect(isAngleInWindow(5, 350, 10)).toBe(true);
      expect(isAngleInWindow(350, 350, 10)).toBe(true);
      expect(isAngleInWindow(10, 350, 10)).toBe(true);
    });

    it("should return false for angles outside wraparound window", () => {
      expect(isAngleInWindow(180, 350, 10)).toBe(false);
      expect(isAngleInWindow(90, 350, 10)).toBe(false);
      expect(isAngleInWindow(270, 350, 10)).toBe(false);
    });

    it("should handle negative angles correctly", () => {
      expect(isAngleInWindow(-10, 350, 10)).toBe(true); // -10° = 350°
      expect(isAngleInWindow(-90, 0, 180)).toBe(false);
    });

    it("should handle angles > 360° correctly", () => {
      expect(isAngleInWindow(370, 0, 20)).toBe(true); // 370° = 10°
      expect(isAngleInWindow(540, 170, 190)).toBe(true); // 540° = 180°
    });
  });

  describe("primarySecondarySwell", () => {
    it("should return null components when forecasts array is empty", () => {
      const result = primarySecondarySwell([]);
      expect(result).toEqual({ primary: null, secondary: null });
    });

    it("should return null when no forecast has swell data", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "08:00",
          forecast_date: "2025-01-15",
          swell_height: null,
          swell_period: null,
          swell_direction: null,
        } as any,
      ];
      const result = primarySecondarySwell(forecasts);
      expect(result).toEqual({ primary: null, secondary: null });
    });

    it("should extract primary swell component correctly", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "08:00",
          forecast_date: "2025-01-15",
          swell_height: 5.5,
          swell_period: 14.2,
          swell_direction: 270.8,
        } as any,
      ];
      const result = primarySecondarySwell(forecasts);

      expect(result.primary).toEqual({
        height: 5.5,
        period: 14,
        direction: 271,
        cardinal: "W",
      });
      expect(result.secondary).toBeNull();
    });

    it("should extract both primary and secondary swell components", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "08:00",
          forecast_date: "2025-01-15",
          swell_height: 4.2,
          swell_period: 12.5,
          swell_direction: 285,
          secondary_swell_height: 2.8,
          secondary_swell_period: 8.3,
          secondary_swell_direction: 315,
        } as any,
      ];
      const result = primarySecondarySwell(forecasts);

      expect(result.primary).toEqual({
        height: 4.2,
        period: 13,
        direction: 285,
        cardinal: "WNW",
      });
      expect(result.secondary).toEqual({
        height: 2.8,
        period: 8,
        direction: 315,
        cardinal: "NW",
      });
    });

    it("should handle edge case of 0° direction (North)", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "08:00",
          forecast_date: "2025-01-15",
          swell_height: 3.0,
          swell_period: 10,
          swell_direction: 0,
        } as any,
      ];
      const result = primarySecondarySwell(forecasts);

      expect(result.primary?.cardinal).toBe("N");
      expect(result.primary?.direction).toBe(0);
    });

    it("should find first forecast with complete swell data", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "06:00",
          swell_height: null,
          swell_period: 10,
          swell_direction: 270,
        } as any,
        {
          forecast_time: "07:00",
          swell_height: 5.0,
          swell_period: 12,
          swell_direction: 280,
        } as any,
      ];
      const result = primarySecondarySwell(forecasts);

      expect(result.primary?.height).toBe(5.0);
    });
  });

  describe("analyzeSwellMatch", () => {
    const mockBeach: BeachPreferences = {
      swellWindowMin: 250,
      swellWindowMax: 290,
    } as BeachPreferences;

    it("should return acceptable status when beach has no swell window configured", () => {
      const beach: BeachPreferences = {} as BeachPreferences;
      const result = analyzeSwellMatch(270, beach);

      expect(result.status).toBe("acceptable");
      expect(result.emoji).toBe("⚠️");
      expect(result.message).toContain("not configured");
    });

    it("should return poor status when no swell direction data", () => {
      const result = analyzeSwellMatch(null, mockBeach);

      expect(result.status).toBe("poor");
      expect(result.emoji).toBe("❌");
      expect(result.message).toContain("No swell direction data");
    });

    it("should return poor status when swell direction is undefined", () => {
      const result = analyzeSwellMatch(undefined, mockBeach);

      expect(result.status).toBe("poor");
      expect(result.emoji).toBe("❌");
    });

    it("should return optimal status when swell is within window", () => {
      const result = analyzeSwellMatch(270, mockBeach);

      expect(result.status).toBe("optimal");
      expect(result.emoji).toBe("✅");
      expect(result.message).toContain("270°");
      expect(result.message).toContain("within optimal window");
    });

    it("should return optimal status at window boundaries", () => {
      const resultMin = analyzeSwellMatch(250, mockBeach);
      const resultMax = analyzeSwellMatch(290, mockBeach);

      expect(resultMin.status).toBe("optimal");
      expect(resultMax.status).toBe("optimal");
    });

    it("should return acceptable status when slightly off optimal (< 45°)", () => {
      const result = analyzeSwellMatch(240, mockBeach); // 30° from center (270)

      expect(result.status).toBe("acceptable");
      expect(result.emoji).toBe("⚠️");
      expect(result.message).toContain("slightly off optimal");
    });

    it("should return poor status when far outside optimal window", () => {
      const result = analyzeSwellMatch(180, mockBeach); // 90° from center

      expect(result.status).toBe("poor");
      expect(result.emoji).toBe("❌");
      expect(result.message).toContain("outside optimal window");
    });

    it("should handle window that crosses 0° boundary", () => {
      const beach: BeachPreferences = {
        swellWindowMin: 350,
        swellWindowMax: 10,
      } as BeachPreferences;

      expect(analyzeSwellMatch(355, beach).status).toBe("optimal");
      expect(analyzeSwellMatch(0, beach).status).toBe("optimal");
      expect(analyzeSwellMatch(5, beach).status).toBe("optimal");
      expect(analyzeSwellMatch(180, beach).status).toBe("poor");
    });

    it("should include cardinal direction in message", () => {
      const result = analyzeSwellMatch(270, mockBeach);
      expect(result.message).toContain("W");
    });

    it("should round swell direction in message", () => {
      const result = analyzeSwellMatch(269.7, mockBeach);
      expect(result.message).toContain("270°");
    });
  });

  describe("Cardinal Direction Conversion (via primarySecondarySwell)", () => {
    const testCases = [
      { degrees: 0, cardinal: "N" },
      { degrees: 45, cardinal: "NE" },
      { degrees: 90, cardinal: "E" },
      { degrees: 135, cardinal: "SE" },
      { degrees: 180, cardinal: "S" },
      { degrees: 225, cardinal: "SW" },
      { degrees: 270, cardinal: "W" },
      { degrees: 315, cardinal: "NW" },
      { degrees: 360, cardinal: "N" }, // Wraps to 0
      { degrees: 22.5, cardinal: "NNE" },
      { degrees: 67.5, cardinal: "ENE" },
    ];

    testCases.forEach(({ degrees, cardinal }) => {
      it(`should convert ${degrees}° to ${cardinal}`, () => {
        const forecasts: ForecastSlice["forecasts"] = [
          {
            forecast_time: "08:00",
            forecast_date: "2025-01-15",
            swell_height: 3.0,
            swell_period: 10,
            swell_direction: degrees,
          } as any,
        ];
        const result = primarySecondarySwell(forecasts);
        expect(result.primary?.cardinal).toBe(cardinal);
      });
    });
  });

  describe("Integration: Swell Analysis Workflow", () => {
    it("should analyze complete swell scenario", () => {
      // Setup: Extract swell from forecast
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_time: "08:00",
          forecast_date: "2025-01-15",
          swell_height: 5.0,
          swell_period: 14,
          swell_direction: 275,
          secondary_swell_height: 2.0,
          secondary_swell_period: 8,
          secondary_swell_direction: 300,
        } as any,
      ];

      const beach: BeachPreferences = {
        swellWindowMin: 260,
        swellWindowMax: 290,
      } as BeachPreferences;

      // Step 1: Extract swell components
      const swells = primarySecondarySwell(forecasts);
      expect(swells.primary).toBeTruthy();
      expect(swells.secondary).toBeTruthy();

      // Step 2: Analyze primary swell match
      const analysis = analyzeSwellMatch(
        swells.primary!.direction,
        beach
      );
      expect(analysis.status).toBe("optimal");
      expect(analysis.message).toContain("W");
      expect(analysis.message).toContain("275°");
    });
  });
});

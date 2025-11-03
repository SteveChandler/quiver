/**
 * Unit tests for IntelFormatter
 * Tests formatting and rendering of surf intelligence data
 */

import { describe, test, expect } from "@jest/globals";
import {
  IntelFormatter,
  intelFormatter,
  getWaveHeightDescription,
  deriveSurfRange,
  renderIntelMarkdown,
} from "@/lib/formatters/intel-formatter";
import type { MorningIntelData, ForecastSlice } from "@/types/morning-intel";

describe("IntelFormatter", () => {
  describe("getWaveHeightDescription", () => {
    test("classifies knee-high waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(0.5)).toBe("Knee-high");
      expect(formatter.getWaveHeightDescription(0.9)).toBe("Knee-high");
    });

    test("classifies waist-high waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(1.0)).toBe("Waist-high");
      expect(formatter.getWaveHeightDescription(1.5)).toBe("Waist-high");
      expect(formatter.getWaveHeightDescription(1.9)).toBe("Waist-high");
    });

    test("classifies chest-high waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(2.0)).toBe("Chest-high");
      expect(formatter.getWaveHeightDescription(3.0)).toBe("Chest-high");
      expect(formatter.getWaveHeightDescription(3.4)).toBe("Chest-high");
    });

    test("classifies head-high waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(3.5)).toBe("Head-high");
      expect(formatter.getWaveHeightDescription(4.0)).toBe("Head-high");
      expect(formatter.getWaveHeightDescription(4.9)).toBe("Head-high");
    });

    test("classifies overhead waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(5.0)).toBe("Overhead");
      expect(formatter.getWaveHeightDescription(6.0)).toBe("Overhead");
      expect(formatter.getWaveHeightDescription(6.9)).toBe("Overhead");
    });

    test("classifies double overhead+ waves", () => {
      const formatter = new IntelFormatter();
      expect(formatter.getWaveHeightDescription(7.0)).toBe("Double overhead+");
      expect(formatter.getWaveHeightDescription(10.0)).toBe("Double overhead+");
    });

    test("backward compatibility function works", () => {
      expect(getWaveHeightDescription(2.5)).toBe("Chest-high");
    });
  });

  describe("deriveSurfRange", () => {
    test("derives range from wave height data", () => {
      const formatter = new IntelFormatter();
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: "2025-10-26",
          forecast_time: "06:00",
          wave_height: 3.5,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: null,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
        {
          forecast_date: "2025-10-26",
          forecast_time: "07:00",
          wave_height: 4.2,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: null,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
        {
          forecast_date: "2025-10-26",
          forecast_time: "08:00",
          wave_height: 3.8,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: null,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
      ];

      const result = formatter.deriveSurfRange(forecasts);

      expect(result.min).toBe(3.5);
      expect(result.max).toBe(4.2);
      expect(result.dominant).toBe("Head-high"); // avg ~3.83
    });

    test("falls back to swell height when wave height not available", () => {
      const formatter = new IntelFormatter();
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: "2025-10-26",
          forecast_time: "06:00",
          wave_height: null,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: 2.5,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
      ];

      const result = formatter.deriveSurfRange(forecasts);

      expect(result.min).toBe(2.5);
      expect(result.max).toBe(2.5);
      expect(result.dominant).toBe("Chest-high");
    });

    test("returns N/A when no wave data available", () => {
      const formatter = new IntelFormatter();
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: "2025-10-26",
          forecast_time: "06:00",
          wave_height: null,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: null,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
      ];

      const result = formatter.deriveSurfRange(forecasts);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.dominant).toBe("N/A");
    });

    test("backward compatibility function works", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: "2025-10-26",
          forecast_time: "06:00",
          wave_height: 3.0,
          wave_period: null,
          wave_direction: null,
          wind_speed: null,
          wind_direction: null,
          tide_height: null,
          tide_status: null,
          swell_height: null,
          swell_period: null,
          swell_direction: null,
          secondary_swell_height: null,
          secondary_swell_period: null,
          secondary_swell_direction: null,
        },
      ];

      const result = deriveSurfRange(forecasts);
      expect(result.dominant).toBe("Chest-high");
    });
  });

  describe("renderIntelMarkdown", () => {
    test("renders complete intel markdown", () => {
      const formatter = new IntelFormatter();
      const data: MorningIntelData = {
        spotName: "Ocean Beach",
        date: "2025-10-26",
        time: "06:00",
        surf: { min: 3, max: 5, dominant: "Chest-head high" },
        tide: {
          height: 3.2,
          direction: "falling",
          nextEvent: {
            type: "LOW",
            height: 1.5,
            time: "09:30",
          },
        },
        swells: {
          primary: {
            height: 4.0,
            period: 12,
            direction: 270,
            cardinal: "W",
          },
          secondary: {
            height: 2.5,
            period: 8,
            direction: 290,
            cardinal: "WNW",
          },
        },
        wind: {
          speed: 5,
          direction: 90,
          cardinal: "E",
          offshore: true,
          description: "light offshore",
        },
        bestWindow: "06:00–08:00 on the drop",
        confidence: "High",
        notes: "Clean offshore winds create organized waves.",
        payload: {
          generatedAt: "2025-10-26T06:00:00Z",
          dataCompleteness: 0.95,
          sources: {
            wave: true,
            tide: true,
            wind: true,
            swell: true,
          },
        },
      };

      const markdown = formatter.renderIntelMarkdown(data);

      // Check key sections are present
      expect(markdown).toContain("**Ocean Beach — Morning Surf Intel (06:00)**");
      expect(markdown).toContain("**Surf:** 3–5 ft (Chest-head high)");
      expect(markdown).toContain("**Tide @ 06:00:** 3.2 ft, falling");
      expect(markdown).toContain("next LOW 1.5 ft @ 09:30");
      expect(markdown).toContain("Primary: 4 ft @ 12s from W (270°)");
      expect(markdown).toContain("Secondary: 2.5 ft @ 8s from WNW (290°)");
      expect(markdown).toContain("**Wind:** 5 mph E (90°) — light offshore");
      expect(markdown).toContain("**Best Window:** 06:00–08:00 on the drop");
      expect(markdown).toContain("**Confidence:** High");
      expect(markdown).toContain("**Notes:** Clean offshore winds create organized waves.");
    });

    test("renders with conditions score when available", () => {
      const formatter = new IntelFormatter();
      const data: MorningIntelData = {
        spotName: "Ocean Beach",
        date: "2025-10-26",
        time: "06:00",
        surf: { min: 3, max: 5, dominant: "Chest-head high" },
        tide: {
          height: 3.2,
          direction: "falling",
          nextEvent: null,
        },
        swells: {
          primary: {
            height: 4.0,
            period: 12,
            direction: 270,
            cardinal: "W",
          },
          secondary: null,
        },
        wind: {
          speed: 5,
          direction: 90,
          cardinal: "E",
          offshore: true,
          description: "light offshore",
        },
        bestWindow: "06:00–08:00",
        confidence: "High",
        notes: "Good conditions",
        beachPreferences: {
          name: "Ocean Beach",
          swellWindowMin: 250,
          swellWindowMax: 290,
          windOffshoreDeg: 90,
          windOffshoreTol: 45,
          tideMinFt: 2,
          tideMaxFt: 5,
          hazards: ["Rip currents", "Rocks"],
          skillLevel: "Intermediate",
          breakType: "Beach break",
        },
        conditions: {
          score: 8,
          swell: {
            status: "optimal",
            emoji: "✅",
            message: "W (270°) - within optimal window",
          },
          wind: {
            status: "optimal",
            emoji: "✅",
            message: "light offshore (5 mph E)",
          },
          tide: {
            status: "optimal",
            emoji: "✅",
            message: "3.2 ft - within optimal range (2-5 ft)",
          },
        },
        payload: {
          generatedAt: "2025-10-26T06:00:00Z",
          dataCompleteness: 0.95,
          sources: {
            wave: true,
            tide: true,
            wind: true,
            swell: true,
          },
        },
      };

      const markdown = formatter.renderIntelMarkdown(data);

      expect(markdown).toContain("📊 **CONDITIONS SCORE: 8/10**");
      expect(markdown).toContain("✅ **Swell Direction:** W (270°) - within optimal window");
      expect(markdown).toContain("✅ **Wind:** light offshore (5 mph E)");
      expect(markdown).toContain("✅ **Tide:** 3.2 ft - within optimal range (2-5 ft)");
      expect(markdown).toContain("🏄 **Skill Level:** Intermediate");
      expect(markdown).toContain("⚠️ **HAZARDS:** Rip currents, Rocks");
    });

    test("handles missing secondary swell", () => {
      const formatter = new IntelFormatter();
      const data: MorningIntelData = {
        spotName: "Ocean Beach",
        date: "2025-10-26",
        time: "06:00",
        surf: { min: 3, max: 5, dominant: "Chest-high" },
        tide: {
          height: 3.2,
          direction: "rising",
          nextEvent: null,
        },
        swells: {
          primary: {
            height: 4.0,
            period: 12,
            direction: 270,
            cardinal: "W",
          },
          secondary: null,
        },
        wind: {
          speed: 5,
          direction: 90,
          cardinal: "E",
          offshore: true,
          description: "offshore",
        },
        bestWindow: "06:00–08:00",
        confidence: "Medium",
        notes: "Standard conditions",
        payload: {
          generatedAt: "2025-10-26T06:00:00Z",
          dataCompleteness: 0.8,
          sources: {
            wave: true,
            tide: true,
            wind: true,
            swell: true,
          },
        },
      };

      const markdown = formatter.renderIntelMarkdown(data);

      expect(markdown).toContain("Primary: 4 ft @ 12s from W (270°)");
      expect(markdown).toContain("Secondary: N/A");
    });

    test("backward compatibility function works", () => {
      const data: MorningIntelData = {
        spotName: "Ocean Beach",
        date: "2025-10-26",
        time: "06:00",
        surf: { min: 3, max: 5, dominant: "Chest-high" },
        tide: {
          height: 3.2,
          direction: "slack",
          nextEvent: null,
        },
        swells: {
          primary: null,
          secondary: null,
        },
        wind: {
          speed: 0,
          direction: 0,
          cardinal: "N",
          offshore: false,
          description: "calm",
        },
        bestWindow: "N/A",
        confidence: "Low",
        notes: "",
        payload: {
          generatedAt: "2025-10-26T06:00:00Z",
          dataCompleteness: 0.5,
          sources: {
            wave: false,
            tide: false,
            wind: false,
            swell: false,
          },
        },
      };

      const markdown = renderIntelMarkdown(data);
      expect(markdown).toContain("Ocean Beach");
      expect(markdown).toContain("**Notes:** Standard morning conditions");
    });
  });

  describe("singleton instance", () => {
    test("provides working singleton instance", () => {
      expect(intelFormatter.getWaveHeightDescription(3.0)).toBe("Chest-high");
    });
  });
});

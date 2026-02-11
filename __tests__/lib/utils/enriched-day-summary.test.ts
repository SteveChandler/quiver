/**
 * Tests for enrichDaySummaries utility
 *
 * @module __tests__/lib/utils/enriched-day-summary
 */

import { enrichDaySummaries } from "@/lib/utils/enriched-day-summary";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Helper factories
function makeDaySummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    date: "Feb 10",
    dayName: "Mon",
    minHeight: 3,
    maxHeight: 5,
    tier: "good" as const,
    score: 65,
    fullDate: "2026-02-10",
    isToday: false,
    bestTime: "09:00",
    period: 12,
    ...overrides,
  };
}

function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "beach-1",
    forecast_date: "2026-02-10",
    forecast_time: "09:00",
    wave_height: "4",
    wind_speed: "8 mph",
    wind_direction: "E",
    water_temp: "60",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
    ...overrides,
  };
}

describe("enrichDaySummaries", () => {
  describe("Wind classification", () => {
    it("classifies offshore wind correctly", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "E", // Offshore for California west coast
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("offshore");
    });

    it("classifies light wind correctly", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "Light and Variable",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("light");
    });

    it("classifies onshore wind correctly", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "W", // Onshore for California west coast
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("onshore");
    });

    it("handles empty wind direction as onshore", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("onshore");
    });
  });

  describe("Time slot derivation", () => {
    it("derives dawn-patrol time slot (before 7am)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "05:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "05:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("dawn-patrol");
    });

    it("derives morning time slot (7am-10am)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "08:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "08:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("morning");
    });

    it("derives midday time slot (10am-1pm)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "12:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "12:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("midday");
    });

    it("derives afternoon time slot (1pm-4pm)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "14:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "14:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("afternoon");
    });

    it("derives evening time slot (4pm onwards)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "17:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "17:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("evening");
    });

    it("handles edge case: 7am exactly is morning", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "07:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "07:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("morning");
    });

    it("handles edge case: 10am exactly is midday", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "10:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "10:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].bestTimeSlot).toBe("midday");
    });
  });

  describe("Fallback when bestTime is null", () => {
    it("returns default values when bestTime is null", () => {
      const day = makeDaySummary({
        fullDate: "2026-02-10",
        bestTime: null,
      });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("onshore");
      expect(result[0].windSpeed).toBeNull();
      expect(result[0].bestTimeSlot).toBe("morning");
    });
  });

  describe("Fallback when no matching forecast for a day", () => {
    it("returns default values when no forecasts match the date", () => {
      const day = makeDaySummary({
        fullDate: "2026-02-10",
        bestTime: "09:00",
      });
      const forecast = makeForecast({
        forecast_date: "2026-02-11", // Different date
        forecast_time: "09:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("onshore");
      expect(result[0].windSpeed).toBeNull();
      expect(result[0].bestTimeSlot).toBe("morning");
    });

    it("returns default values when forecast array is empty", () => {
      const day = makeDaySummary({
        fullDate: "2026-02-10",
        bestTime: "09:00",
      });

      const result = enrichDaySummaries([day], []);

      expect(result[0].windConditions).toBe("onshore");
      expect(result[0].windSpeed).toBeNull();
      expect(result[0].bestTimeSlot).toBe("morning");
    });
  });

  describe("Wind speed extraction", () => {
    it("extracts wind speed from closest forecast", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_speed: "12 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windSpeed).toBe("12 mph");
    });

    it("returns null when wind_speed is missing", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_speed: null,
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windSpeed).toBeNull();
    });
  });

  describe("Closest forecast selection", () => {
    it("selects exact matching forecast when available", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecasts = [
        makeForecast({
          id: "1",
          forecast_date: "2026-02-10",
          forecast_time: "06:00",
          wind_direction: "W",
        }),
        makeForecast({
          id: "2",
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "E",
        }),
        makeForecast({
          id: "3",
          forecast_date: "2026-02-10",
          forecast_time: "12:00",
          wind_direction: "W",
        }),
      ];

      const result = enrichDaySummaries([day], forecasts);

      expect(result[0].windConditions).toBe("offshore"); // E wind
    });

    it("selects closest forecast when no exact match", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "08:00" });
      const forecasts = [
        makeForecast({
          id: "1",
          forecast_date: "2026-02-10",
          forecast_time: "06:00",
          wind_direction: "W",
        }),
        makeForecast({
          id: "2",
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "E",
        }),
        makeForecast({
          id: "3",
          forecast_date: "2026-02-10",
          forecast_time: "12:00",
          wind_direction: "W",
        }),
      ];

      const result = enrichDaySummaries([day], forecasts);

      // 08:00 is closer to 09:00 (1 hour diff) than 06:00 (2 hours diff)
      expect(result[0].windConditions).toBe("offshore"); // E wind from 09:00 forecast
    });

    it("handles tie by selecting first forecast in array order", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecasts = [
        makeForecast({
          id: "1",
          forecast_date: "2026-02-10",
          forecast_time: "07:00",
          wind_direction: "W",
          wind_speed: "10 mph",
        }),
        makeForecast({
          id: "2",
          forecast_date: "2026-02-10",
          forecast_time: "11:00",
          wind_direction: "E",
          wind_speed: "15 mph",
        }),
      ];

      const result = enrichDaySummaries([day], forecasts);

      // Both 07:00 and 11:00 are 2 hours away, should select first (07:00)
      expect(result[0].windConditions).toBe("onshore"); // W wind
      expect(result[0].windSpeed).toBe("10 mph");
    });

    it("handles missing forecast_time gracefully", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: undefined,
        wind_direction: "E",
      });

      const result = enrichDaySummaries([day], [forecast]);

      // Should default to hour 12 when forecast_time is missing
      expect(result[0].windConditions).toBe("offshore");
    });
  });

  describe("Multiple days", () => {
    it("enriches multiple days correctly", () => {
      const days = [
        makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" }),
        makeDaySummary({ fullDate: "2026-02-11", bestTime: "14:00" }),
      ];
      const forecasts = [
        makeForecast({
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "E",
          wind_speed: "8 mph",
        }),
        makeForecast({
          forecast_date: "2026-02-11",
          forecast_time: "14:00",
          wind_direction: "Light and Variable",
          wind_speed: "5 mph",
        }),
      ];

      const result = enrichDaySummaries(days, forecasts);

      expect(result).toHaveLength(2);
      expect(result[0].windConditions).toBe("offshore");
      expect(result[0].windSpeed).toBe("8 mph");
      expect(result[0].bestTimeSlot).toBe("morning");
      expect(result[1].windConditions).toBe("light");
      expect(result[1].windSpeed).toBe("5 mph");
      expect(result[1].bestTimeSlot).toBe("afternoon");
    });

    it("handles forecasts for only some days", () => {
      const days = [
        makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" }),
        makeDaySummary({ fullDate: "2026-02-11", bestTime: "14:00" }),
        makeDaySummary({ fullDate: "2026-02-12", bestTime: "12:00" }),
      ];
      const forecasts = [
        makeForecast({
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "E",
        }),
        // No forecast for 2026-02-11
        makeForecast({
          forecast_date: "2026-02-12",
          forecast_time: "12:00",
          wind_direction: "W",
        }),
      ];

      const result = enrichDaySummaries(days, forecasts);

      expect(result).toHaveLength(3);
      expect(result[0].windConditions).toBe("offshore");
      expect(result[1].windConditions).toBe("onshore"); // Fallback
      expect(result[1].windSpeed).toBeNull(); // Fallback
      expect(result[1].bestTimeSlot).toBe("morning"); // Fallback
      expect(result[2].windConditions).toBe("onshore");
    });
  });

  describe("Light-wind speed override", () => {
    it("classifies as 'light' when wind speed is ≤5 mph regardless of direction", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "06:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "06:00",
        wind_direction: "W", // Onshore for CA west coast
        wind_speed: "3 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("light");
    });

    it("classifies as 'light' at exactly 5 mph", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "06:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "06:00",
        wind_direction: "W",
        wind_speed: "5 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("light");
    });

    it("uses normal classification when wind speed is >5 mph", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "W", // Onshore for CA west coast
        wind_speed: "8 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("onshore");
    });

    it("classifies as 'light' at 0 mph", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "06:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "06:00",
        wind_direction: "SW",
        wind_speed: "0 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("light");
    });

    it("classifies as 'light' when wind_speed is null or missing", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "06:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "06:00",
        wind_direction: "W",
        wind_speed: null,
      });

      const result = enrichDaySummaries([day], [forecast]);

      // parseFloat(null || "0") = 0, which is ≤5, so "light"
      expect(result[0].windConditions).toBe("light");
    });

    it("preserves offshore classification when wind speed is >5 mph", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "E", // Offshore for CA west coast
        wind_speed: "10 mph",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("offshore");
    });

    it("overrides onshore with light for beach-aware classification too", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "06:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "06:00",
        wind_direction: "E", // Would be onshore for Hawaii (windOffshoreDeg=270)
        wind_speed: "2 mph",
      });

      const result = enrichDaySummaries([day], [forecast], 270);

      expect(result[0].windConditions).toBe("light");
    });
  });

  describe("Beach-aware wind classification with windOffshoreDeg", () => {
    it("classifies E wind as onshore for Hawaii beach (windOffshoreDeg=270)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "E",
      });

      const result = enrichDaySummaries([day], [forecast], 270);

      expect(result[0].windConditions).toBe("onshore");
    });

    it("classifies W wind as offshore for Hawaii beach (windOffshoreDeg=270)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "W",
      });

      const result = enrichDaySummaries([day], [forecast], 270);

      expect(result[0].windConditions).toBe("offshore");
    });

    it("without windOffshoreDeg, E wind is still offshore (backward compat)", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
        wind_direction: "E",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].windConditions).toBe("offshore");
    });
  });

  describe("Edge cases", () => {
    it("handles empty days array", () => {
      const result = enrichDaySummaries([], [makeForecast()]);

      expect(result).toEqual([]);
    });

    it("preserves all original DaySummary properties", () => {
      const day = makeDaySummary({
        fullDate: "2026-02-10",
        bestTime: "09:00",
        date: "Feb 10",
        dayName: "Mon",
        minHeight: 3,
        maxHeight: 5,
        tier: "good",
        score: 65,
        isToday: true,
        period: 12,
      });
      const forecast = makeForecast({
        forecast_date: "2026-02-10",
        forecast_time: "09:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      expect(result[0].date).toBe("Feb 10");
      expect(result[0].dayName).toBe("Mon");
      expect(result[0].minHeight).toBe(3);
      expect(result[0].maxHeight).toBe(5);
      expect(result[0].tier).toBe("good");
      expect(result[0].score).toBe(65);
      expect(result[0].isToday).toBe(true);
      expect(result[0].period).toBe(12);
      expect(result[0].fullDate).toBe("2026-02-10");
      expect(result[0].bestTime).toBe("09:00");
    });

    it("handles forecast without forecast_date", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecast = makeForecast({
        forecast_date: null as any,
        forecast_time: "09:00",
      });

      const result = enrichDaySummaries([day], [forecast]);

      // Should use fallback since forecast_date is null
      expect(result[0].windConditions).toBe("onshore");
      expect(result[0].windSpeed).toBeNull();
      expect(result[0].bestTimeSlot).toBe("morning");
    });

    it("handles multiple forecasts for same date/time", () => {
      const day = makeDaySummary({ fullDate: "2026-02-10", bestTime: "09:00" });
      const forecasts = [
        makeForecast({
          id: "1",
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "E",
          wind_speed: "8 mph",
        }),
        makeForecast({
          id: "2",
          forecast_date: "2026-02-10",
          forecast_time: "09:00",
          wind_direction: "W",
          wind_speed: "12 mph",
        }),
      ];

      const result = enrichDaySummaries([day], forecasts);

      // Should select first matching forecast
      expect(result[0].windConditions).toBe("offshore"); // E wind
      expect(result[0].windSpeed).toBe("8 mph");
    });
  });
});

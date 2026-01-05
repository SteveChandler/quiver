import { describe, it, expect } from "@jest/globals";

import { findFirstMatchingForecast } from "@/lib/services/forecast-alerts";

describe("Forecast Alert Service", () => {
  describe("findFirstMatchingForecast", () => {
    it("matches a forecast within lookahead window when thresholds are met", () => {
      const nowMs = Date.UTC(2025, 0, 1, 12, 0, 0); // 2025-01-01T12:00:00Z
      const forecasts = [
        {
          forecast_date: "2025-01-01",
          forecast_time: "11:00:00",
          wave_height: "3",
          wave_period: "12",
          wind_speed: "8",
          tide_status: "rising",
          confidence_score: 0.9,
        },
        {
          forecast_date: "2025-01-01",
          forecast_time: "13:00:00",
          wave_height: "3.5",
          wave_period: "12",
          wind_speed: "10",
          tide_status: "rising",
          confidence_score: 0.9,
        },
      ];

      const thresholds = {
        source: "default" as const,
        waveMinFt: 2,
        waveMaxFt: 6,
        periodMinS: 10,
        periodMaxS: 18,
        maxWindMph: 15,
        confidenceMin: 0.5,
        preferredTideStatuses: null,
      };

      const match = findFirstMatchingForecast({
        forecasts,
        nowMs,
        lookaheadHours: 6,
        thresholds,
      });

      expect(match).not.toBeNull();
      expect(match!.forecast.forecast_time).toBe("13:00:00");
    });

    it("returns null when all forecasts are outside thresholds", () => {
      const nowMs = Date.UTC(2025, 0, 1, 12, 0, 0);
      const forecasts = [
        {
          forecast_date: "2025-01-01",
          forecast_time: "13:00:00",
          wave_height: "1",
          wave_period: "6",
          wind_speed: "25",
          tide_status: "rising",
          confidence_score: 0.9,
        },
      ];

      const thresholds = {
        source: "default" as const,
        waveMinFt: 2,
        waveMaxFt: 6,
        periodMinS: 10,
        periodMaxS: 18,
        maxWindMph: 15,
        confidenceMin: 0.5,
        preferredTideStatuses: null,
      };

      const match = findFirstMatchingForecast({
        forecasts,
        nowMs,
        lookaheadHours: 6,
        thresholds,
      });

      expect(match).toBeNull();
    });

    it("respects preferred tide statuses when provided", () => {
      const nowMs = Date.UTC(2025, 0, 1, 12, 0, 0);
      const forecasts = [
        {
          forecast_date: "2025-01-01",
          forecast_time: "13:00:00",
          wave_height: "3",
          wave_period: "12",
          wind_speed: "10",
          tide_status: "falling",
          confidence_score: 0.9,
        },
        {
          forecast_date: "2025-01-01",
          forecast_time: "14:00:00",
          wave_height: "3",
          wave_period: "12",
          wind_speed: "10",
          tide_status: "rising",
          confidence_score: 0.9,
        },
      ];

      const thresholds = {
        source: "learned" as const,
        waveMinFt: 2,
        waveMaxFt: 6,
        periodMinS: 10,
        periodMaxS: 18,
        maxWindMph: 15,
        confidenceMin: 0.5,
        preferredTideStatuses: ["rising"],
      };

      const match = findFirstMatchingForecast({
        forecasts,
        nowMs,
        lookaheadHours: 6,
        thresholds,
      });

      expect(match).not.toBeNull();
      expect(match!.forecast.forecast_time).toBe("14:00:00");
    });
  });
});










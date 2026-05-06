import { describe, it, expect } from "@jest/globals";

import {
  findFirstMatchingForecast,
  isWithinDailyForecastSendWindow,
  formatForecastTimeLocal,
} from "@/lib/services/forecast-alerts";

describe("Forecast Alert Service", () => {
  describe("findFirstMatchingForecast", () => {
    it("matches a forecast within lookahead window when thresholds are met", () => {
      const nowMs = Date.UTC(2025, 0, 1, 12, 0, 0); // 2025-01-01T12:00:00Z
      const forecasts = [
        {
          forecast_at: "2025-01-01T11:00:00Z",
          forecast_date: "2025-01-01",
          forecast_time: "11:00:00",
          wave_height: "3",
          wave_period: "12",
          wind_speed: "8",
          tide_status: "rising",
          confidence_score: 0.9,
        },
        {
          forecast_at: "2025-01-01T13:00:00Z",
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
          forecast_at: "2025-01-01T13:00:00Z",
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
          forecast_at: "2025-01-01T13:00:00Z",
          forecast_date: "2025-01-01",
          forecast_time: "13:00:00",
          wave_height: "3",
          wave_period: "12",
          wind_speed: "10",
          tide_status: "falling",
          confidence_score: 0.9,
        },
        {
          forecast_at: "2025-01-01T14:00:00Z",
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

  describe("isWithinDailyForecastSendWindow", () => {
    const tz = "America/Los_Angeles";

    it("returns false before 5 AM local", () => {
      const fourAmPst = new Date(Date.UTC(2025, 0, 2, 12, 0, 0));
      expect(isWithinDailyForecastSendWindow(tz, fourAmPst)).toBe(false);
    });

    it("returns true from 5 AM through 10 AM local", () => {
      const fiveAmPst = new Date(Date.UTC(2025, 0, 2, 13, 0, 0));
      const tenAmPst = new Date(Date.UTC(2025, 0, 2, 18, 0, 0));
      expect(isWithinDailyForecastSendWindow(tz, fiveAmPst)).toBe(true);
      expect(isWithinDailyForecastSendWindow(tz, tenAmPst)).toBe(true);
    });

    it("returns false at 11 AM local and later", () => {
      const elevenAmPst = new Date(Date.UTC(2025, 0, 2, 19, 0, 0));
      const noonPst = new Date(Date.UTC(2025, 0, 2, 20, 0, 0));
      expect(isWithinDailyForecastSendWindow(tz, elevenAmPst)).toBe(false);
      expect(isWithinDailyForecastSendWindow(tz, noonPst)).toBe(false);
    });

    it("uses default timezone when timezone is null", () => {
      const sixAmPst = new Date(Date.UTC(2025, 0, 2, 14, 0, 0));
      expect(isWithinDailyForecastSendWindow(null, sixAmPst)).toBe(true);
    });

    it("handles DST spring forward transition", () => {
      const afterDstSpring = new Date(Date.UTC(2025, 2, 9, 13, 0, 0));
      expect(isWithinDailyForecastSendWindow(tz, afterDstSpring)).toBe(true);
    });

    it("handles DST fall back transition", () => {
      const afterDstFall = new Date(Date.UTC(2025, 10, 2, 14, 0, 0));
      expect(isWithinDailyForecastSendWindow(tz, afterDstFall)).toBe(true);
    });
  });

  describe("formatForecastTimeLocal", () => {
    it("formats time correctly in PST timezone", () => {
      // 2 PM UTC on Feb 4 = 6 AM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 4, 14, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "America/Los_Angeles");
      expect(result).toBe("2/4 6AM");
    });

    it("formats afternoon times correctly", () => {
      // 10 PM UTC on Feb 4 = 2 PM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 4, 22, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "America/Los_Angeles");
      expect(result).toBe("2/4 2PM");
    });

    it("handles timezone that changes the date", () => {
      // 3 AM UTC on Feb 5 = 7 PM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 5, 3, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "America/Los_Angeles");
      expect(result).toBe("2/4 7PM");
    });

    it("uses default timezone when timezone is null", () => {
      // 2 PM UTC on Feb 4 = 6 AM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 4, 14, 0, 0);
      const result = formatForecastTimeLocal(utcMs, null);
      expect(result).toBe("2/4 6AM");
    });

    it("falls back to UTC with suffix for invalid timezone", () => {
      const utcMs = Date.UTC(2025, 1, 4, 14, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "Invalid/Timezone");
      expect(result).toBe("2/4 2PM UTC");
    });

    it("formats 12 PM correctly (not 0 PM)", () => {
      // 8 PM UTC on Feb 4 = 12 PM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 4, 20, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "America/Los_Angeles");
      expect(result).toBe("2/4 12PM");
    });

    it("formats 12 AM correctly (midnight)", () => {
      // 8 AM UTC on Feb 4 = 12 AM PST on Feb 4
      const utcMs = Date.UTC(2025, 1, 4, 8, 0, 0);
      const result = formatForecastTimeLocal(utcMs, "America/Los_Angeles");
      expect(result).toBe("2/4 12AM");
    });
  });
});












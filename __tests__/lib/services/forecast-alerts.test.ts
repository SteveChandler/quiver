import { describe, it, expect } from "@jest/globals";

import {
  findFirstMatchingForecast,
  isWithinQuietHours,
  shouldSuppressForQuietHours,
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

  describe("isWithinQuietHours", () => {
    it("returns true for hours 22, 23 (10 PM - midnight)", () => {
      // 10 PM UTC = 2 PM PST, but we're testing PST timezone
      // Create dates at specific PST hours
      const tz = "America/Los_Angeles";

      // 10 PM PST = 6 AM UTC next day
      const tenPmPst = new Date(Date.UTC(2025, 0, 2, 6, 0, 0)); // Jan 2, 6 AM UTC = Jan 1, 10 PM PST
      expect(isWithinQuietHours(tz, tenPmPst)).toBe(true);

      // 11 PM PST = 7 AM UTC next day
      const elevenPmPst = new Date(Date.UTC(2025, 0, 2, 7, 0, 0));
      expect(isWithinQuietHours(tz, elevenPmPst)).toBe(true);
    });

    it("returns true for hours 0, 1, 2, 3 (midnight - 4 AM)", () => {
      const tz = "America/Los_Angeles";

      // Midnight PST = 8 AM UTC
      const midnightPst = new Date(Date.UTC(2025, 0, 2, 8, 0, 0));
      expect(isWithinQuietHours(tz, midnightPst)).toBe(true);

      // 1 AM PST = 9 AM UTC
      const oneAmPst = new Date(Date.UTC(2025, 0, 2, 9, 0, 0));
      expect(isWithinQuietHours(tz, oneAmPst)).toBe(true);

      // 2 AM PST = 10 AM UTC
      const twoAmPst = new Date(Date.UTC(2025, 0, 2, 10, 0, 0));
      expect(isWithinQuietHours(tz, twoAmPst)).toBe(true);

      // 3 AM PST = 11 AM UTC
      const threeAmPst = new Date(Date.UTC(2025, 0, 2, 11, 0, 0));
      expect(isWithinQuietHours(tz, threeAmPst)).toBe(true);
    });

    it("returns false for hours 4-21 (4 AM - 10 PM)", () => {
      const tz = "America/Los_Angeles";

      // 4 AM PST = 12 PM UTC
      const fourAmPst = new Date(Date.UTC(2025, 0, 2, 12, 0, 0));
      expect(isWithinQuietHours(tz, fourAmPst)).toBe(false);

      // 12 PM PST = 8 PM UTC
      const noonPst = new Date(Date.UTC(2025, 0, 2, 20, 0, 0));
      expect(isWithinQuietHours(tz, noonPst)).toBe(false);

      // 9 PM PST = 5 AM UTC next day
      const ninePmPst = new Date(Date.UTC(2025, 0, 2, 5, 0, 0));
      expect(isWithinQuietHours(tz, ninePmPst)).toBe(false);
    });

    it("uses default timezone (America/Los_Angeles) when timezone is null", () => {
      // 10 PM PST = 6 AM UTC next day
      const tenPmPst = new Date(Date.UTC(2025, 0, 2, 6, 0, 0));
      expect(isWithinQuietHours(null, tenPmPst)).toBe(true);

      // 6 AM PST = 2 PM UTC
      const sixAmPst = new Date(Date.UTC(2025, 0, 2, 14, 0, 0));
      expect(isWithinQuietHours(null, sixAmPst)).toBe(false);
    });

    it("handles exact hour boundaries correctly", () => {
      const tz = "America/Los_Angeles";

      // 9:59 PM PST (just before quiet hours) = 5:59 AM UTC
      const justBefore10pm = new Date(Date.UTC(2025, 0, 2, 5, 59, 59));
      expect(isWithinQuietHours(tz, justBefore10pm)).toBe(false);

      // 10:00 PM PST (start of quiet hours) = 6:00 AM UTC
      const exactly10pm = new Date(Date.UTC(2025, 0, 2, 6, 0, 0));
      expect(isWithinQuietHours(tz, exactly10pm)).toBe(true);

      // 3:59 AM PST (end of quiet hours) = 11:59 AM UTC
      const justBefore4am = new Date(Date.UTC(2025, 0, 2, 11, 59, 59));
      expect(isWithinQuietHours(tz, justBefore4am)).toBe(true);

      // 4:00 AM PST (after quiet hours) = 12:00 PM UTC
      const exactly4am = new Date(Date.UTC(2025, 0, 2, 12, 0, 0));
      expect(isWithinQuietHours(tz, exactly4am)).toBe(false);
    });

    it("handles DST spring forward transition", () => {
      const tz = "America/Los_Angeles";
      // March 9, 2025 is when DST begins (2 AM becomes 3 AM)
      // At 10 AM UTC on March 9, it's 3 AM PDT (after DST switch)
      const afterDstSpring = new Date(Date.UTC(2025, 2, 9, 10, 0, 0));
      expect(isWithinQuietHours(tz, afterDstSpring)).toBe(true); // 3 AM is in quiet hours
    });

    it("handles DST fall back transition", () => {
      const tz = "America/Los_Angeles";
      // November 2, 2025 is when DST ends (2 AM becomes 1 AM)
      // At 9 AM UTC on November 2, it's 1 AM PST (after DST ends)
      const afterDstFall = new Date(Date.UTC(2025, 10, 2, 9, 0, 0));
      expect(isWithinQuietHours(tz, afterDstFall)).toBe(true); // 1 AM is in quiet hours
    });
  });

  describe("shouldSuppressForQuietHours", () => {
    const tz = "America/Los_Angeles";

    it("suppresses when BOTH current time and forecast time are in quiet hours", () => {
      // Current: 3 AM PST = 11 AM UTC
      const now = new Date(Date.UTC(2025, 0, 2, 11, 0, 0));
      // Forecast: 2 AM PST = 10 AM UTC (same day)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 10, 0, 0);

      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(true);
    });

    it("does NOT suppress for dawn patrol - current in quiet hours, forecast outside", () => {
      // Current: 3 AM PST = 11 AM UTC (quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 11, 0, 0));
      // Forecast: 6 AM PST = 2 PM UTC (NOT in quiet hours)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 14, 0, 0);

      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(false);
    });

    it("does NOT suppress when current time is outside quiet hours", () => {
      // Current: 8 AM PST = 4 PM UTC (NOT quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 16, 0, 0));
      // Forecast: 2 AM PST = 10 AM UTC (in quiet hours)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 10, 0, 0);

      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(false);
    });

    it("does NOT suppress when both times are outside quiet hours", () => {
      // Current: 8 AM PST = 4 PM UTC (NOT quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 16, 0, 0));
      // Forecast: 12 PM PST = 8 PM UTC (NOT quiet hours)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 20, 0, 0);

      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(false);
    });

    it("uses default timezone when timezone is null", () => {
      // Current: 3 AM PST = 11 AM UTC (quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 11, 0, 0));
      // Forecast: 6 AM PST = 2 PM UTC (NOT in quiet hours) - dawn patrol scenario
      const forecastUtcMs = Date.UTC(2025, 0, 2, 14, 0, 0);

      // Should NOT suppress for dawn patrol even with null timezone
      expect(shouldSuppressForQuietHours(null, forecastUtcMs, now)).toBe(false);
    });

    it("handles midnight forecast correctly", () => {
      // Current: 11 PM PST = 7 AM UTC (quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 7, 0, 0));
      // Forecast: midnight PST = 8 AM UTC (quiet hours)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 8, 0, 0);

      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(true);
    });

    it("handles late evening current time with early morning forecast", () => {
      // Current: 11 PM PST = 7 AM UTC (quiet hours)
      const now = new Date(Date.UTC(2025, 0, 2, 7, 0, 0));
      // Forecast: 5 AM PST next day = 1 PM UTC (NOT quiet hours)
      const forecastUtcMs = Date.UTC(2025, 0, 2, 13, 0, 0);

      // Should NOT suppress - forecast is outside quiet hours
      expect(shouldSuppressForQuietHours(tz, forecastUtcMs, now)).toBe(false);
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













jest.mock("date-fns/format", () => {
  // Minimal formatter for patterns used by `lib/analyzers/tide-analyzer.ts` in unit tests.
  return (date: Date, pattern: string) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (pattern === "yyyy-MM-dd") {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    if (pattern === "HH:mm") {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    throw new Error(`Unsupported date-fns format pattern in test mock: ${pattern}`);
  };
});

import { fromZonedTime } from "date-fns-tz";

jest.mock("@/lib/monitoring/fallback-tracker", () => ({
  trackFallback: jest.fn(),
}));

import { recommendTideWindow, tideAt } from "@/lib/analyzers/tide-analyzer";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { BeachPreferences, ForecastSlice } from "@/types/morning-intel";

describe("tide-analyzer", () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const TODAY = "2025-01-15";

  const setNowLocal = (localIso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(localIso));
  };

  const tsAtLocal = (date: string, hhmm: string) =>
    fromZonedTime(new Date(`${date}T${hhmm}:00`), tz).toISOString();

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("recommendTideWindow", () => {
    beforeEach(() => {
      jest.mocked(trackFallback).mockClear();
    });

    test("scores a valid 0 ft tide without counting it as missing", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        { forecast_date: TODAY, forecast_time: "06:00", tide_height: 2 },
        { forecast_date: TODAY, forecast_time: "08:00", tide_height: 0 },
      ];

      const result = recommendTideWindow(forecasts, {
        name: "Test Beach",
        tideMinFt: -1,
        tideMaxFt: 1,
      });

      expect(result.height).toBe(0);
      expect(result.recommendedTime).toBe("08:00");
      expect(trackFallback).not.toHaveBeenCalled();
    });

    test.each([null, undefined])("excludes a missing %s morning tide even when 0 ft would score best", (tideHeight) => {
      const forecasts: ForecastSlice["forecasts"] = [
        { forecast_date: TODAY, forecast_time: "06:00", tide_height: tideHeight },
        { forecast_date: TODAY, forecast_time: "08:00", tide_height: 3 },
      ];

      const result = recommendTideWindow(forecasts, {
        name: "Test Beach",
        tideMinFt: -1,
        tideMaxFt: 1,
      });

      expect(result.height).toBe(3);
      expect(result.recommendedTime).toBe("08:00");
      expect(trackFallback).not.toHaveBeenCalled();
    });

    test("chooses the first real morning tide without beach preferences", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        { forecast_date: TODAY, forecast_time: "06:00", tide_height: undefined },
        { forecast_date: TODAY, forecast_time: "07:00", tide_height: null },
        { forecast_date: TODAY, forecast_time: "08:00", tide_height: 3 },
      ];

      const result = recommendTideWindow(forecasts, null);

      expect(result.height).toBe(3);
      expect(result.recommendedTime).toBe("08:00");
      expect(trackFallback).not.toHaveBeenCalled();
    });

    test.each([0, 2.5])("falls back to the first real tide height of %s ft", (tideHeight) => {
      const forecasts: ForecastSlice["forecasts"] = [
        { forecast_date: TODAY, forecast_time: "04:00", tide_height: undefined },
        { forecast_date: TODAY, forecast_time: "05:00", tide_height: null },
        { forecast_date: TODAY, forecast_time: "12:00", tide_height: tideHeight, tide_status: "Rising" },
        { forecast_date: TODAY, forecast_time: "13:00", tide_height: 4, tide_status: "Falling" },
      ];

      expect(recommendTideWindow(forecasts, null)).toEqual({
        height: tideHeight,
        direction: "rising",
        nextEvent: null,
      });
      expect(trackFallback).not.toHaveBeenCalled();
    });

    test.each([null, undefined])("still tracks a missing %s tide height", (tideHeight) => {
      const result = recommendTideWindow(
        [{ forecast_date: TODAY, forecast_time: "08:00", tide_height: tideHeight }],
        { name: "Test Beach", tideMinFt: 2, tideMaxFt: 4 }
      );

      expect(result).toEqual({ height: 0, direction: "slack", nextEvent: null });
      expect(trackFallback).toHaveBeenCalledTimes(1);
      expect(trackFallback).toHaveBeenCalledWith({
        domain: "tide-analyzer",
        field: "tide_height",
        fallbackValue: 0,
        context: undefined,
      });
    });

    test("returns safe defaults for empty input", () => {
      expect(recommendTideWindow([], null)).toEqual({
        height: 0,
        direction: "slack",
        nextEvent: null,
      });
    });

    test("falls back to first forecast with tide data when morning window is missing", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        { forecast_date: TODAY, forecast_time: "05:00", tide_height: null },
        {
          forecast_date: TODAY,
          forecast_time: "12:00",
          tide_height: 2.5,
          tide_status: "Rising",
        },
      ];

      const result = recommendTideWindow(forecasts, null);
      expect(result).toEqual({
        height: 2.5,
        direction: "rising",
        nextEvent: null,
      });
      expect(result.recommendedTime).toBeUndefined();
      expect(result.optimalRange).toBeUndefined();
    });

    test("chooses closest-to-mid tide within range when beach preferences are provided", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: TODAY,
          forecast_time: "06:00",
          tide_height: 3.0,
          tide_status: "Unknown",
        },
        {
          forecast_date: TODAY,
          forecast_time: "08:00",
          tide_height: 4.2,
          tide_status: " Falling ",
        },
        {
          forecast_date: TODAY,
          forecast_time: "10:00",
          tide_height: 5.8,
          tide_status: null,
        },
      ];

      const prefs: BeachPreferences = {
        name: "Test Beach",
        tideMinFt: 2,
        tideMaxFt: 6,
      };

      const result = recommendTideWindow(forecasts, prefs);

      // Mid tide is 4.0ft, so 4.2ft is best within range.
      expect(result.height).toBe(4.2);
      expect(result.direction).toBe("falling");
      expect(result.recommendedTime).toBe("08:00");
      expect(result.optimalRange).toBe("2-6 ft");
    });

    test("normalizes tide direction to rising/falling/slack", () => {
      const forecasts: ForecastSlice["forecasts"] = [
        {
          forecast_date: TODAY,
          forecast_time: "06:00",
          tide_height: 3.5,
          tide_status: "RISING",
        },
      ];

      const result = recommendTideWindow(forecasts, null);
      expect(result.direction).toBe("rising");
    });
  });

  describe("tideAt", () => {
    test("returns safe defaults for empty tide array", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      expect(tideAt("08:00", [], tz)).toEqual({
        height: 0,
        direction: "slack",
        nextEvent: null,
      });
    });

    test("interpolates height (meters->feet) and detects rising/falling direction", () => {
      setNowLocal(`${TODAY}T12:00:00`);

      const tides: ForecastSlice["tides"] = [
        { ts: tsAtLocal(TODAY, "07:00"), tide_height_m: 1.0 },
        { ts: tsAtLocal(TODAY, "09:00"), tide_height_m: 2.0 },
      ];

      const result = tideAt("08:00", tides, tz);
      // Halfway between 1.0m and 2.0m => 1.5m
      expect(result.height).toBeCloseTo(1.5 * 3.28084, 5);
      expect(result.direction).toBe("rising");
      expect(result.nextEvent).toBeNull();
    });

    test("treats near-flat changes as slack (±0.1m threshold)", () => {
      setNowLocal(`${TODAY}T12:00:00`);

      const tides: ForecastSlice["tides"] = [
        { ts: tsAtLocal(TODAY, "07:00"), tide_height_m: 1.0 },
        { ts: tsAtLocal(TODAY, "09:00"), tide_height_m: 1.05 },
      ];

      const result = tideAt("08:00", tides, tz);
      expect(result.direction).toBe("slack");
    });

    test("selects next HIGH/LOW event when a future tide phase exists", () => {
      setNowLocal(`${TODAY}T12:00:00`);

      const tides: ForecastSlice["tides"] = [
        { ts: tsAtLocal(TODAY, "07:00"), tide_height_m: 1.0 },
        { ts: tsAtLocal(TODAY, "09:00"), tide_height_m: 2.0 },
        { ts: tsAtLocal(TODAY, "10:00"), tide_height_m: 2.5, tide_phase: "HIGH" },
        // Include a later point so the loop (i < tides.length - 1) considers the HIGH entry.
        { ts: tsAtLocal(TODAY, "11:00"), tide_height_m: 2.4 },
      ];

      const result = tideAt("08:00", tides, tz);
      expect(result.nextEvent).not.toBeNull();
      expect(result.nextEvent?.type).toBe("HIGH");
      expect(result.nextEvent?.height).toBeCloseTo(2.5 * 3.28084, 5);
      expect(result.nextEvent?.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });
});



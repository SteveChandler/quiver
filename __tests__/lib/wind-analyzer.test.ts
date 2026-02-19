jest.mock("date-fns/format", () => {
  // Minimal formatter for patterns used by `lib/analyzers/wind-analyzer.ts` in unit tests.
  return (date: Date, pattern: string) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (pattern === "yyyy-MM-dd") {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    throw new Error(`Unsupported date-fns format pattern in test mock: ${pattern}`);
  };
});

import {
  analyzeWindConditions,
  calculateOnOffshore,
  normalizeAngle,
  windAt,
} from "@/lib/analyzers/wind-analyzer";
import type { BeachPreferences, WindMetrics } from "@/types/morning-intel";

describe("wind-analyzer", () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const TODAY = "2025-01-15";

  const setNowLocal = (localIso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(localIso));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("normalizeAngle", () => {
    test("normalizes negatives and angles > 360 into 0-359", () => {
      expect(normalizeAngle(-10)).toBe(350);
      expect(normalizeAngle(370)).toBe(10);
      expect(normalizeAngle(720)).toBe(0);
    });
  });

  describe("calculateOnOffshore", () => {
    test("treats wind within ±45° of beach normal (including wraparound) as offshore", () => {
      expect(calculateOnOffshore(270, 270)).toBe(true); // exact
      expect(calculateOnOffshore(315, 270)).toBe(true); // +45
      expect(calculateOnOffshore(316, 270)).toBe(false); // just outside

      // wraparound: windDir 10°, beachNormal 350° => diff 20°
      expect(calculateOnOffshore(10, 350)).toBe(true);
      // wraparound just outside: diff 46°
      expect(calculateOnOffshore(36, 350)).toBe(false);
    });
  });

  describe("windAt", () => {
    test("selects closest forecast to target time and rounds speed/direction", () => {
      setNowLocal(`${TODAY}T12:00:00`);

      // Use fromZonedTime to construct forecast_at values in the same
      // timezone that windAt will use, so "09:00 local" and "12:00 local"
      // are properly comparable to the target "10:00 local".
      const { fromZonedTime } = require("date-fns-tz");
      const forecast9am = fromZonedTime(new Date(`${TODAY}T09:00:00`), tz).toISOString();
      const forecast12pm = fromZonedTime(new Date(`${TODAY}T12:00:00`), tz).toISOString();

      const forecasts = [
        {
          forecast_at: forecast9am,
          forecast_date: TODAY,
          forecast_time: "09:00",
          wind_speed: 4.4,
          wind_direction: 269.6,
        },
        {
          forecast_at: forecast12pm,
          forecast_date: TODAY,
          forecast_time: "12:00",
          wind_speed: 12,
          wind_direction: 90,
        },
      ];

      const result = windAt("10:00", forecasts, tz);
      expect(result.speed).toBe(4); // rounded
      expect(result.direction).toBe(270); // rounded
      expect(result.offshore).toBe(true);
      expect(result.description).toBe("light offshore");
      expect(result.cardinal).toBeTruthy();
    });

    test("returns calm for zero wind", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      const forecasts = [
        {
          forecast_date: TODAY,
          forecast_time: "08:00",
          wind_speed: 0,
          wind_direction: 180,
        },
      ];

      expect(windAt("08:00", forecasts, tz).description).toBe("calm");
    });

    test("describes onshore vs cross-shore when not offshore", () => {
      setNowLocal(`${TODAY}T12:00:00`);

      const onshore = windAt(
        "08:00",
        [
          {
            forecast_date: TODAY,
            forecast_time: "08:00",
            wind_speed: 9,
            wind_direction: 90,
          },
        ],
        tz
      );
      expect(onshore.description).toBe("onshore");

      const cross = windAt(
        "08:00",
        [
          {
            forecast_date: TODAY,
            forecast_time: "08:00",
            wind_speed: 9,
            wind_direction: 0,
          },
        ],
        tz
      );
      expect(cross.description).toBe("cross-shore");

      const lightOnshore = windAt(
        "08:00",
        [
          {
            forecast_date: TODAY,
            forecast_time: "08:00",
            wind_speed: 7,
            wind_direction: 90,
          },
        ],
        tz
      );
      expect(lightOnshore.description).toBe("light onshore");
    });
  });

  describe("analyzeWindConditions", () => {
    const windBase: WindMetrics = {
      speed: 0,
      direction: 0,
      cardinal: "N",
      offshore: false,
      description: "calm",
    };

    test("evaluates general wind conditions when no offshore preference is defined", () => {
      const beach: BeachPreferences = { name: "No Prefs Beach" };

      expect(analyzeWindConditions({ ...windBase, speed: 3, cardinal: "E" }, beach))
        .toEqual({
          status: "optimal",
          emoji: "✅",
          message: "Light winds (3 mph E)",
        });

      expect(analyzeWindConditions({ ...windBase, speed: 7, cardinal: "E" }, beach))
        .toEqual({
          status: "acceptable",
          emoji: "⚠️",
          message: "Moderate winds (7 mph E)",
        });

      expect(analyzeWindConditions({ ...windBase, speed: 12, cardinal: "E" }, beach))
        .toEqual({
          status: "poor",
          emoji: "❌",
          message: "Strong winds (12 mph E)",
        });
    });

    test("uses beach offshore preference + tolerance and speed thresholds", () => {
      const beach: BeachPreferences = {
        name: "Prefs Beach",
        windOffshoreDeg: 270,
        windOffshoreTol: 45,
      };

      const optimal = analyzeWindConditions(
        { ...windBase, speed: 5, direction: 280, cardinal: "W", description: "offshore" },
        beach
      );
      expect(optimal.status).toBe("optimal");

      const acceptable = analyzeWindConditions(
        { ...windBase, speed: 12, direction: 280, cardinal: "W", description: "offshore" },
        beach
      );
      expect(acceptable.status).toBe("acceptable");

      const poor = analyzeWindConditions(
        { ...windBase, speed: 12, direction: 90, cardinal: "E", description: "onshore" },
        beach
      );
      expect(poor.status).toBe("poor");
    });

    test("respects custom tolerance when determining offshore", () => {
      const beach: BeachPreferences = {
        name: "Tight Tol Beach",
        windOffshoreDeg: 270,
        windOffshoreTol: 10,
      };

      const result = analyzeWindConditions(
        { ...windBase, speed: 12, direction: 285, cardinal: "WNW", description: "cross-shore" },
        beach
      );
      expect(result.status).toBe("poor");
    });
  });
});



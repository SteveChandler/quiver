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
  isWindUnknown,
  windAt,
} from "@/lib/analyzers/wind-analyzer";
import type { BeachPreferences, WindMetrics } from "@/types/morning-intel";

// East-facing beach: offshore blows from the west. Keeps the original 270° fixtures meaningful.
const EAST_FACING = { offshoreDeg: 270, toleranceDeg: 45 };
// West-facing beach (Ocean Beach SD): offshore blows from the east.
const WEST_FACING = { offshoreDeg: 90, toleranceDeg: 30 };

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

      const result = windAt("10:00", forecasts, tz, EAST_FACING);
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
        tz,
        EAST_FACING
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
        tz,
        EAST_FACING
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
        tz,
        EAST_FACING
      );
      expect(lightOnshore.description).toBe("light onshore");
    });

    const row = (speed: number | null, direction: number | null) => [
      { forecast_date: TODAY, forecast_time: "08:00", wind_speed: speed, wind_direction: direction },
    ];

    test("judges wind against the beach, not a fixed shore normal", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      // West wind at a west-facing beach is onshore; east wind is offshore.
      expect(windAt("08:00", row(10, 270), tz, WEST_FACING)).toMatchObject({ relation: "onshore", offshore: false });
      expect(windAt("08:00", row(10, 90), tz, WEST_FACING)).toMatchObject({ relation: "offshore", offshore: true });
      expect(windAt("08:00", row(10, 125), tz, WEST_FACING).relation).toBe("cross-shore");
    });

    test("names no relation without a beach orientation", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      for (const orientation of [null, { offshoreDeg: null, toleranceDeg: 30 }]) {
        const wind = windAt("08:00", row(10, 270), tz, orientation);
        expect(wind).toMatchObject({ relation: null, offshore: false, description: "10 mph wind" });
        expect(isWindUnknown(wind)).toBe(true);
      }
    });

    test("treats missing direction as unknown unless calm", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      expect(isWindUnknown(windAt("08:00", row(10, null), tz, WEST_FACING))).toBe(true);
      expect(isWindUnknown(windAt("08:00", row(2, null), tz, WEST_FACING))).toBe(false);
      expect(isWindUnknown(windAt("08:00", row(null, 90), tz, WEST_FACING))).toBe(true);
    });
  });

  describe("analyzeWindConditions", () => {
    const windBase: WindMetrics = {
      speed: 0,
      direction: 0,
      cardinal: "N",
      offshore: false,
      description: "calm",
      relation: null,
    };

    test("calm wind with no relation reads light", () => {
      const beach: BeachPreferences = { name: "No Prefs Beach" };

      expect(analyzeWindConditions({ ...windBase, speed: 3, cardinal: "E" }, beach))
        .toEqual({
          status: "optimal",
          emoji: "✅",
          message: "Light winds (3 mph E)",
        });
    });

    test("leaves wind it can't judge out, with nothing to show", () => {
      const beach: BeachPreferences = { name: "No Prefs Beach" };
      for (const wind of [
        { ...windBase, speed: 7, cardinal: "E", description: "7 mph wind" },
        { ...windBase, speed: 12, cardinal: "N/A", description: "12 mph wind" },
        { ...windBase, cardinal: "N/A", description: "N/A" },
      ]) {
        expect(analyzeWindConditions(wind, beach)).toEqual({
          status: "acceptable",
          emoji: "⚠️",
          message: "",
          excluded: true,
        });
      }
    });

    test("uses beach offshore preference + tolerance and speed thresholds", () => {
      const beach: BeachPreferences = {
        name: "Prefs Beach",
        windOffshoreDeg: 270,
        windOffshoreTol: 45,
      };

      const optimal = analyzeWindConditions(
        { ...windBase, speed: 5, direction: 280, cardinal: "W", description: "offshore", relation: "offshore" },
        beach
      );
      expect(optimal.status).toBe("optimal");

      const acceptable = analyzeWindConditions(
        { ...windBase, speed: 12, direction: 280, cardinal: "W", description: "offshore", relation: "offshore" },
        beach
      );
      expect(acceptable.status).toBe("acceptable");

      const poor = analyzeWindConditions(
        { ...windBase, speed: 12, direction: 90, cardinal: "E", description: "onshore", relation: "onshore" },
        beach
      );
      expect(poor.status).toBe("poor");
    });

    test("respects custom tolerance when determining offshore", () => {
      setNowLocal(`${TODAY}T12:00:00`);
      const beach: BeachPreferences = { name: "Tight Tol Beach", windOffshoreDeg: 270, windOffshoreTol: 10 };
      const wind = windAt(
        "08:00",
        [{ forecast_date: TODAY, forecast_time: "08:00", wind_speed: 12, wind_direction: 285 }],
        tz,
        { offshoreDeg: 270, toleranceDeg: 10 }
      );

      expect(wind.relation).toBe("cross-shore");
      expect(analyzeWindConditions(wind, beach).status).toBe("poor");
    });
  });
});



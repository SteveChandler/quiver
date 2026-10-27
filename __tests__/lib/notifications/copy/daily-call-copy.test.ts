/**
 * @jest-environment node
 */

import {
  comparisonLine,
  formatClock12,
  formatWindowLabel,
  limitSentence,
  notificationBeachName,
  swellPhrase,
  windPhrase,
} from "@/lib/notifications/copy/daily-call-copy";
import { refineWindow, type WindowDriver } from "@/lib/alerts/window-refiner";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const TZ = "America/Los_Angeles";

function driver(kind: WindowDriver["kind"], label: string, at: string): WindowDriver {
  return { kind, edge: "end", at, approximate: kind !== "tide", label };
}

describe("daily call copy", () => {
  it("shortens park-style beach names but keeps a curated short name", () => {
    expect(notificationBeachName({ name: "Torrey Pines State Beach", short_name: null })).toBe("Torrey Pines");
    expect(notificationBeachName({ name: "San Onofre State Park", short_name: null })).toBe("San Onofre");
    expect(notificationBeachName({ name: "Ocean Beach Pier", short_name: null })).toBe("Ocean Beach Pier");
    expect(notificationBeachName({ name: "Blacks Beach", short_name: "Blacks" })).toBe("Blacks");
  });

  it("reads times on a 12-hour clock", () => {
    expect(formatClock12("2026-09-24T15:00:00.000Z", TZ)).toBe("8 AM");
    expect(formatClock12("2026-09-24T13:39:44.000Z", TZ)).toBe("6:39 AM");
    expect(formatClock12("2026-09-24T19:30:00.000Z", TZ)).toBe("12:30 PM");
  });

  it("writes a compact window and marks approximate edges", () => {
    expect(formatWindowLabel("2026-09-24T15:00:00.000Z", "2026-09-24T18:00:00.000Z", TZ)).toBe("8 to 11 AM");
    expect(formatWindowLabel("2026-09-24T18:00:00.000Z", "2026-09-24T21:00:00.000Z", TZ)).toBe("11 AM to 2 PM");
    expect(formatWindowLabel("2026-09-24T13:39:00.000Z", "2026-09-24T14:45:00.000Z", TZ, { approximateEnd: true }))
      .toBe("6:39 to ~7:45 AM");
  });

  it("describes swell like the app: a height range, period and direction", () => {
    expect(swellPhrase({ wave_height: "4.1", wave_period: "15", wave_direction: "WSW" })).toBe("4–5 ft at 15s WSW");
    expect(swellPhrase({ wave_height: "3 ft", wave_period: "11.4", wave_direction: null })).toBe("3 ft at 11s");
  });

  it("calls light wind light instead of printing its speed", () => {
    expect(windPhrase({ wind_speed: "3", wind_direction: "W" })).toBe("light wind");
    expect(windPhrase({ wind_speed: "8.4", wind_direction: "WNW" })).toBe("8 mph WNW wind");
  });

  it("names what ends the window", () => {
    const end = "2026-09-24T18:00:00.000Z";
    expect(limitSentence([driver("tide", "falling to a 1.4ft low", end)], end, TZ))
      .toBe("Best before the tide drops around 11 AM.");
    expect(limitSentence([driver("tide", "rising to a 5.2ft high", end)], end, TZ))
      .toBe("Best before the tide fills in around 11 AM.");
    expect(limitSentence([driver("wind", "offshore till the wind turns", end)], end, TZ))
      .toBe("Best before the wind picks up around 11 AM.");
    expect(limitSentence([driver("daylight", "sunset", end)], end, TZ)).toBe("Good until dark around 11 AM.");
    expect(limitSentence([], end, TZ)).toBe("Good until 11 AM.");
  });

  describe("tide swing (TIDE_SWING_ENABLED)", () => {
    const originalFlag = process.env.TIDE_SWING_ENABLED;
    afterEach(() => {
      if (originalFlag === undefined) delete process.env.TIDE_SWING_ENABLED;
      else process.env.TIDE_SWING_ENABLED = originalFlag;
    });

    // PB Point (band 2-4 ft) on Tue 2026-10-27, its real hourly tide from the 9:47 AM high.
    const pbPoint = { id: "pb-point", preferred_tide_ft_min: 2, preferred_tide_ft_max: 4, preferred_tide_direction: null } as Beach;
    const tideFt: Array<[string, number]> = [
      ["17", 6.8], ["18", 6.3], ["19", 5.2], ["20", 3.6], ["21", 2.0], ["22", 0.5], ["23", -0.5],
    ];
    const rows = tideFt.map(([hour, height]) => ({
      id: hour,
      beach_id: pbPoint.id,
      forecast_at: `2026-10-27T${hour}:00:00Z`,
      tide_height: String(height),
      tide_status: "Falling",
    })) as EnhancedForecastEntity[];

    function dropWindow() {
      return refineWindow({
        coarse: { start: "2026-10-27T20:00:00Z", end: "2026-10-27T22:00:00Z" },
        forecasts: rows,
        beach: pbPoint,
        tideSamples: null,
        daylight: { sunrise: "2026-10-27T14:03:00Z", sunset: "2026-10-28T01:04:00Z" },
        verdictAt: (row) => {
          const height = Number(row.tide_height);
          return height >= 2 && height <= 4 ? "go" : "no";
        },
      });
    }

    it("flag off keeps the falling-tide sentence for a window the drop opens and closes", () => {
      delete process.env.TIDE_SWING_ENABLED;
      const window = dropWindow()!;
      expect(window.drivers.every((value) => value.bandEdge === undefined)).toBe(true);
      expect(limitSentence(window.drivers, window.end, TZ)).toBe("Best before the tide drops around 2 PM.");
    });

    it("flag on names the drop through the band, with times from the refined window", () => {
      process.env.TIDE_SWING_ENABLED = "true";
      const window = dropWindow()!;
      expect(window.drivers.map(({ edge, bandEdge }) => [edge, bandEdge])).toEqual([["start", "max"], ["end", "min"]]);
      expect(limitSentence(window.drivers, window.end, TZ))
        .toBe("Best on the drop from 12:45 PM until it gets too low around 2 PM.");
    });

    it("reads noon as noon and mirrors the push for a rising tide", () => {
      const start = (label: string, bandEdge: "min" | "max"): WindowDriver =>
        ({ kind: "tide", edge: "start", at: "2026-10-27T19:00:00Z", approximate: true, label, bandEdge });
      const end = (label: string, bandEdge: "min" | "max"): WindowDriver =>
        ({ kind: "tide", edge: "end", at: "2026-10-27T22:00:00Z", approximate: true, label, bandEdge });
      const at = "2026-10-27T22:00:00Z";
      expect(limitSentence([start("falling to a -0.9ft low", "max"), end("falling to a -0.9ft low", "min")], at, TZ))
        .toBe("Best on the drop from noon until it gets too low around 3 PM.");
      expect(limitSentence([start("rising to a 6.8ft high", "min"), end("rising to a 6.8ft high", "max")], at, TZ))
        .toBe("Best on the push from noon until it gets too full around 3 PM.");
    });

    it("a direction-only tide change or a mixed edge keeps today's sentence", () => {
      const at = "2026-10-27T22:00:00Z";
      const startNoEdge: WindowDriver = { kind: "tide", edge: "start", at: "2026-10-27T19:00:00Z", approximate: true, label: "falling to a -0.9ft low" };
      const endMin: WindowDriver = { kind: "tide", edge: "end", at, approximate: true, label: "falling to a -0.9ft low", bandEdge: "min" };
      const daylightStart: WindowDriver = { kind: "daylight", edge: "start", at: "2026-10-27T14:03:00Z", approximate: false, label: "sunrise" };
      expect(limitSentence([startNoEdge, endMin], at, TZ)).toBe("Best before the tide drops around 3 PM.");
      expect(limitSentence([daylightStart, endMin], at, TZ)).toBe("Best before the tide drops around 3 PM.");
    });
  });

  it("compares with home only from the numbers", () => {
    const home = { name: "OB Pier", forecast: { wave_height: "2.6", wave_period: "10", wind_speed: "3" }, minutes: 180 };
    expect(comparisonLine({ forecast: { wave_height: "4.1", wave_period: "15", wind_speed: "3" }, minutes: 180 }, home))
      .toBe("Bigger than OB Pier today");
    expect(comparisonLine({ forecast: { wave_height: "2.8", wave_period: "15", wind_speed: "3" }, minutes: 180 }, home))
      .toBe("Longer-period swell than OB Pier today");
    expect(comparisonLine({ forecast: { wave_height: "2.8", wave_period: "11", wind_speed: "3" }, minutes: 180 },
      { ...home, forecast: { ...home.forecast, wind_speed: "12" } }))
      .toBe("Less wind than OB Pier today");
    expect(comparisonLine({ forecast: { wave_height: "2.8", wave_period: "11", wind_speed: "3" }, minutes: 180 }, home))
      .toBe("Rated higher than OB Pier today");
  });
});

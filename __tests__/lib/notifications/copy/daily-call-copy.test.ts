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
import type { WindowDriver } from "@/lib/alerts/window-refiner";

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
    expect(formatWindowLabel("2026-09-24T15:00:00.000Z", "2026-09-24T18:00:00.000Z", TZ)).toBe("8–11 AM");
    expect(formatWindowLabel("2026-09-24T18:00:00.000Z", "2026-09-24T21:00:00.000Z", TZ)).toBe("11 AM–2 PM");
    expect(formatWindowLabel("2026-09-24T13:39:00.000Z", "2026-09-24T14:45:00.000Z", TZ, { approximateEnd: true }))
      .toBe("6:39–~7:45 AM");
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

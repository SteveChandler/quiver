/**
 * @jest-environment node
 */

import {
  buildWeekendWindowCopy,
  getUpcomingWeekendKey,
  isWeekendDaylightForecast,
} from "@/app/api/cron/weekend-window/route";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

describe("weekend_window registry contract", () => {
  it("emits the pinned native push data shape", () => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;

    expect(def.channels).toEqual(["push"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType.push).toBe("notif_reminders");

    const out = def.buildPushPayload({
      beach_id: "beach-1",
      forecast_at: "2026-06-20T15:00:00.000Z",
      window_local: "Sat 8am",
      title: "Saturday's looking fun at La Jolla",
      body: "Sat 8am: 3.5ft @ 10s · NW wind 6mph.",
    });

    expect(out).toMatchObject({
      title: "Saturday's looking fun at La Jolla",
      body: "Sat 8am: 3.5ft @ 10s · NW wind 6mph.",
      data: {
        type: "weekend_window",
        beach_id: "beach-1",
        forecast_at: "2026-06-20T15:00:00.000Z",
        window_local: "Sat 8am",
      },
    });
  });
});

describe("weekend_window helpers", () => {
  it("keys the coming weekend by the user's local Saturday", () => {
    expect(
      getUpcomingWeekendKey(
        new Date("2026-06-18T20:00:00.000Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-06-20");

    expect(
      getUpcomingWeekendKey(
        new Date("2026-06-20T20:00:00.000Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-06-20");
  });

  it("keeps only Saturday or Sunday daylight forecasts for that weekend", () => {
    const tz = "America/Los_Angeles";
    const weekendKey = "2026-06-20";

    expect(
      isWeekendDaylightForecast("2026-06-20T15:00:00.000Z", tz, weekendKey)
    ).toBe(true);
    expect(
      isWeekendDaylightForecast("2026-06-21T16:00:00.000Z", tz, weekendKey)
    ).toBe(true);
    expect(
      isWeekendDaylightForecast("2026-06-19T15:00:00.000Z", tz, weekendKey)
    ).toBe(false);
    expect(
      isWeekendDaylightForecast("2026-06-20T05:00:00.000Z", tz, weekendKey)
    ).toBe(false);
  });

  it("builds weekend planning copy from the selected window", () => {
    expect(
      buildWeekendWindowCopy({
        beachName: "La Jolla",
        windowLocal: "Sat 8am",
        waveHeightFt: 3.5,
        wavePeriodS: 10,
        windDirection: "NW",
        windSpeedMph: 6,
      })
    ).toEqual({
      title: "Saturday's looking fun at La Jolla",
      body: "Sat 8am: 3.5ft @ 10s · NW wind 6mph.",
    });
  });
});

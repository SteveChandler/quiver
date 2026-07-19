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
  const payload = {
    snapshot_id: "11111111-1111-4111-8111-111111111111",
    weekend_start: "2026-07-25",
    weekend_end: "2026-07-26",
    qualifying_count: 3,
    lead_beach_id: "22222222-2222-4222-8222-222222222222",
    lead_beach_name: "Black's",
    lead_window_local: "Saturday morning",
  };

  it("emits the pinned Weekend Scout snapshot shape", () => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;

    expect(def.channels).toEqual(["push"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType.push).toBe("notif_reminders");

    const out = def.buildPushPayload(def.validatePayload(payload));

    expect(out).toEqual({
      title: "3 spots look promising this weekend",
      body: "Black's leads Saturday morning. See your top picks and why.",
      data: { type: "weekend_window", ...payload },
    });
  });

  it.each([
    [1, "1 spot looks promising this weekend"],
    [2, "2 spots look promising this weekend"],
  ])("uses correct grammar for %i qualifying spots", (qualifyingCount, title) => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;
    expect(def.buildPushPayload({ ...payload, qualifying_count: qualifyingCount }).title).toBe(title);
  });

  it("rejects the retired producer-authored payload", () => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;
    expect(() => def.validatePayload({
      beach_id: "beach-1",
      forecast_at: "2026-06-20T15:00:00.000Z",
      title: "Producer copy",
      body: "Producer body",
    })).toThrow();
  });

  it.each([
    [{ ...payload, qualifying_count: 0 }],
    [{ ...payload, weekend_start: "2026-02-30" }],
    [{ ...payload, weekend_end: "2026-07-27" }],
  ])("rejects an invalid snapshot summary", (invalidPayload) => {
    const def = (NOTIFICATION_REGISTRY as any).weekend_window;
    expect(() => def.validatePayload(invalidPayload)).toThrow();
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

/**
 * @jest-environment node
 */

const mockScoreWindowWithComposite = jest.fn();
const mockResolveNotificationMajorEventHold = jest.fn();

jest.mock("@/lib/services/discovery/window-selector", () => ({
  scoreWindowWithComposite: (...args: unknown[]) =>
    mockScoreWindowWithComposite(...args),
}));
jest.mock("@/lib/recommendations/major-event-hold/adapters/notification", () => ({
  resolveNotificationMajorEventHold: (...args: unknown[]) =>
    mockResolveNotificationMajorEventHold(...args),
}));

import {
  buildWeekendWindowCopy,
  getUpcomingWeekendKey,
  isWeekendDaylightForecast,
  selectAndBuildWeekendWindow,
} from "@/app/api/cron/weekend-window/route";
import type { HomeBeachPushSelectArgs } from "@/lib/cron/home-beach-push-runner";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const BEACH_ID = "00000000-0000-4000-8000-0000000000b1";
const WINDOW_START = "2026-06-20T15:00:00.000Z";
const WINDOW_END = "2026-06-20T16:00:00.000Z";

function weekendSelectArgs(): HomeBeachPushSelectArgs {
  return {
    profile: {
      id: USER_ID,
      home_beach_id: BEACH_ID,
      experience_level: "advanced",
    } as HomeBeachPushSelectArgs["profile"],
    beach: {
      id: BEACH_ID,
      name: "La Jolla",
      timezone: "America/Los_Angeles",
      skill_level: "intermediate",
    } as HomeBeachPushSelectArgs["beach"],
    forecasts: [
      {
        forecast_at: WINDOW_START,
        wave_height: "3.5",
        wave_period: "10",
        wind_direction: "NW",
        wind_speed: "6",
      },
    ] as HomeBeachPushSelectArgs["forecasts"],
    timezone: "America/Los_Angeles",
    now: new Date("2026-06-18T20:00:00.000Z"),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScoreWindowWithComposite.mockReturnValue({ total: 80 });
  mockResolveNotificationMajorEventHold.mockResolvedValue({
    status: "allowed",
    candidate: null,
  });
});

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
  it("binds weekend copy to the exact internal forecast slot before enqueue", async () => {
    const result = await selectAndBuildWeekendWindow(weekendSelectArgs());

    expect(result).toMatchObject({
      payload: {
        beach_id: BEACH_ID,
        forecast_at: WINDOW_START,
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_ID,
          starts_at: WINDOW_START,
          ends_at: WINDOW_END,
        },
        session_decision: {
          verdict: "go",
          selection: {
            beachId: BEACH_ID,
            windowStart: WINDOW_START,
            windowEnd: WINDOW_END,
          },
        },
      },
    });
    expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith({
      eventId: `weekend-window:${USER_ID}:2026-06-20`,
      type: "weekend_window",
      payload: expect.objectContaining({
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_ID,
          starts_at: WINDOW_START,
          ends_at: WINDOW_END,
        },
      }),
      profileExperience: "advanced",
    });
  });

  it("suppresses held or unresolved weekend picks before enqueue", async () => {
    mockResolveNotificationMajorEventHold.mockResolvedValueOnce({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
      candidate: null,
    });

    await expect(
      selectAndBuildWeekendWindow(weekendSelectArgs())
    ).resolves.toEqual({ skipReason: "majorEventHold" });
  });

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

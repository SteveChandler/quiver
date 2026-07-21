/**
 * @jest-environment node
 */

const mockResolveTodayHeadline = jest.fn();
const mockComputeSurfCall = jest.fn();
const mockResolveNotificationMajorEventHold = jest.fn();

jest.mock("@/lib/services/forecast/today-headline", () => ({
  resolveTodayHeadline: (...args: unknown[]) => mockResolveTodayHeadline(...args),
}));
jest.mock("@/lib/utils/surf-call-logic", () => ({
  computeSurfCall: (...args: unknown[]) => mockComputeSurfCall(...args),
}));
jest.mock("@/lib/recommendations/major-event-hold/adapters/notification", () => ({
  resolveNotificationMajorEventHold: (...args: unknown[]) =>
    mockResolveNotificationMajorEventHold(...args),
}));

import {
  buildMorningCallCopy,
  selectAndBuildMorningCall,
} from "@/app/api/cron/home-morning-call/route";
import {
  isEligibleHomeBeachPushProfile,
  type HomeBeachPushSelectArgs,
} from "@/lib/cron/home-beach-push-runner";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const BEACH_ID = "00000000-0000-4000-8000-0000000000b1";
const WINDOW_START = "2026-06-24T13:00:00.000Z";
const WINDOW_END = "2026-06-24T15:00:00.000Z";

function morningSelectArgs(): HomeBeachPushSelectArgs {
  return {
    profile: {
      id: USER_ID,
      home_beach_id: BEACH_ID,
      experience_level: "beginner",
    } as HomeBeachPushSelectArgs["profile"],
    beach: {
      id: BEACH_ID,
      name: "La Jolla",
      timezone: "America/Los_Angeles",
    } as HomeBeachPushSelectArgs["beach"],
    forecasts: [
      {
        forecast_at: WINDOW_START,
        wave_height: "3-4 ft",
        wave_period: "11s",
      },
    ] as HomeBeachPushSelectArgs["forecasts"],
    timezone: "America/Los_Angeles",
    now: new Date("2026-06-24T12:00:00.000Z"),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveTodayHeadline.mockReturnValue({
    window: { start: new Date(WINDOW_START), end: new Date(WINDOW_END) },
    display: { forecastAt: WINDOW_START },
  });
  mockComputeSurfCall.mockReturnValue({
    verdict: "YES",
    bestWindowStart: WINDOW_START,
    bestWindowEnd: WINDOW_END,
    waveHeight: "3-4 ft",
    windDescription: "clean offshore",
    whySentence: "Clean offshore with 3-4 ft swell energy.",
  });
  mockResolveNotificationMajorEventHold.mockResolvedValue({
    status: "allowed",
    candidate: null,
  });
});

describe("home_morning_call registry contract", () => {
  it("emits the pinned native push data shape", () => {
    const def = (NOTIFICATION_REGISTRY as any).home_morning_call;

    expect(def.channels).toEqual(["push"]);
    expect(def.prefs.master.push).toBe("notif_push_enabled");
    expect(def.prefs.perType.push).toBe("notif_reminders");

    const out = def.buildPushPayload({
      beach_id: "beach-1",
      beach_name: "La Jolla",
      verdict: "YES",
      forecast_at: "2026-06-24T13:00:00.000Z",
      title: "La Jolla: It's firing",
      body: "3.5ft @ 11s. Clean offshore.",
    });

    expect(out).toMatchObject({
      title: "La Jolla: It's firing",
      body: "3.5ft @ 11s. Clean offshore.",
      data: {
        type: "home_morning_call",
        beach_id: "beach-1",
        verdict: "YES",
        forecast_at: "2026-06-24T13:00:00.000Z",
      },
    });
  });
});

describe("home_morning_call helpers", () => {
  it("binds positive morning copy to the exact internal window before enqueue", async () => {
    const result = await selectAndBuildMorningCall(morningSelectArgs());

    expect(result).toMatchObject({
      payload: {
        verdict: "YES",
        beach_id: BEACH_ID,
        forecast_at: WINDOW_START,
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_ID,
          starts_at: WINDOW_START,
          ends_at: WINDOW_END,
        },
      },
    });
    expect(mockResolveNotificationMajorEventHold).toHaveBeenCalledWith({
      eventId: `home-morning-call:${USER_ID}:2026-06-24`,
      type: "home_morning_call",
      payload: expect.objectContaining({
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: BEACH_ID,
          starts_at: WINDOW_START,
          ends_at: WINDOW_END,
        },
      }),
      profileExperience: "beginner",
    });
  });

  it.each([
    ["missing", null, null],
    ["invalid", WINDOW_END, WINDOW_START],
  ])(
    "fails closed when a positive morning call has a %s exact best-window pair",
    async (_case, bestWindowStart, bestWindowEnd) => {
      mockComputeSurfCall.mockReturnValueOnce({
        verdict: "YES",
        bestWindowStart,
        bestWindowEnd,
        waveHeight: "3-4 ft",
        windDescription: "clean offshore",
        whySentence: "Clean offshore with 3-4 ft swell energy.",
      });

      await expect(
        selectAndBuildMorningCall(morningSelectArgs())
      ).resolves.toEqual({ skipReason: "majorEventHold" });
      expect(mockResolveNotificationMajorEventHold).not.toHaveBeenCalled();
    }
  );

  it("suppresses held or unresolved positive morning copy before enqueue", async () => {
    mockResolveNotificationMajorEventHold.mockResolvedValueOnce({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      auditCode: "major_event_hold",
      candidate: null,
    });

    await expect(
      selectAndBuildMorningCall(morningSelectArgs())
    ).resolves.toEqual({ skipReason: "majorEventHold" });
  });

  it("keeps non-positive morning calls unchanged without consulting the hold", async () => {
    mockComputeSurfCall.mockReturnValueOnce({
      verdict: "NO",
      bestWindowStart: null,
      bestWindowEnd: null,
      waveHeight: null,
      windDescription: null,
      whySentence: "No viable surf window today.",
    });
    mockResolveNotificationMajorEventHold.mockResolvedValueOnce({
      status: "suppressed",
      reasonCode: "major_event_hold",
      auditCode: "major_event_hold",
      candidate: null,
    });

    await expect(
      selectAndBuildMorningCall(morningSelectArgs())
    ).resolves.toMatchObject({
      payload: {
        verdict: "NO",
        title: "La Jolla: Rest up today",
      },
    });
    expect(mockResolveNotificationMajorEventHold).not.toHaveBeenCalled();
  });

  it("keeps only home-beach users with push and reminder prefs enabled", () => {
    const allowlist = new Set<string>();

    expect(
      isEligibleHomeBeachPushProfile(
        {
          id: "user-1",
          home_beach_id: "beach-1",
          notif_push_enabled: null,
          notif_reminders: null,
        },
        allowlist
      )
    ).toBe(true);

    expect(
      isEligibleHomeBeachPushProfile(
        {
          id: "user-1",
          home_beach_id: null,
          notif_push_enabled: null,
          notif_reminders: null,
        },
        allowlist
      )
    ).toBe(false);

    expect(
      isEligibleHomeBeachPushProfile(
        {
          id: "user-1",
          home_beach_id: "beach-1",
          notif_push_enabled: false,
          notif_reminders: null,
        },
        allowlist
      )
    ).toBe(false);

    expect(
      isEligibleHomeBeachPushProfile(
        {
          id: "user-1",
          home_beach_id: "beach-1",
          notif_push_enabled: null,
          notif_reminders: false,
        },
        new Set(["other-user"])
      )
    ).toBe(false);
  });

  it("builds verdict-specific morning call copy", () => {
    expect(
      buildMorningCallCopy({
        verdict: "YES",
        beachName: "La Jolla",
        waveHeight: "3-4 ft",
        wavePeriod: "11s",
        windDescription: "clean offshore",
        whySentence: "Clean offshore with 3-4 ft swell energy.",
      })
    ).toEqual({
      title: "La Jolla: It's firing",
      body: "3-4 ft @ 11s. Clean offshore with 3-4 ft swell energy.",
    });

    expect(
      buildMorningCallCopy({
        verdict: "MAYBE",
        beachName: "La Jolla",
        waveHeight: "2 ft",
        wavePeriod: null,
        windDescription: null,
        whySentence: "Rideable 2 ft surf - keep an eye on conditions.",
      })
    ).toEqual({
      title: "La Jolla: Worth a look",
      body: "2 ft. Rideable 2 ft surf - keep an eye on conditions.",
    });

    expect(
      buildMorningCallCopy({
        verdict: "NO",
        beachName: "La Jolla",
        waveHeight: null,
        wavePeriod: null,
        windDescription: null,
        whySentence: "No viable surf window today.",
      })
    ).toEqual({
      title: "La Jolla: Rest up today",
      body: "No viable surf window today. Check the week before you drive.",
    });
  });
});

/**
 * @jest-environment node
 */

import { buildMorningCallCopy } from "@/app/api/cron/home-morning-call/route";
import { isEligibleHomeBeachPushProfile } from "@/lib/cron/home-beach-push-runner";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";

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

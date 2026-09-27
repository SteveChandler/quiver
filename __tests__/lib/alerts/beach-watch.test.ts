/**
 * @jest-environment node
 */
import { validateConditionAlertInput } from "@/lib/alerts/condition-validation";
import { buildBeachWatchAppLink, buildBeachWatchRule, selectBeachWatchWindow } from "@/lib/alerts/beach-watch";

const NOW = new Date("2026-09-27T16:00:00.000Z");
const CALL = { kind: "call" as const, label: "FAIR" as const, action: "Worth a look" };
const WINDOW = { start: "2026-09-27T18:00:00.000Z", end: "2026-09-27T20:30:00.000Z", forecastAt: "2026-09-27T18:00:00.000Z" };

describe("selectBeachWatchWindow", () => {
  it("offers today's best window with a readable label", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, timezone: "America/Los_Angeles", isTomorrow: false, now: NOW }))
      .toEqual({ ...WINDOW, label: "today 11am–1:30pm" });
  });

  it("says tomorrow when the report fell back", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, timezone: "America/Los_Angeles", isTomorrow: true, now: NOW })?.label)
      .toBe("tomorrow 11am–1:30pm");
  });

  it("offers nothing for a skip, a hold, an unknown call, a missing or a past window", () => {
    const base = { ...WINDOW, timezone: "UTC", isTomorrow: false, now: NOW };
    expect(selectBeachWatchWindow({ ...base, call: { kind: "call", label: "MEH", action: "Skip it" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: { kind: "no_call", reason: "x" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: { kind: "unknown" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: CALL, start: null })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: CALL, now: new Date("2026-09-27T21:00:00.000Z") })).toBeNull();
  });

  it("falls back to the window start when there is no forecast row instant", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, forecastAt: null, timezone: "UTC", isTomorrow: false, now: NOW })?.forecastAt)
      .toBe(WINDOW.start);
  });
});

describe("buildBeachWatchRule", () => {
  const window = { ...WINDOW, label: "today 11am–1:30pm" };

  it("builds a watched_call the rules route accepts", () => {
    const body = buildBeachWatchRule({ beachId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", beachName: "Tourmaline", window, score: 61 });
    expect(body).toMatchObject({ preset_type: "watched_call", notify_push: true, notify_email: false });
    const result = validateConditionAlertInput({
      presetType: body.preset_type,
      conditions: body.conditions,
      notifyEmail: body.notify_email,
      notifyPush: body.notify_push,
    });
    expect(result.ok).toBe(true);
  });

  it("uses the app's dedupe key shape so a web and an app watch of one window are the same watch", () => {
    const body = buildBeachWatchRule({ beachId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", beachName: "Tourmaline", window, score: null });
    const watched = body.conditions.watched_call;
    expect(watched.dedupeKey).toBe(
      ["watched-call.v1", "3fa85f64-5717-4562-b3fc-2c963f66afa6", watched.recommendationId, window.start, window.end]
        .map(encodeURIComponent).join(":"),
    );
    expect(watched.overallScore).toBe(0);
    expect(watched.sourceSurface).toBe("beach_detail");
    expect(watched.mode).toBe("beach-detail");
  });
});

describe("buildBeachWatchAppLink", () => {
  it("opens the exact window in the app", () => {
    expect(buildBeachWatchAppLink("Tourmaline", "2026-09-27T18:00:00.000Z"))
      .toMatch(/\/app\/spot\/tourmaline\?window=2026-09-27T18%3A00%3A00\.000Z$/);
  });
});

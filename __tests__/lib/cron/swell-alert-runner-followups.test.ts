/**
 * @jest-environment node
 */

import {
  runSwellAlertCron,
  type PinnedSwellEvaluation,
  type SwellAlertDeps,
  type SwellAlertPoolEvaluation,
  type SwellAlertProfile,
  type SwellFollowupDeps,
  type SwellOutlookDeps,
} from "@/lib/cron/swell-alert-runner";
import { findTideAwareWindow } from "@/lib/alerts/surf-window/tide-aware-window";
import { isTideReasonEligibleBeach } from "@/lib/alerts/surf-window/unverified-tide-bands";
import type { ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import type { SwellFollowupState } from "@/lib/alerts/swell-followup/state";
import { getSwellCardHeadline } from "@/lib/notifications/copy/swell-card-headline";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";

const USER_ID = "73040cff-afe9-4fa0-a874-2016203fc015";
const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_KEY = `${BEACH_ID}:NW:2026-09-20`;
/** Friday 2026-09-18, 10:00 PDT: not the 17:00 first-alert hour. */
const MORNING = new Date("2026-09-18T17:00:00.000Z");
/** Thursday 2026-09-17, 17:00 PDT: the first-alert hour. */
const SEND_HOUR = new Date("2026-09-18T00:00:00.000Z");
/** Sunday 2026-09-20, 08:00 PDT. */
const TOLD_PEAK = "2026-09-20T15:00:00.000Z";
const FIRST_ALERT_AT = "2026-09-18T00:00:00.000Z";

type Deps = SwellAlertDeps & SwellFollowupDeps & Partial<SwellOutlookDeps>;

function profile(overrides: Partial<SwellAlertProfile> = {}): SwellAlertProfile {
  return {
    id: USER_ID,
    timezone: "America/Los_Angeles",
    homeBeachId: BEACH_ID,
    location: { lat: 32.75, lon: -117.25 },
    maxDriveMinutes: 45,
    experienceLevel: "advanced",
    notifPushEnabled: true,
    notifSwellAlerts: true, notifForecastAlerts: false,
    ...overrides,
  };
}

function pinnedState(overrides: Partial<SwellFollowupState> = {}): SwellFollowupState {
  return {
    userId: USER_ID,
    eventKey: EVENT_KEY,
    beachId: BEACH_ID,
    lastArrivalAt: "2026-09-19T15:00:00.000Z",
    lastPeakAt: TOLD_PEAK,
    lastFaceHeightFt: 5,
    lastPeriodS: 16,
    lastDirectionDeg: 300,
    serious: false,
    lastKind: "coming",
    toldKinds: ["coming"],
    lastToldAt: FIRST_ALERT_AT,
    lastFollowupAt: null,
    status: "active",
    ...overrides,
  };
}

function pinned(
  event: Partial<Parameters<typeof beachSwellEvent>[0]> | null = {},
  overrides: Partial<PinnedSwellEvaluation> = {},
): PinnedSwellEvaluation {
  return {
    beach: { id: BEACH_ID, name: "Blacks Beach", shortName: "Blacks", slug: "blacks", state: "CA" },
    forecastAvailable: true,
    previous: null,
    event: event === null ? null : beachSwellEvent({
      beachId: BEACH_ID,
      eventKey: EVENT_KEY,
      peakFaceHeightFt: 5,
      periodS: 16,
      directionDeg: 300,
      arrivalAt: "2026-09-19T15:00:00.000Z",
      peakAt: TOLD_PEAK,
      ...event,
    }),
    ...overrides,
  };
}

/** A lead-beach pick that would name a DIFFERENT beach if a follow-up ever re-ran it. */
function evaluation(): SwellAlertPoolEvaluation {
  const otherBeach = "22222222-2222-4222-8222-222222222222";
  return {
    history: [
      { localDate: "2026-09-14", bestScore: 52, go: false },
      { localDate: "2026-09-15", bestScore: 58, go: false },
      { localDate: "2026-09-16", bestScore: 61, go: false },
    ],
    candidates: [{
      beach: { id: otherBeach, name: "Scripps", shortName: null, slug: "scripps", state: "CA" },
      event: beachSwellEvent({
        beachId: otherBeach,
        eventKey: `${otherBeach}:NW:2026-09-19`,
        peakFaceHeightFt: 6,
        periodS: 17,
        peakAt: "2026-09-19T15:00:00.000Z",
      }),
      arrivalDate: "2026-09-18",
      peakDate: "2026-09-19",
      peakScore: 82,
      peakVerdict: "go" as const,
      serious: false,
      awarenessSignal: "forecast_trend" as const,
      officialEvidenceRefs: [],
    }],
  };
}

function dependencies(overrides: Partial<Deps> = {}): Deps {
  return {
    isEnabled: jest.fn(() => true),
    isUserAllowed: jest.fn(() => true),
    loadProfiles: jest.fn(async () => [profile()]),
    evaluatePool: jest.fn(async () => evaluation()),
    // The first alert for this very event is on record and inside both first-alert cooldowns.
    loadAlertState: jest.fn(async () => ({
      eventExists: true,
      lastAlertAt: FIRST_ALERT_AT,
      recentTitleIds: [],
      recentFilmCount: 0,
    })),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
    resolveHeldBeaches: jest.fn(async () => new Map()),
    isFollowupEnabled: jest.fn(() => true),
    isFollowupUserAllowed: jest.fn(() => true),
    loadFollowupStates: jest.fn(async () => [pinnedState()]),
    evaluatePinned: jest.fn(async () => pinned({ peakFaceHeightFt: 7 })),
    saveFirstTold: jest.fn(async () => undefined),
    claimFollowup: jest.fn(async () => true),
    closeFollowupState: jest.fn(async () => undefined),
    ...overrides,
  };
}

function enqueuedPayload(deps: Deps, call = 0): Record<string, unknown> {
  return jest.mocked(deps.enqueue).mock.calls[call][0].payload as Record<string, unknown>;
}

describe("swell follow-ups", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends a follow-up for the pinned event outside the first alert's gates", async () => {
    const deps = dependencies();

    const result = await runSwellAlertCron({ now: MORNING, deps });

    // 10:00 local is not the send hour, the event already has an alert row, and
    // that alert is 17 h old: all three would block a first alert.
    expect(result.skippedCounts.not_send_hour).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.sentByKind).toEqual({ bigger: 1 });
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(deps.loadAlertState).not.toHaveBeenCalled();
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(jest.mocked(deps.enqueue).mock.calls[0][0]).toMatchObject({
      type: "swell_watch",
      recipientUserId: USER_ID,
      dedupeKey: `swell_watch:${USER_ID}:${EVENT_KEY}:bigger`,
    });
  });

  it("re-evaluates the pinned beach and never re-runs the lead-beach pick", async () => {
    const deps = dependencies();

    await runSwellAlertCron({ now: MORNING, deps });

    expect(deps.evaluatePool).not.toHaveBeenCalled();
    expect(deps.evaluatePinned).toHaveBeenCalledWith(profile(), pinnedState(), MORNING);
    expect(enqueuedPayload(deps)).toMatchObject({
      beach_id: BEACH_ID,
      beach_slug: "blacks",
      event_key: EVENT_KEY,
      beaches: [{ beach_id: BEACH_ID, beach_name: "Blacks", rank: 1 }],
    });
  });

  it("carries the contract fields and the same title the card renders", async () => {
    const deps = dependencies();

    await runSwellAlertCron({ now: MORNING, deps });

    const payload = enqueuedPayload(deps);
    expect(payload).toMatchObject({
      kind: "bigger",
      peak_date: "2026-09-20",
      peak_height_ft: 7,
      peak_period_s: 16,
      forecast_at: TOLD_PEAK,
      previous_peak_height_ft: 5,
      previous_peak_date: "2026-09-20",
      awareness_severity: "significant",
    });
    const titleId = payload.title_id as string;
    expect(payload.share_url).toBe(
      `https://www.quiversurf.app/app/swell/${encodeURIComponent(EVENT_KEY)}?k=bigger&t=${titleId}`,
    );
    expect(payload.title).toBe(getSwellCardHeadline({
      titleId,
      kind: "bigger",
      eventKey: EVENT_KEY,
      beachName: "Blacks",
      peakDayLabel: "Sunday",
    }).headline);
    expect(payload.body).toContain("7ft @ 16s");
    expect(payload.body).toContain("5ft");

    const push = NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(
      NOTIFICATION_REGISTRY.swell_watch.validatePayload!(payload),
    );
    expect(push.title).toBe(payload.title);
    expect(push.data).toMatchObject({
      kind: "bigger",
      title_id: titleId,
      share_url: payload.share_url,
      previous_peak_height_ft: 5,
      previous_peak_date: "2026-09-20",
      event_key: EVENT_KEY,
      beach_id: BEACH_ID,
      beach_slug: "blacks",
      peak_date: "2026-09-20",
      peak_height_ft: 7,
      peak_period_s: 16,
      forecast_at: TOLD_PEAK,
    });
  });

  it("records what the user has now been told before enqueueing", async () => {
    const order: string[] = [];
    const deps = dependencies({
      claimFollowup: jest.fn(async () => {
        order.push("claim");
        return true;
      }),
      enqueue: jest.fn(async () => {
        order.push("enqueue");
        return { enqueued: true as const, eventId: "event-1" };
      }),
    });

    await runSwellAlertCron({ now: MORNING, deps });

    expect(order).toEqual(["claim", "enqueue"]);
    expect(deps.claimFollowup).toHaveBeenCalledWith(pinnedState(), {
      arrivalAt: "2026-09-19T15:00:00.000Z",
      peakAt: TOLD_PEAK,
      faceHeightFt: 7,
      periodS: 16,
      directionDeg: 300,
      serious: false,
      kind: "bigger",
      toldAt: MORNING.toISOString(),
      status: "active",
    });
  });

  it("does not enqueue when another run claimed the follow-up first", async () => {
    const deps = dependencies({ claimFollowup: jest.fn(async () => false) });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.skippedCounts.followup_claim_lost).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("tells a moved peak with late copy and the previous day", async () => {
    const deps = dependencies({
      evaluatePinned: jest.fn(async () => pinned({ peakAt: "2026-09-21T15:00:00.000Z" })),
    });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.sentByKind).toEqual({ moved: 1 });
    const payload = enqueuedPayload(deps);
    expect(payload).toMatchObject({
      kind: "moved",
      peak_date: "2026-09-21",
      previous_peak_date: "2026-09-20",
    });
    expect(payload.title).toContain("Monday");
    expect(payload.body).toContain("Was Sunday");
  });

  it("tells a dropped swell with the last-told numbers and closes the event", async () => {
    const deps = dependencies({ evaluatePinned: jest.fn(async () => pinned(null)) });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.sentByKind).toEqual({ dropped: 1 });
    expect(enqueuedPayload(deps)).toMatchObject({
      kind: "dropped",
      peak_height_ft: 5,
      previous_peak_height_ft: 5,
      peak_date: "2026-09-20",
    });
    expect(jest.mocked(deps.claimFollowup).mock.calls[0][1]).toMatchObject({
      kind: "dropped",
      status: "dropped",
      faceHeightFt: 5,
    });
  });

  it("tells an arrival on the peak day and closes the event", async () => {
    const deps = dependencies();

    const result = await runSwellAlertCron({
      now: new Date("2026-09-20T14:00:00.000Z"),
      deps: { ...deps, evaluatePinned: jest.fn(async () => pinned()) },
    });

    expect(result.sentByKind).toEqual({ arrived: 1 });
    expect(jest.mocked(deps.claimFollowup).mock.calls[0][1]).toMatchObject({
      kind: "arrived",
      status: "arrived",
    });
  });

  it("uses plain copy for a serious swell", async () => {
    const deps = dependencies({
      evaluatePinned: jest.fn(async () => pinned({ peakFaceHeightFt: 9 })),
    });

    await runSwellAlertCron({ now: MORNING, deps });

    const payload = enqueuedPayload(deps);
    expect(payload.awareness_severity).toBe("major");
    expect(["b08", "b09", "b10"]).toContain(payload.title_id);
  });

  it("keeps a swell that was told as serious on plain copy when it shrinks", async () => {
    const deps = dependencies({
      loadFollowupStates: jest.fn(async () => [pinnedState({ serious: true, lastFaceHeightFt: 9 })]),
      evaluatePinned: jest.fn(async () => pinned({ peakFaceHeightFt: 6 })),
    });

    await runSwellAlertCron({ now: MORNING, deps });

    expect(["sm08", "sm09", "sm10"]).toContain(enqueuedPayload(deps).title_id);
  });

  it("sends nothing when the forecast has not changed materially", async () => {
    const deps = dependencies({ evaluatePinned: jest.fn(async () => pinned()) });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.skippedCounts.followup_no_change).toBe(1);
    expect(result.followupsEvaluated).toBe(1);
    expect(deps.claimFollowup).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("holds a second follow-up inside 24 hours without loading the forecast", async () => {
    const deps = dependencies({
      loadFollowupStates: jest.fn(async () => [pinnedState({
        toldKinds: ["coming", "moved"],
        lastFollowupAt: "2026-09-18T15:00:00.000Z",
      })]),
    });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.skippedCounts.followup_window_closed).toBe(1);
    expect(deps.evaluatePinned).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("never reports a data gap as a dropped swell", async () => {
    const deps = dependencies({
      evaluatePinned: jest.fn(async () => pinned(null, { forecastAvailable: false })),
    });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.skippedCounts.followup_no_forecast).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("quietly closes an event whose peak has passed", async () => {
    const deps = dependencies();
    const now = new Date("2026-09-21T17:00:00.000Z");

    const result = await runSwellAlertCron({ now, deps });

    expect(result.skippedCounts.followup_expired).toBe(1);
    expect(deps.closeFollowupState).toHaveBeenCalledWith(pinnedState(), "passed", now);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("sends no follow-ups when the allowlist is empty", async () => {
    const original = process.env.SWELL_ALERT_USER_ALLOWLIST;
    process.env.SWELL_ALERT_USER_ALLOWLIST = "";
    try {
      // The real flag function: an empty allowlist admits everyone to first alerts, nobody to follow-ups.
      const { isFollowupUserAllowed: _stub, ...rest } = dependencies();
      const deps = rest as Deps;

      const result = await runSwellAlertCron({ now: MORNING, deps });

      expect(result.sent).toBe(0);
      expect(result.followupsEvaluated).toBe(0);
      expect(deps.evaluatePinned).not.toHaveBeenCalled();
      expect(deps.enqueue).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.SWELL_ALERT_USER_ALLOWLIST;
      else process.env.SWELL_ALERT_USER_ALLOWLIST = original;
    }
  });

  it("sends follow-ups only to allowlisted users", async () => {
    const original = process.env.SWELL_ALERT_USER_ALLOWLIST;
    process.env.SWELL_ALERT_USER_ALLOWLIST = `someone-else, ${USER_ID}`;
    try {
      const { isFollowupUserAllowed: _stub, ...rest } = dependencies();

      const result = await runSwellAlertCron({ now: MORNING, deps: rest as Deps });

      expect(result.sentByKind).toEqual({ bigger: 1 });
    } finally {
      if (original === undefined) delete process.env.SWELL_ALERT_USER_ALLOWLIST;
      else process.env.SWELL_ALERT_USER_ALLOWLIST = original;
    }
  });

  it("respects the user's push and swell alert preferences", async () => {
    for (const overrides of [{ notifPushEnabled: false }, { notifSwellAlerts: false }]) {
      const deps = dependencies({ loadProfiles: jest.fn(async () => [profile(overrides)]) });

      await runSwellAlertCron({ now: MORNING, deps });

      expect(deps.evaluatePinned).not.toHaveBeenCalled();
      expect(deps.enqueue).not.toHaveBeenCalled();
    }
  });

  it("counts a follow-up error without stopping the run", async () => {
    const deps = dependencies({
      evaluatePinned: jest.fn(async () => {
        throw new Error("forecast read failed");
      }),
    });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.errors).toBe(1);
    expect(result.evaluated).toBe(1);
  });
});

describe("tide-aware follow-up revisions", () => {
  const previousFlag = process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED;
  const localAt = (hour: number): string => new Date(Date.parse("2026-09-20T07:00:00.000Z") + hour * 3_600_000).toISOString();
  const window = { state: "recommended" as const,
    window: { start: localAt(10), end: localAt(12), localDate: "2026-09-20",
      timezone: "America/Los_Angeles", faceHeightFt: { min: 3, max: 4 } },
    reasons: ["high_tide_outside_preference", "better_tide_after_peak"] };

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED;
    else process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = previousFlag;
    jest.restoreAllMocks();
  });

  it("revises the pinned swell to a 10 AM–noon window after a 7 AM high-tide peak", async () => {
    process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = "true";
    const beach = { ...snapshot.beach, id: BEACH_ID, timezone: "America/Los_Angeles",
      preferred_tide_ft_min: 0, preferred_tide_ft_max: 3 } as unknown as Beach;
    const forecasts = Array.from({ length: 24 }, (_, hour) => ({ ...snapshot.forecast,
      id: `hour-${hour}`, forecast_at: localAt(hour), wave_height: hour === 12 ? "0 ft" : hour < 10 ? "5-6 ft" : "3-4 ft",
      wind_speed: "3 mph", tide_height: hour >= 10 && hour <= 12 ? "2" : "5" } as EnhancedForecastEntity));
    const tideSamples = [...forecasts.map((row) => ({ at: row.forecast_at, heightFt: Number(row.tide_height) })),
      { at: "2026-09-21T07:00:00.000Z", heightFt: 5 }];
    const loadSurfWindow = jest.fn(async (_profile: SwellAlertProfile, event: { beachId: string; arrivalAt: string | null;
      peakAt: string; fadeAt: string | null }, now: Date) => findTideAwareWindow({ beach, forecasts, tideSamples,
      arrivalAt: event.arrivalAt, peakAt: event.peakAt, fadeAt: event.fadeAt, timezone: beach.timezone!, now,
      skillLevel: "advanced", isTideReasonEligible: isTideReasonEligibleBeach,
      verdictFor: (row): ForecastVerdict => ({ forecast: row, score: row.wave_height === "5-6 ft" ? 95 : 85,
        verdict: row.wave_height === "0 ft" || Number(row.tide_height) > 3 ? "no" : "go" } as ForecastVerdict) }));
    const deps = dependencies({ loadSurfWindow,
      evaluatePinned: jest.fn(async () => pinned({ arrivalAt: localAt(5), peakAt: localAt(7),
        fadeAt: localAt(20), peakFaceHeightFt: 7 })) });

    const result = await runSwellAlertCron({ now: MORNING, deps });

    expect(result.sentByKind).toEqual({ bigger: 1 });
    expect(loadSurfWindow).toHaveBeenCalledWith(profile(), { beachId: BEACH_ID,
      arrivalAt: localAt(5), peakAt: localAt(7), fadeAt: localAt(20) }, MORNING);
    expect(enqueuedPayload(deps).surf_window).toEqual({ state: "recommended", start: localAt(10), end: localAt(12),
      local_date: "2026-09-20", timezone: "America/Los_Angeles",
      reasons: ["high_tide_outside_preference", "better_tide_after_peak"] });
    expect(enqueuedPayload(deps).surf_window).not.toMatchObject({ start: localAt(7) });
    expect(enqueuedPayload(deps).body).toContain("Best window Sun 10 AM–12 PM.");
    expect(enqueuedPayload(deps).forecast_at).toBe(localAt(7));
    const push = NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(
      NOTIFICATION_REGISTRY.swell_watch.validatePayload!(enqueuedPayload(deps)),
    );
    expect(JSON.parse(push.data.surf_window as string)).toEqual(enqueuedPayload(deps).surf_window);
    expect(jest.mocked(deps.resolveHeldBeaches).mock.calls[0][0].candidates[0]).toEqual({
      candidateId: "followup", beachId: BEACH_ID, startsAt: localAt(10), endsAt: localAt(12),
    });
    expect(enqueuedPayload(deps).event_key).toBe(EVENT_KEY);
    expect(jest.mocked(deps.enqueue).mock.calls[0][0].dedupeKey).toBe(`swell_watch:${USER_ID}:${EVENT_KEY}:bigger`);
    expect(deps.insertAlert).not.toHaveBeenCalled();
  });

  it("keeps the flag-off follow-up payload byte-identical", async () => {
    process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = "false";
    const loadSurfWindow = jest.fn(async () => window);
    const deps = dependencies({ loadSurfWindow });
    await runSwellAlertCron({ now: MORNING, deps });
    const baseline = dependencies();
    await runSwellAlertCron({ now: MORNING, deps: baseline });
    expect(JSON.stringify(enqueuedPayload(deps))).toBe(JSON.stringify(enqueuedPayload(baseline)));
    expect(loadSurfWindow).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "smaller", now: MORNING, state: pinnedState({ lastFaceHeightFt: 9, serious: true }), event: { peakFaceHeightFt: 6 } },
    { kind: "moved", now: MORNING, state: pinnedState(), event: { peakAt: "2026-09-21T15:00:00.000Z" } },
    { kind: "arrived", now: new Date("2026-09-20T14:00:00.000Z"), state: pinnedState(), event: { peakFaceHeightFt: 5 } },
  ] as const)("adds a window to a $kind follow-up", async ({ kind, now, state, event }) => {
    process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = "true";
    const loadSurfWindow = jest.fn(async () => window);
    const deps = dependencies({ loadSurfWindow,
      loadFollowupStates: jest.fn(async () => [state]),
      evaluatePinned: jest.fn(async () => pinned(event)) });
    const result = await runSwellAlertCron({ now, deps });
    expect(result.sentByKind).toEqual({ [kind]: 1 });
    expect(loadSurfWindow).toHaveBeenCalledTimes(1);
    expect(enqueuedPayload(deps).surf_window).toMatchObject({ state: "recommended", start: localAt(10), end: localAt(12) });
    expect(enqueuedPayload(deps).kind).toBe(kind);
  });

  it("sends without a window when computation fails, and never computes one for dropped swells", async () => {
    process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = "true";
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const loadSurfWindow = jest.fn(async () => { throw new Error("window failed"); });
    const failed = dependencies({ loadSurfWindow });
    await runSwellAlertCron({ now: MORNING, deps: failed });
    expect(enqueuedPayload(failed)).not.toHaveProperty("surf_window");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Follow-up window computation failed"), expect.any(Error));
    const dropped = dependencies({ loadSurfWindow, evaluatePinned: jest.fn(async () => pinned(null)) });
    await runSwellAlertCron({ now: MORNING, deps: dropped });
    expect(enqueuedPayload(dropped)).not.toHaveProperty("surf_window");
    expect(loadSurfWindow).toHaveBeenCalledTimes(1);
  });

  it("retains the payload window when its sentence would exceed 300 characters", async () => {
    process.env.SWELL_OUTLOOK_TIDE_WINDOW_ENABLED = "true";
    const deps = dependencies({ loadSurfWindow: jest.fn(async () => window),
      evaluatePinned: jest.fn(async () => pinned({ peakFaceHeightFt: 7 }, {
        beach: { id: BEACH_ID, name: "Very Long Beach Name ".repeat(20), shortName: null, slug: "long-beach", state: "CA" },
      })) });
    await runSwellAlertCron({ now: MORNING, deps });
    expect(enqueuedPayload(deps).surf_window).toMatchObject({ start: localAt(10), end: localAt(12) });
    expect(enqueuedPayload(deps).body).not.toContain("Best window");
  });
});

describe("first alerts with follow-ups", () => {
  const firstAlertState = jest.fn(async () => ({
    eventExists: false,
    lastAlertAt: null,
    recentTitleIds: [],
    recentFilmCount: 0,
  }));

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("is unchanged with the flag off: no state reads or writes, no new payload fields", async () => {
    const deps = dependencies({
      isFollowupEnabled: jest.fn(() => false),
      loadAlertState: firstAlertState,
    });

    const result = await runSwellAlertCron({ now: SEND_HOUR, deps });

    expect(result.sent).toBe(1);
    expect(result.sentByKind).toEqual({ coming: 1 });
    expect(deps.loadFollowupStates).not.toHaveBeenCalled();
    expect(deps.evaluatePinned).not.toHaveBeenCalled();
    expect(deps.saveFirstTold).not.toHaveBeenCalled();
    expect(deps.claimFollowup).not.toHaveBeenCalled();
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    const payload = enqueuedPayload(deps);
    expect(payload).not.toHaveProperty("kind");
    expect(payload).not.toHaveProperty("share_url");
    expect(jest.mocked(deps.enqueue).mock.calls[0][0].dedupeKey)
      .toBe(`swell_watch:${USER_ID}:22222222-2222-4222-8222-222222222222:NW:2026-09-19`);
  });

  it("defaults to off: the real flag sends no follow-ups", async () => {
    const original = process.env.SWELL_FOLLOWUP_ENABLED;
    delete process.env.SWELL_FOLLOWUP_ENABLED;
    try {
      const { isFollowupEnabled: _stub, ...rest } = dependencies();
      const deps = rest as Deps;

      const result = await runSwellAlertCron({ now: MORNING, deps });

      expect(result.sent).toBe(0);
      expect(deps.loadFollowupStates).not.toHaveBeenCalled();
      expect(deps.enqueue).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) process.env.SWELL_FOLLOWUP_ENABLED = original;
    }
  });

  it("still blocks a repeat first alert for an event that already has one", async () => {
    const deps = dependencies({ loadFollowupStates: jest.fn(async () => []) });

    const result = await runSwellAlertCron({ now: SEND_HOUR, deps });

    expect(result.skippedCounts.event_exists).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("pins the event and marks the push as 'coming' with the flag on", async () => {
    const deps = dependencies({
      loadFollowupStates: jest.fn(async () => []),
      loadAlertState: firstAlertState,
    });

    const result = await runSwellAlertCron({ now: SEND_HOUR, deps });

    const eventKey = "22222222-2222-4222-8222-222222222222:NW:2026-09-19";
    expect(result.sentByKind).toEqual({ coming: 1 });
    const payload = enqueuedPayload(deps);
    expect(payload).toMatchObject({
      kind: "coming",
      share_url: `https://www.quiversurf.app/app/swell/${encodeURIComponent(eventKey)}?k=coming&t=${payload.title_id as string}`,
    });
    expect(payload.title).toBe(getSwellCardHeadline({
      titleId: payload.title_id as string,
      kind: "coming",
      eventKey,
      beachName: "Scripps",
      peakDayLabel: "Saturday",
    }).headline);
    expect(deps.saveFirstTold).toHaveBeenCalledWith({
      userId: USER_ID,
      eventKey,
      beachId: "22222222-2222-4222-8222-222222222222",
      told: {
        arrivalAt: expect.any(String),
        peakAt: "2026-09-19T15:00:00.000Z",
        faceHeightFt: 6,
        periodS: 17,
        directionDeg: expect.any(Number),
        serious: false,
        kind: "coming",
        toldAt: SEND_HOUR.toISOString(),
        status: "active",
      },
    });
  });

  it("still sends first alerts when the follow-up table cannot be read or written", async () => {
    const deps = dependencies({
      loadAlertState: firstAlertState,
      loadFollowupStates: jest.fn(async () => {
        throw new Error('relation "swell_event_user_state" does not exist');
      }),
      saveFirstTold: jest.fn(async () => {
        throw new Error('relation "swell_event_user_state" does not exist');
      }),
    });

    const result = await runSwellAlertCron({ now: SEND_HOUR, deps });

    expect(result.sentByKind).toEqual({ coming: 1 });
    expect(result.followupStateFailures).toBe(2);
    expect(result.errors).toBe(0);
  });
});

describe("swell_watch delivery cooldown", () => {
  const def = NOTIFICATION_REGISTRY.swell_watch;

  it("keeps first alerts in one shared window, including payloads queued before follow-ups", () => {
    expect(def.cooldownKey!({ event_key: EVENT_KEY } as never)).toBe("coming");
    expect(def.cooldownKey!({ event_key: EVENT_KEY, kind: "coming" } as never)).toBe("coming");
    expect(def.cooldownKey!({} as never)).toBe("coming");
  });

  it("scopes a follow-up to its own event and kind, so the first alert never blocks it", () => {
    const key = def.cooldownKey!({ event_key: EVENT_KEY, kind: "bigger" } as never);
    expect(key).toBe(`${EVENT_KEY}:bigger`);
    expect(key).not.toBe(def.cooldownKey!({ event_key: EVENT_KEY } as never));
    expect(key).not.toBe(def.cooldownKey!({ event_key: EVENT_KEY, kind: "moved" } as never));
  });

  it("leaves quiet hours in force", () => {
    expect(def.quietHours).toMatchObject({ mode: "defer", windowStart: 22, windowEnd: 4 });
  });
});

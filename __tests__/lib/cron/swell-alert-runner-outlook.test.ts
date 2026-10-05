/**
 * @jest-environment node
 */
// __tests__/lib/cron/swell-alert-runner-outlook.test.ts
jest.mock("@/lib/alerts/swell-outlook/state", () => ({
  ...jest.requireActual("@/lib/alerts/swell-outlook/state"),
  loadSwellOutlookUserState: jest.fn(), saveSwellOutlookUserState: jest.fn(),
}));
jest.mock("@/lib/services/discovery/swell-outlook-loader", () => ({ loadSwellOutlookForUser: jest.fn() }));
jest.mock("@/lib/alerts/user-pool", () => ({ loadUserPool: jest.fn() }));
jest.mock("@/lib/alerts/canonical-forecast-verdict", () => ({ evaluateForecastVerdict: jest.fn() }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import * as verdicts from "@/lib/alerts/canonical-forecast-verdict";
import * as pools from "@/lib/alerts/user-pool";
import * as states from "@/lib/alerts/swell-outlook/state";
import * as outlookLoader from "@/lib/services/discovery/swell-outlook-loader";
import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import { runSwellAlertCron, type SwellAlertProfile, type SwellOutlookDeps } from "@/lib/cron/swell-alert-runner";
import { EMPTY_SWELL_ENGAGEMENT, type SwellEngagementState } from "@/lib/alerts/swell-outlook/engagement";
import { EMPTY_SWELL_OUTLOOK_USER_STATE, SwellOutlookStateConflictError, type SwellOutlookStateTransition, type SwellOutlookUserState } from "@/lib/alerts/swell-outlook/state";
import type { SwellFollowupState } from "@/lib/alerts/swell-followup/state";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";
import { OUTLOOK_HOME_BEACH_ID as HOME, outlookSwell } from "@/__tests__/helpers/outlook-swell";

const USER = "73040cff-afe9-4fa0-a874-2016203fc015";
/** Friday 2026-09-18, 10:00 PDT: inside the 6-21 window, not the 17:00 evening-before hour. */
const MORNING = new Date("2026-09-18T17:00:00.000Z");
/** Thursday 2026-09-17, 17:00 PDT: the evening-before hour. */
const EVENING = new Date("2026-09-18T00:00:00.000Z");
const hoursAgo = (hours: number): string => new Date(MORNING.getTime() - hours * 3_600_000).toISOString();

function profile(overrides: Partial<SwellAlertProfile> = {}): SwellAlertProfile {
  return {
    id: USER, timezone: "America/Los_Angeles", homeBeachId: HOME, location: { lat: 32.75, lon: -117.25 }, maxDriveMinutes: 45,
    experienceLevel: "advanced", notifPushEnabled: true, notifSwellAlerts: true, ...overrides,
  };
}

function engagement(overrides: Partial<SwellEngagementState> = {}): SwellEngagementState {
  return { ...EMPTY_SWELL_ENGAGEMENT, ...overrides };
}

function makeDeps(overrides: Record<string, unknown> = {}): SwellOutlookDeps & Record<string, jest.Mock> {
  return {
    isEnabled: jest.fn(() => true),
    isUserAllowed: jest.fn(() => true),
    loadProfiles: jest.fn(async () => [profile()]),
    evaluatePool: jest.fn(async () => ({ history: [], candidates: [] })),
    loadAlertState: jest.fn(async () => ({ eventExists: false, lastAlertAt: null, recentTitleIds: [], recentFilmCount: 0 })),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
    isFollowupEnabled: jest.fn(() => true),
    isFollowupUserAllowed: jest.fn(() => true),
    loadFollowupStates: jest.fn(async () => [] as SwellFollowupState[]),
    evaluatePinned: jest.fn(),
    saveFirstTold: jest.fn(async () => undefined),
    claimFollowup: jest.fn(async () => true),
    closeFollowupState: jest.fn(async () => undefined),
    isOutlookEnabled: jest.fn(() => true),
    isOutlookUserAllowed: jest.fn(() => true),
    loadOutlook: jest.fn(async () => [outlookSwell()]),
    loadEngagement: jest.fn(async () => null),
    saveEngagement: jest.fn(async () => undefined),
    hasFirstSightingAlert: jest.fn(async () => false),
    assessSwellRarity: jest.fn(async () => false),
    getTier: jest.fn(async () => "premium" as const),
    ...overrides,
  } as never as SwellOutlookDeps & Record<string, jest.Mock>;
}

function savedState(deps: ReturnType<typeof makeDeps>, fresh: SwellOutlookUserState = EMPTY_SWELL_OUTLOOK_USER_STATE): SwellOutlookUserState {
  expect(deps.saveEngagement).toHaveBeenCalledWith(USER, expect.any(Function));
  const transition = jest.mocked(deps.saveEngagement).mock.calls[0][1] as SwellOutlookStateTransition;
  return transition(fresh);
}

function pinnedState(): SwellFollowupState {
  return {
    userId: USER, eventKey: `${HOME}:NW:2026-09-20`, beachId: HOME,
    lastArrivalAt: "2026-09-19T15:00:00.000Z", lastPeakAt: "2026-09-20T15:00:00.000Z",
    lastFaceHeightFt: 5, lastPeriodS: 16, lastDirectionDeg: 300, serious: false,
    lastKind: "coming", toldKinds: ["coming"], lastToldAt: "2026-09-16T00:00:00.000Z",
    lastFollowupAt: null, status: "active",
  };
}

function biggerPinned(): Record<string, unknown> {
  const pinned = pinnedState();
  return {
    beach: { id: HOME, name: "Blacks Beach", shortName: "Blacks", slug: "blacks", state: "CA" },
    forecastAvailable: true,
    event: beachSwellEvent({ beachId: HOME, eventKey: pinned.eventKey, peakFaceHeightFt: 8,
      periodS: 16, directionDeg: 300, peakAt: pinned.lastPeakAt }),
  };
}

describe("swell alert cron: outlook users", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("leaves a user who is not on the outlook allowlist on the evening-before path", async () => {
    const deps = makeDeps({ isOutlookUserAllowed: jest.fn(() => false) });
    await runSwellAlertCron({ now: EVENING, deps: deps as never });
    expect(deps.evaluatePool).toHaveBeenCalledTimes(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
    expect(deps.loadEngagement).not.toHaveBeenCalled();
  });

  it("leaves everyone on the evening-before path while the outlook flag is off", async () => {
    const deps = makeDeps({ isOutlookEnabled: jest.fn(() => false) });
    await runSwellAlertCron({ now: EVENING, deps: deps as never });
    expect(deps.evaluatePool).toHaveBeenCalledTimes(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
  });

  it("replaces the evening-before alert for an outlook user and sends one first-sighting push", async () => {
    const deps = makeDeps();
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.evaluatePool).not.toHaveBeenCalled();
    expect(summary.sentByKind.coming).toBe(1);
    const swell = outlookSwell();
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, eventKey: swell.id, leadBeachId: HOME }));
    const sent = deps.enqueue.mock.calls[0][0];
    expect(sent).toMatchObject({ type: "swell_watch", recipientUserId: USER, dedupeKey: `swell_watch:${USER}:${swell.id}` });
    expect(sent.payload).toMatchObject({ event_key: swell.eventKey, kind: "coming" });
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(savedState(deps)).toMatchObject({ consecutiveUnanswered: 1, lastFirstSightingAt: MORNING.toISOString() });
  });

  it("does not push a swell that is not in range, or is only shrinking", async () => {
    const deps = makeDeps({ loadOutlook: jest.fn(async () => [
      outlookSwell({ id: "a", fit: { status: "rideable", boards: [] } }),
      outlookSwell({ id: "b", status: "shrinking" }),
    ]) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("sends at most one first-sighting push per swell", async () => {
    const deps = makeDeps({ hasFirstSightingAlert: jest.fn(async () => true) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("allows one first sighting per 96 h", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({ lastFirstSightingAt: hoursAgo(10), lastSentAt: hoursAgo(10), consecutiveUnanswered: 0 })) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.first_sighting_spacing).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("stays inside the local send hours", async () => {
    const deps = makeDeps();
    const summary = await runSwellAlertCron({ now: new Date("2026-09-18T10:00:00.000Z"), deps: deps as never });
    expect(summary.skippedCounts.first_sighting_window_closed).toBe(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
  });

  it("limits a free user to swells sized at the home beach", async () => {
    const other = outlookSwell({ id: "other", beach: { id: "ffffffff-0000-4000-8000-000000000002", name: "Elsewhere" } });
    const deps = makeDeps({ getTier: jest.fn(async () => "free"), loadOutlook: jest.fn(async () => [other]) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("pins only notable swells for follow-ups", async () => {
    const plain = makeDeps();
    await runSwellAlertCron({ now: MORNING, deps: plain as never });
    expect(plain.saveFirstTold).not.toHaveBeenCalled();
    const notable = makeDeps({ loadOutlook: jest.fn(async () => [outlookSwell({ notable: true, eventKey: `${HOME}:NW:2026-09-21` })]) });
    await runSwellAlertCron({ now: MORNING, deps: notable as never });
    expect(notable.saveFirstTold).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, eventKey: `${HOME}:NW:2026-09-21`, beachId: HOME }));
  });

  it("records nothing and sends nothing when the enqueue is refused", async () => {
    const deps = makeDeps({ enqueue: jest.fn(async () => ({ enqueued: false as const, reason: "duplicate" as const })) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.duplicates).toBe(1);
    expect(deps.saveEngagement).not.toHaveBeenCalled();
  });
});

describe("swell alert cron: back-off", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  const pausedFor = (days: number): SwellEngagementState => engagement({
    consecutiveUnanswered: 3, lastSentAt: hoursAgo(days * 24 + 48), pausedSince: hoursAgo(days * 24), lastFirstSightingAt: hoursAgo(days * 24 + 48),
  });

  it("skips a first sighting for a paused user and records the skip status", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(3)) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("allows one rarity-rule push after 14 days of pause, then keeps the pause", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(15)), assessSwellRarity: jest.fn(async () => true) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.sentByKind.coming).toBe(1);
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(1);
    expect(savedState(deps, { ...EMPTY_SWELL_OUTLOOK_USER_STATE, ...pausedFor(15) })).toMatchObject({ lastExceptionAt: MORNING.toISOString(), pausedSince: pausedFor(15).pausedSince });
  });

  it("does not send after 14 days when the swell fails the rarity rule", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(15)), assessSwellRarity: jest.fn(async () => false) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("holds follow-ups for a paused outlook user too", async () => {
    const pinned: SwellFollowupState = {
      userId: USER, eventKey: `${HOME}:NW:2026-09-20`, beachId: HOME, lastArrivalAt: "2026-09-19T15:00:00.000Z", lastPeakAt: "2026-09-20T15:00:00.000Z",
      lastFaceHeightFt: 5, lastPeriodS: 16, lastDirectionDeg: 300, serious: false, lastKind: "coming", toldKinds: ["coming"],
      lastToldAt: "2026-09-16T00:00:00.000Z", lastFollowupAt: null, status: "active",
    };
    const deps = makeDeps({
      loadEngagement: jest.fn(async () => pausedFor(3)),
      loadFollowupStates: jest.fn(async () => [pinned]),
      loadOutlook: jest.fn(async () => []),
      evaluatePinned: jest.fn(async () => ({
        beach: { id: HOME, name: "Blacks Beach", shortName: "Blacks", slug: "blacks", state: "CA" }, forecastAvailable: true,
        event: beachSwellEvent({ beachId: HOME, eventKey: pinned.eventKey, peakFaceHeightFt: 8, periodS: 16, directionDeg: 300, peakAt: pinned.lastPeakAt }),
      })),
    });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(deps.claimFollowup).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});

describe("swell alert cron: persistence and concurrency", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("saves follow-ups and a first sighting in one pure transition, preserving fresh lists", async () => {
    const list = { runDate: "2026-09-18", swells: [outlookSwell()] };
    const deps = makeDeps({ loadFollowupStates: jest.fn(async () => [pinnedState()]),
      evaluatePinned: jest.fn(async () => biggerPinned()) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.sent).toBe(2);
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    const fresh = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list };
    expect(savedState(deps, fresh)).toMatchObject({ consecutiveUnanswered: 2, outlookList: list });
    expect(savedState(deps, fresh)).toEqual(savedState(deps, fresh));
    expect(fresh.consecutiveUnanswered).toBe(0);
  });

  it("merges a loader's pending list into the same final state write", async () => {
    const list = { runDate: "2026-09-18", swells: [outlookSwell()] };
    const deps = makeDeps({ loadOutlook: jest.fn(async (_profile, _now, onList) => {
      onList(list);
      return list.swells;
    }) });
    await runSwellAlertCron({ now: MORNING, deps });
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(savedState(deps)).toMatchObject({ consecutiveUnanswered: 1, outlookList: list });
  });

  it("preserves a concurrent app open when recording a stale send decision", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({
      consecutiveUnanswered: 2, lastSentAt: hoursAgo(96), lastFirstSightingAt: hoursAgo(96),
    })) });
    await runSwellAlertCron({ now: MORNING, deps });
    const fresh = { ...EMPTY_SWELL_OUTLOOK_USER_STATE,
      lastSentAt: hoursAgo(96), lastFirstSightingAt: hoursAgo(96),
      lastAnsweredAt: new Date(MORNING.getTime() + 1000).toISOString() };
    expect(savedState(deps, fresh)).toMatchObject({ consecutiveUnanswered: 0, pausedSince: null,
      lastAnsweredAt: fresh.lastAnsweredAt, lastFirstSightingAt: MORNING.toISOString() });
  });

  it("records against a resumed user's fresh counter instead of restoring a captured pause", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({
      consecutiveUnanswered: 3, lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360),
    })), assessSwellRarity: jest.fn(async () => true) });
    await runSwellAlertCron({ now: MORNING, deps });
    expect(savedState(deps)).toMatchObject({ consecutiveUnanswered: 1, pausedSince: null });
  });

  it("does not overwrite newer send timestamps on a delayed save", async () => {
    const deps = makeDeps();
    await runSwellAlertCron({ now: MORNING, deps });
    const later = new Date(MORNING.getTime() + 1000).toISOString();
    const fresh = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, consecutiveUnanswered: 1,
      lastSentAt: later, lastFirstSightingAt: later };
    expect(savedState(deps, fresh)).toMatchObject({ lastSentAt: later, lastFirstSightingAt: later });
  });

  it("lets only the winner of the pre-enqueue event claim send overlapping first sightings", async () => {
    const claimed = new Set<string>();
    const insertAlert = jest.fn(async (args: { userId: string; eventKey: string }) => {
      const key = `${args.userId}:${args.eventKey}`;
      if (claimed.has(key)) return null;
      claimed.add(key);
      return { id: "winner" };
    });
    const deps = makeDeps({ insertAlert, loadOutlook: jest.fn(async () => [outlookSwell(),
      outlookSwell({ id: "next", eventKey: "next", peakAt: "2026-09-22T15:00:00.000Z" })]) });
    const results = await Promise.all([runSwellAlertCron({ now: MORNING, deps }), runSwellAlertCron({ now: MORNING, deps })]);
    expect(insertAlert).toHaveBeenCalledTimes(2);
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
  });

  it.each([
    ["load", ["second-user"], 1, 1], ["save", [USER, "second-user"], 2, 2],
    ["outlook", ["second-user"], 1, 1], ["enqueue", [USER, "second-user"], 1, 1],
    ["mark", [USER, "second-user"], 2, 2],
  ] as const)("isolates a %s failure to its user", async (stage, recipients, sent, saves) => {
    const deps = makeDeps({ loadProfiles: jest.fn(async () => [profile(), profile({ id: "second-user" })]) });
    if (stage === "load") jest.mocked(deps.loadEngagement).mockRejectedValueOnce(new Error("unavailable"));
    if (stage === "save") jest.mocked(deps.saveEngagement).mockRejectedValueOnce(new SwellOutlookStateConflictError(USER));
    if (stage === "outlook") jest.mocked(deps.loadOutlook).mockRejectedValueOnce(new Error("unavailable"));
    if (stage === "enqueue") deps.enqueue.mockRejectedValueOnce(new Error("unavailable"));
    if (stage === "mark") deps.markAlertEnqueued.mockRejectedValueOnce(new Error("unavailable"));
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.errors).toBe(1);
    expect(deps.enqueue).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "second-user" }));
    expect(deps.enqueue.mock.calls.map(([args]) => args.recipientUserId)).toEqual(recipients);
    expect(summary.sent).toBe(sent);
    expect(deps.saveEngagement).toHaveBeenCalledTimes(saves);
  });

  it("settles an overdue pause against fresh state without undoing an intervening open", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({
      consecutiveUnanswered: 3, lastSentAt: hoursAgo(49),
    })), loadOutlook: jest.fn(async () => []) });
    await runSwellAlertCron({ now: MORNING, deps });
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(savedState(deps)).toEqual(EMPTY_SWELL_OUTLOOK_USER_STATE);
  });

  it("respects existing alert, follow-up and notification preference gates", async () => {
    for (const override of [{ isEnabled: jest.fn(() => false) }, { isUserAllowed: jest.fn(() => false) },
      { loadProfiles: jest.fn(async () => [profile({ notifPushEnabled: false })]) },
      { loadProfiles: jest.fn(async () => [profile({ notifSwellAlerts: false })]) }]) {
      const deps = makeDeps(override);
      await runSwellAlertCron({ now: MORNING, deps });
      expect(deps.loadEngagement).not.toHaveBeenCalled();
      expect(deps.enqueue).not.toHaveBeenCalled();
    }
    const deps = makeDeps({ isFollowupEnabled: jest.fn(() => false),
      loadFollowupStates: jest.fn(async () => [pinnedState()]),
      loadOutlook: jest.fn(async () => [outlookSwell({ notable: true })]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.sent).toBe(1);
    expect(deps.loadFollowupStates).not.toHaveBeenCalled();
    expect(deps.saveFirstTold).not.toHaveBeenCalled();
  });
});

describe("swell alert cron: outlook send boundaries", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("limits a downgraded free user's follow-ups to the home beach too", async () => {
    const deps = makeDeps({ getTier: jest.fn(async () => "free"),
      loadProfiles: jest.fn(async () => [profile({ homeBeachId: "ffffffff-0000-4000-8000-000000000002" })]),
      loadFollowupStates: jest.fn(async () => [pinnedState()]),
      evaluatePinned: jest.fn(async () => biggerPinned()), loadOutlook: jest.fn(async () => []) });
    await runSwellAlertCron({ now: MORNING, deps });
    expect(deps.evaluatePinned).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it.each([6, 21])("sends at the inclusive %i local-hour boundary", async (hour) => {
    const deps = makeDeps();
    const summary = await runSwellAlertCron({ now: new Date(Date.UTC(2026, 8, 18, hour + 7)), deps });
    expect(summary.sent).toBe(1);
  });

  it("sends at exactly 96 hours, and does not assess rarity for an engaged user", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({
      lastFirstSightingAt: hoursAgo(96), lastSentAt: hoursAgo(96), consecutiveUnanswered: 1,
    })) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.sent).toBe(1);
    expect(deps.assessSwellRarity).not.toHaveBeenCalled();
  });

  it("records accepted sends when a notable pin fails", async () => {
    const deps = makeDeps({ loadOutlook: jest.fn(async () => [outlookSwell({ notable: true })]),
      saveFirstTold: jest.fn(async () => { throw new Error("pin unavailable"); }) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.followupStateFailures).toBe(1);
    expect(summary.sent).toBe(1);
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(savedState(deps).consecutiveUnanswered).toBe(1);
  });
});

describe("swell alert cron: default outlook adapters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("loads without recording an open and forwards one transition to CAS persistence", async () => {
    const list = { runDate: "2026-09-18", swells: [outlookSwell()] };
    const client = {} as SupabaseClient<Database>;
    const load = jest.mocked(states.loadSwellOutlookUserState).mockResolvedValue(null);
    const save = jest.mocked(states.saveSwellOutlookUserState).mockResolvedValue(undefined);
    const loader = jest.mocked(outlookLoader.loadSwellOutlookForUser).mockImplementation(async (args) => {
      args.onList?.(list);
      return { generatedAt: MORNING.toISOString(), ...list, horizonDays: 9, homeBeach: null };
    });
    await runSwellAlertCron({ now: MORNING, supabase: client, deps: { ...makeDeps(),
      loadEngagement: undefined, saveEngagement: undefined, loadOutlook: undefined } });
    expect(load).toHaveBeenCalledWith(client, USER);
    expect(loader).toHaveBeenCalledWith(expect.objectContaining({ recordOpen: false, onList: expect.any(Function) }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(client, USER, expect.any(Function));
    expect(save.mock.calls[0][2](EMPTY_SWELL_OUTLOOK_USER_STATE)).toMatchObject({ outlookList: list, consecutiveUnanswered: 1 });
  });

  it.each([
    ["rare", true, true, true, true], ["peak not go", true, true, true, false],
    ["no history", true, true, false, true], ["beach absent", false, true, true, true],
    ["peak row absent", true, false, true, true],
  ])("uses the canonical peak verdict and existing history rule: %s", async (_name, beachPresent, peakPresent, historyPresent, peakGo) => {
    const beach = { ...snapshot.beach, id: HOME } as unknown as Beach;
    const pool = jest.mocked(pools.loadUserPool).mockResolvedValue(beachPresent
      ? [{ beach, relation: "home", distanceMiles: null }] : []);
    const peak = { ...snapshot.forecast, id: "peak", beach_id: HOME, forecast_at: outlookSwell().peakAt } as EnhancedForecastEntity;
    const history = { ...peak, id: "history", forecast_at: "2026-09-17T15:00:00.000Z" };
    const rows = [...(historyPresent ? [history] : []), ...(peakPresent ? [peak] : [])];
    const verdict = jest.mocked(verdicts.evaluateForecastVerdict).mockImplementation(({ forecast }) => ({
      score: forecast.id === "peak" ? 90 : 50,
      verdict: forecast.id === "peak" && !peakGo ? "maybe" : "go",
    } as verdicts.ForecastVerdict));
    const query: Record<string, jest.Mock> = {};
    for (const method of ["select", "in", "or", "gte", "lt", "order"]) query[method] = jest.fn(() => query);
    query.range = jest.fn(async (offset: number) => ({ data: offset === 0 ? rows : [], error: null }));
    const from = jest.fn(() => query);
    const client = { from } as unknown as SupabaseClient<Database>;
    const deps = makeDeps({ assessSwellRarity: undefined, loadEngagement: jest.fn(async () => engagement({
      consecutiveUnanswered: 3, lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360),
    })) });
    const summary = await runSwellAlertCron({ now: MORNING, supabase: client, deps });
    const expectedSent = beachPresent && peakPresent && historyPresent && peakGo ? 1 : 0;
    expect(summary.sent).toBe(expectedSent);
    expect(deps.enqueue).toHaveBeenCalledTimes(expectedSent);
    expect(pool).toHaveBeenCalledTimes(1);
    expect(verdict.mock.calls.filter(([args]) => args.forecast.id === "peak").length).toBe(beachPresent && peakPresent ? 1 : 0);
    expect(from.mock.calls.length).toBe(beachPresent ? 2 : 0);
  });
});

describe("swell alert cron: atomic first-sighting claim adapter", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it.each(["claimed", "event_exists", "first_sighting_spacing", "error"])("uses a per-user atomic claim before enqueue: %s", async (outcome) => {
    const rpc = jest.fn(async () => ({ data: { id: outcome === "claimed" ? "claim-1" : null, reason: outcome === "claimed" ? null : outcome },
      error: outcome === "error" ? { message: "claim unavailable" } : null }));
    const from = jest.fn(() => { throw new Error("direct insert bypassed the atomic claim"); });
    const deps = makeDeps({ insertAlert: undefined });
    const summary = await runSwellAlertCron({ now: MORNING,
      supabase: { rpc, from } as unknown as SupabaseClient<Database>, deps });
    expect(rpc).toHaveBeenCalledWith("claim_swell_outlook_first_sighting", expect.objectContaining({
      p_user_id: USER, p_event_key: outlookSwell().id, p_event_keys: [outlookSwell().id, outlookSwell().eventKey],
      p_now: MORNING.toISOString(), p_peak_date: "2026-09-21", p_beach_id: HOME,
    }));
    expect(from).not.toHaveBeenCalled();
    expect(summary.sent).toBe(outcome === "claimed" ? 1 : 0);
    expect(deps.enqueue).toHaveBeenCalledTimes(outcome === "claimed" ? 1 : 0);
    expect(summary.errors).toBe(outcome === "error" ? 1 : 0);
    expect(summary.skippedCounts.event_exists ?? 0).toBe(outcome === "event_exists" ? 1 : 0);
    expect(summary.skippedCounts.first_sighting_spacing ?? 0).toBe(outcome === "first_sighting_spacing" ? 1 : 0);
  });
});

describe("swell alert cron: exception candidate search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const paused = engagement({ consecutiveUnanswered: 3, lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360) });
  const early = outlookSwell({ id: "early", eventKey: "early" });
  const later = outlookSwell({ id: "later", eventKey: "later", peakAt: "2026-09-22T15:00:00.000Z" });

  it("sends and records only the first rare candidate, even when the earliest is not rare", async () => {
    const rarity = jest.fn(async (_profile, swell) => swell.id !== "early");
    const deps = makeDeps({ loadEngagement: jest.fn(async () => paused), assessSwellRarity: rarity,
      loadOutlook: jest.fn(async () => [early, later, outlookSwell({ id: "last", peakAt: "2026-09-23T15:00:00.000Z" })]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(rarity.mock.calls.map(([, swell]) => swell.id)).toEqual(["early", "later"]);
    expect(summary.sent).toBe(1);
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "later" }));
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "swell_watch", payload: expect.objectContaining({ kind: "coming" }),
    }));
    expect(deps.saveEngagement).toHaveBeenCalledTimes(1);
    expect(savedState(deps, { ...EMPTY_SWELL_OUTLOOK_USER_STATE, ...paused })).toMatchObject({
      lastExceptionAt: MORNING.toISOString(), consecutiveUnanswered: 4, pausedSince: paused.pausedSince,
    });
  });

  it("assesses both non-rare candidates and counts one unengaged skip", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => paused),
      loadOutlook: jest.fn(async () => [early, later]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(2);
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(summary.skippedCounts.first_sighting_none).toBeUndefined();
  });

  it("caps rarity work at three candidates per user per run", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => paused),
      loadOutlook: jest.fn(async () => Array.from({ length: 6 }, (_, index) => outlookSwell({
        id: `candidate-${index}`, peakAt: `2026-09-${21 + index}T15:00:00.000Z`,
      }))) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(3);
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("loads one pool and one paginated forecast input set for several rarity candidates", async () => {
    const pool = jest.mocked(pools.loadUserPool).mockResolvedValue([
      { beach: { ...snapshot.beach, id: HOME } as unknown as Beach, relation: "home", distanceMiles: null },
    ]);
    const history = { ...snapshot.forecast, id: "history", beach_id: HOME, forecast_at: "2026-09-17T15:00:00.000Z" } as EnhancedForecastEntity;
    const rows = [history, { ...history, id: "early", forecast_at: early.peakAt },
      { ...history, id: "later", forecast_at: later.peakAt }];
    jest.mocked(verdicts.evaluateForecastVerdict).mockImplementation(({ forecast }) => ({
      score: forecast.id === "later" ? 90 : 50, verdict: "go",
    } as verdicts.ForecastVerdict));
    const query: Record<string, jest.Mock> = {};
    for (const method of ["select", "in", "or", "gte", "lt", "order"]) query[method] = jest.fn(() => query);
    query.range = jest.fn(async (offset: number) => ({ data: offset === 0 ? rows : [], error: null }));
    const from = jest.fn(() => query);
    const deps = makeDeps({ loadEngagement: jest.fn(async () => paused), assessSwellRarity: undefined,
      loadOutlook: jest.fn(async () => [early, later]) });
    const summary = await runSwellAlertCron({ now: MORNING, supabase: { from } as unknown as SupabaseClient<Database>, deps });
    expect(summary.sent).toBe(1);
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "later" }));
    expect(pool).toHaveBeenCalledTimes(1);
    expect(query.range.mock.calls.map(([offset]) => offset)).toEqual([0, 3]);
    expect(from.mock.calls).toEqual([["enhanced_forecasts"], ["enhanced_forecasts"]]);
  });

  it("never assesses rarity when exception spacing is closed", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => ({ ...paused, lastFirstSightingAt: hoursAgo(1) })),
      loadOutlook: jest.fn(async () => [early, later]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.skippedCounts.first_sighting_spacing).toBe(1);
    expect(deps.assessSwellRarity).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("keeps the earliest-candidate behavior without rarity work for an engaged user", async () => {
    const deps = makeDeps({ loadOutlook: jest.fn(async () => [later, early]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.sent).toBe(1);
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "early" }));
    expect(deps.assessSwellRarity).not.toHaveBeenCalled();
  });

  it.each([
    ["null data", null], ["premium-looking data", { is_pro: true, is_trialing: false, expires_at: null }],
  ])("skips an outlook user on a returned tier error with %s", async (_name, data) => {
    const query: Record<string, jest.Mock> = {};
    for (const method of ["select", "eq"]) query[method] = jest.fn(() => query);
    query.maybeSingle = jest.fn(async () => ({ data, error: { message: "entitlements unavailable" } }));
    const from = jest.fn(() => query);
    const deps = makeDeps({ getTier: undefined, loadFollowupStates: jest.fn(async () => [pinnedState()]),
      evaluatePinned: jest.fn(async () => biggerPinned()), loadOutlook: jest.fn(async () => [early,
        outlookSwell({ beach: { id: "ffffffff-0000-4000-8000-000000000002", name: "Elsewhere" } })]) });
    const summary = await runSwellAlertCron({ now: MORNING, supabase: { from } as unknown as SupabaseClient<Database>, deps });
    expect(summary.errors).toBe(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
    expect(deps.evaluatePinned).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("isolates a rejected tier lookup and sends nothing to that user", async () => {
    const deps = makeDeps({ getTier: jest.fn(async () => { throw new Error("network failure"); }) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.errors).toBe(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});

describe("swell alert cron: exception eligibility filters", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("keeps a free user's exception inside forecast, in-range, home-beach filters", async () => {
    const deps = makeDeps({ getTier: jest.fn(async () => "free"),
      loadEngagement: jest.fn(async () => engagement({ consecutiveUnanswered: 3,
        lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360) })),
      assessSwellRarity: jest.fn(async () => true),
      loadOutlook: jest.fn(async () => [
        outlookSwell({ id: "other", beach: { id: "ffffffff-0000-4000-8000-000000000002", name: "Elsewhere" } }),
        outlookSwell({ id: "shrinking", status: "shrinking" }),
        outlookSwell({ id: "faded", status: "faded" }),
        outlookSwell({ id: "rideable", fit: { status: "rideable", boards: [] } }),
        outlookSwell({ id: "home" }),
      ]) });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.sent).toBe(1);
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(1);
    expect(deps.assessSwellRarity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "home" }), MORNING);
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ eventKey: "home", leadBeachId: HOME }));
  });

  it("does not assess or send an exception outside send hours", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({ consecutiveUnanswered: 3,
      lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360) })), assessSwellRarity: jest.fn(async () => true) });
    const summary = await runSwellAlertCron({ now: new Date("2026-09-18T10:00:00.000Z"), deps });
    expect(summary.skippedCounts.first_sighting_window_closed).toBe(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
    expect(deps.assessSwellRarity).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("keeps a rare exception behind the atomic spacing claim", async () => {
    const rpc = jest.fn(async () => ({ data: { id: null, reason: "first_sighting_spacing" }, error: null }));
    const deps = makeDeps({ insertAlert: undefined, loadEngagement: jest.fn(async () => engagement({
      consecutiveUnanswered: 3, lastSentAt: hoursAgo(408), pausedSince: hoursAgo(360),
    })), assessSwellRarity: jest.fn(async () => true) });
    const summary = await runSwellAlertCron({ now: MORNING, supabase: { rpc } as unknown as SupabaseClient<Database>, deps });
    expect(summary.skippedCounts.first_sighting_spacing).toBe(1);
    expect(summary.skippedCounts.event_exists).toBeUndefined();
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.saveEngagement).not.toHaveBeenCalled();
  });

  it("continues processing other users after an entitlement rejection", async () => {
    const deps = makeDeps({ loadProfiles: jest.fn(async () => [profile(), profile({ id: "second-user" })]),
      getTier: jest.fn().mockRejectedValueOnce(new Error("network failure")).mockResolvedValue("free") });
    const summary = await runSwellAlertCron({ now: MORNING, deps });
    expect(summary.errors).toBe(1);
    expect(summary.sent).toBe(1);
    expect(deps.enqueue.mock.calls.map(([args]) => args.recipientUserId)).toEqual(["second-user"]);
  });
});

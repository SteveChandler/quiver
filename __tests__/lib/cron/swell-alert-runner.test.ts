/**
 * @jest-environment node
 */

import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  orderSwellCandidatesForTomorrow,
  runSwellAlertCron,
  type SwellAlertDeps,
  type SwellAlertPoolEvaluation,
  type SwellAlertProfile,
} from "@/lib/cron/swell-alert-runner";
import type { RankDay } from "@/lib/cron/daily-call-runner";
import type {
  CanonicalWeekScoutResponse,
  WeekScoutDayResponse,
  WeekScoutWindowResponse,
} from "@/lib/services/discovery/week-scout";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";

const NOW = new Date("2026-09-18T00:00:00.000Z");
const USER_ID = "73040cff-afe9-4fa0-a874-2016203fc015";

function profile(
  overrides: Partial<SwellAlertProfile> = {},
): SwellAlertProfile {
  return {
    id: USER_ID,
    timezone: "America/Los_Angeles",
    homeBeachId: "11111111-1111-4111-8111-111111111111",
    location: { lat: 32.75, lon: -117.25 },
    maxDriveMinutes: 45,
    experienceLevel: "advanced",
    notifPushEnabled: true,
    notifSwellAlerts: true, notifForecastAlerts: false,
    ...overrides,
  };
}

function evaluation(peakHeightFt = 6): SwellAlertPoolEvaluation {
  const beachIds = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];

  return {
    history: [
      { localDate: "2026-09-14", bestScore: 52, go: false },
      { localDate: "2026-09-15", bestScore: 58, go: false },
      { localDate: "2026-09-16", bestScore: 61, go: false },
    ],
    candidates: beachIds.map((id, index) => ({
      beach: {
        id,
        name: ["Blacks", "Scripps", "Osprey"][index],
        shortName: null,
        slug: ["blacks", "scripps", "osprey"][index],
        state: "CA",
      },
      event: beachSwellEvent({
        beachId: id,
        eventKey: `${id}:NW:2026-09-20`,
        peakFaceHeightFt: index === 0 ? peakHeightFt : peakHeightFt - index,
        periodS: 17 - index,
        peakOffshoreHeightFt: 4.5 - index,
        peakAt: `2026-09-20T${String(15 + index).padStart(2, "0")}:00:00.000Z`,
      }),
      arrivalDate: "2026-09-18",
      peakDate: "2026-09-20",
      peakScore: 82 - index,
      peakVerdict: "go" as const,
      serious: index === 0 && peakHeightFt >= 8,
      awarenessSignal: "forecast_trend" as const,
      officialEvidenceRefs: [],
    })),
  };
}

function dependencies(
  overrides: Partial<SwellAlertDeps> = {},
): SwellAlertDeps {
  return {
    isEnabled: jest.fn(() => true),
    isUserAllowed: jest.fn(() => true),
    loadProfiles: jest.fn(async () => [profile()]),
    evaluatePool: jest.fn(async () => evaluation()),
    loadAlertState: jest.fn(async () => ({
      eventExists: false,
      lastAlertAt: null,
      recentTitleIds: [],
      recentFilmCount: 0,
    })),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
    resolveHeldBeaches: jest.fn(async () => new Map()),
    ...overrides,
  };
}

describe("runSwellAlertCron", () => {
  it("skips a swell event already recorded yesterday", async () => {
    const deps = dependencies({
      loadAlertState: jest.fn(async () => ({
        eventExists: true,
        lastAlertAt: "2026-09-17T00:00:00.000Z",
        recentTitleIds: [],
        recentFilmCount: 0,
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.skippedCounts.event_exists).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("enforces the 7-day user cooldown across different events", async () => {
    const deps = dependencies({
      loadAlertState: jest.fn(async () => ({
        eventExists: false,
        lastAlertAt: "2026-09-13T00:00:00.000Z",
        recentTitleIds: ["s09"],
        recentFilmCount: 0,
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.skippedCounts.cooldown_7d).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
  });

  it("names the user's board and an NWS hazard in the body", async () => {
    const pool = evaluation();
    pool.candidates[0] = { ...pool.candidates[0], boardName: "7'2", hazard: "high_rip_current" };
    const deps = dependencies({ evaluatePool: jest.fn(async () => pool) });

    await runSwellAlertCron({ now: NOW, deps });

    const { body } = (deps.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(body).toContain("Your call: Blacks, grab your 7'2.");
    expect(body).toMatch(/Rip current statement in effect\.$/);
  });

  it("states the daily call's window and what closes it", async () => {
    const pool = evaluation();
    pool.candidates[0] = {
      ...pool.candidates[0],
      boardName: "7'2",
      window: {
        start: "2026-09-20T15:00:00.000Z",
        end: "2026-09-20T18:00:00.000Z",
        minutes: 180,
        drivers: [{ kind: "wind", edge: "end", at: "2026-09-20T19:00:00.000Z", approximate: false, label: "onshore" }],
      },
    };
    const deps = dependencies({ evaluatePool: jest.fn(async () => pool) });

    await runSwellAlertCron({ now: NOW, deps });

    const { body } = (deps.enqueue as jest.Mock).mock.calls[0][0].payload;
    expect(body).toContain("Your call: Blacks Sunday 8–11 AM, grab your 7'2. Best before the wind picks up around 12 PM.");
  });

  it("uses only serious title copy for a nine-foot peak", async () => {
    const deps = dependencies({
      evaluatePool: jest.fn(async () => evaluation(9)),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    const enqueueArg = jest.mocked(deps.enqueue).mock.calls[0][0];
    const payload = enqueueArg.payload as {
      beaches: Array<{ beach_id: string; beach_name: string; rank: number }>;
      event_key: string;
      rarity: string;
      title_id: string;
      title: string;
    };
    const entry = titlePool.swell.find(({ id }) => id === payload.title_id);
    expect(entry?.tags).toContain("serious");
    expect(payload.title).not.toContain("NOW FIRING");
    expect(payload.beaches).toHaveLength(3);
    expect(payload.rarity).toBe("Best in 6 days");
    expect(enqueueArg.dedupeKey).toBe(
      `swell_watch:${USER_ID}:${payload.event_key}`,
    );
    expect(deps.markAlertEnqueued).toHaveBeenCalledWith("alert-1", "event-1");
  });

  it("skips users before their local 17:00 send hour", async () => {
    const deps = dependencies();
    const result = await runSwellAlertCron({
      now: new Date("2026-09-17T23:00:00.000Z"),
      deps,
    });

    expect(result.skippedCounts.not_send_hour).toBe(1);
    expect(deps.evaluatePool).not.toHaveBeenCalled();
  });
});

describe("runSwellAlertCron go rule and verification record", () => {
  function enqueuedPayload(deps: SwellAlertDeps): {
    beaches: Array<{ beach_id: string; beach_name: string; rank: number }>;
    event_key: string;
    rarity: string;
  } {
    return jest.mocked(deps.enqueue).mock.calls[0][0].payload as {
      beaches: Array<{ beach_id: string; beach_name: string; rank: number }>;
      event_key: string;
      rarity: string;
    };
  }

  it("holds a peak scoring above the old 70 threshold when the canonical verdict is not go", async () => {
    const pool = evaluation();
    const deps = dependencies({
      evaluatePool: jest.fn(async () => ({
        ...pool,
        candidates: pool.candidates.map((candidate) => ({
          ...candidate,
          peakVerdict: "maybe" as const,
        })),
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(pool.candidates[0].peakScore).toBeGreaterThanOrEqual(70);
    expect(result.skippedCounts.not_rare).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(deps.recordForecast).not.toHaveBeenCalled();
  });

  it("sends a peak scoring below the old 70 threshold when the canonical verdict is go", async () => {
    const pool = evaluation();
    const deps = dependencies({
      evaluatePool: jest.fn(async () => ({
        ...pool,
        candidates: pool.candidates.map((candidate, index) => ({
          ...candidate,
          peakScore: 65 - index,
        })),
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(enqueuedPayload(deps).rarity).toBe("Best in 6 days");
  });

  it("sends when only one beach qualifies", async () => {
    const pool = evaluation();
    const deps = dependencies({
      evaluatePool: jest.fn(async () => ({
        ...pool,
        candidates: pool.candidates.slice(0, 1),
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.errors).toBe(0);
    expect(result.sent).toBe(1);
    expect(enqueuedPayload(deps).beaches).toEqual([{
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_name: "Blacks",
      rank: 1,
    }]);
  });

  it("records the lead beach forecast once, after the alert row and before the push", async () => {
    const deps = dependencies();

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(result.verificationRecordFailures).toBe(0);
    expect(deps.recordForecast).toHaveBeenCalledTimes(1);
    expect(enqueuedPayload(deps).event_key).toBe("11111111-1111-4111-8111-111111111111:NW:2026-09-20");
    expect(deps.recordForecast).toHaveBeenCalledWith({
      eventKey: "11111111-1111-4111-8111-111111111111:NW:2026-09-20",
      beachId: "11111111-1111-4111-8111-111111111111",
      source: "alert",
      detectorVersion: "swell-events.v1",
      issuedAt: "2026-09-18T00:00:00.000Z",
      arrivalAt: "2026-09-18T15:00:00.000Z",
      peakAt: "2026-09-20T15:00:00.000Z",
      fadeAt: "2026-09-21T07:00:00.000Z",
      peakOffshoreHeightFt: 4.5,
      peakFaceHeightFt: 6,
      peakPeriodS: 17,
      directionDeg: 315,
    });
    const [insertOrder] = jest.mocked(deps.insertAlert).mock.invocationCallOrder;
    const [recordOrder] = jest.mocked(deps.recordForecast).mock.invocationCallOrder;
    const [enqueueOrder] = jest.mocked(deps.enqueue).mock.invocationCallOrder;
    expect(insertOrder).toBeLessThan(recordOrder);
    expect(recordOrder).toBeLessThan(enqueueOrder);
  });

  it("still sends when the verification record fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = dependencies({
      recordForecast: jest.fn(async () => {
        throw new Error("relation swell_event_verifications does not exist");
      }),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.verificationRecordFailures).toBe(1);
    expect(deps.markAlertEnqueued).toHaveBeenCalledWith("alert-1", "event-1");
    error.mockRestore();
  });

  it("does not record a forecast when the alert row already exists", async () => {
    const deps = dependencies({ insertAlert: jest.fn(async () => null) });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.skippedCounts.event_exists).toBe(1);
    expect(deps.recordForecast).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});

describe("held beaches on the legacy swell path", () => {
  it("leads with the best clear beach and never names a held one", async () => {
    const blacks = "11111111-1111-4111-8111-111111111111";
    const deps = dependencies({
      resolveHeldBeaches: jest.fn(async ({ candidates }) => new Map(candidates
        .filter((candidate) => candidate.beachId === blacks)
        .map((candidate) => [candidate.candidateId, "water_quality_hold" as const]))),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(deps.resolveHeldBeaches).toHaveBeenCalledWith(expect.objectContaining({
      profileExperience: "advanced",
      asOf: NOW,
    }));
    expect(result.sent).toBe(1);
    expect(result.skippedCounts.held_water_quality_hold).toBe(1);
    const payload = jest.mocked(deps.enqueue).mock.calls[0][0].payload as {
      beach_id: string;
      beaches: Array<{ beach_id: string; rank: number }>;
    };
    expect(payload.beach_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(payload.beaches.map(({ beach_id }) => beach_id)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });
});

describe("Daily Call ownership on the legacy swell path", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env.DAILY_CALL_ENABLED = "true";
    process.env.DAILY_CALL_USER_ALLOWLIST = "";
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  it.each([true, false])("handles a same-day peak (Daily Call recipient: %s)", async (recipient) => {
    const pool = evaluation();
    pool.candidates = pool.candidates.map((candidate) => ({
      ...candidate, arrivalDate: "2026-09-18", peakDate: "2026-09-17",
      event: { ...candidate.event, peakAt: "2026-09-18T01:00:00.000Z" },
    }));
    const deps = dependencies({
      loadProfiles: jest.fn(async () => [profile({ notifForecastAlerts: recipient })]),
      evaluatePool: jest.fn(async () => pool),
    });
    const summary = await runSwellAlertCron({ now: NOW, deps });
    expect(deps.enqueue).toHaveBeenCalledTimes(recipient ? 0 : 1);
    expect(deps.insertAlert).toHaveBeenCalledTimes(recipient ? 0 : 1);
    expect(summary.skippedCounts.skipped_daily_call_owns_today ?? 0).toBe(recipient ? 1 : 0);
  });

  it("still sends a days-ahead peak to a Daily Call recipient", async () => {
    const deps = dependencies({ loadProfiles: jest.fn(async () => [profile({ notifForecastAlerts: true })]) });
    const summary = await runSwellAlertCron({ now: NOW, deps });
    expect(summary.sent).toBe(1);
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe("swell alert shared ranking", () => {
  function rankingResponse(beachId: string, rankedBeachIds: string[]): CanonicalWeekScoutResponse {
    const pick = {
      id: "tomorrow-pick",
      beachId,
      start: "2026-09-18T15:00:00.000Z",
      end: "2026-09-18T18:00:00.000Z",
      displayWindowStart: "2026-09-18T15:00:00.000Z",
      displayWindowEnd: "2026-09-18T18:00:00.000Z",
      conditionScore: 85,
      rankedSpots: rankedBeachIds.map((id) => ({ beachId: id })),
    } as WeekScoutWindowResponse;
    const day: WeekScoutDayResponse = {
      localDate: "2026-09-18",
      bestWindowId: pick.id,
      bestDayWindow: pick,
      windows: [pick],
      exclusionReasons: [],
    };
    return { days: [day] } as CanonicalWeekScoutResponse;
  }

  function sharedEvaluation(): SwellAlertPoolEvaluation {
    const pool = evaluation();
    return { ...pool, poolBeachIds: pool.candidates.map(({ beach }) => beach.id), anchor: profile().location };
  }

  function payload(deps: SwellAlertDeps): {
    beach_id: string;
    body: string;
    beaches: Array<{ beach_id: string; rank: number }>;
  } {
    return jest.mocked(deps.enqueue).mock.calls[0][0].payload as ReturnType<typeof payload>;
  }

  it("leads with the pick instead of the peak-score winner throughout the alert", async () => {
    const pool = sharedEvaluation();
    const [highest, picked, third] = pool.candidates;
    const rankDay = jest.fn<ReturnType<RankDay>, Parameters<RankDay>>(async () => (
      rankingResponse(picked.beach.id, [third.beach.id, highest.beach.id])
    ));
    const deps = dependencies({
      evaluatePool: jest.fn(async () => pool),
      loadProfiles: jest.fn(async () => [profile({ preferredSessionTime: "morning" })]),
      usesSharedRanking: () => true,
      rankDay,
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(result.candidates).toBe(3);
    expect(rankDay).toHaveBeenCalledTimes(1);
    expect(rankDay).toHaveBeenCalledWith({
      userId: USER_ID, poolBeachIds: pool.poolBeachIds, timezone: "America/Los_Angeles",
      localDate: "2026-09-18", sessionTime: "morning", anchor: pool.anchor,
    });
    expect(payload(deps).beach_id).toBe(picked.beach.id);
    expect(payload(deps).beaches).toEqual([picked, third, highest].map((candidate, index) => ({
      beach_id: candidate.beach.id, beach_name: candidate.beach.name, rank: index + 1,
    })));
    expect(payload(deps).body).toContain("Your call: Scripps.");
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({
      leadBeachId: picked.beach.id, eventKey: picked.event.eventKey,
    }));
    expect(deps.recordForecast).toHaveBeenCalledWith(expect.objectContaining({ beachId: picked.beach.id }));
  });

  it("uses ranked spots when the pick has no swell, then preserves peak-score order", async () => {
    const pool = sharedEvaluation();
    const [highest, second, third] = pool.candidates;
    pool.candidates = [second, third, highest];
    const deps = dependencies({
      evaluatePool: jest.fn(async () => pool),
      usesSharedRanking: () => true,
      rankDay: jest.fn(async () => rankingResponse("no-swell-pick", ["no-swell-spot", third.beach.id])),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(payload(deps).beach_id).toBe(third.beach.id);
    expect(payload(deps).beaches.map(({ beach_id }) => beach_id)).toEqual([
      third.beach.id, highest.beach.id, second.beach.id,
    ]);
  });

  it("warns once with the user and still sends in peak-score order when ranking fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const pool = sharedEvaluation();
    const failure = new Error("ranking unavailable");
    const rankDay = jest.fn(async () => { throw failure; });
    const deps = dependencies({
      evaluatePool: jest.fn(async () => pool), usesSharedRanking: () => true, rankDay,
    });
    try {
      const result = await runSwellAlertCron({ now: NOW, deps });

      expect(result.sent).toBe(1);
      expect(result.errors).toBe(0);
      expect(rankDay).toHaveBeenCalledTimes(1);
      expect(payload(deps).beaches.map(({ beach_id }) => beach_id)).toEqual(pool.poolBeachIds);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(USER_ID), failure);
    } finally {
      warn.mockRestore();
    }
  });

  it("never ranks when the flag dependency is off", async () => {
    const pool = sharedEvaluation();
    const rankDay = jest.fn(async () => rankingResponse(pool.candidates[2].beach.id, []));
    const deps = dependencies({
      evaluatePool: jest.fn(async () => pool), usesSharedRanking: () => false, rankDay,
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.sent).toBe(1);
    expect(rankDay).not.toHaveBeenCalled();
    expect(payload(deps).beaches.map(({ beach_id }) => beach_id)).toEqual(pool.poolBeachIds);
  });

  it("defaults to the real flag and never ranks when CALL_SHARED_RANKING_ENABLED is unset", async () => {
    const enabledBefore = process.env.CALL_SHARED_RANKING_ENABLED;
    delete process.env.CALL_SHARED_RANKING_ENABLED;
    const pool = sharedEvaluation();
    const rankDay = jest.fn(async () => rankingResponse(pool.candidates[2].beach.id, []));
    const deps = dependencies({ evaluatePool: jest.fn(async () => pool), rankDay });
    try {
      const result = await runSwellAlertCron({ now: NOW, deps });

      expect(result.sent).toBe(1);
      expect(rankDay).not.toHaveBeenCalled();
      expect(payload(deps).beaches.map(({ beach_id }) => beach_id)).toEqual(pool.poolBeachIds);
    } finally {
      if (enabledBefore === undefined) delete process.env.CALL_SHARED_RANKING_ENABLED;
      else process.env.CALL_SHARED_RANKING_ENABLED = enabledBefore;
    }
  });

  it.each(["missing day", "null pick"])("keeps peak-score order with a %s", async (kind) => {
    const pool = sharedEvaluation();
    const response = rankingResponse(pool.candidates[2].beach.id, []);
    if (kind === "missing day") response.days = [];
    else response.days[0].bestWindowId = null;
    const rankDay = jest.fn(async () => response);

    const ordered = await orderSwellCandidatesForTomorrow({
      profile: profile(), evaluation: pool, now: NOW, rankDay, usesSharedRanking: () => true,
    });

    expect(rankDay).toHaveBeenCalledTimes(1);
    expect(ordered).toEqual(pool.candidates);
  });

  it.each([undefined, []])("never ranks without pool IDs (%s)", async (poolBeachIds) => {
    const pool = { ...evaluation(), poolBeachIds };
    const rankDay = jest.fn(async () => rankingResponse(pool.candidates[2].beach.id, []));

    const ordered = await orderSwellCandidatesForTomorrow({
      profile: profile(), evaluation: pool, now: NOW, rankDay, usesSharedRanking: () => true,
    });

    expect(rankDay).not.toHaveBeenCalled();
    expect(ordered).toEqual(pool.candidates);
  });

  it("preserves tomorrow filtering and beach-ID ties and passes null for missing preferences and anchor", async () => {
    const pool = sharedEvaluation();
    delete pool.anchor;
    const [first, second, third] = pool.candidates;
    pool.candidates = [
      { ...third, arrivalDate: "2026-09-19" },
      { ...second, arrivalDate: "2026-09-19", peakDate: "2026-09-18", peakScore: first.peakScore },
      first,
    ];
    const rankDay = jest.fn(async () => rankingResponse("no-swell-pick", []));

    const ordered = await orderSwellCandidatesForTomorrow({
      profile: profile(), evaluation: pool, now: NOW, rankDay, usesSharedRanking: () => true,
    });

    expect(ordered.map(({ beach }) => beach.id)).toEqual([first.beach.id, second.beach.id]);
    expect(rankDay).toHaveBeenCalledWith(expect.objectContaining({ sessionTime: null, anchor: null }));
    expect(pool.candidates).toHaveLength(3);
  });
});

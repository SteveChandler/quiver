/**
 * @jest-environment node
 */

import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  runSwellAlertCron,
  type SwellAlertDeps,
  type SwellAlertPoolEvaluation,
  type SwellAlertProfile,
} from "@/lib/cron/swell-alert-runner";
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
    notifSwellAlerts: true,
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

  it("enforces the 72-hour user cooldown across different events", async () => {
    const deps = dependencies({
      loadAlertState: jest.fn(async () => ({
        eventExists: false,
        lastAlertAt: "2026-09-16T00:00:00.000Z",
        recentTitleIds: ["s09"],
        recentFilmCount: 0,
      })),
    });

    const result = await runSwellAlertCron({ now: NOW, deps });

    expect(result.skippedCounts.cooldown_72h).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
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
    expect(payload.rarity).toBe("Best in 30 days");
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
    expect(enqueuedPayload(deps).rarity).toBe("Best in 30 days");
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

import {
  evaluateMajorEventHoldCandidates,
  evaluateRecommendationHoldCandidates,
} from "@/lib/recommendations/major-event-hold/service";
import type { WaterQualityHoldResolution } from "@/lib/recommendations/major-event-hold/water-quality";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldResolution,
  ResolvedMajorEventHold,
} from "@/lib/recommendations/major-event-hold/types";

const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";
const candidates: MajorEventHoldCandidate[] = [
  {
    candidateId: "first",
    beachId: BEACH_A,
    startsAt: "2026-07-19T17:00:00.000Z",
    endsAt: "2026-07-19T19:00:00.000Z",
  },
  {
    candidateId: "second",
    beachId: BEACH_B,
    startsAt: "2026-07-19T19:00:00.000Z",
    endsAt: "2026-07-19T21:00:00.000Z",
  },
];

const holdA: ResolvedMajorEventHold = {
  recordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  holdId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  version: 2,
  status: "active",
  scopeBeachIds: [BEACH_A],
  validFrom: "2026-07-19T07:00:00.000Z",
  validUntil: "2026-07-20T07:00:00.000Z",
  affectedCohorts: ["beginner", "intermediate", "unknown"],
  action: "suppress_positive",
  expiresAt: "2026-07-20T07:00:00.000Z",
};

const resolved = (
  holds: ResolvedMajorEventHold[],
): MajorEventHoldResolution => ({
  state: "resolved",
  holds,
});
const discardAudit = (): undefined => undefined;

describe("major-event hold service", () => {
  it("serializes the exact resolution snapshot used by the resolver", async () => {
    const resolutionAsOf = new Date("2026-07-20T12:00:00.000Z");
    const resolveHolds = jest.fn().mockResolvedValue(resolved([]));
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0]],
        profileExperience: "intermediate",
        mode: "enforce",
      },
      {
        resolveHolds,
        audit: discardAudit,
        clock: () => resolutionAsOf,
      },
    );

    expect(resolveHolds).toHaveBeenCalledWith([candidates[0]], {
      asOf: resolutionAsOf,
    });
    expect(decisions[0].recommendationAvailability).toMatchObject({
      state: "available",
      resolutionAsOf: resolutionAsOf.toISOString(),
    });
  });

  it("fails closed on recommendation surfaces while leaving the base evaluator opt-in", async () => {
    const waterQualityResolution: WaterQualityHoldResolution = {
      state: "resolved",
      heldBeachIds: [BEACH_A],
      epoch: "water-quality-epoch",
    };
    const resolveWaterQualityHolds = jest
      .fn()
      .mockResolvedValue(waterQualityResolution);

    const recommendationDecisions = await evaluateRecommendationHoldCandidates(
      {
        candidates,
        profileExperience: "intermediate",
        mode: "off",
      },
      { resolveWaterQualityHolds, audit: discardAudit },
    );
    const directDecisions = await evaluateMajorEventHoldCandidates(
      {
        candidates,
        profileExperience: "intermediate",
        mode: "off",
      },
      { resolveWaterQualityHolds, audit: discardAudit },
    );

    expect(recommendationDecisions[0].recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "water_quality_hold",
    });
    expect(recommendationDecisions[1].recommendationAvailability.state).toBe(
      "available",
    );
    expect(directDecisions.every(
      (decision) => decision.recommendationAvailability.state === "available",
    )).toBe(true);
    expect(resolveWaterQualityHolds).toHaveBeenCalledTimes(1);
  });

  it("keeps a known chronic hold effective while an outside live signal is unavailable", async () => {
    const resolveWaterQualityHolds = jest.fn().mockResolvedValue({
      state: "unresolved",
      heldBeachIds: [BEACH_A],
      epoch: "water-quality-unresolved-with-owner-hold",
    } satisfies WaterQualityHoldResolution);

    const decisions = await evaluateRecommendationHoldCandidates(
      { candidates, profileExperience: "intermediate", mode: "off" },
      { resolveWaterQualityHolds, audit: discardAudit },
    );

    expect(decisions[0].recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "water_quality_hold",
    });
    expect(decisions[1].recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("short-circuits off mode without an RPC and preserves order", async () => {
    const resolveHolds = jest.fn();
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates: [...candidates].reverse(),
        profileExperience: "beginner",
        mode: "off",
      },
      { resolveHolds, audit: discardAudit },
    );

    expect(resolveHolds).not.toHaveBeenCalled();
    expect(decisions.map((decision) => decision.candidateId)).toEqual([
      "second",
      "first",
    ]);
    expect(
      decisions.map((decision) => decision.recommendationAvailability),
    ).toEqual([
      expect.objectContaining({ state: "available" }),
      expect.objectContaining({ state: "available" }),
    ]);
  });

  it("batches every valid candidate once and maps invalid skill to unknown", async () => {
    const resolveHolds = jest.fn().mockResolvedValue(resolved([holdA]));
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates,
        profileExperience: "novice-ish",
        mode: "enforce",
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      },
      { resolveHolds, audit: discardAudit },
    );

    expect(resolveHolds).toHaveBeenCalledTimes(1);
    expect(resolveHolds).toHaveBeenCalledWith(candidates, {
      asOf: new Date("2026-07-19T12:00:00.000Z"),
    });
    expect(decisions.map((decision) => decision.candidateId)).toEqual([
      "first",
      "second",
    ]);
    expect(decisions[0].recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: holdA.expiresAt,
    });
    expect(decisions[1].recommendationAvailability).toMatchObject({
      state: "available",
    });
  });

  it("batches valid candidates while failing a malformed candidate closed", async () => {
    const resolveHolds = jest.fn().mockResolvedValue(resolved([]));
    const malformed = { candidateId: "bad", beachId: null };
    const decisions = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0], malformed, candidates[1]],
        profileExperience: "expert",
        mode: "enforce",
      },
      { resolveHolds, audit: discardAudit },
    );

    expect(resolveHolds).toHaveBeenCalledTimes(1);
    expect(resolveHolds.mock.calls[0][0]).toEqual(candidates);
    expect(decisions.map((decision) => decision.candidateId)).toEqual([
      "first",
      null,
      "second",
    ]);
    expect(decisions[1].recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: expect.any(String),
      resolutionAsOf: expect.any(String),
    });
  });

  it("creates stable sorted SHA-256 epochs distinct by state and mode", async () => {
    const holdB: ResolvedMajorEventHold = {
      ...holdA,
      recordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      holdId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      version: 1,
      scopeBeachIds: [BEACH_B],
    };
    const evaluateWith = async (
      mode: "off" | "shadow" | "enforce",
      resolution: MajorEventHoldResolution,
    ) =>
      evaluateMajorEventHoldCandidates(
        { candidates: [candidates[0]], profileExperience: "expert", mode },
        {
          resolveHolds: jest.fn().mockResolvedValue(resolution),
          audit: discardAudit,
        },
      );

    const ordered = await evaluateWith("enforce", resolved([holdA, holdB]));
    const reversed = await evaluateWith("enforce", resolved([holdB, holdA]));
    const shadow = await evaluateWith("shadow", resolved([holdA, holdB]));
    const unresolved = await evaluateWith("enforce", {
      state: "unresolved",
      holds: [],
    });
    const off = await evaluateWith("off", resolved([]));

    const epochs = [ordered, reversed, shadow, unresolved, off].map(
      ([decision]) => decision.evaluation.holdEpoch,
    );
    expect(epochs[0]).toBe(epochs[1]);
    expect(epochs[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([epochs[0], epochs[2], epochs[3], epochs[4]]).size).toBe(4);
  });

  it("audits shadow would-block and enforce outcomes without changing output", async () => {
    const audit = jest.fn().mockRejectedValue(new Error("audit unavailable"));
    const shadow = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0]],
        profileExperience: "beginner",
        mode: "shadow",
      },
      { resolveHolds: jest.fn().mockResolvedValue(resolved([holdA])), audit },
    );
    const shadowUnavailable = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0]],
        profileExperience: "expert",
        mode: "shadow",
      },
      {
        resolveHolds: jest
          .fn()
          .mockResolvedValue({ state: "unresolved", holds: [] }),
        audit,
      },
    );
    const shadowMalformed = await evaluateMajorEventHoldCandidates(
      {
        candidates: [{ candidateId: "missing-window", beachId: BEACH_A }],
        profileExperience: "expert",
        mode: "shadow",
      },
      { resolveHolds: jest.fn(), audit },
    );
    const blocked = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0]],
        profileExperience: "beginner",
        mode: "enforce",
      },
      { resolveHolds: jest.fn().mockResolvedValue(resolved([holdA])), audit },
    );
    const unavailable = await evaluateMajorEventHoldCandidates(
      {
        candidates: [candidates[0]],
        profileExperience: "expert",
        mode: "enforce",
      },
      {
        resolveHolds: jest
          .fn()
          .mockResolvedValue({ state: "unresolved", holds: [] }),
        audit,
      },
    );

    expect(shadow[0].recommendationAvailability.state).toBe("available");
    expect(shadowUnavailable[0].recommendationAvailability.state).toBe(
      "available",
    );
    expect(shadowMalformed[0].recommendationAvailability.state).toBe(
      "available",
    );
    expect(blocked[0].recommendationAvailability.state).toBe("none");
    expect(unavailable[0].recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "hold_state_unavailable",
    });
    expect(audit.mock.calls.map(([event]) => event.event)).toEqual([
      "would_block",
      "resolution_unavailable",
      "resolution_unavailable",
      "blocked",
      "resolution_unavailable",
    ]);
  });

  it("uses a fixed client-safe shape for the default structured audit", async () => {
    const consoleInfo = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});
    try {
      const decisions = await evaluateMajorEventHoldCandidates(
        {
          candidates: [candidates[0]],
          profileExperience: "expert",
          mode: "shadow",
        },
        {
          resolveHolds: jest
            .fn()
            .mockResolvedValue({ state: "unresolved", holds: [] }),
        },
      );

      expect(decisions[0].recommendationAvailability.state).toBe("available");
      expect(consoleInfo).toHaveBeenCalledTimes(1);
      const [label, audit] = consoleInfo.mock.calls[0];
      expect(label).toBe("[major-event-hold:audit]");
      expect(Object.keys(audit).sort()).toEqual([
        "beachId",
        "cohort",
        "event",
        "holdEpoch",
        "holdIds",
        "mode",
        "reasonCode",
      ]);
      expect(audit).toMatchObject({
        event: "resolution_unavailable",
        mode: "shadow",
        beachId: BEACH_A,
        cohort: "expert",
        holdIds: [],
        holdEpoch: expect.stringMatching(/^[0-9a-f]{64}$/),
        reasonCode: "hold_state_unavailable",
      });
      expect(JSON.stringify(audit)).not.toMatch(
        /candidate|evidence|operator|safety|reliability|confidence/i,
      );
    } finally {
      consoleInfo.mockRestore();
    }
  });

  it("serializes only the client-safe availability contract", async () => {
    const decisions = await evaluateMajorEventHoldCandidates(
      { candidates: [candidates[0]], profileExperience: null, mode: "enforce" },
      {
        resolveHolds: jest.fn().mockResolvedValue(resolved([holdA])),
        audit: discardAudit,
      },
    );
    const serialized = JSON.stringify(decisions[0].recommendationAvailability);
    expect(Object.keys(decisions[0].recommendationAvailability).sort()).toEqual(
      ["expiresAt", "holdEpoch", "reasonCode", "resolutionAsOf", "state"],
    );
    expect(serialized).not.toMatch(
      /evidence|operator|safety|reliability|confidence|recordId|holdId/i,
    );
  });
});
describe("resolution failure diagnostics", () => {
  it("fails closed AND reports why when hold resolution throws", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const audit = jest.fn();

    const decisions = await evaluateMajorEventHoldCandidates(
      { mode: "enforce", profileExperience: "intermediate", candidates },
      {
        resolveHolds: jest
          .fn()
          .mockRejectedValue(new Error("hold store unreachable")),
        audit,
      },
    );

    // Fail-closed behaviour is deliberate and must not regress: a resolution
    // failure suppresses recommendations rather than serving an unsafe call.
    for (const decision of decisions) {
      expect(decision.evaluation.outcome).toBe("explicit_none");
      expect(decision.evaluation.reasonCode).toBe("hold_state_unavailable");
    }

    // ...but the cause must be recoverable. Before this, a bare catch swallowed
    // the error, so a DB outage, a timeout and a bad asOf were indistinguishable
    // from each other in production.
    expect(consoleError).toHaveBeenCalledWith(
      "[major-event-hold:resolution-failed]",
      expect.objectContaining({ error: "hold store unreachable" }),
    );

    consoleError.mockRestore();
  });
});

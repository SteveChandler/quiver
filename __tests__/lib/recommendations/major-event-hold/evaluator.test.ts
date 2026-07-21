import { mapSafetyCohort } from "@/lib/recommendations/major-event-hold/cohort";
import {
  evaluateMajorEventHold,
  P0_PROTECTED_ALTERNATIVE_POLICY_VERSION,
} from "@/lib/recommendations/major-event-hold/evaluator";
import { parseMajorEventHoldMode } from "@/lib/recommendations/major-event-hold/config";
import type {
  MajorEventHoldCandidate,
  ResolvedMajorEventHold,
} from "@/lib/recommendations/major-event-hold/types";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const CASE_BEACH_ID = "abcdefab-cdef-4abc-8def-abcdefabcdef";

const heldCandidate: MajorEventHoldCandidate = {
  candidateId: "candidate-a",
  beachId: BEACH_ID,
  startsAt: "2026-07-19T17:00:00.000Z",
  endsAt: "2026-07-19T19:00:00.000Z",
};

const activeHold: ResolvedMajorEventHold = {
  recordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  holdId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  version: 1,
  status: "active",
  scopeBeachIds: [BEACH_ID],
  validFrom: "2026-07-19T07:00:00.000Z",
  validUntil: "2026-07-20T07:00:00.000Z",
  affectedCohorts: ["beginner", "intermediate", "unknown"],
  action: "suppress_positive",
  expiresAt: "2026-07-20T07:00:00.000Z",
};

describe("major-event hold cohort and evaluator", () => {
  it.each(["beginner", "intermediate", "unknown"] as const)(
    "returns explicit none for affected %s",
    (cohort) => {
      expect(
        evaluateMajorEventHold({
          mode: "enforce",
          resolutionState: "resolved",
          holds: [activeHold],
          cohort,
          candidate: heldCandidate,
          holdEpoch: "epoch",
        }),
      ).toEqual({
        outcome: "explicit_none",
        reasonCode: "major_event_hold",
        holdIds: [activeHold.holdId],
        expiresAt: activeHold.expiresAt,
        holdEpoch: "epoch",
      });
    },
  );

  it("canonicalizes a valid uppercase candidate beach ID before matching", () => {
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [{ ...activeHold, scopeBeachIds: [CASE_BEACH_ID] }],
        cohort: "beginner",
        candidate: {
          ...heldCandidate,
          beachId: CASE_BEACH_ID.toUpperCase(),
        },
        holdEpoch: "epoch",
      }),
    ).toMatchObject({
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
    });
  });

  it.each(["advanced", "expert"] as const)(
    "allows unaffected %s surfers",
    (cohort) => {
      expect(
        evaluateMajorEventHold({
          mode: "enforce",
          resolutionState: "resolved",
          holds: [activeHold],
          cohort,
          candidate: heldCandidate,
          holdEpoch: "epoch",
        }),
      ).toMatchObject({ outcome: "allow", holdIds: [] });
    },
  );

  it("maps missing and invalid profile skill to unknown", () => {
    expect(mapSafetyCohort(null)).toBe("unknown");
    expect(mapSafetyCohort(undefined)).toBe("unknown");
    expect(mapSafetyCohort("novice-ish")).toBe("unknown");
    expect(mapSafetyCohort(" BEGINNER ")).toBe("beginner");
  });

  it("fails closed for every cohort when hold state is unresolved", () => {
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "unresolved",
        holds: [],
        cohort: "expert",
        candidate: heldCandidate,
        holdEpoch: "unresolved-epoch",
      }),
    ).toEqual({
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
      holdIds: [],
      holdEpoch: "unresolved-epoch",
    });
  });

  it("fails closed for a malformed candidate in enforce mode", () => {
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [],
        cohort: "expert",
        candidate: { ...heldCandidate, beachId: "" },
        holdEpoch: "epoch",
      }),
    ).toMatchObject({
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
    });
  });

  it("short-circuits off mode even when state and candidate are unresolved", () => {
    expect(
      evaluateMajorEventHold({
        mode: "off",
        resolutionState: "unresolved",
        holds: [],
        cohort: "unknown",
        candidate: null,
        holdEpoch: "off-epoch",
      }),
    ).toEqual({
      outcome: "allow",
      holdIds: [],
      holdEpoch: "off-epoch",
    });
  });

  it("identifies a shadow would-block while allowing the candidate", () => {
    expect(
      evaluateMajorEventHold({
        mode: "shadow",
        resolutionState: "resolved",
        holds: [activeHold],
        cohort: "beginner",
        candidate: heldCandidate,
        holdEpoch: "shadow-epoch",
      }),
    ).toEqual({
      outcome: "allow",
      holdIds: [activeHold.holdId],
      expiresAt: activeHold.expiresAt,
      holdEpoch: "shadow-epoch",
    });
  });

  it("does not emit a protected alternative in P0-A", () => {
    expect(P0_PROTECTED_ALTERNATIVE_POLICY_VERSION).toBe(
      "protected-alternative-explicit-none-v1",
    );
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [{ ...activeHold, action: "protected_alternatives_only" }],
        cohort: "beginner",
        candidate: heldCandidate,
        holdEpoch: "epoch",
      }).outcome,
    ).toBe("explicit_none");
  });

  it("uses beach scope, half-open windows, cohort, and the latest status", () => {
    const cancelledLatest: ResolvedMajorEventHold = {
      ...activeHold,
      recordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      version: 2,
      status: "cancelled",
    };
    const adjacentCandidate = {
      ...heldCandidate,
      startsAt: activeHold.validUntil,
      endsAt: "2026-07-20T08:00:00.000Z",
    };

    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [activeHold, cancelledLatest],
        cohort: "beginner",
        candidate: heldCandidate,
        holdEpoch: "epoch",
      }).outcome,
    ).toBe("allow");
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [activeHold],
        cohort: "beginner",
        candidate: adjacentCandidate,
        holdEpoch: "epoch",
      }).outcome,
    ).toBe("allow");
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [activeHold],
        cohort: "beginner",
        candidate: {
          ...heldCandidate,
          beachId: "22222222-2222-4222-8222-222222222222",
        },
        holdEpoch: "epoch",
      }).outcome,
    ).toBe("allow");
  });

  it("uses the earliest expiry across matching holds", () => {
    const earlier = {
      ...activeHold,
      recordId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      holdId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      expiresAt: "2026-07-19T23:00:00.000Z",
    };
    expect(
      evaluateMajorEventHold({
        mode: "enforce",
        resolutionState: "resolved",
        holds: [activeHold, earlier],
        cohort: "beginner",
        candidate: heldCandidate,
        holdEpoch: "epoch",
      }),
    ).toMatchObject({ expiresAt: earlier.expiresAt });
  });

  it("strictly parses the server-only mode", () => {
    expect(parseMajorEventHoldMode(undefined)).toBe("off");
    expect(parseMajorEventHoldMode(null)).toBe("off");
    expect(() => parseMajorEventHoldMode("")).toThrow(
      "Invalid MAJOR_EVENT_HOLD_MODE",
    );
    expect(() => parseMajorEventHoldMode("  ")).toThrow(
      "Invalid MAJOR_EVENT_HOLD_MODE",
    );
    expect(() => parseMajorEventHoldMode(" enforce ")).toThrow(
      "Invalid MAJOR_EVENT_HOLD_MODE",
    );
    expect(parseMajorEventHoldMode("shadow")).toBe("shadow");
    expect(() => parseMajorEventHoldMode("ENFORCE")).toThrow(
      "Invalid MAJOR_EVENT_HOLD_MODE",
    );
  });
});

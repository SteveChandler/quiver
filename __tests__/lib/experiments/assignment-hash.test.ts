import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  experimentArm,
} from "@/lib/experiments/assignment-hash";
import {
  BFR_HOLDOUT_EXPERIMENT_KEY,
  bfrHoldoutAssignment,
} from "@/lib/experiments/bfr-holdout";

const ASSIGNED_AT = "2026-08-24T12:00:00.000Z";

describe("experimentArm", () => {
  it.each([
    ["00000000-0000-0000-0000-000000000001", "t3-quicklog-v1", 1],
    ["00000000-0000-0000-0000-000000000001", "t10-freegrowth-v1", 0],
    ["11111111-2222-3333-4444-555555555555", "t3-quicklog-v1", 1],
    ["11111111-2222-3333-4444-555555555555", "t2a-swellwatch-v1", 1],
    ["a3f1c9d2-7b64-4e0a-9c58-2d1b6f8e4a70", "t10-freegrowth-v1", 1],
  ])("matches the shared SQL vector for %s / %s", (userId, key, expected) => {
    expect(experimentArm(userId, key)).toBe(expected);
  });

  it("normalizes UUID case to the Postgres uuid::text representation", () => {
    const userId = "a3f1c9d2-7b64-4e0a-9c58-2d1b6f8e4a70";
    expect(experimentArm(userId.toUpperCase(), "t10-freegrowth-v1")).toBe(
      experimentArm(userId, "t10-freegrowth-v1")
    );
  });

  it("is deterministic across repeated calls", () => {
    const values = Array.from({ length: 10 }, () =>
      experimentArm("11111111-2222-3333-4444-555555555555", "t3-quicklog-v1")
    );
    expect(new Set(values)).toEqual(new Set([1]));
  });

  it.each(["user-123", "anon-visitor-456"])(
    "assigns a stable BFR holdout arm for %s",
    (subjectId) => {
      const assignments = Array.from({ length: 10 }, () =>
        bfrHoldoutAssignment(subjectId, ASSIGNED_AT)
      );
      expect(new Set(assignments.map((assignment) => assignment.arm)).size).toBe(1);
      expect(assignments[0]).toEqual({
        subjectId,
        experimentKey: BFR_HOLDOUT_EXPERIMENT_KEY,
        arm: expect.stringMatching(/^(holdout|treatment)$/),
        assignedAt: ASSIGNED_AT,
        version: 1,
      });
    }
  );

  it("canonicalizes a bounded ISO assignment instant", () => {
    expect(
      bfrHoldoutAssignment("anon-1", "2026-08-24T05:00:00-07:00").assignedAt
    ).toBe(ASSIGNED_AT);
  });

  it("rejects a non-ISO assignment time accepted by Date.parse", () => {
    expect(() => bfrHoldoutAssignment("anon-1", "August 24, 2026")).toThrow(
      "Invalid BFR holdout assignment time"
    );
  });

  it("keeps the BFR assignment module browser-safe", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/experiments/bfr-holdout.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/(?:node:)?crypto|createHash|Buffer/);
  });

  it("produces a rough 50/50 split over deterministic identifiers", () => {
    const assignments = Array.from({ length: 400 }, (_, index) =>
      bfrHoldoutAssignment(`anon-${index}`, ASSIGNED_AT)
    );
    const treatmentCount = assignments.filter(
      (assignment) => assignment.arm === "treatment"
    ).length;

    expect(treatmentCount).toBeGreaterThanOrEqual(160);
    expect(treatmentCount).toBeLessThanOrEqual(240);
  });

  /**
   * Boundary coverage for `normalizeBoundedIsoInstant`, which moved into this module when
   * `lib/beach-follow/state.ts` was deleted with the beach-follow surface. The deleted
   * `__tests__/lib/beach-follow/state.test.ts` held the only offset-bound, impossible-calendar,
   * and length checks for this still-live validator; without these, a future hand edit could
   * loosen the guard and every remaining test would stay green.
   */
  describe("bounded ISO instant validation", () => {
    it.each(["+14:01", "-14:01", "-23:59", "+15:00"])(
      "rejects an assignment time beyond the ISO offset bound: %s",
      (offset) => {
        expect(() =>
          bfrHoldoutAssignment("anon-1", `2026-08-24T05:00:00${offset}`)
        ).toThrow("Invalid BFR holdout assignment time");
      }
    );

    it("accepts the maximum legal +14:00 offset", () => {
      expect(
        bfrHoldoutAssignment("anon-1", "2026-08-25T02:00:00+14:00").assignedAt
      ).toBe(ASSIGNED_AT);
    });

    it.each([
      ["non-leap February 30th", "2026-02-30T00:00:00Z"],
      ["April 31st", "2026-04-31T00:00:00-07:00"],
      ["month 13", "2026-13-01T00:00:00Z"],
      ["hour 24", "2026-08-24T24:00:00Z"],
    ])("rejects an impossible calendar instant: %s", (_label, value) => {
      expect(() => bfrHoldoutAssignment("anon-1", value)).toThrow(
        "Invalid BFR holdout assignment time"
      );
    });

    it("rejects an instant longer than the 35-character bound", () => {
      // Ten fractional digits pushes past both the regex and MAX_ISO_INSTANT_LENGTH.
      expect(() =>
        bfrHoldoutAssignment("anon-1", "2026-08-24T12:00:00.0123456789Z")
      ).toThrow("Invalid BFR holdout assignment time");
    });

    it("accepts fractional seconds within the bound and canonicalizes them", () => {
      expect(
        bfrHoldoutAssignment("anon-1", "2026-08-24T12:00:00.123456789Z")
          .assignedAt
      ).toBe("2026-08-24T12:00:00.123Z");
    });

    it("rejects a missing timezone designator", () => {
      expect(() =>
        bfrHoldoutAssignment("anon-1", "2026-08-24T12:00:00")
      ).toThrow("Invalid BFR holdout assignment time");
    });
  });
});

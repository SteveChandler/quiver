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
});

import {
  BFR_HOLDOUT_EXPERIMENT_KEY,
  bfrHoldoutAssignment,
  experimentArm,
} from "@/lib/experiments/assignment-hash";

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
        bfrHoldoutAssignment(subjectId)
      );
      expect(new Set(assignments.map((assignment) => assignment.arm)).size).toBe(1);
      expect(assignments[0]).toEqual({
        experimentKey: BFR_HOLDOUT_EXPERIMENT_KEY,
        arm: expect.stringMatching(/^(holdout|treatment)$/),
      });
    }
  );
});

/** @jest-environment node */
import config from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { deriveSwellWatchHorizon, matchSwellWatchFrame } from "@/lib/alerts/swell-watch/horizon-derivation";
import { calculateSwellWatchPolicyHash, verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const start = Date.parse("2026-09-05T00:00:00Z");
function series() {
  return Array.from({ length: 144 }, (_, hour) => ["s1", "s2"].map((sourceSlot, index) => ({
    provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot: sourceSlot as "s1" | "s2",
    forecastAt: new Date(start + hour * 3_600_000).toISOString(), heightM: 0.3, periodS: index ? 13 : 9,
    directionDeg: index ? 170 : 260, completeness: "complete" as const,
  })));
}
function derive(value: ReturnType<typeof series>, policy: SwellWatchPolicy) {
  return deriveSwellWatchHorizon({ series: value, now: new Date(start).toISOString(), policy,
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 } });
}
function frame(values: Array<[number, number]>) {
  return values.map(([directionDeg, periodS], index) => ({ provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture",
    sourceSlot: index ? "s2" as const : "s1" as const, forecastAt: new Date(start).toISOString(), heightM: 0.3, directionDeg, periodS, completeness: "complete" as const }));
}

it("keeps legacy ambiguity suppression but selects the unique normalized winner", () => {
  const value = series();
  Object.assign(value[49][0], { periodS: 10.79, directionDeg: 267 });
  Object.assign(value[49][1], { periodS: 15.69, directionDeg: 244 });
  Object.assign(value[50][0], { periodS: 14.08, directionDeg: 242 });
  Object.assign(value[50][1], { periodS: 14.45, directionDeg: 269 });
  expect(() => derive(value, fixturePolicy as SwellWatchPolicy)).toThrow("ambiguous_partition_path");
  expect(derive(value, config.policy as SwellWatchPolicy).events).toEqual([]);
});

it("suppresses exact normalized ties without a source-slot tiebreak", () => {
  const value = series();
  for (const frame of [49, 50]) for (const part of value[frame]) Object.assign(part, { periodS: 10, directionDeg: 180 });
  expect(() => derive(value, config.policy as SwellWatchPolicy)).toThrow("ambiguous_partition_path");
});

it("orders cardinality, minimax, then sum without slot or height ties", () => {
  const policy = config.policy as SwellWatchPolicy;
  expect(matchSwellWatchFrame(frame([[0, 10], [20, 11.9]]).map((part) => [part]), frame([[0, 10], [20, 11.9]]), policy)).toEqual([0, 1]);
  expect(matchSwellWatchFrame(frame([[0, 10], [0, 10.5]]).map((part) => [part]), frame([[5, 10.5], [5, 11]]), policy)).toEqual([0, 1]);
  expect(matchSwellWatchFrame(frame([[0, 10], [0, 10.5]]).map((part) => [part]), frame([[0, 10], [10, 10.5]]), policy)).toEqual([0, 1]);
  expect(matchSwellWatchFrame(frame([[359, 10], [180, 12]]).map((part) => [part]), frame([[1, 10], [180, 12]]), policy)).toEqual([0, 1]);
  expect(matchSwellWatchFrame(frame([[0, 10], [20, 12]]).map((part) => [part]), frame([[20, 12], [0, 10]]), policy)).toEqual([1, 0]);
  expect(matchSwellWatchFrame(frame([[0, 10], [180, 12]]).map((part) => [part]), frame([[0, 10], [90, 20]]), policy)).toEqual([0, null]);
});

it("preserves physical matches when either component row order changes", () => {
  const previous = frame([[267, 10.79], [244, 15.69]]);
  const current = frame([[242, 14.08], [269, 14.45]]);
  for (const active of [previous, [...previous].reverse()]) {
    for (const next of [current, [...current].reverse()]) {
      const matches = matchSwellWatchFrame(active.map((part) => [part]), next, config.policy as SwellWatchPolicy);
      const physical = next.map((part, index) => ({ direction: part.directionDeg,
        predecessor: matches[index] === null ? null : active[matches[index]!].directionDeg }))
        .sort((left, right) => left.direction - right.direction);
      expect(physical).toEqual([{ direction: 242, predecessor: 244 }, { direction: 269, predecessor: null }]);
    }
  }
});

it("keeps the old hash/strict behavior and rejects unsupported versions", () => {
  expect(verifySwellWatchPolicy(fixturePolicy)).toBe(true);
  expect(verifySwellWatchPolicy(config.policy)).toBe(true);
  expect(config.policy.value_hash).toBe(calculateSwellWatchPolicyHash(config.policy as SwellWatchPolicy));
  expect(config.policy.value_hash).not.toBe(fixturePolicy.value_hash);
  expect(verifySwellWatchPolicy({ ...config.policy, policy_values: { ...config.policy.policy_values,
    partition_matching: { ...config.policy.policy_values.partition_matching, trajectory_assignment: "bad" } } })).toBe(false);
});

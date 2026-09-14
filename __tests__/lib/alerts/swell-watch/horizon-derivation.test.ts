/** @jest-environment node */
import config from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { deriveSwellWatchHorizon, matchSwellWatchFrame } from "@/lib/alerts/swell-watch/horizon-derivation";
import { calculateSwellWatchPolicyHash, verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

import { resolveNativeSamplingProfile } from "@/lib/alerts/swell-watch/native-sampling";
import { sourceIdentity, retainedSeries, waikiki } from "@/__tests__/helpers/swell-watch-retained";

const start = Date.parse("2026-09-05T00:00:00Z");
function series() {
  return Array.from({ length: 168 }, (_, hour) => ["s1", "s2"].map((sourceSlot, index) => ({
    provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot: sourceSlot as "s1" | "s2",
    forecastAt: new Date(start + hour * 3_600_000).toISOString(), heightM: 0.3, periodS: index ? 13 : 9,
    directionDeg: index ? 170 : 260, completeness: "complete" as const,
  })));
}
function derive(value: ReturnType<typeof series>, policy: SwellWatchPolicy) {
  return deriveSwellWatchHorizon({ series: value, now: new Date(start).toISOString(), policy,
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt: new Date(start).toISOString() },
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

const nativeInput = () => ({ series: retainedSeries(waikiki), now: waikiki.replayClockBounds[0],
  beach: waikiki.beach, policy: config.policy as SwellWatchPolicy,
  sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt: waikiki.issuedAt } });
it.each(waikiki.replayClockBounds)("closes the retained Waikiki rank-swap episode at %s", (now) => {
  const input = { ...nativeInput(), now };
  const before = structuredClone(input);
  const result = deriveSwellWatchHorizon(input);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ arrivalAt: "2026-09-18T18:00:00.000Z", peakAt: "2026-09-18T18:00:00.000Z",
    peakWindow: { earliestAt: "2026-09-18T18:00:00.000Z", latestAt: "2026-09-18T21:00:00.000Z" },
    arrivalWindow: { earliestAt: "2026-09-18T15:00:00.000Z", latestAt: "2026-09-18T18:00:00.000Z" },
    closureWindow: { earliestAt: "2026-09-20T00:00:00.000Z", latestAt: "2026-09-20T03:00:00.000Z" } });
  expect(result.derivation).toMatchObject({ version: "swell-watch-horizon-derivation.v2", nativeFrames: 136, interpolatedFrames: 32 });
  expect(input).toEqual(before);
});
it("recognizes the native rank swap that hourly interpolation broke", () => {
  const { series, policy } = nativeInput();
  expect(matchSwellWatchFrame(series[138].map((part) => [part]), series[141], policy)).toEqual([1, 0]);
  expect(matchSwellWatchFrame(series[138].map((part) => [part]), series[139], policy)).toEqual([null, null]);
  expect(() => deriveSwellWatchHorizon(nativeInput())).not.toThrow();
});
it("suppresses an onset bracket crossing the five-day boundary", () => {
  expect(() => deriveSwellWatchHorizon({ ...nativeInput(), now: "2026-09-13T16:00:00Z" })).toThrow("arrival_window_crosses_actionability");
});

function syntheticEpisode(from: number, to: number): ReturnType<typeof series> {
  const value = series();
  for (let i = from; i <= to; i++) value[i][1].heightM = i === from + 2 ? 2 : 1.5;
  return value;
}
it("reports hourly peak neighbours clipped to the episode", () => {
  const result = derive(syntheticEpisode(78, 84), config.policy as SwellWatchPolicy);
  const at = (hour: number): string => new Date(start + hour * 3_600_000).toISOString();
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ arrivalWindow: { earliestAt: at(77), latestAt: at(78) },
    peakAt: at(80), peakWindow: { earliestAt: at(79), latestAt: at(81) },
    closureWindow: { earliestAt: at(84), latestAt: at(85) } });
  const single = derive(syntheticEpisode(78, 78), config.policy as SwellWatchPolicy);
  expect(single.events[0].peakWindow).toEqual({ earliestAt: at(78), latestAt: at(78) });
});
it("suppresses an hourly onset bracket crossing the two-day boundary", () => {
  expect(() => deriveSwellWatchHorizon({ ...nativeInput(), series: syntheticEpisode(54, 60),
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt: new Date(start).toISOString() },
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 },
    now: new Date(start + 5.5 * 3_600_000).toISOString() })).toThrow("arrival_window_crosses_actionability");
});
it.each([[10, 15], [115, 119]])("drops an arrival window wholly outside actionability (%i..%i)", (from, to) => {
  const now = from === 115 ? new Date(start - 24 * 3_600_000).toISOString() : new Date(start).toISOString();
  expect(deriveSwellWatchHorizon({ ...nativeInput(), series: syntheticEpisode(from, to), now,
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt: new Date(start).toISOString() },
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 } }).events).toEqual([]);
});
it("preserves unclosed and unbounded track suppression", () => {
  const unclosed = syntheticEpisode(78, 167);
  // A constant native tail satisfies the height witness.
  expect(() => derive(unclosed, config.policy as SwellWatchPolicy)).toThrow("unclosed_episode");
  const bornCandidate = syntheticEpisode(78, 84);
  for (let i = 78; i <= 84; i++) bornCandidate[i][1].periodS = 20;
  expect(() => derive(bornCandidate, config.policy as SwellWatchPolicy)).toThrow("unbounded_episode");
});
it("preserves missing baseline and checks the native horizon end", () => {
  const value = series();
  for (const frame of value.slice(0, 48)) frame[1].directionDeg = 260;
  expect(() => derive(value, config.policy as SwellWatchPolicy)).toThrow("missing_baseline");
  expect(() => deriveSwellWatchHorizon({ ...nativeInput(), now: "2026-09-15T09:00:00Z" })).toThrow("incomplete_horizon");
});
it.each([139, 166, 167])("validates complete tuples on excluded hour %i", (i) => {
  const input = nativeInput();
  input.series[i][0].periodS = 0;
  expect(() => deriveSwellWatchHorizon(input)).toThrow("incomplete_partition");
});

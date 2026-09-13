/** @jest-environment node */
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { BeachTerrainConfig } from "@/lib/utils/wave-height-transformer";
import { deriveSwellWatchHorizon, matchSwellWatchFrame } from "@/lib/alerts/swell-watch/horizon-derivation";
import { selectGfsNativeFrames, GFS_NATIVE_SAMPLING_PROFILE, type NativeSamplingEvidence } from "@/lib/alerts/swell-watch/native-step-selection";
import type { SwellPartitionObservation } from "@/lib/alerts/swell-watch/partition-normalizer";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import config from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import { swellWatchNativeRetainedGzipBase64 } from "@/__tests__/fixtures/swell-watch-native-retained";
interface RetainedForecast {
  name: string;
  beach: BeachTerrainConfig & { swell_window_center_deg: number; swell_window_halfwidth_deg: number };
  semanticRevisionHash: string;
  semanticPayload: { hourly: { time: string[]; swell_wave_height: number[]; swell_wave_period: number[];
    swell_wave_direction: number[]; secondary_swell_wave_height: number[]; secondary_swell_wave_period: number[];
    secondary_swell_wave_direction: number[] } };
}
const { waikiki, hatteras } = JSON.parse(gunzipSync(Buffer.from(swellWatchNativeRetainedGzipBase64, "base64")).toString()) as {
  waikiki: RetainedForecast; hatteras: RetainedForecast;
};

const policy = config.policy as SwellWatchPolicy;
const issued = Date.parse("2026-09-13T12:00:00Z");
const at = (hour: number): string => new Date(issued + hour * 3_600_000).toISOString();
const sampling: NativeSamplingEvidence = { profile: GFS_NATIVE_SAMPLING_PROFILE,
  model: "ncep_gfswave016", transportProvider: "open_meteo_single_runs", issuedAt: at(0) };
function frames(fixture: typeof waikiki | typeof hatteras): SwellPartitionObservation[][] {
  const h = fixture.semanticPayload.hourly;
  return h.time.map((time, i) => ([
    [h.swell_wave_height[i], h.swell_wave_period[i], h.swell_wave_direction[i]],
    [h.secondary_swell_wave_height[i], h.secondary_swell_wave_period[i], h.secondary_swell_wave_direction[i]],
  ]).map(([heightM, periodS, directionDeg], slot) => ({ provider: "open_meteo", completeness: "complete",
    evaluationId: "genuine_completed:5a7ff0e2-b185-4488-8128-bff98dfd3f64", sourceSlot: slot ? "s2" : "s1",
    forecastAt: `${time}Z`, heightM, periodS, directionDeg: directionDeg === 360 ? 0 : directionDeg })));
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const series = frames(waikiki);
const input = (values = series, now = "2026-09-13T20:15:22.096815Z") => ({ series: values, now, policy, beach: waikiki.beach, sampling });
const synthetic = (first = 123, last = 149): SwellPartitionObservation[][] => series.map((frame, i) => frame.map((p, j) => ({
  ...p, heightM: j ? 0.2 : i >= first && i <= last ? 1.4 : 0.3,
  periodS: j ? 6 : 13, directionDeg: j ? 90 : 200,
})));

it.each([waikiki, hatteras])("matches the exact retained semantic hash for $name", (fixture) => {
  expect(createHash("sha256").update(stable(fixture.semanticPayload)).digest("hex")).toBe(fixture.semanticRevisionHash);
});
it("preserves the governing policy and matching tolerances", () => {
  expect(verifySwellWatchPolicy(policy)).toBe(true);
  expect(policy.value_hash).toBe("86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f");
  expect(policy.policy_values.partition_matching.maximum_period_delta_s).toBe(2);
  expect(policy.policy_values.partition_matching.maximum_direction_delta_deg).toBe(25);
});
it.each(["2026-09-13T20:15:22.096815Z", "2026-09-13T20:15:24.316666Z"])("reproduces and corrects the retained rank swap at %s without inventing exact timing", (now) => {
  expect(() => deriveSwellWatchHorizon({ ...input(series, now), sampling: undefined })).toThrow("unclosed_episode");
  const result = deriveSwellWatchHorizon(input(series, now));
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ arrivalAt: "2026-09-18T18:00Z", peakAt: "2026-09-18T18:00Z", confidence: null,
    nativeTiming: { arrivalAfter: "2026-09-18T15:00Z", arrivalAtOrBefore: "2026-09-18T18:00Z",
      closureAfter: "2026-09-20T00:00Z", closureAtOrBefore: "2026-09-20T03:00Z", peakKind: "maximum_native_sample" } });
  expect(result.sampling).toMatchObject({ profile: GFS_NATIVE_SAMPLING_PROFILE, retainedFrames: 168, trackingFrames: 136 });
  expect(result.events[0].impact.partition.forecastAt).toBe(result.events[0].peakAt);
});
it("matches the real native rank swap while the intermediate rank-wise interpolation breaks it", () => {
  expect(matchSwellWatchFrame(series[138].map((p) => [p]), series[139], policy)).toEqual([null, null]);
  expect(matchSwellWatchFrame(series[138].map((p) => [p]), series[141], policy)).toEqual([1, 0]);
});
it("identifies all native and provider-interpolated times without mutating evidence", () => {
  const before = JSON.stringify({ series, policy });
  const result = selectGfsNativeFrames(series, sampling);
  expect(result.frames).toHaveLength(136);
  expect(result.providerInterpolatedIndices).toHaveLength(32);
  expect(result.nativeIndices.slice(-3)).toEqual([159, 162, 165]);
  expect(result.providerInterpolatedIndices).toEqual(expect.arrayContaining([139, 140]));
  deriveSwellWatchHorizon(input());
  expect(JSON.stringify({ series, policy })).toBe(before);
});
it("keeps all Hatteras zero-fill tuples unavailable", () => {
  const values = frames(hatteras);
  expect(values.flat().filter((p) => p.heightM === 0 && p.periodS === 0 && p.directionDeg === 0)).toHaveLength(48);
  expect(() => selectGfsNativeFrames(values, sampling)).toThrow("incomplete_partition");
});
it.each([121, 139, 140, 166, 167])("does not hide unavailable evidence at untracked hour %i", (hour) => {
  const values = structuredClone(series);
  Object.assign(values[hour][1], { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
  expect(() => deriveSwellWatchHorizon(input(values))).toThrow("incomplete_partition");
});
it.each([["heightM", -1], ["heightM", NaN], ["periodS", 0], ["periodS", null], ["periodS", Infinity],
  ["directionDeg", 360], ["directionDeg", -1], ["directionDeg", "208"]])("rejects malformed %s=%p even at an interpolation point", (field, value) => {
  const values = structuredClone(series);
  Object.assign(values[139][0], { [field as string]: value });
  expect(() => selectGfsNativeFrames(values, sampling)).toThrow("invalid_component");
});
it.each(["ecmwf_wam", "ncep_gfswave025", null])("rejects unsupported native model %p", (model) => {
  expect(() => selectGfsNativeFrames(series, { ...sampling, model } as NativeSamplingEvidence)).toThrow("unsupported_native_sampling_evidence");
});
it.each(["2026-09-13T13:00Z", "invalid", undefined, null])("rejects invalid native issuance %p", (issuedAt) => {
  expect(() => selectGfsNativeFrames(series, { ...sampling, issuedAt } as NativeSamplingEvidence)).toThrow("invalid_native_sampling_issuance");
});
it.each(["remove", "duplicate_time", "slot", "identity"])("rejects corrupted evidence: %s", (kind) => {
  const values = structuredClone(series);
  if (kind === "remove") values.splice(139, 1);
  if (kind === "duplicate_time") values[139][0].forecastAt = values[138][0].forecastAt;
  if (kind === "slot") values[139][0].sourceSlot = "s2";
  if (kind === "identity") values[139][0].evaluationId = "different";
  expect(() => selectGfsNativeFrames(values, sampling)).toThrow(/incomplete_horizon|inconsistent_frame_evidence/);
});
it("accepts a wholly actionable onset interval, including its inclusive upper limit", () => {
  const result = deriveSwellWatchHorizon(input(synthetic(), at(3)));
  expect(result.events).toHaveLength(1);
  expect(result.events[0].nativeTiming).toMatchObject({ arrivalAfter: `${waikiki.semanticPayload.hourly.time[120]}Z`, arrivalAtOrBefore: `${waikiki.semanticPayload.hourly.time[123]}Z` });
});
it.each([[123, 149, 2], [57, 81, 8.5]])("suppresses an onset interval crossing an actionability edge (%i, %i, %f)", (first, last, nowHour) => {
  expect(() => deriveSwellWatchHorizon(input(synthetic(first, last), at(nowHour)))).toThrow("ambiguous_arrival_window");
});
it("does not turn a wholly nonactionable late onset into a candidate", () => {
  expect(deriveSwellWatchHorizon(input(synthetic(126, 149), at(0))).events).toEqual([]);
});
it("retains legitimate unclosed and unbounded episode suppression", () => {
  expect(() => deriveSwellWatchHorizon(input(synthetic(60, 167)))).toThrow("unclosed_episode");
  const values = synthetic(60, 81);
  for (let i = 60; i <= 81; i++) values[i][0].periodS = 18;
  expect(() => deriveSwellWatchHorizon(input(values))).toThrow("unbounded_episode");
});

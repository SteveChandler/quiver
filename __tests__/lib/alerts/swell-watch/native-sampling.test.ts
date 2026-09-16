/** @jest-environment node */
import { resolveNativeSamplingProfile, selectNativeFrames, verifyInterpolationWitness } from "@/lib/alerts/swell-watch/native-sampling";
import { sourceIdentity, retainedSeries, waikiki, hatteras, historical } from "@/__tests__/helpers/swell-watch-retained";

const profile = () => resolveNativeSamplingProfile(sourceIdentity);
it("binds sampling to every source identity field", () => {
  expect(profile()).toMatchObject({ id: "ncep_gfswave016.native-1h-to-120h-3h-to-168h.v1", witness: "provider-linear-interpolation.v1" });
  for (const [key, value] of Object.entries({ model: "other", transportProvider: "other", provider: "other", upstreamModelProvider: "other", forecastDays: 6 })) {
    expect(() => resolveNativeSamplingProfile({ ...sourceIdentity, [key]: value })).toThrow("unsupported_sampling_profile");
  }
  expect(() => resolveNativeSamplingProfile({ ...sourceIdentity, issuedAt: "2026-09-13T13:00Z" })).toThrow("invalid_sampling_issuance");
});
it("selects exact native indices and records one- and three-hour gaps", () => {
  const selection = selectNativeFrames(retainedSeries(waikiki), profile(), waikiki.issuedAt);
  const expected = Array.from({ length: 168 }, (_, i) => i).filter((i) => i <= 120 || i % 3 === 0);
  expect(selection.native.map((frame) => frame.index)).toEqual(expected);
  expect(selection.native).toHaveLength(136);
  expect(selection.interpolated).toEqual(Array.from({ length: 168 }, (_, i) => i).filter((i) => !expected.includes(i)));
  expect(selection.interpolated).toHaveLength(32);
  expect(selection.native[0]).toEqual({ index: 0, hoursSinceIssue: 0, gapHoursBefore: null });
  expect(selection.native[120]).toEqual({ index: 120, hoursSinceIssue: 120, gapHoursBefore: 1 });
  expect(selection.native[121]).toEqual({ index: 123, hoursSinceIssue: 123, gapHoursBefore: 3 });
});
it.each([139, 166, 167])("validates time even at excluded frame %i", (index) => {
  const series = retainedSeries(waikiki);
  series[index][1].forecastAt = series[index - 1][1].forecastAt;
  expect(() => selectNativeFrames(series, profile(), waikiki.issuedAt)).toThrow("inconsistent_frame_evidence");
});
it("rejects truncated hourly coverage", () => {
  expect(() => selectNativeFrames(retainedSeries(waikiki).slice(0, 167), profile(), waikiki.issuedAt)).toThrow("incomplete_horizon");
});
it("witnesses both retained payloads and every historical source", () => {
  const series = [retainedSeries(waikiki), retainedSeries(hatteras), ...historical.map(({ run }) =>
    run.samples.map((sample) => sample.components.map((part) => ({ ...part, sourceSlot: part.sourceSlot as "s1" | "s2", provider: "open_meteo" as const,
      evaluationId: run.source.evaluationId, forecastAt: sample.forecastAt, completeness: "complete" as const }))))];
  for (const frames of series) {
    expect(() => verifyInterpolationWitness(frames, selectNativeFrames(frames, profile(), frames[0][0].forecastAt))).not.toThrow();
  }
});
it.each(["directionDeg", "heightM"] as const)("rejects an interpolated %s witness violation", (field) => {
  const series = retainedSeries(waikiki);
  series[139][0][field] += field === "heightM" ? 0.05 : 5;
  expect(() => verifyInterpolationWitness(series, selectNativeFrames(series, profile(), waikiki.issuedAt))).toThrow("sampling_profile_mismatch");
});
it("accepts both arcs at the 180 degree tie, without checking nonlinear periods or unbracketed tail", () => {
  for (const middle of [[99, 159], [339, 279]]) {
    const series = retainedSeries(waikiki);
    [39, ...middle, 219].forEach((direction, i) => { series[120 + i][0].directionDeg = direction; });
    // Restore the following bracket to avoid changing its unrelated direction witness.
    [124, 125].forEach((i) => { series[i][0].directionDeg = 219 + (series[126][0].directionDeg - 219) * (i - 123) / 3; });
    series[121][0].periodS = 100;
    for (const i of [166, 167]) Object.assign(series[i][0], { directionDeg: 300, heightM: 100 });
    expect(() => verifyInterpolationWitness(series, selectNativeFrames(series, profile(), waikiki.issuedAt))).not.toThrow();
  }
});

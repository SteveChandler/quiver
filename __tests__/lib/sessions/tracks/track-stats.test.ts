import { heartRateStats, paddleDistanceM } from "@/lib/sessions/tracks/track-stats";
import { summarizeTrack, type TrackSummary } from "@/lib/sessions/tracks/summarize-track";
import type { NormalizedTrack, TrackSample } from "@/lib/sessions/tracks/types";

const time = (seconds: number): string => new Date(Date.UTC(2026, 9, 17) + seconds * 1000).toISOString();
const sample = (seconds: number, lon: number | null, hr: number | null = null): TrackSample => ({
  t: time(seconds), lat: lon === null ? null : 0, lon, hr, speedMps: null, tempC: null, cadence: null,
});
function trackWith(samples: TrackSample[]): NormalizedTrack {
  return {
    meta: { format: "fit", sport: "surfing", subSport: null, recordedBy: null, startedAt: samples[0].t, endedAt: samples.at(-1)!.t },
    samples,
  };
}
function span(track: NormalizedTrack, start: number, end: number): TrackSummary {
  return { ...summarizeTrack(track), inWaterStart: time(start), inWaterEnd: time(end) };
}

it("counts only in-water GPS distance and excludes ride windows without bridging across them", () => {
  const track = trackWith([sample(0, -0.01), sample(10, 0), sample(20, 0.001), sample(30, 0.002), sample(40, 0.003), sample(50, 0.01)]);
  expect(paddleDistanceM(track, span(track, 10, 40), [{ start: time(20), end: time(30) }])).toBeCloseTo(222.39, 2);
});

it("bridges a 20 s GPS gap and the 30 s boundary but skips a 45 s gap", () => {
  const track = trackWith([sample(0, 0), sample(10, null), sample(20, 0.001), sample(50, 0.002), sample(95, 0.003)]);
  expect(paddleDistanceM(track, span(track, 0, 95), [])).toBeCloseTo(222.39, 2);
});

it("does not count a GPS gap spanning a ride window", () => {
  const track = trackWith([sample(0, 0), sample(20, 0.001)]);
  expect(paddleDistanceM(track, span(track, 0, 20), [{ start: time(5), end: time(15) }])).toBe(0);
});

it("averages and rounds HR within the inclusive in-water span, including samples without GPS", () => {
  const track = trackWith([sample(0, 0, 240), sample(10, 0, 100), sample(20, null, 121), sample(30, 0, null), sample(40, 0, 120), sample(50, 0, 250)]);
  expect(heartRateStats(track, span(track, 10, 40))).toEqual({ avg: 114, max: 121 });
});

it("returns null when there is no in-water HR", () => {
  const track = trackWith([sample(0, 0, 100), sample(10, 0), sample(20, 0)]);
  expect(heartRateStats(track, span(track, 10, 20))).toBeNull();
});

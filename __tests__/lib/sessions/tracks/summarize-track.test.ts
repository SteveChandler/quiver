/** @jest-environment node */

import obFixture from "@/__tests__/fixtures/session-tracks/ob-2026-10-17.json";
import cardiffFixture from "@/__tests__/fixtures/session-tracks/cardiff-2026-10-03.json";
import { summarizeTrack } from "@/lib/sessions/tracks/summarize-track";
import { angleDiffDeg, bearingDeg, haversineM } from "@/lib/sessions/tracks/track-geometry";
import type { NormalizedTrack, TrackSample } from "@/lib/sessions/tracks/types";
import { TrackFileError } from "@/lib/sessions/tracks/types";

const START = Date.parse("2026-10-17T12:00:00.000Z");

function sample(second: number, lat: number | null, lon: number | null,
  speedMps: number | null = null, tempC: number | null = null): TrackSample {
  return { t: new Date(START + second * 1000).toISOString(), lat, lon, speedMps,
    tempC, hr: null, cadence: null };
}

function track(samples: TrackSample[]): NormalizedTrack {
  return { meta: { format: "fit", sport: "surfing", subSport: "generic", recordedBy: null,
    startedAt: samples[0].t, endedAt: samples.at(-1)!.t }, samples };
}

describe("track geometry", () => {
  it("measures distance, north bearing, and the shortest angular difference", () => {
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 })).toBeCloseTo(111.2, 0);
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0);
    expect(angleDiffDeg(350, 10)).toBe(20);
    expect(angleDiffDeg(10, 190)).toBe(180);
  });
});

describe("summarizeTrack", () => {
  it("summarizes the OB fixture's GPS coverage, gaps, speed trust, and water temperature", () => {
    const summary = summarizeTrack(obFixture.track as NormalizedTrack);
    expect(summary.gpsCoverage).toBeGreaterThan(0.40);
    expect(summary.gpsCoverage).toBeLessThan(0.55);
    expect(summary.maxGapS).toBeGreaterThanOrEqual(100);
    expect(summary.speedReliable).toBe(true);
    expect(summary.waterTempC).toBe(22);
    expect(summary.sampleCount).toBe(obFixture.track.samples.length);
    expect(summary.trackGeojson.type).toBe("LineString");
    expect(summary.trackGeojson.coordinates[0]).toHaveLength(2);
  });

  it("marks Cardiff open-water swimming speed as unreliable", () => {
    expect(summarizeTrack(cardiffFixture.track as NormalizedTrack).speedReliable).toBe(false);
  });

  it("rounds a sub-second GPX gap up to whole seconds for storage", () => {
    const input = track([sample(0, 37, -122), sample(0.25, 37.001, -122),
      sample(59.45, 37.0011, -122), sample(60, 37, -122)]);
    input.meta.format = "gpx";
    expect(summarizeTrack(input).maxGapS).toBe(60);
  });

  it("throws a no_gps TrackFileError when every sample lacks a position", () => {
    const input = track([sample(0, null, null), sample(1, null, null)]);
    expect(() => summarizeTrack(input)).toThrow(TrackFileError);
    expect(() => summarizeTrack(input)).toThrow(expect.objectContaining({
      code: "no_gps", message: "This file has no GPS track",
    }));
  });

  it("trims the first and last 180 seconds of a long span before taking the centroid", () => {
    const input = track([sample(0, 37, -122), sample(10, 37.001, -122.001),
      sample(20, 37.001, -122.001), sample(30, 37.001, -122.001),
      sample(200, 37.003, -122.003), sample(400, 37.005, -122.005),
      sample(600, 37.001, -122.001), sample(610, 37.001, -122.001),
      sample(620, 37, -122)]);
    const summary = summarizeTrack(input);
    expect(summary.inWaterStart).toBe(input.samples[1].t);
    expect(summary.inWaterEnd).toBe(input.samples[7].t);
    expect(summary.centroid.lat).toBeCloseTo(37.004, 6);
    expect(summary.centroid.lon).toBeCloseTo(-122.004, 6);
  });

  it("starts after the sand point when both ends are on the same sand point", () => {
    const samples = [sample(0, 37, -122), sample(1, null, null),
      sample(10, 37.001, -122), sample(20, 37.0011, -122), sample(30, 37, -122)];
    const summary = summarizeTrack(track(samples));
    expect(summary.inWaterStart).toBe(samples[2].t);
    expect(summary.inWaterEnd).toBe(samples[3].t);
    expect(summary.centroid).toEqual({ lat: 37.00105, lon: -122 });
    expect(summary.gpsCoverage).toBeCloseTo(2 / 11);
    expect(summary.trackGeojson.coordinates).toEqual([[-122, 37.001], [-122, 37.0011]]);
  });

  it("keeps wave-window fixes without changing any other summary field", () => {
    const samples = [sample(0, 37, -122), sample(1, 37.001, -122),
      sample(2, 37.0011, -122), sample(3, 37.0012, -122), sample(4, 37.0013, -122),
      sample(5, 37.0014, -122), sample(6, 37, -122)];
    const input = track(samples);
    const baseline = summarizeTrack(input);
    const kept = summarizeTrack(input, [{ start: samples[2].t, end: samples[4].t }]);
    expect(kept.trackGeojson.coordinates).toEqual([
      [-122, 37.001], [-122, 37.0011], [-122, 37.0012], [-122, 37.0013],
      [-122, 37.0014],
    ]);
    expect({ ...kept, trackGeojson: baseline.trackGeojson }).toEqual(baseline);
  });

  it("buckets recorded speeds and derives speed where only positions exist", () => {
    const samples = [sample(0, 37, -122), sample(1, 37.001, -122, 1),
      sample(2, 37.00101, -122, 3), sample(6, 37.00102, -122),
      sample(7, 37.00103, -122), sample(10, 37, -122)];
    const summary = summarizeTrack(track(samples));
    expect(summary.speedSeries[0]).toEqual({ t: new Date(START).toISOString(), mps: 2 });
    expect(summary.speedSeries[1].t).toBe(new Date(START + 5000).toISOString());
    expect(summary.speedSeries[1].mps).toBeGreaterThan(0);
  });
});

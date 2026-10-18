/** @jest-environment node */

import obFixture from "@/__tests__/fixtures/session-tracks/ob-2026-10-17.json";
import cardiffFixture from "@/__tests__/fixtures/session-tracks/cardiff-2026-10-03.json";
import { summarizeTrack, type TrackSummary } from "@/lib/sessions/tracks/summarize-track";
import type { NormalizedTrack, TrackSample } from "@/lib/sessions/tracks/types";
import { detectWaves, WAVE_DETECTION_VERSION, type DetectedWave, type DetectionBeach } from "@/lib/sessions/wave-detection/detect-waves";
import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import { performance } from "node:perf_hooks";

const START = Date.parse("2026-10-17T12:00:00.000Z");
const RIDE_STARTS = [180, 600, 1000, 1500];
const BEACH: DetectionBeach = { lat: 34, lon: -117, swellWindowCenterDeg: 180 };
const time = (second: number): string => new Date(START + second * 1000).toISOString();

function syntheticTrack(): NormalizedTrack {
  let lat = 33;
  const samples: TrackSample[] = Array.from({ length: 1801 }, (_, second) => {
    const riding = RIDE_STARTS.some((start) => second >= start && second < start + 8);
    const paddling = RIDE_STARTS.some((start) => second >= start - 10 && second < start);
    const speedMps = riding ? 4.5 : 0.3;
    lat += speedMps / 111_194.9266;
    return { t: time(second), lat, lon: -117, speedMps, cadence: paddling ? 30 : 0,
      hr: null, tempC: null };
  });
  return { meta: { format: "fit", sport: "surfing", subSport: "generic", recordedBy: null,
    startedAt: time(0), endedAt: time(1800) }, samples };
}

function fullSpan(track: NormalizedTrack): TrackSummary {
  return { ...summarizeTrack(track), inWaterStart: track.meta.startedAt, inWaterEnd: track.meta.endedAt };
}

function rampTrack(peakSeconds: number, tailSeconds: number = 0): NormalizedTrack {
  const track = syntheticTrack();
  let lat = 33;
  let lon = -117;
  track.samples = track.samples.map((sample, second) => {
    const paddleIn = second >= 180 && second < 188;
    const peak = second >= 188 && second < 188 + peakSeconds;
    const tail = second >= 188 + peakSeconds && second < 188 + peakSeconds + tailSeconds;
    const speedMps = peak ? 6 : paddleIn || tail ? 2 : 0.3;
    if (paddleIn) lon += speedMps / (111_194.9266 * Math.cos(lat * Math.PI / 180));
    else lat += speedMps / 111_194.9266;
    return { ...sample, lat, lon, speedMps, cadence: paddleIn ? 30 : 0 };
  });
  return track;
}

describe("detectWaves", () => {
  it("finds 2–4 counted OB rides", () => {
    const track = obFixture.track as NormalizedTrack;
    const waves = detectWaves(track, summarizeTrack(track), obFixture.beach);
    const counted: DetectedWave[] = waves.filter((wave) => wave.confidence >= COUNT_MIN_CONFIDENCE);
    expect(COUNT_MIN_CONFIDENCE).toBe(0.5);
    expect(counted.length).toBeGreaterThanOrEqual(2);
    expect(counted.length).toBeLessThanOrEqual(4);
  });

  it("contains the reported peak within the counted known OB good ride window", () => {
    const track = obFixture.track as NormalizedTrack;
    const waves = detectWaves(track, summarizeTrack(track), obFixture.beach);
    const reportedPeak = Date.parse("2026-10-17T16:04:17Z");
    // R20: onset came from speed-threshold analysis; the ride window must contain it.
    expect(waves.some((wave) => wave.confidence >= 0.5 && (wave.maxSpeedMps ?? 0) > 4.4
      && Date.parse(wave.startedAt) <= reportedPeak && Date.parse(wave.endedAt) >= reportedPeak)).toBe(true);
  });

  it("finds 5–9 Cardiff rides while withholding unreliable display speeds", () => {
    const track = cardiffFixture.track as NormalizedTrack;
    const summary = summarizeTrack(track);
    const waves = detectWaves(track, summary, cardiffFixture.beach);
    const counted = waves.filter((wave) => wave.confidence >= 0.5);
    expect(summary.speedReliable).toBe(false);
    expect(counted.length).toBeGreaterThanOrEqual(5);
    expect(counted.length).toBeLessThanOrEqual(9);
    for (const wave of waves) {
      expect(wave.maxSpeedMps).toBeNull();
      expect(wave.avgSpeedMps).toBeNull();
    }
  });

  it("locates exactly four injected rides and reports their geometry and cadence confidence", () => {
    const track = syntheticTrack();
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(WAVE_DETECTION_VERSION).toBe("wd-1.0.0");
    expect(waves).toHaveLength(4);
    waves.forEach((wave, index) => {
      expect(wave.index).toBe(index);
      expect(Math.abs(Date.parse(wave.startedAt) - Date.parse(time(RIDE_STARTS[index])))).toBeLessThanOrEqual(2000);
      expect(Math.abs(Date.parse(wave.endedAt) - Date.parse(time(RIDE_STARTS[index] + 8)))).toBeLessThanOrEqual(2000);
      expect(wave.durationS).toBe((Date.parse(wave.endedAt) - Date.parse(wave.startedAt)) / 1000);
      expect(wave.distanceM).toBeGreaterThan(25);
      expect(wave.distanceM).toBeLessThan(40);
      expect(wave.maxSpeedMps).toBe(4.5);
      expect(wave.avgSpeedMps).toBeCloseTo(4.5);
      expect(wave.headingDeg).toBeCloseTo(0);
      expect(wave.end.lat).toBeGreaterThan(wave.start.lat);
      expect(wave.confidence).toBeCloseTo(1);
    });
  });

  it.each(["missing samples", "missing fixes"])("never crosses a 110-second GPS gap with %s", (mode) => {
    const track = syntheticTrack();
    track.samples = track.samples.flatMap((sample, index) => {
      if (index < 184 || index >= 294) return [sample];
      return mode === "missing samples" ? [] : [{ ...sample, lat: null, lon: null }];
    });
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves.length).toBeGreaterThanOrEqual(3);
    expect(waves.some((wave) => Date.parse(wave.startedAt) < Date.parse(time(294))
      && Date.parse(wave.endedAt) > Date.parse(time(183)))).toBe(false);
    expect(waves.filter((wave) => Date.parse(wave.startedAt) >= Date.parse(time(600)))).toHaveLength(3);
  });

  it("returns no rides for sand-only fixes with no swell window", () => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample) => ({ ...sample, lat: 33, lon: -117 }));
    expect(detectWaves(track, summarizeTrack(track), { ...BEACH, lat: 33, swellWindowCenterDeg: null })).toEqual([]);
  });

  it("uses the centroid-to-beach bearing when the swell window is null", () => {
    const track = syntheticTrack();
    const summary = fullSpan(track);
    const shoreward = detectWaves(track, summary, { ...BEACH, swellWindowCenterDeg: null });
    const offshore = detectWaves(track, summary, { ...BEACH, lat: 32, swellWindowCenterDeg: null });
    expect(shoreward).toHaveLength(4);
    expect(offshore).toHaveLength(4);
    shoreward.forEach((wave, index) => {
      expect(wave.confidence).toBeCloseTo(1);
      expect(offshore[index].confidence).toBeCloseTo(0.3);
    });
  });

  it.each(["all", "before", "during"])("does not award a paddling bonus for null cadence %s the ride", (period) => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample) => ({ ...sample,
      cadence: period === "all" || (period === "before" ? sample.cadence === 30 : sample.cadence === 0)
        ? null : sample.cadence }));
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    for (const wave of waves) expect(wave.confidence).toBeCloseTo(0.9);
  });

  it("derives absent speeds from positions", () => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample) => ({ ...sample, speedMps: null }));
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    for (const wave of waves) expect(wave.maxSpeedMps).toBeCloseTo(4.5, 3);
  });

  it("drops candidates outside the in-water span", () => {
    const track = syntheticTrack();
    const waves = detectWaves(track, { ...fullSpan(track), inWaterStart: time(500), inWaterEnd: time(1200) }, BEACH);
    expect(waves).toHaveLength(2);
    expect(waves.map((wave) => wave.index)).toEqual([0, 1]);
    for (const wave of waves) {
      expect(Date.parse(wave.startedAt)).toBeGreaterThanOrEqual(Date.parse(time(500)));
      expect(Date.parse(wave.endedAt)).toBeLessThanOrEqual(Date.parse(time(1200)));
    }
  });

  it("rejects a one-fix teleport and a one-sample speed spike", () => {
    const track = syntheticTrack();
    track.samples[400] = { ...track.samples[400], lat: 35, speedMps: 100 };
    track.samples[800] = { ...track.samples[800], speedMps: 10 };
    track.samples[184] = { ...track.samples[184], speedMps: 10 };
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    expect(waves.every((wave) => wave.maxSpeedMps === 4.5)).toBe(true);
  });

  it.each([1001, 1003, 1005])("preserves the whole ride after rejecting a teleport at second %i", (second) => {
    const track = syntheticTrack();
    track.samples[second] = { ...track.samples[second], lat: 35 };
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    expect(Math.abs(Date.parse(waves[2].startedAt) - Date.parse(time(1000)))).toBeLessThanOrEqual(2000);
    expect(Math.abs(Date.parse(waves[2].endedAt) - Date.parse(time(1008)))).toBeLessThanOrEqual(2000);
    expect(waves[2].distanceM).toBeGreaterThan(25);
    expect(waves[2].distanceM).toBeLessThan(40);
  });

  it.each([5500, 110_000])("recovers after the first fix is displaced by %i meters", (distanceM) => {
    const track = syntheticTrack();
    track.samples[0] = { ...track.samples[0], lat: track.samples[0].lat! + distanceM / 111_194.9266 };
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    waves.forEach((wave, index) => {
      expect(Math.abs(Date.parse(wave.startedAt) - Date.parse(time(RIDE_STARTS[index])))).toBeLessThanOrEqual(2000);
      expect(Math.abs(Date.parse(wave.endedAt) - Date.parse(time(RIDE_STARTS[index] + 8)))).toBeLessThanOrEqual(2000);
    });
  });

  it("trims paddle-in from every ride metric and uses cadence before the trimmed start", () => {
    const track = rampTrack(6, 2);
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(1);
    expect(waves[0]).toMatchObject({
      startedAt: time(188), endedAt: time(195), durationS: 7,
      start: { lat: track.samples[188].lat, lon: track.samples[188].lon },
      end: { lat: track.samples[195].lat, lon: track.samples[195].lon },
      maxSpeedMps: 6, confidence: 1,
    });
    expect(waves[0].distanceM).toBeCloseTo(34, 2);
    expect(waves[0].avgSpeedMps).toBeCloseTo(34 / 7);
    expect(waves[0].headingDeg).toBeCloseTo(0);
  });

  it("does not earn the duration confidence bonus from paddle-in", () => {
    const track = rampTrack(4);
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(1);
    expect(waves[0]).toMatchObject({ startedAt: time(188), endedAt: time(191), durationS: 3,
      maxSpeedMps: 6, confidence: 0.8 });
  });

  it("includes the 10-second cadence boundary and the ride's last cadence sample", () => {
    const track = rampTrack(4);
    track.samples = track.samples.map((sample, second) => ({ ...sample,
      cadence: second === 178 ? 11 : second >= 188 && second <= 191 ? 0 : null }));
    const summary = fullSpan(track);
    const waves = detectWaves(track, summary, BEACH);
    expect(waves).toHaveLength(1);
    expect(waves[0].confidence).toBe(0.8);
    track.samples[191].cadence = 30;
    const stillPaddling = detectWaves(track, summary, BEACH);
    expect(stillPaddling).toHaveLength(1);
    expect(stillPaddling[0].confidence).toBe(0.7);
  });

  it.each([[180, 0.9], [0, 0.27]])("rounds persisted confidence with swell-window bearing %i", (window, confidence) => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample) => ({ ...sample, cadence: null }));
    const waves = detectWaves(track, fullSpan(track), { ...BEACH, swellWindowCenterDeg: window });
    expect(waves).toHaveLength(4);
    for (const wave of waves) expect(wave.confidence).toBe(confidence);
  });

  it("processes 20k samples and over 2,000 candidate bursts in under 1,500 ms", () => {
    const track = syntheticTrack();
    let lat = 33;
    track.samples = Array.from({ length: 20_000 }, (_, second) => {
      const riding = second % 9 < 4;
      const speedMps = riding ? 4.5 : 0.3;
      lat += speedMps / 111_194.9266;
      return { t: time(second), lat, lon: -117, speedMps, cadence: riding ? 0 : 30,
        hr: null, tempC: null };
    });
    track.meta.endedAt = time(19_999);
    const summary = fullSpan(track);
    const started = performance.now();
    const waves = detectWaves(track, summary, BEACH);
    const elapsedMs = performance.now() - started;
    expect(waves).toHaveLength(2222);
    expect(elapsedMs).toBeLessThan(1500);
  });

  it("uses the swell-window bearing even when the beach bearing disagrees", () => {
    const track = syntheticTrack();
    const waves = detectWaves(track, fullSpan(track), { ...BEACH, swellWindowCenterDeg: 0 });
    expect(waves).toHaveLength(4);
    for (const wave of waves) expect(wave.confidence).toBeCloseTo(0.3);
  });

  it("keeps sustained low-peak candidates with base confidence", () => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample) => ({ ...sample,
      speedMps: sample.speedMps === 4.5 ? 2 : 0.3, cadence: null }));
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(4);
    for (const wave of waves) expect(wave.confidence).toBe(0.7);
  });

  it("rejects bursts that never meet the start hold", () => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample, second) => ({ ...sample,
      speedMps: RIDE_STARTS.some((start) => second >= start && second < start + 3) ? 4.5 : 0.3 }));
    expect(detectWaves(track, fullSpan(track), BEACH)).toEqual([]);
  });

  it("requires the end hold before splitting a ride", () => {
    const track = syntheticTrack();
    track.samples = track.samples.map((sample, second) => ({ ...sample, speedMps:
      second >= 180 && second <= 210 && !(second >= 190 && second <= 191) ? 4.5 : 0.3 }));
    const waves = detectWaves(track, fullSpan(track), BEACH);
    expect(waves).toHaveLength(1);
    expect(waves[0].startedAt).toBe(time(180));
    expect(waves[0].endedAt).toBe(time(210));

    track.samples[192].speedMps = 0.3;
    const split = detectWaves(track, fullSpan(track), BEACH);
    expect(split).toHaveLength(2);
    expect(split[0].endedAt).toBe(time(189));
    expect(split[1].startedAt).toBe(time(193));
  });

  it("drops whole rides that straddle the in-water boundaries", () => {
    const track = syntheticTrack();
    const waves = detectWaves(track, { ...fullSpan(track), inWaterStart: time(183), inWaterEnd: time(1504) }, BEACH);
    expect(waves).toHaveLength(2);
    expect(waves.map((wave) => wave.startedAt)).toEqual([time(600), time(1000)]);
  });

  it("returns no candidates when there are no usable fixes", () => {
    const track = syntheticTrack();
    const summary = fullSpan(track);
    expect(detectWaves({ ...track, samples: [] }, summary, BEACH)).toEqual([]);
    expect(detectWaves({ ...track, samples: track.samples.map((sample) => ({ ...sample, lat: null, lon: null })) },
      summary, BEACH)).toEqual([]);
  });

  it("is deterministic, time ordered, and does not mutate inputs", () => {
    const track = syntheticTrack();
    track.samples.reverse();
    const summary = fullSpan(track);
    const before = JSON.stringify({ track, summary, beach: BEACH });
    const first = detectWaves(track, summary, BEACH);
    expect(first).toHaveLength(4);
    expect(detectWaves(track, summary, BEACH)).toEqual(first);
    expect(JSON.stringify({ track, summary, beach: BEACH })).toBe(before);
    expect(first.map((wave) => wave.index)).toEqual([0, 1, 2, 3]);
    expect(first.map((wave) => wave.startedAt)).toEqual(first.map((wave) => wave.startedAt).sort());
  });
});

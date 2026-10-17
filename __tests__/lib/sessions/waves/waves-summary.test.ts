/** @jest-environment node */

import { buildWavesSummary, isExcluded, type StoredWave } from "@/lib/sessions/waves/waves-summary";

const time = (second: number): string => new Date(Date.parse("2026-10-17T12:00:00Z") + second * 1000).toISOString();

function wave(id: string, startS: number, durationS: number, overrides: Partial<StoredWave> = {}): StoredWave {
  return {
    id, index: Number(id), startedAt: time(startS), endedAt: time(startS + durationS),
    durationS, distanceM: 40, maxSpeedMps: 5, avgSpeedMps: 3,
    start: { lat: 33, lon: -117 }, end: { lat: 33.001, lon: -117 },
    headingDeg: 0, confidence: 0.8, ...overrides,
  };
}

describe("isExcluded", () => {
  const ride = wave("1", 0, 20);

  it("excludes exactly 50% overlap, including corrections that extend beyond the ride", () => {
    expect(isExcluded(ride, [{ startedAt: time(-10), endedAt: time(10) }])).toBe(true);
    expect(isExcluded(ride, [{ startedAt: time(10), endedAt: time(30) }])).toBe(true);
  });

  it("uses the union of corrections without double counting", () => {
    expect(isExcluded(ride, [
      { startedAt: time(0), endedAt: time(6) },
      { startedAt: time(4), endedAt: time(9) },
    ])).toBe(false);
    expect(isExcluded(ride, [
      { startedAt: time(0), endedAt: time(6) },
      { startedAt: time(4), endedAt: time(10) },
    ])).toBe(true);
  });
});

describe("buildWavesSummary", () => {
  const waves = [
    wave("1", 0, 20, { maxSpeedMps: 5 }),
    wave("2", 30, 30, { distanceM: 80, maxSpeedMps: 8 }),
    wave("3", 70, 40, { maxSpeedMps: 12, confidence: 0.49 }),
    wave("4", 120, 50, { maxSpeedMps: 15 }),
  ];
  const corrections = [{ startedAt: time(120), endedAt: time(145) }];

  it("counts eligible waves and uses the user's count for the headline", () => {
    expect(buildWavesSummary(waves, corrections, {
      gpsCoverage: 0.49, speedReliable: true, userWaveCount: 7,
    }, "wd-1.0.0")).toEqual({
      waveCount: 7, detectedWaveCount: 2, userWaveCount: 7,
      longestRideS: 30, longestRideM: 80, topSpeedMps: 8,
      gpsCoverage: 0.49, lowCoverage: true, speedReliable: true,
      detectionVersion: "wd-1.0.0",
    });
  });

  it("falls back to the detected count and hides speed when unreliable", () => {
    expect(buildWavesSummary(waves, corrections, {
      gpsCoverage: 0.5, speedReliable: false, userWaveCount: null,
    }, "wd-1.0.0")).toEqual({
      waveCount: 2, detectedWaveCount: 2, userWaveCount: null,
      longestRideS: 30, longestRideM: 80, topSpeedMps: null,
      gpsCoverage: 0.5, lowCoverage: false, speedReliable: false,
      detectionVersion: "wd-1.0.0",
    });
  });

  it("returns null ride metrics for no counted waves", () => {
    expect(buildWavesSummary([], [], {
      gpsCoverage: 0, speedReliable: true, userWaveCount: 0,
    }, "wd-1.0.0")).toMatchObject({
      waveCount: 0, detectedWaveCount: 0, longestRideS: null,
      longestRideM: null, topSpeedMps: null,
    });
  });

  it("counts a wave at exactly the confidence threshold", () => {
    expect(buildWavesSummary([wave("5", 0, 10, { confidence: 0.5 })], [], {
      gpsCoverage: 1, speedReliable: true, userWaveCount: null,
    }, "wd-1.0.0").detectedWaveCount).toBe(1);
  });
});

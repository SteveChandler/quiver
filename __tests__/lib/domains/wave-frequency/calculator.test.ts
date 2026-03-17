/**
 * Unit tests for the rideable wave frequency calculator.
 *
 * Covers all seven algorithm steps plus integration scenarios and edge cases.
 */

import { calculateRideableWaves } from "@/lib/domains/wave-frequency/calculator";
import type { WaveFrequencyInput } from "@/lib/domains/wave-frequency/types";
import {
  BREAK_TYPE_FACTORS,
  DEFAULT_BREAK_TYPE_FACTOR,
  DEFAULT_RIDEABLE_THRESHOLD,
  DEFAULT_SWELL_ACCESS_FACTOR,
  MAX_RIDEABLE_WAVES_PER_HOUR,
  WIND_PENALTY_FLOOR,
  WIND_PENALTY_DIVISOR,
  WIND_SWELL_PERIOD_THRESHOLD,
  MIN_SET_INTERVAL_S,
  MAX_SET_INTERVAL_S,
  MIN_WAVES_PER_SET,
  MAX_WAVES_PER_SET,
} from "@/lib/domains/wave-frequency/constants";

/** Baseline input with sane defaults — override fields per test */
function makeInput(overrides: Partial<WaveFrequencyInput> = {}): WaveFrequencyInput {
  return {
    dominantPeriodS: 12,
    swell1PeriodS: null,
    swell2PeriodS: null,
    swell1DirectionDeg: null,
    waveHeightFt: 4,
    windSpeedKts: 0,
    windDirectionDeg: null,
    breakType: "beach",
    aspectDeg: 270,
    swellAccessFactors: null,
    ...overrides,
  };
}

describe("calculateRideableWaves", () => {
  // ───────────────────────────────────────────────────────────────
  // Step 0: Period guard
  // ───────────────────────────────────────────────────────────────
  describe("Step 0: Period guard", () => {
    it("returns 0 when dominant period is null", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: null }));
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("returns 0 when dominant period is zero", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 0 }));
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("returns 0 when dominant period is negative", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: -5 }));
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("returns zero factors when period is invalid", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: null }));
      expect(result.factors.baseFrequency).toBe(0);
      expect(result.factors.breakTypeFactor).toBe(0);
      expect(result.factors.shortPeriodPenalty).toBe(0);
      expect(result.factors.swellAccessFactor).toBe(0);
      expect(result.factors.windPenalty).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 1: Height gate
  // ───────────────────────────────────────────────────────────────
  describe("Step 1: Height gate", () => {
    it("returns 0 when wave height is below beach threshold (2.0ft)", () => {
      const result = calculateRideableWaves(
        makeInput({ breakType: "beach", waveHeightFt: 1.5 }),
      );
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("returns 0 when wave height is below reef threshold (2.5ft)", () => {
      const result = calculateRideableWaves(
        makeInput({ breakType: "reef", waveHeightFt: 2.0 }),
      );
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("returns non-zero when wave height meets beach threshold", () => {
      const result = calculateRideableWaves(
        makeInput({ breakType: "beach", waveHeightFt: 2.0 }),
      );
      expect(result.rideableWavesPerHour).toBeGreaterThan(0);
    });

    it("returns non-zero when wave height meets reef threshold", () => {
      const result = calculateRideableWaves(
        makeInput({ breakType: "reef", waveHeightFt: 2.5 }),
      );
      expect(result.rideableWavesPerHour).toBeGreaterThan(0);
    });

    it("returns 0 when wave height is null", () => {
      const result = calculateRideableWaves(makeInput({ waveHeightFt: null }));
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("uses default threshold (2.0) for unknown break type", () => {
      // 1.9ft is below the default 2.0 threshold
      const below = calculateRideableWaves(
        makeInput({ breakType: "jetty", waveHeightFt: 1.9 }),
      );
      expect(below.rideableWavesPerHour).toBe(0);

      // 2.0ft meets the default threshold
      const at = calculateRideableWaves(
        makeInput({ breakType: "jetty", waveHeightFt: 2.0 }),
      );
      expect(at.rideableWavesPerHour).toBeGreaterThan(0);
    });

    it("uses default threshold when break type is null", () => {
      const below = calculateRideableWaves(
        makeInput({ breakType: null, waveHeightFt: 1.9 }),
      );
      expect(below.rideableWavesPerHour).toBe(0);

      const at = calculateRideableWaves(
        makeInput({ breakType: null, waveHeightFt: 2.0 }),
      );
      expect(at.rideableWavesPerHour).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 2: Base frequency
  // ───────────────────────────────────────────────────────────────
  describe("Step 2: Base frequency", () => {
    it("single swell: base = 3600 / period (e.g., 10s -> 360)", () => {
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 10, swell1PeriodS: null, swell2PeriodS: null }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 10);
    });

    it("single swell: base = 3600 / period (e.g., 12s -> 300)", () => {
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 12, swell1PeriodS: null, swell2PeriodS: null }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 12);
    });

    it("multi-swell: uses beat frequency formula with known values", () => {
      // T1=14, T2=9, |T1-T2|=5 >= 1.0 (MIN_PERIOD_DIFFERENCE)
      // setInterval = clamp((14*9)/5, 60, 600) = clamp(25.2, 60, 600) = 60
      // wavesPerSet = clamp(round(14/9), 2, 7) = clamp(round(1.556), 2, 7) = clamp(2, 2, 7) = 2
      // baseFrequency = (3600/60) * 2 = 120
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 12, swell1PeriodS: 14, swell2PeriodS: 9 }),
      );
      expect(result.factors.baseFrequency).toBe(120);
    });

    it("multi-swell: falls back to single swell when periods within 1.0s", () => {
      // T1=12, T2=11.5, |T1-T2|=0.5 < 1.0 (MIN_PERIOD_DIFFERENCE)
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 12, swell1PeriodS: 12, swell2PeriodS: 11.5 }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 12);
    });

    it("multi-swell: falls back to single swell when periods are equal", () => {
      // T1=10, T2=10, |T1-T2|=0 < 1.0 (MIN_PERIOD_DIFFERENCE)
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 10, swell1PeriodS: 10, swell2PeriodS: 10 }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 10);
    });

    it("multi-swell: falls back to single when swell2 is null", () => {
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 10, swell1PeriodS: 14, swell2PeriodS: null }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 10);
    });

    it("multi-swell: falls back to single when swell1 is null", () => {
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 10, swell1PeriodS: null, swell2PeriodS: 9 }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 10);
    });

    it("multi-swell: falls back to single when swell1 is zero", () => {
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 10, swell1PeriodS: 0, swell2PeriodS: 9 }),
      );
      expect(result.factors.baseFrequency).toBe(3600 / 10);
    });

    it("multi-swell: set interval is clamped to MIN_SET_INTERVAL_S", () => {
      // T1=14, T2=9: raw setInterval = (14*9)/5 = 25.2 -> clamped to 60
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 12, swell1PeriodS: 14, swell2PeriodS: 9 }),
      );
      // If setInterval were unclamped (25.2), base would be (3600/25.2)*2 = 285.7
      // With clamping to 60, base = (3600/60)*2 = 120
      expect(result.factors.baseFrequency).toBe(120);
    });

    it("multi-swell: large period difference produces higher set interval", () => {
      // T1=18, T2=8, diff=10
      // setInterval = clamp((18*8)/10, 60, 600) = clamp(14.4, 60, 600) = 60
      // wavesPerSet = clamp(round(18/8), 2, 7) = clamp(round(2.25), 2, 7) = clamp(2, 2, 7) = 2
      // baseFrequency = (3600/60) * 2 = 120
      const result = calculateRideableWaves(
        makeInput({ dominantPeriodS: 14, swell1PeriodS: 18, swell2PeriodS: 8 }),
      );
      expect(result.factors.baseFrequency).toBe(120);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 3: Break type factor
  // ───────────────────────────────────────────────────────────────
  describe("Step 3: Break type factor", () => {
    it("beach break uses 0.15 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: "beach" }));
      expect(result.factors.breakTypeFactor).toBe(BREAK_TYPE_FACTORS["beach"]);
      expect(result.factors.breakTypeFactor).toBe(0.15);
    });

    it("point break uses 0.08 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: "point" }));
      expect(result.factors.breakTypeFactor).toBe(BREAK_TYPE_FACTORS["point"]);
      expect(result.factors.breakTypeFactor).toBe(0.08);
    });

    it("reef break uses 0.10 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: "reef" }));
      expect(result.factors.breakTypeFactor).toBe(BREAK_TYPE_FACTORS["reef"]);
      expect(result.factors.breakTypeFactor).toBe(0.1);
    });

    it("river break uses 0.08 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: "river" }));
      expect(result.factors.breakTypeFactor).toBe(BREAK_TYPE_FACTORS["river"]);
      expect(result.factors.breakTypeFactor).toBe(0.08);
    });

    it("null break type uses default 0.12 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: null }));
      expect(result.factors.breakTypeFactor).toBe(DEFAULT_BREAK_TYPE_FACTOR);
      expect(result.factors.breakTypeFactor).toBe(0.12);
    });

    it("unknown break type ('jetty') uses default 0.12 factor", () => {
      const result = calculateRideableWaves(makeInput({ breakType: "jetty" }));
      expect(result.factors.breakTypeFactor).toBe(DEFAULT_BREAK_TYPE_FACTOR);
      expect(result.factors.breakTypeFactor).toBe(0.12);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 4: Short period penalty
  // ───────────────────────────────────────────────────────────────
  describe("Step 4: Short period penalty", () => {
    it("period 6s produces penalty of 0.75 (6/8)", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 6 }));
      expect(result.factors.shortPeriodPenalty).toBeCloseTo(6 / WIND_SWELL_PERIOD_THRESHOLD, 10);
      expect(result.factors.shortPeriodPenalty).toBeCloseTo(0.75, 10);
    });

    it("period 4s produces penalty of 0.50 (4/8)", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 4 }));
      expect(result.factors.shortPeriodPenalty).toBeCloseTo(0.5, 10);
    });

    it("period 8s produces penalty of 1.0 (threshold boundary, no penalty)", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 8 }));
      expect(result.factors.shortPeriodPenalty).toBe(1.0);
    });

    it("period 12s produces penalty of 1.0 (above threshold)", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 12 }));
      expect(result.factors.shortPeriodPenalty).toBe(1.0);
    });

    it("period 7s produces penalty of 0.875 (7/8)", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: 7 }));
      expect(result.factors.shortPeriodPenalty).toBeCloseTo(0.875, 10);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 5: Swell access
  // ───────────────────────────────────────────────────────────────
  describe("Step 5: Swell access factor", () => {
    it("uses bin lookup with valid 72-element access factors array", () => {
      // swell1DirectionDeg=270 => bin = round(270/5) % 72 = 54
      const accessFactors = new Array(72).fill(0.5);
      accessFactors[54] = 0.95;

      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );
      expect(result.factors.swellAccessFactor).toBe(0.95);
    });

    it("falls back to default 0.7 when access factors is null", () => {
      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: 270,
          swellAccessFactors: null,
        }),
      );
      expect(result.factors.swellAccessFactor).toBe(DEFAULT_SWELL_ACCESS_FACTOR);
      expect(result.factors.swellAccessFactor).toBe(0.7);
    });

    it("falls back to default 0.7 when access factors has wrong length", () => {
      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: 270,
          swellAccessFactors: [0.9, 0.8, 0.7], // only 3 elements, not 72
        }),
      );
      expect(result.factors.swellAccessFactor).toBe(DEFAULT_SWELL_ACCESS_FACTOR);
    });

    it("falls back to default 0.7 when swell1DirectionDeg is null", () => {
      const accessFactors = new Array(72).fill(0.95);
      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: null,
          swellAccessFactors: accessFactors,
        }),
      );
      expect(result.factors.swellAccessFactor).toBe(DEFAULT_SWELL_ACCESS_FACTOR);
    });

    it("handles direction at 0 degrees (bin 0)", () => {
      const accessFactors = new Array(72).fill(0.5);
      accessFactors[0] = 0.88;

      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: 0,
          swellAccessFactors: accessFactors,
        }),
      );
      expect(result.factors.swellAccessFactor).toBe(0.88);
    });

    it("handles direction at 360 degrees (wraps to bin 0)", () => {
      const accessFactors = new Array(72).fill(0.5);
      accessFactors[0] = 0.88;

      const result = calculateRideableWaves(
        makeInput({
          swell1DirectionDeg: 360,
          swellAccessFactors: accessFactors,
        }),
      );
      // round(360/5) % 72 = 72 % 72 = 0
      expect(result.factors.swellAccessFactor).toBe(0.88);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 6: Wind penalty
  // ───────────────────────────────────────────────────────────────
  describe("Step 6: Wind penalty", () => {
    it("offshore wind has no penalty (windPenalty = 1.0)", () => {
      // Wind from 90 (east), aspect 270 (facing west)
      // cos(toRad(90 - 270)) = cos(toRad(-180)) = cos(pi) = -1 (offshore)
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 10,
          windDirectionDeg: 90,
          aspectDeg: 270,
        }),
      );
      expect(result.factors.windPenalty).toBe(1.0);
    });

    it("light onshore produces moderate penalty", () => {
      // Wind from 270 (west), aspect 270 (facing west)
      // cos(toRad(270 - 270)) = cos(0) = 1 (directly onshore)
      // windPenalty = max(0.3, 1 - (5 * 1) / 30) = max(0.3, 0.833) = 0.833
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 5,
          windDirectionDeg: 270,
          aspectDeg: 270,
        }),
      );
      const expected = Math.max(WIND_PENALTY_FLOOR, 1 - (5 * 1) / WIND_PENALTY_DIVISOR);
      expect(result.factors.windPenalty).toBeCloseTo(expected, 10);
      expect(result.factors.windPenalty).toBeCloseTo(1 - 5 / 30, 10);
    });

    it("strong onshore (15kt+) produces heavy penalty clamped to floor", () => {
      // Wind from 270 (west), aspect 270 (facing west)
      // cos(0) = 1, penalty = max(0.3, 1 - (25 * 1) / 30) = max(0.3, -0.167) = 0.3
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 25,
          windDirectionDeg: 270,
          aspectDeg: 270,
        }),
      );
      expect(result.factors.windPenalty).toBe(WIND_PENALTY_FLOOR);
      expect(result.factors.windPenalty).toBe(0.3);
    });

    it("15kt onshore exactly", () => {
      // cos(0) = 1, penalty = max(0.3, 1 - (15 * 1)/30) = max(0.3, 0.5) = 0.5
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 15,
          windDirectionDeg: 270,
          aspectDeg: 270,
        }),
      );
      expect(result.factors.windPenalty).toBeCloseTo(0.5, 10);
    });

    it("null wind direction has no penalty (windPenalty = 1.0)", () => {
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 20,
          windDirectionDeg: null,
          aspectDeg: 270,
        }),
      );
      expect(result.factors.windPenalty).toBe(1.0);
    });

    it("zero wind speed has no penalty (windPenalty = 1.0)", () => {
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 0,
          windDirectionDeg: 270,
          aspectDeg: 270,
        }),
      );
      expect(result.factors.windPenalty).toBe(1.0);
    });

    it("null aspect has no penalty (windPenalty = 1.0)", () => {
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 15,
          windDirectionDeg: 270,
          aspectDeg: null,
        }),
      );
      expect(result.factors.windPenalty).toBe(1.0);
    });

    it("crossshore wind (90 degrees off) has no penalty", () => {
      // Wind from 0 (north), aspect 270 (facing west)
      // cos(toRad(0 - 270)) = cos(toRad(-270)) = cos(-3pi/2) ~= 0
      // Cosine of -270 deg is ~0, so onshoreComponent ~= 0, no penalty applied
      const result = calculateRideableWaves(
        makeInput({
          windSpeedKts: 15,
          windDirectionDeg: 0,
          aspectDeg: 270,
        }),
      );
      // cos(-270 deg) = cos(-3*pi/2) = 0 (actually ~6.12e-17 due to float)
      // Since it's effectively 0, no penalty branch entered
      expect(result.factors.windPenalty).toBeCloseTo(1.0, 5);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Step 7: Output clamping
  // ───────────────────────────────────────────────────────────────
  describe("Step 7: Output clamping", () => {
    it("result is clamped to MAX_RIDEABLE_WAVES_PER_HOUR (60)", () => {
      // Engineer a scenario that would produce > 60 without clamping:
      // Very short period (2s) with beach break:
      // base = 3600/2 = 1800, breakType = 0.15, shortPeriod = 2/8 = 0.25
      // swellAccess = 0.7 (default), windPenalty = 1.0
      // raw = 1800 * 0.15 * 0.25 * 0.7 * 1.0 = 47.25 — not enough
      // Use access factor of 1.0 to push it:
      // raw = 1800 * 0.15 * 0.25 * 1.0 * 1.0 = 67.5 > 60
      const accessFactors = new Array(72).fill(1.0);
      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 2,
          waveHeightFt: 5,
          breakType: "beach",
          windSpeedKts: 0,
          swell1DirectionDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );
      expect(result.rideableWavesPerHour).toBe(MAX_RIDEABLE_WAVES_PER_HOUR);
      expect(result.rideableWavesPerHour).toBe(60);
    });

    it("zero result stays 0", () => {
      const result = calculateRideableWaves(makeInput({ waveHeightFt: 0 }));
      expect(result.rideableWavesPerHour).toBe(0);
    });

    it("result is never negative", () => {
      const result = calculateRideableWaves(makeInput({ waveHeightFt: null }));
      expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Spec example verification — realistic scenarios
  // ───────────────────────────────────────────────────────────────
  describe("Spec example verification", () => {
    it("Ocean Beach Pier (beach): 4ft @ 10s, access 0.85, light offshore", () => {
      // base = 3600/10 = 360
      // breakType = 0.15 (beach)
      // shortPeriod = 1.0 (10s >= 8s)
      // swellAccess = 0.85 (from bin lookup)
      // windPenalty = 1.0 (offshore)
      // raw = 360 * 0.15 * 1.0 * 0.85 * 1.0 = 45.9
      // clamped = round(45.9) = 46
      const accessFactors = new Array(72).fill(0.5);
      const bin = Math.round(270 / 5) % 72; // 54
      accessFactors[bin] = 0.85;

      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 10,
          swell1PeriodS: null,
          swell2PeriodS: null,
          swell1DirectionDeg: 270,
          waveHeightFt: 4,
          windSpeedKts: 5,
          windDirectionDeg: 90, // offshore (opposite of aspect)
          breakType: "beach",
          aspectDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );

      expect(result.rideableWavesPerHour).toBe(46);
      expect(result.factors.baseFrequency).toBe(360);
      expect(result.factors.breakTypeFactor).toBe(0.15);
      expect(result.factors.shortPeriodPenalty).toBe(1.0);
      expect(result.factors.swellAccessFactor).toBe(0.85);
      expect(result.factors.windPenalty).toBe(1.0);
    });

    it("Scripps (reef): 4ft @ 12s, glassy, access 0.90", () => {
      // base = 3600/12 = 300
      // breakType = 0.10 (reef)
      // shortPeriod = 1.0 (12s >= 8s)
      // swellAccess = 0.90 (from bin lookup)
      // windPenalty = 1.0 (0kt wind)
      // raw = 300 * 0.10 * 1.0 * 0.90 * 1.0 = 27.0
      // clamped = round(27) = 27
      const accessFactors = new Array(72).fill(0.5);
      const bin = Math.round(270 / 5) % 72;
      accessFactors[bin] = 0.90;

      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 12,
          swell1DirectionDeg: 270,
          waveHeightFt: 4,
          windSpeedKts: 0,
          breakType: "reef",
          aspectDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );

      expect(result.rideableWavesPerHour).toBe(27);
      expect(result.factors.baseFrequency).toBe(300);
      expect(result.factors.breakTypeFactor).toBe(0.1);
      expect(result.factors.swellAccessFactor).toBe(0.9);
    });

    it("Scripps (reef): 4ft @ 12s, 15kt onshore reduces count", () => {
      // base = 300, breakType = 0.10, shortPeriod = 1.0, swellAccess = 0.90
      // windPenalty: cos(toRad(270 - 270)) = cos(0) = 1.0 (directly onshore)
      // penalty = max(0.3, 1 - (15 * 1.0) / 30) = max(0.3, 0.5) = 0.5
      // raw = 300 * 0.10 * 1.0 * 0.90 * 0.5 = 13.5
      // clamped = round(13.5) = 14
      const accessFactors = new Array(72).fill(0.5);
      const bin = Math.round(270 / 5) % 72;
      accessFactors[bin] = 0.90;

      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 12,
          swell1DirectionDeg: 270,
          waveHeightFt: 4,
          windSpeedKts: 15,
          windDirectionDeg: 270, // onshore (same as aspect)
          breakType: "reef",
          aspectDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );

      expect(result.rideableWavesPerHour).toBe(14);
      expect(result.factors.windPenalty).toBeCloseTo(0.5, 10);

      // Should be less than the glassy scenario
      expect(result.rideableWavesPerHour).toBeLessThan(27);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Edge cases
  // ───────────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("all factors at minimum produce very low result", () => {
      // Short period (3s), reef (high threshold), strong onshore, low access
      const accessFactors = new Array(72).fill(0.05);

      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 3,
          swell1DirectionDeg: 270,
          waveHeightFt: 2.5, // just at reef threshold
          windSpeedKts: 25,
          windDirectionDeg: 270,
          breakType: "reef",
          aspectDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );

      // base = 3600/3 = 1200
      // breakType = 0.10
      // shortPeriod = 3/8 = 0.375
      // swellAccess = 0.05
      // windPenalty = 0.3 (floor)
      // raw = 1200 * 0.10 * 0.375 * 0.05 * 0.3 = 0.675
      // clamped = round(0.675) = 1
      expect(result.rideableWavesPerHour).toBeLessThanOrEqual(2);
      expect(result.rideableWavesPerHour).toBeGreaterThanOrEqual(0);
    });

    it("perfect conditions produce high result approaching cap", () => {
      const accessFactors = new Array(72).fill(1.0);

      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 8, // at threshold, no period penalty
          swell1DirectionDeg: 270,
          waveHeightFt: 8,
          windSpeedKts: 0, // glassy
          breakType: "beach", // highest factor (0.15)
          aspectDeg: 270,
          swellAccessFactors: accessFactors,
        }),
      );

      // base = 3600/8 = 450
      // breakType = 0.15
      // shortPeriod = 1.0
      // swellAccess = 1.0
      // windPenalty = 1.0
      // raw = 450 * 0.15 * 1.0 * 1.0 * 1.0 = 67.5
      // clamped to 60
      expect(result.rideableWavesPerHour).toBe(MAX_RIDEABLE_WAVES_PER_HOUR);
    });

    it("confidence is always 'medium' from the calculator", () => {
      const result = calculateRideableWaves(makeInput());
      expect(result.confidence).toBe("medium");
    });

    it("confidence is 'medium' even for zero result", () => {
      const result = calculateRideableWaves(makeInput({ dominantPeriodS: null }));
      expect(result.confidence).toBe("medium");
    });

    it("result is deterministic — same input always produces same output", () => {
      const input = makeInput({
        dominantPeriodS: 10,
        waveHeightFt: 4,
        windSpeedKts: 8,
        windDirectionDeg: 200,
        aspectDeg: 270,
      });

      const r1 = calculateRideableWaves(input);
      const r2 = calculateRideableWaves(input);
      const r3 = calculateRideableWaves(input);

      expect(r1).toEqual(r2);
      expect(r2).toEqual(r3);
    });

    it("result is an integer (rounded)", () => {
      const result = calculateRideableWaves(
        makeInput({
          dominantPeriodS: 11,
          waveHeightFt: 3.5,
          windSpeedKts: 3,
          windDirectionDeg: 250,
          aspectDeg: 270,
        }),
      );
      expect(Number.isInteger(result.rideableWavesPerHour)).toBe(true);
    });

    it("break type matching is case-insensitive", () => {
      const lower = calculateRideableWaves(makeInput({ breakType: "beach" }));
      const upper = calculateRideableWaves(makeInput({ breakType: "Beach" }));
      const mixed = calculateRideableWaves(makeInput({ breakType: "BEACH" }));

      expect(lower.factors.breakTypeFactor).toBe(upper.factors.breakTypeFactor);
      expect(lower.factors.breakTypeFactor).toBe(mixed.factors.breakTypeFactor);
    });
  });
});

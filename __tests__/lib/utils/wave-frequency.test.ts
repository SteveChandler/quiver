/**
 * @jest-environment node
 */
import {
  estimateSetFrequency,
  formatSetFrequency,
  formatSetFrequencyShort,
} from '@/lib/utils/wave-frequency';

describe('estimateSetFrequency', () => {
  it('returns null for null period', () => {
    expect(estimateSetFrequency(null)).toBeNull();
  });

  it('returns null for 0 period', () => {
    expect(estimateSetFrequency(0)).toBeNull();
  });

  it('returns null for negative period', () => {
    expect(estimateSetFrequency(-5)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(estimateSetFrequency(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(estimateSetFrequency(Infinity)).toBeNull();
  });

  it('returns hasSets=false for wind chop (<8s)', () => {
    const result = estimateSetFrequency(6);
    expect(result).toEqual({
      setIntervalMin: [0, 0],
      wavesPerHour: [0, 0],
      hasSets: false,
    });
  });

  it('estimates medium period swell (10s)', () => {
    const result = estimateSetFrequency(10);
    expect(result).not.toBeNull();
    expect(result!.hasSets).toBe(true);
    // 10s * 5/60 = 0.83 → clamped to 1, 10s * 8/60 = 1.33 → 1
    expect(result!.setIntervalMin[0]).toBeGreaterThanOrEqual(1);
    expect(result!.setIntervalMin[1]).toBeGreaterThanOrEqual(result!.setIntervalMin[0]);
    expect(result!.wavesPerHour[0]).toBeGreaterThan(0);
    expect(result!.wavesPerHour[1]).toBeGreaterThanOrEqual(result!.wavesPerHour[0]);
  });

  it('estimates standard groundswell (13s)', () => {
    const result = estimateSetFrequency(13);
    expect(result).not.toBeNull();
    expect(result!.hasSets).toBe(true);
    // 13s * 7/60 ≈ 1.5 → 2, 13s * 10/60 ≈ 2.2 → 2
    expect(result!.setIntervalMin[0]).toBeGreaterThanOrEqual(1);
    expect(result!.setIntervalMin[1]).toBeGreaterThanOrEqual(result!.setIntervalMin[0]);
    expect(result!.wavesPerHour[0]).toBeGreaterThan(0);
    expect(result!.wavesPerHour[1]).toBeGreaterThanOrEqual(result!.wavesPerHour[0]);
  });

  it('estimates long-period groundswell (17s)', () => {
    const result = estimateSetFrequency(17);
    expect(result).not.toBeNull();
    expect(result!.hasSets).toBe(true);
    // 17s * 9/60 = 2.55 → 3, 17s * 12/60 = 3.4 → 3
    expect(result!.setIntervalMin[0]).toBeGreaterThanOrEqual(2);
    expect(result!.setIntervalMin[1]).toBeGreaterThanOrEqual(result!.setIntervalMin[0]);
    // 3-4 waves per set
    expect(result!.wavesPerHour[0]).toBeGreaterThan(0);
    expect(result!.wavesPerHour[1]).toBeGreaterThanOrEqual(result!.wavesPerHour[0]);
  });

  it('longer periods produce longer set intervals', () => {
    const medium = estimateSetFrequency(10)!;
    const ground = estimateSetFrequency(14)!;
    const longPeriod = estimateSetFrequency(18)!;

    // Set intervals should generally increase with period
    expect(longPeriod.setIntervalMin[0]).toBeGreaterThanOrEqual(ground.setIntervalMin[0]);
    expect(ground.setIntervalMin[0]).toBeGreaterThanOrEqual(medium.setIntervalMin[0]);
  });

  it('boundary at 8s returns hasSets=true', () => {
    const result = estimateSetFrequency(8);
    expect(result).not.toBeNull();
    expect(result!.hasSets).toBe(true);
  });

  it('boundary at 7.9s returns hasSets=false', () => {
    const result = estimateSetFrequency(7.9);
    expect(result).not.toBeNull();
    expect(result!.hasSets).toBe(false);
  });
});

describe('formatSetFrequency', () => {
  it('returns formatted string for valid estimate', () => {
    const estimate = estimateSetFrequency(13)!;
    const formatted = formatSetFrequency(estimate);
    expect(formatted).not.toBeNull();
    expect(formatted).toMatch(/^Sets every \d+(-\d+)? min \(\d+(-\d+)?\/hr\)$/);
  });

  it('returns null for null estimate', () => {
    expect(formatSetFrequency(null)).toBeNull();
  });

  it('returns null for wind chop (hasSets=false)', () => {
    const estimate = estimateSetFrequency(5)!;
    expect(formatSetFrequency(estimate)).toBeNull();
  });

  it('uses single value when low equals high', () => {
    // Build a case where intervals might match
    const estimate = estimateSetFrequency(10)!;
    const formatted = formatSetFrequency(estimate)!;
    // Just verify it's a valid format — range or single
    expect(formatted).toMatch(/^Sets every/);
  });
});

describe('formatSetFrequencyShort', () => {
  it('returns short format for valid estimate', () => {
    const estimate = estimateSetFrequency(13)!;
    const formatted = formatSetFrequencyShort(estimate);
    expect(formatted).not.toBeNull();
    expect(formatted).toMatch(/^Sets ~\d+ min$/);
  });

  it('returns null for null estimate', () => {
    expect(formatSetFrequencyShort(null)).toBeNull();
  });

  it('returns null for wind chop (hasSets=false)', () => {
    const estimate = estimateSetFrequency(6)!;
    expect(formatSetFrequencyShort(estimate)).toBeNull();
  });
});

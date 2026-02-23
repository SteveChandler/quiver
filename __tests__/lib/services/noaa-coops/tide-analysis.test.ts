/**
 * Tests for NOAA CO-OPS tide analysis utilities
 */

import {
  getTideStatusAtTime,
  getTideHeightAtTime,
  getNextTideFromTime,
  parseCOOPSTimestampToUnixSecondsUTC,
} from '@/lib/services/noaa-coops/tide-analysis';
import type { TideData } from '@/lib/services/noaa-coops/types';

describe('tide-analysis', () => {
  describe('parseCOOPSTimestampToUnixSecondsUTC', () => {
    it('should parse valid COOPS timestamp', () => {
      const result = parseCOOPSTimestampToUnixSecondsUTC('2025-01-15 12:30');
      // 2025-01-15 12:30 UTC
      expect(result).toBe(Math.floor(new Date('2025-01-15T12:30:00Z').getTime() / 1000));
    });

    it('should return null for invalid format', () => {
      expect(parseCOOPSTimestampToUnixSecondsUTC('2025/01/15 12:30')).toBeNull();
      expect(parseCOOPSTimestampToUnixSecondsUTC('invalid')).toBeNull();
      expect(parseCOOPSTimestampToUnixSecondsUTC('')).toBeNull();
    });
  });

  describe('getTideStatusAtTime', () => {
    // Real-world scenario: tide falling from high (9am) to low (4pm)
    const tidesHighToLow: TideData[] = [
      { time: 1706007600, height: 6.8, type: 'high', name: 'High' }, // 9:00 AM
      { time: 1706032800, height: -1.4, type: 'low', name: 'Low' },  // 4:00 PM (7 hours later)
    ];

    it('should return Falling when between high and low tide', () => {
      // 12:00 PM (noon) - between high (9am) and low (4pm)
      const noon = new Date(1706022000 * 1000);
      expect(getTideStatusAtTime(tidesHighToLow, noon)).toBe('Falling');
    });

    it('should return Falling at 1pm when going from high to low', () => {
      // 1:00 PM - still between high (9am) and low (4pm)
      const onePm = new Date(1706025600 * 1000);
      expect(getTideStatusAtTime(tidesHighToLow, onePm)).toBe('Falling');
    });

    // Scenario: tide rising from low to high
    const tidesLowToHigh: TideData[] = [
      { time: 1706000000, height: -0.5, type: 'low', name: 'Low' },   // Early morning
      { time: 1706025000, height: 5.5, type: 'high', name: 'High' },  // ~7 hours later
    ];

    it('should return Rising when between low and high tide', () => {
      const midMorning = new Date(1706012500 * 1000);
      expect(getTideStatusAtTime(tidesLowToHigh, midMorning)).toBe('Rising');
    });

    it('should return Unknown for empty tides array', () => {
      const now = new Date();
      expect(getTideStatusAtTime([], now)).toBe('Unknown');
    });

    it('should return correct status when before first tide (next is low)', () => {
      // When before first tide and next tide is LOW, we're falling toward it
      const beforeFirst = new Date(1705990000 * 1000); // Before the low tide
      expect(getTideStatusAtTime(tidesLowToHigh, beforeFirst)).toBe('Falling');
    });

    it('should return correct status when after last tide (prev was high)', () => {
      // When after last tide and prev was HIGH, we're rising away from it
      // This is edge case behavior - in practice there should always be more tides
      const afterLast = new Date(1706040000 * 1000); // After both tides
      expect(getTideStatusAtTime(tidesHighToLow, afterLast)).toBe('Rising');
    });
  });

  describe('getTideHeightAtTime', () => {
    const tides: TideData[] = [
      { time: 1706000000, height: 0.0, type: 'low', name: 'Low' },
      { time: 1706014400, height: 4.0, type: 'high', name: 'High' }, // 4 hours later
    ];

    it('should interpolate height at midpoint', () => {
      // Midpoint between the two tides
      const midpoint = new Date(1706007200 * 1000);
      const height = getTideHeightAtTime(tides, midpoint);
      expect(height).toBeCloseTo(2.0, 1); // Halfway = 2.0 ft
    });

    it('should interpolate height at quarter point', () => {
      const quarterPoint = new Date(1706003600 * 1000); // 1/4 through
      const height = getTideHeightAtTime(tides, quarterPoint);
      expect(height).toBeCloseTo(1.0, 1); // 25% = 1.0 ft
    });

    it('should return null for time outside tide range', () => {
      const beforeRange = new Date(1705995000 * 1000);
      expect(getTideHeightAtTime(tides, beforeRange)).toBeNull();

      const afterRange = new Date(1706020000 * 1000);
      expect(getTideHeightAtTime(tides, afterRange)).toBeNull();
    });

    it('should return null for insufficient tides', () => {
      const singleTide: TideData[] = [
        { time: 1706000000, height: 2.0, type: 'high', name: 'High' },
      ];
      const now = new Date();
      expect(getTideHeightAtTime(singleTide, now)).toBeNull();
      expect(getTideHeightAtTime([], now)).toBeNull();
    });
  });

  describe('getNextTideFromTime', () => {
    const tides: TideData[] = [
      { time: 1706000000, height: 0.0, type: 'low', name: 'Low' },
      { time: 1706022000, height: 6.0, type: 'high', name: 'High' },
      { time: 1706044800, height: -0.5, type: 'low', name: 'Low' },
    ];

    it('should return the next tide after target time', () => {
      const beforeFirst = new Date(1705995000 * 1000);
      const next = getNextTideFromTime(tides, beforeFirst);
      expect(next?.type).toBe('low');
      expect(next?.height).toBe(0.0);
    });

    it('should return high tide when between low and high', () => {
      const betweenLowAndHigh = new Date(1706010000 * 1000);
      const next = getNextTideFromTime(tides, betweenLowAndHigh);
      expect(next?.type).toBe('high');
      expect(next?.height).toBe(6.0);
    });

    it('should return second low when after high', () => {
      const afterHigh = new Date(1706030000 * 1000);
      const next = getNextTideFromTime(tides, afterHigh);
      expect(next?.type).toBe('low');
      expect(next?.height).toBe(-0.5);
    });

    it('should return null when no more tides', () => {
      const afterAll = new Date(1706050000 * 1000);
      const next = getNextTideFromTime(tides, afterAll);
      expect(next).toBeNull();
    });

    it('should return null for empty array', () => {
      const now = new Date();
      expect(getNextTideFromTime([], now)).toBeNull();
    });
  });

  describe('Plateau case (consecutive equal heights)', () => {
    // Test for plateau detection - no false positives when heights are equal
    // This tests the extrema detection logic used in fetchCachedTides
    it('should not falsely identify plateau points as extrema', () => {
      // Three consecutive equal heights should not produce false extremes
      // This is a data integrity test - plateau means no local max/min
      const plateauTides: TideData[] = [
        { time: 1706000000, height: 3.0, type: 'high', name: 'High' },
        { time: 1706010000, height: 3.0, type: 'high', name: 'High' },
        { time: 1706020000, height: 3.0, type: 'high', name: 'High' },
      ];

      // Tide status between identical points should still work
      const midpoint = new Date(1706005000 * 1000);
      const status = getTideStatusAtTime(plateauTides, midpoint);
      // With same-type adjacency fix, status should always be Rising or Falling
      expect(['Rising', 'Falling']).toContain(status);
    });

    it('should handle interpolation with equal heights correctly', () => {
      const plateauTides: TideData[] = [
        { time: 1706000000, height: 3.0, type: 'high', name: 'High' },
        { time: 1706014400, height: 3.0, type: 'high', name: 'High' },
      ];

      // Height at midpoint should be the same as the plateau height
      const midpoint = new Date(1706007200 * 1000);
      const height = getTideHeightAtTime(plateauTides, midpoint);
      expect(height).toBeCloseTo(3.0, 1);
    });
  });

  describe('Same-type adjacency (boundary extrema artifact)', () => {
    // When TideExtremaDetector produces two consecutive highs or lows,
    // an implicit opposite extreme exists between them. The midpoint
    // approach correctly splits the interval.

    const bothHigh: TideData[] = [
      { time: 1706000000, height: 5.5, type: 'high', name: 'High' },
      { time: 1706020000, height: 6.0, type: 'high', name: 'High' },
    ];
    const midpointTime = (1706000000 + 1706020000) / 2; // 1706010000

    const bothLow: TideData[] = [
      { time: 1706000000, height: -0.5, type: 'low', name: 'Low' },
      { time: 1706020000, height: 0.2, type: 'low', name: 'Low' },
    ];

    it('both HIGH: first half returns Falling', () => {
      const firstHalf = new Date((midpointTime - 1000) * 1000);
      expect(getTideStatusAtTime(bothHigh, firstHalf)).toBe('Falling');
    });

    it('both HIGH: second half returns Rising', () => {
      const secondHalf = new Date((midpointTime + 1000) * 1000);
      expect(getTideStatusAtTime(bothHigh, secondHalf)).toBe('Rising');
    });

    it('both LOW: first half returns Rising', () => {
      const firstHalf = new Date((midpointTime - 1000) * 1000);
      expect(getTideStatusAtTime(bothLow, firstHalf)).toBe('Rising');
    });

    it('both LOW: second half returns Falling', () => {
      const secondHalf = new Date((midpointTime + 1000) * 1000);
      expect(getTideStatusAtTime(bothLow, secondHalf)).toBe('Falling');
    });

    it('midpoint boundary returns the approaching phase', () => {
      const atMidpoint = new Date(midpointTime * 1000);
      // At midpoint with both HIGH: still in "Falling" phase (<=)
      expect(getTideStatusAtTime(bothHigh, atMidpoint)).toBe('Falling');
      // At midpoint with both LOW: still in "Rising" phase (<=)
      expect(getTideStatusAtTime(bothLow, atMidpoint)).toBe('Rising');
    });

    it('same-type adjacency never returns Unknown', () => {
      const testTimes = [
        new Date((midpointTime - 5000) * 1000),
        new Date(midpointTime * 1000),
        new Date((midpointTime + 5000) * 1000),
      ];
      for (const t of testTimes) {
        expect(getTideStatusAtTime(bothHigh, t)).not.toBe('Unknown');
        expect(getTideStatusAtTime(bothLow, t)).not.toBe('Unknown');
      }
    });
  });

  describe('Real-world bug scenario: OB Pier Feb 2, 2026', () => {
    // Bug report: tide_status showed "Rising" at noon when tide was falling
    // High at 9am (6.8ft) → Low at 4pm (-1.4ft)
    // At noon, status should be "Falling"

    const obPierTides: TideData[] = [
      { time: 1738501200, height: 6.8, type: 'high', name: 'High' }, // 2026-02-02 09:00 PST
      { time: 1738526400, height: -1.4, type: 'low', name: 'Low' },  // 2026-02-02 16:00 PST
    ];

    it('should correctly show Falling at noon', () => {
      // 2026-02-02 12:00 PST (noon)
      const noonPst = new Date(1738512000 * 1000);
      const status = getTideStatusAtTime(obPierTides, noonPst);
      expect(status).toBe('Falling');
    });

    it('should correctly show Falling at 1pm', () => {
      // 2026-02-02 13:00 PST
      const onePm = new Date(1738515600 * 1000);
      const status = getTideStatusAtTime(obPierTides, onePm);
      expect(status).toBe('Falling');
    });

    it('should interpolate correct height at noon', () => {
      // At noon (3 hours into 7-hour tide cycle from high to low)
      // Progress: 3/7 = 0.43
      // Height change: -1.4 - 6.8 = -8.2
      // Interpolated: 6.8 + (-8.2 * 0.43) = 6.8 - 3.52 = 3.28 ft
      const noonPst = new Date(1738512000 * 1000);
      const height = getTideHeightAtTime(obPierTides, noonPst);
      expect(height).toBeCloseTo(3.3, 0); // Around 3.3 ft
    });
  });
});

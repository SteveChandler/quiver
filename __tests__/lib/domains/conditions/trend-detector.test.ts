/**
 * Tests for Trend Detector
 *
 * Tests trend detection and window stability analysis.
 */

import {
  analyzeConditionsWindow,
  detectTrend,
  computeVariance,
  isWindowImproving,
  isWindowDegrading,
  isWindowStable,
  describeWindowStability,
} from '@/lib/domains/conditions';
import type { ConditionsSnapshot } from '@/lib/domains/conditions';

// Helper to create a mock ConditionsSnapshot
function createSnapshot(
  overrides: Partial<{
    timestamp: Date;
    waveHeight: number;
    wavePeriod: number;
    windSpeed: number;
    tideHeight: number;
    confidence: number;
  }> = {}
): ConditionsSnapshot {
  const {
    timestamp = new Date(),
    waveHeight = 4,
    wavePeriod = 12,
    windSpeed = 8,
    tideHeight = 3,
    confidence = 80,
  } = overrides;

  return {
    timestamp,
    waveHeight,
    wavePeriod,
    waveDirection: 270,
    primarySwell: null,
    secondarySwell: null,
    windWave: null,
    wind: {
      speedMph: windSpeed,
      directionDeg: 90,
    },
    tide: {
      heightFt: tideHeight,
      status: 'rising',
      direction: 'rising',
    },
    confidence,
    dataSource: 'test',
  };
}

// Helper to create a sequence of snapshots over time
function createSnapshotSequence(
  values: { waveHeight?: number; windSpeed?: number; tideHeight?: number }[],
  intervalMinutes = 60
): ConditionsSnapshot[] {
  const baseTime = new Date('2025-01-15T08:00:00Z');
  return values.map((v, i) =>
    createSnapshot({
      timestamp: new Date(baseTime.getTime() + i * intervalMinutes * 60 * 1000),
      waveHeight: v.waveHeight,
      windSpeed: v.windSpeed,
      tideHeight: v.tideHeight,
    })
  );
}

describe('Trend Detector', () => {
  describe('detectTrend', () => {
    describe('with higherIsBetter = true', () => {
      it('should detect improving trend when values increase', () => {
        const values = [2, 3, 4, 5, 6];
        expect(detectTrend(values, true)).toBe('improving');
      });

      it('should detect degrading trend when values decrease', () => {
        const values = [6, 5, 4, 3, 2];
        expect(detectTrend(values, true)).toBe('degrading');
      });

      it('should detect stable trend when values are constant', () => {
        const values = [4, 4, 4, 4, 4];
        expect(detectTrend(values, true)).toBe('stable');
      });

      it('should detect stable for small fluctuations', () => {
        const values = [4.0, 4.1, 3.9, 4.05, 3.95];
        expect(detectTrend(values, true)).toBe('stable');
      });
    });

    describe('with higherIsBetter = false (e.g., wind speed)', () => {
      it('should detect improving trend when values decrease', () => {
        const values = [15, 12, 9, 6, 3];
        expect(detectTrend(values, false)).toBe('improving');
      });

      it('should detect degrading trend when values increase', () => {
        const values = [3, 6, 9, 12, 15];
        expect(detectTrend(values, false)).toBe('degrading');
      });
    });

    describe('edge cases', () => {
      it('should return stable for single value', () => {
        expect(detectTrend([5], true)).toBe('stable');
      });

      it('should return stable for empty array', () => {
        expect(detectTrend([], true)).toBe('stable');
      });

      it('should handle two values', () => {
        expect(detectTrend([2, 5], true)).toBe('improving');
        expect(detectTrend([5, 2], true)).toBe('degrading');
      });
    });
  });

  describe('computeVariance', () => {
    it('should return 0 for constant values', () => {
      expect(computeVariance([5, 5, 5, 5])).toBe(0);
    });

    it('should compute variance correctly', () => {
      // Values: [2, 4, 4, 4, 6], mean = 4
      // Squared diffs: [4, 0, 0, 0, 4], mean = 1.6
      expect(computeVariance([2, 4, 4, 4, 6])).toBeCloseTo(1.6, 1);
    });

    it('should return 0 for single value', () => {
      expect(computeVariance([5])).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(computeVariance([])).toBe(0);
    });
  });

  describe('analyzeConditionsWindow', () => {
    it('should throw error for empty snapshots', () => {
      expect(() => analyzeConditionsWindow([])).toThrow(
        'Cannot analyze empty snapshots array'
      );
    });

    it('should calculate correct duration', () => {
      const snapshots = createSnapshotSequence([{}, {}, {}], 60); // 3 hours

      const window = analyzeConditionsWindow(snapshots);

      expect(window.durationHours).toBe(2); // 2 intervals of 1 hour
    });

    it('should detect improving wave conditions', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 2, windSpeed: 10 },
        { waveHeight: 3, windSpeed: 8 },
        { waveHeight: 4, windSpeed: 6 },
        { waveHeight: 5, windSpeed: 4 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.waveHeightTrend).toBe('improving'); // Building swell
      expect(window.windSpeedTrend).toBe('improving'); // Decreasing wind
      expect(window.overallTrend).toBe('improving');
    });

    it('should detect degrading wave conditions', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 5, windSpeed: 4 },
        { waveHeight: 4, windSpeed: 8 },
        { waveHeight: 3, windSpeed: 12 },
        { waveHeight: 2, windSpeed: 16 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.waveHeightTrend).toBe('degrading'); // Dropping swell
      expect(window.windSpeedTrend).toBe('degrading'); // Increasing wind
      expect(window.overallTrend).toBe('degrading');
    });

    it('should detect stable conditions', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.waveHeightTrend).toBe('stable');
      expect(window.windSpeedTrend).toBe('stable');
      expect(window.overallTrend).toBe('stable');
      expect(window.isStable).toBe(true);
    });

    it('should mark high variance as not stable', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 2, windSpeed: 5 },
        { waveHeight: 6, windSpeed: 15 },
        { waveHeight: 3, windSpeed: 8 },
        { waveHeight: 7, windSpeed: 4 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.isStable).toBe(false);
    });

    it('should compute averages correctly', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 2, windSpeed: 6 },
        { waveHeight: 4, windSpeed: 8 },
        { waveHeight: 6, windSpeed: 10 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.avgWaveHeight).toBe(4);
      expect(window.avgWindSpeed).toBe(8);
    });

    it('should sort snapshots by timestamp', () => {
      const base = new Date('2025-01-15T08:00:00Z');
      const unsorted = [
        createSnapshot({
          timestamp: new Date(base.getTime() + 2 * 60 * 60 * 1000),
          waveHeight: 5,
        }),
        createSnapshot({ timestamp: base, waveHeight: 3 }),
        createSnapshot({
          timestamp: new Date(base.getTime() + 1 * 60 * 60 * 1000),
          waveHeight: 4,
        }),
      ];

      const window = analyzeConditionsWindow(unsorted);

      expect(window.snapshots[0].waveHeight).toBe(3);
      expect(window.snapshots[1].waveHeight).toBe(4);
      expect(window.snapshots[2].waveHeight).toBe(5);
    });
  });

  describe('helper functions', () => {
    describe('isWindowImproving', () => {
      it('should return true for improving window', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 2 },
          { waveHeight: 4 },
          { waveHeight: 6 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        expect(isWindowImproving(window)).toBe(true);
      });

      it('should return false for degrading window', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 6 },
          { waveHeight: 4 },
          { waveHeight: 2 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        expect(isWindowImproving(window)).toBe(false);
      });
    });

    describe('isWindowDegrading', () => {
      it('should return true for degrading window', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 6, windSpeed: 4 },
          { waveHeight: 4, windSpeed: 8 },
          { waveHeight: 2, windSpeed: 12 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        expect(isWindowDegrading(window)).toBe(true);
      });
    });

    describe('isWindowStable', () => {
      it('should return true for low variance', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 4.0, windSpeed: 8.0 },
          { waveHeight: 4.1, windSpeed: 8.1 },
          { waveHeight: 3.9, windSpeed: 7.9 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        expect(isWindowStable(window)).toBe(true);
      });
    });

    describe('describeWindowStability', () => {
      it('should describe stable improving conditions', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 3, windSpeed: 10 },
          { waveHeight: 4, windSpeed: 8 },
          { waveHeight: 5, windSpeed: 6 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        // Set isStable manually for test (in real scenario variance would determine)
        const description = describeWindowStability(window);
        expect(description).toContain('improving');
      });

      it('should describe variable conditions', () => {
        const snapshots = createSnapshotSequence([
          { waveHeight: 2, windSpeed: 15 },
          { waveHeight: 6, windSpeed: 5 },
          { waveHeight: 3, windSpeed: 12 },
        ]);
        const window = analyzeConditionsWindow(snapshots);

        const description = describeWindowStability(window);
        expect(description).toContain('Variable');
      });
    });
  });

  describe('Overall Trend Determination', () => {
    it('should return improving when 2/3 metrics improving', () => {
      // Wave up, wind down, tide up = improving
      const snapshots = createSnapshotSequence([
        { waveHeight: 2, windSpeed: 12, tideHeight: 1 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 6, windSpeed: 4, tideHeight: 5 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.overallTrend).toBe('improving');
    });

    it('should return degrading when 2/3 metrics degrading', () => {
      // Wave down, wind up, tide down = degrading
      const snapshots = createSnapshotSequence([
        { waveHeight: 6, windSpeed: 4, tideHeight: 5 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 2, windSpeed: 12, tideHeight: 1 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.overallTrend).toBe('degrading');
    });

    it('should return stable when tied or all stable', () => {
      const snapshots = createSnapshotSequence([
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
        { waveHeight: 4, windSpeed: 8, tideHeight: 3 },
      ]);

      const window = analyzeConditionsWindow(snapshots);

      expect(window.overallTrend).toBe('stable');
    });
  });
});

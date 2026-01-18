/**
 * Performance benchmarks for surf discovery time slot capping
 *
 * Tests timezone conversion overhead to ensure it doesn't impact API response times.
 *
 * Run with: yarn jest __tests__/lib/services/surf-discovery-performance.test.ts
 */

import { capEndTimeToTimeSlot } from '@/lib/services/discovery';
import type { TimeSlot } from '@/types/personalization';

describe('Surf Discovery Performance Benchmarks', () => {
  // Helper to measure execution time
  function measureTime(fn: () => void, iterations: number = 100): {
    totalMs: number;
    meanMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  } {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    times.sort((a, b) => a - b);

    const totalMs = times.reduce((sum, t) => sum + t, 0);
    const meanMs = totalMs / iterations;
    const p50Ms = times[Math.floor(iterations * 0.5)];
    const p95Ms = times[Math.floor(iterations * 0.95)];
    const p99Ms = times[Math.floor(iterations * 0.99)];

    return { totalMs, meanMs, p50Ms, p95Ms, p99Ms };
  }

  describe('Intl.DateTimeFormat timezone conversion', () => {
    const timezones = [
      'America/Los_Angeles',
      'America/New_York',
      'Pacific/Honolulu',
      'Europe/London',
      'Asia/Tokyo',
    ];

    it('should complete single timezone conversion in < 1ms', () => {
      const testDate = new Date('2024-01-15T14:30:00Z');

      for (const tz of timezones) {
        const result = measureTime(() => {
          new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: tz,
          }).format(testDate);
        }, 100);

        console.log(`Timezone ${tz}: mean=${result.meanMs.toFixed(3)}ms, p95=${result.p95Ms.toFixed(3)}ms`);

        // Should complete in < 1ms on average
        expect(result.meanMs).toBeLessThan(1);
      }
    });

    it('should reuse DateTimeFormat instances for better performance', () => {
      const testDate = new Date('2024-01-15T14:30:00Z');
      const tz = 'America/Los_Angeles';

      // Without reuse - create new formatter each time
      const withoutReuse = measureTime(() => {
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: tz,
        }).format(testDate);
      }, 100);

      // With reuse - reuse formatter
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz,
      });
      const withReuse = measureTime(() => {
        formatter.format(testDate);
      }, 100);

      console.log(`Without reuse: mean=${withoutReuse.meanMs.toFixed(3)}ms`);
      console.log(`With reuse: mean=${withReuse.meanMs.toFixed(3)}ms`);
      console.log(`Speedup: ${(withoutReuse.meanMs / withReuse.meanMs).toFixed(1)}x`);

      // Reuse should be faster
      expect(withReuse.meanMs).toBeLessThanOrEqual(withoutReuse.meanMs);
    });
  });

  describe('capEndTimeToTimeSlot function', () => {
    const testCases: { timeSlot: TimeSlot; expectedCap: number }[] = [
      { timeSlot: 'dawn-patrol', expectedCap: 9 },
      { timeSlot: 'morning', expectedCap: 12 },
      { timeSlot: 'afternoon', expectedCap: 18 },
      { timeSlot: 'any', expectedCap: -1 }, // No capping
    ];

    it('should process 100 calls in < 50ms', () => {
      const startTime = new Date('2024-01-15T07:00:00-08:00'); // 7am PST
      const endTime = new Date('2024-01-15T11:00:00-08:00'); // 11am PST
      const beachTz = 'America/Los_Angeles';

      for (const { timeSlot } of testCases) {
        const result = measureTime(() => {
          capEndTimeToTimeSlot(startTime, endTime, timeSlot, beachTz);
        }, 100);

        console.log(
          `capEndTimeToTimeSlot (${timeSlot}): ` +
          `total=${result.totalMs.toFixed(2)}ms, ` +
          `mean=${result.meanMs.toFixed(3)}ms, ` +
          `p95=${result.p95Ms.toFixed(3)}ms`
        );

        // 100 calls should complete in < 50ms total
        expect(result.totalMs).toBeLessThan(50);
      }
    });

    it('should have minimal overhead for "any" time slot (no capping)', () => {
      const startTime = new Date('2024-01-15T07:00:00-08:00');
      const endTime = new Date('2024-01-15T11:00:00-08:00');
      const beachTz = 'America/Los_Angeles';

      const withCapping = measureTime(() => {
        capEndTimeToTimeSlot(startTime, endTime, 'dawn-patrol', beachTz);
      }, 100);

      const withoutCapping = measureTime(() => {
        capEndTimeToTimeSlot(startTime, endTime, 'any', beachTz);
      }, 100);

      console.log(`With capping (dawn-patrol): mean=${withCapping.meanMs.toFixed(3)}ms`);
      console.log(`Without capping (any): mean=${withoutCapping.meanMs.toFixed(3)}ms`);

      // "any" should be faster since it returns early
      expect(withoutCapping.meanMs).toBeLessThanOrEqual(withCapping.meanMs);
    });
  });

  describe('Batch processing simulation', () => {
    it('should process 50 beaches x 10 windows = 500 calls efficiently', () => {
      const beachTz = 'America/Los_Angeles';
      const timeSlot: TimeSlot = 'morning';

      // Simulate 50 beaches, each with 10 forecast windows
      const beaches = 50;
      const windowsPerBeach = 10;

      const result = measureTime(() => {
        for (let b = 0; b < beaches; b++) {
          for (let w = 0; w < windowsPerBeach; w++) {
            const startTime = new Date(`2024-01-15T${6 + w}:00:00-08:00`);
            const endTime = new Date(`2024-01-15T${10 + w}:00:00-08:00`);
            capEndTimeToTimeSlot(startTime, endTime, timeSlot, beachTz);
          }
        }
      }, 10); // Run 10 iterations of the full batch

      console.log(
        `Batch (${beaches} beaches x ${windowsPerBeach} windows = ${beaches * windowsPerBeach} calls): ` +
        `total=${result.totalMs.toFixed(2)}ms per batch, ` +
        `mean per call=${(result.meanMs / (beaches * windowsPerBeach)).toFixed(4)}ms`
      );

      // Should process all 500 windows in < 100ms
      expect(result.meanMs).toBeLessThan(100);
    });
  });

  describe('Memory efficiency', () => {
    it('should not leak memory over many iterations', () => {
      const startTime = new Date('2024-01-15T07:00:00-08:00');
      const endTime = new Date('2024-01-15T11:00:00-08:00');
      const beachTz = 'America/Los_Angeles';

      // Force GC if available (Node.js with --expose-gc flag)
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run 10,000 iterations
      for (let i = 0; i < 10000; i++) {
        capEndTimeToTimeSlot(startTime, endTime, 'dawn-patrol', beachTz);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory growth after 10,000 iterations: ${memoryGrowthMB.toFixed(2)}MB`);

      // Memory growth should be minimal (< 10MB)
      // Note: Without --expose-gc, this test is approximate
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });
});

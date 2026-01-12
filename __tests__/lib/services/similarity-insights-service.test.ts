/**
 * Unit tests for Similarity Insights Service
 *
 * Tests the bucketMatch function for correct handling of:
 * - Same bucket matching
 * - Adjacent bucket matching
 * - Boundary proximity handling
 * - Edge cases at exact bucket boundaries
 */

import {
  bucketMatch,
  BUCKET_BOUNDARY_THRESHOLD,
} from '@/lib/services/similarity-insights-service';

describe('Similarity Insights Service', () => {
  // Wave height buckets as defined in the service
  const waveHeightBuckets = [
    { min: 0, max: 2, label: 'Ankle to Knee' },
    { min: 2, max: 4, label: 'Waist High' },
    { min: 4, max: 6, label: 'Head High' },
    { min: 6, max: 8, label: 'Overhead' },
    { min: 8, max: 15, label: 'Double Overhead+' },
  ];

  describe('bucketMatch', () => {
    describe('same bucket matching', () => {
      it('returns 1.0 for values in the same bucket', () => {
        expect(bucketMatch(2.5, 3.5, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(5.0, 5.5, waveHeightBuckets)).toBe(1.0);
      });

      it('returns 1.0 for identical values', () => {
        expect(bucketMatch(3.0, 3.0, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(6.5, 6.5, waveHeightBuckets)).toBe(1.0);
      });
    });

    describe('adjacent bucket matching', () => {
      it('returns 0.5 for values in adjacent buckets (not near boundary)', () => {
        // 1.0 is in bucket 0 (0-2), 3.0 is in bucket 1 (2-4) - adjacent
        expect(bucketMatch(1.0, 3.0, waveHeightBuckets)).toBe(0.5);
        // 5.0 is in bucket 2 (4-6), 7.0 is in bucket 3 (6-8) - adjacent
        expect(bucketMatch(5.0, 7.0, waveHeightBuckets)).toBe(0.5);
      });

      it('returns 0 for values in non-adjacent buckets', () => {
        // 1.0 is in bucket 0, 5.0 is in bucket 2 - not adjacent
        expect(bucketMatch(1.0, 5.0, waveHeightBuckets)).toBe(0);
        // 2.5 is in bucket 1, 7.0 is in bucket 3 - not adjacent
        expect(bucketMatch(2.5, 7.0, waveHeightBuckets)).toBe(0);
      });
    });

    describe('boundary proximity handling', () => {
      it('returns 0.75 when one value is near a bucket boundary', () => {
        // 4.0 is at the boundary between buckets 1 and 2
        // 4.5 is in bucket 2
        expect(bucketMatch(4.0, 4.5, waveHeightBuckets)).toBe(0.75);
        expect(bucketMatch(4.5, 4.0, waveHeightBuckets)).toBe(0.75);
      });

      it('returns 0.75 when value is near boundary and other is in adjacent bucket', () => {
        // 3.8 is near 4.0 boundary (bucket 1), 4.5 is in bucket 2 (4-6) - adjacent
        expect(bucketMatch(3.8, 4.5, waveHeightBuckets)).toBe(0.75);
        // 4.2 is near 4.0 boundary (bucket 1), 3.5 is also in bucket 1 (2-4) - same bucket
        expect(bucketMatch(4.2, 3.5, waveHeightBuckets)).toBe(1.0);
      });

      it('handles the 6.0 ft boundary correctly', () => {
        // 6.0 is at the boundary between buckets 2 and 3
        // 6.0 (near boundary, index=2) vs 6.5 (bucket 3) - adjacent bucket via boundary
        expect(bucketMatch(6.0, 6.5, waveHeightBuckets)).toBe(0.75);
        // 6.0 (near boundary, index=2) vs 5.5 (bucket 2) - same bucket
        expect(bucketMatch(6.0, 5.5, waveHeightBuckets)).toBe(1.0);
      });

      it('handles the 8.0 ft boundary correctly', () => {
        // 8.0 is at the boundary between buckets 3 and 4
        // 8.0 (near boundary, index=3) vs 8.5 (bucket 4) - adjacent bucket via boundary
        expect(bucketMatch(8.0, 8.5, waveHeightBuckets)).toBe(0.75);
        // 8.0 (near boundary, index=3) vs 7.5 (bucket 3) - same bucket
        expect(bucketMatch(8.0, 7.5, waveHeightBuckets)).toBe(1.0);
      });
    });

    describe('exact boundary values (regression tests)', () => {
      it('handles exactly 4.0 ft consistently', () => {
        // 4.0 ft should be treated as near-boundary
        // Matching with same bucket should give 1.0 or 0.75 depending on interpretation
        const result1 = bucketMatch(4.0, 3.9, waveHeightBuckets);
        const result2 = bucketMatch(4.0, 4.1, waveHeightBuckets);

        // Both should give reasonable scores (not 0)
        expect(result1).toBeGreaterThan(0);
        expect(result2).toBeGreaterThan(0);

        // Scores should be similar (within 0.25 of each other)
        expect(Math.abs(result1 - result2)).toBeLessThanOrEqual(0.25);
      });

      it('handles exactly 6.0 ft consistently', () => {
        const result1 = bucketMatch(6.0, 5.9, waveHeightBuckets);
        const result2 = bucketMatch(6.0, 6.1, waveHeightBuckets);

        expect(result1).toBeGreaterThan(0);
        expect(result2).toBeGreaterThan(0);
        expect(Math.abs(result1 - result2)).toBeLessThanOrEqual(0.25);
      });

      it('handles exactly 8.0 ft consistently', () => {
        const result1 = bucketMatch(8.0, 7.9, waveHeightBuckets);
        const result2 = bucketMatch(8.0, 8.1, waveHeightBuckets);

        expect(result1).toBeGreaterThan(0);
        expect(result2).toBeGreaterThan(0);
        expect(Math.abs(result1 - result2)).toBeLessThanOrEqual(0.25);
      });

      it('two boundary values match well', () => {
        // Both values at exactly 4.0 should match perfectly
        expect(bucketMatch(4.0, 4.0, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(6.0, 6.0, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(8.0, 8.0, waveHeightBuckets)).toBe(1.0);
      });
    });

    describe('edge cases', () => {
      it('handles values at the start of the first bucket', () => {
        expect(bucketMatch(0, 0.5, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(0.1, 1.9, waveHeightBuckets)).toBe(1.0);
      });

      it('handles values in the last bucket', () => {
        expect(bucketMatch(10, 12, waveHeightBuckets)).toBe(1.0);
        expect(bucketMatch(8.5, 14, waveHeightBuckets)).toBe(1.0);
      });

      it('returns 0 for values outside all buckets', () => {
        // Negative values shouldn't match any bucket
        expect(bucketMatch(-1, 3, waveHeightBuckets)).toBe(0);
      });

      it('handles the 2.0 ft boundary correctly', () => {
        // 2.0 is at the boundary between buckets 0 and 1
        // 2.0 (near boundary, index=0) vs 2.5 (bucket 1) - adjacent bucket via boundary
        expect(bucketMatch(2.0, 2.5, waveHeightBuckets)).toBe(0.75);
        // 2.0 (near boundary, index=0) vs 1.5 (bucket 0) - same bucket
        expect(bucketMatch(2.0, 1.5, waveHeightBuckets)).toBe(1.0);
      });
    });

    describe('boundary threshold constant', () => {
      it('has the expected threshold value', () => {
        expect(BUCKET_BOUNDARY_THRESHOLD).toBe(0.25);
      });

      it('provides smoother transitions than the old 0.1 threshold', () => {
        // With 0.25 threshold, values like 3.8 and 4.2 get boundary handling
        // (they're within 0.25 of the 4.0 boundary)

        // 3.8 is within 0.25 of 4.0, so it should get boundary treatment
        const result = bucketMatch(3.8, 4.5, waveHeightBuckets);
        // Should get partial credit (0.75) not just adjacent bucket credit (0.5)
        expect(result).toBe(0.75);
      });
    });
  });
});

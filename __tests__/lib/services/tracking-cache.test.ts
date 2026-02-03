/**
 * @jest-environment node
 *
 * Tests for tracking cache LRU implementation
 *
 * Tests the in-memory LRU cache used for user tracking preferences.
 * Verifies cache hits/misses, LRU eviction, and TTL expiration.
 */

import {
  getTrackingCache,
  setTrackingCache,
  trackingAllowedCache,
  __clearTrackingCache,
} from '@/lib/services/tracking-cache';

describe('tracking-cache', () => {
  beforeEach(() => {
    __clearTrackingCache();
  });

  afterEach(() => {
    __clearTrackingCache();
  });

  describe('getTrackingCache', () => {
    it('returns undefined for cache miss', () => {
      const result = getTrackingCache('user-123');
      expect(result).toBeUndefined();
    });

    it('returns cached value for cache hit', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      setTrackingCache('user-123', { allowed: true, expires });

      const result = getTrackingCache('user-123');
      expect(result).toEqual({ allowed: true, expires });
    });

    it('returns cached value when tracking is disabled', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      setTrackingCache('user-456', { allowed: false, expires });

      const result = getTrackingCache('user-456');
      expect(result).toEqual({ allowed: false, expires });
    });

    it('updates LRU order on cache access', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      // Add three entries
      setTrackingCache('user-1', { allowed: true, expires });
      setTrackingCache('user-2', { allowed: true, expires });
      setTrackingCache('user-3', { allowed: true, expires });

      // Access user-1 (should move to end of LRU)
      getTrackingCache('user-1');

      // Access user-2 (should move to end of LRU)
      getTrackingCache('user-2');

      // All should still be cached
      expect(getTrackingCache('user-1')).toBeDefined();
      expect(getTrackingCache('user-2')).toBeDefined();
      expect(getTrackingCache('user-3')).toBeDefined();
    });

    it('returns expired entries without filtering', () => {
      // Set entry that expired 1 minute ago
      const expiredTime = Date.now() - 60 * 1000;
      setTrackingCache('user-expired', { allowed: true, expires: expiredTime });

      // getTrackingCache doesn't check expiration - that's the caller's job
      const result = getTrackingCache('user-expired');
      expect(result).toEqual({ allowed: true, expires: expiredTime });
    });
  });

  describe('setTrackingCache', () => {
    it('adds new entry to cache', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      setTrackingCache('user-123', { allowed: true, expires });

      expect(trackingAllowedCache.has('user-123')).toBe(true);
      expect(trackingAllowedCache.get('user-123')).toEqual({
        allowed: true,
        expires,
      });
    });

    it('updates existing entry', () => {
      const expires1 = Date.now() + 5 * 60 * 1000;
      const expires2 = Date.now() + 10 * 60 * 1000;

      setTrackingCache('user-123', { allowed: true, expires: expires1 });
      setTrackingCache('user-123', { allowed: false, expires: expires2 });

      const result = getTrackingCache('user-123');
      expect(result).toEqual({ allowed: false, expires: expires2 });
    });

    it('stores multiple users independently', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      setTrackingCache('user-1', { allowed: true, expires });
      setTrackingCache('user-2', { allowed: false, expires });
      setTrackingCache('user-3', { allowed: true, expires });

      expect(getTrackingCache('user-1')?.allowed).toBe(true);
      expect(getTrackingCache('user-2')?.allowed).toBe(false);
      expect(getTrackingCache('user-3')?.allowed).toBe(true);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when at MAX_CACHE_SIZE', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      const MAX_CACHE_SIZE = 5000;

      // Fill cache to capacity
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      expect(trackingAllowedCache.size).toBe(MAX_CACHE_SIZE);

      // Verify user-0 is in cache (don't call getTrackingCache as it updates LRU order)
      expect(trackingAllowedCache.has('user-0')).toBe(true);

      // Add one more entry - should evict user-0 (oldest)
      setTrackingCache('user-new', { allowed: true, expires });

      expect(trackingAllowedCache.size).toBe(MAX_CACHE_SIZE);
      expect(trackingAllowedCache.has('user-0')).toBe(false);
      expect(trackingAllowedCache.has('user-new')).toBe(true);
    });

    it('does not evict when updating existing entry', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      const MAX_CACHE_SIZE = 5000;

      // Fill cache to capacity
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      expect(trackingAllowedCache.size).toBe(MAX_CACHE_SIZE);

      // Update existing entry (should NOT trigger eviction)
      const newExpires = Date.now() + 10 * 60 * 1000;
      setTrackingCache('user-500', { allowed: false, expires: newExpires });

      expect(trackingAllowedCache.size).toBe(MAX_CACHE_SIZE);
      expect(getTrackingCache('user-0')).toBeDefined();
      expect(getTrackingCache('user-500')?.allowed).toBe(false);
      expect(getTrackingCache('user-500')?.expires).toBe(newExpires);
    });

    it('evicts in FIFO order when not accessed', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Manually set cache to capacity for testing
      const MAX_CACHE_SIZE = 5000;
      for (let i = 5; i < MAX_CACHE_SIZE; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Add 3 more - should evict user-0, user-1, user-2
      setTrackingCache('user-new-1', { allowed: true, expires });
      setTrackingCache('user-new-2', { allowed: true, expires });
      setTrackingCache('user-new-3', { allowed: true, expires });

      expect(trackingAllowedCache.has('user-0')).toBe(false);
      expect(trackingAllowedCache.has('user-1')).toBe(false);
      expect(trackingAllowedCache.has('user-2')).toBe(false);
      expect(trackingAllowedCache.has('user-3')).toBe(true);
      expect(trackingAllowedCache.has('user-new-1')).toBe(true);
      expect(trackingAllowedCache.has('user-new-2')).toBe(true);
      expect(trackingAllowedCache.has('user-new-3')).toBe(true);
    });

    it('respects LRU order after accessing entries', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Access user-0 and user-1 (moves them to end of LRU)
      getTrackingCache('user-0');
      getTrackingCache('user-1');

      // Fill to capacity
      const MAX_CACHE_SIZE = 5000;
      for (let i = 5; i < MAX_CACHE_SIZE; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Add 2 more - should evict user-2 and user-3 (oldest unaccessed)
      setTrackingCache('user-new-1', { allowed: true, expires });
      setTrackingCache('user-new-2', { allowed: true, expires });

      expect(trackingAllowedCache.has('user-0')).toBe(true); // Recently accessed
      expect(trackingAllowedCache.has('user-1')).toBe(true); // Recently accessed
      expect(trackingAllowedCache.has('user-2')).toBe(false); // Evicted
      expect(trackingAllowedCache.has('user-3')).toBe(false); // Evicted
    });
  });

  describe('__clearTrackingCache', () => {
    it('clears all cache entries', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      setTrackingCache('user-1', { allowed: true, expires });
      setTrackingCache('user-2', { allowed: false, expires });
      setTrackingCache('user-3', { allowed: true, expires });

      expect(trackingAllowedCache.size).toBe(3);

      __clearTrackingCache();

      expect(trackingAllowedCache.size).toBe(0);
      expect(getTrackingCache('user-1')).toBeUndefined();
      expect(getTrackingCache('user-2')).toBeUndefined();
      expect(getTrackingCache('user-3')).toBeUndefined();
    });

    it('allows adding entries after clearing', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      setTrackingCache('user-1', { allowed: true, expires });
      __clearTrackingCache();

      setTrackingCache('user-2', { allowed: false, expires });

      expect(trackingAllowedCache.size).toBe(1);
      expect(getTrackingCache('user-2')).toEqual({ allowed: false, expires });
    });
  });

  describe('edge cases', () => {
    it('handles rapid updates to same user', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      for (let i = 0; i < 100; i++) {
        setTrackingCache('user-123', {
          allowed: i % 2 === 0,
          expires: expires + i,
        });
      }

      expect(trackingAllowedCache.size).toBe(1);
      const result = getTrackingCache('user-123');
      expect(result?.allowed).toBe(false); // 99 % 2 === 1, but last iteration is i=99
      expect(result?.expires).toBe(expires + 99);
    });

    it('handles user IDs with special characters', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      const specialUserIds = [
        'user@example.com',
        'user-with-dashes',
        'user_with_underscores',
        'user.with.dots',
        'user:with:colons',
        '00000000-0000-0000-0000-000000000000', // UUID
      ];

      for (const userId of specialUserIds) {
        setTrackingCache(userId, { allowed: true, expires });
        expect(getTrackingCache(userId)).toBeDefined();
      }

      expect(trackingAllowedCache.size).toBe(specialUserIds.length);
    });

    it('handles concurrent access patterns', () => {
      const expires = Date.now() + 5 * 60 * 1000;

      // Simulate concurrent access
      setTrackingCache('user-1', { allowed: true, expires });
      setTrackingCache('user-2', { allowed: true, expires });

      getTrackingCache('user-1');
      setTrackingCache('user-3', { allowed: true, expires });
      getTrackingCache('user-2');
      setTrackingCache('user-4', { allowed: true, expires });

      expect(trackingAllowedCache.size).toBe(4);
      expect(getTrackingCache('user-1')).toBeDefined();
      expect(getTrackingCache('user-2')).toBeDefined();
      expect(getTrackingCache('user-3')).toBeDefined();
      expect(getTrackingCache('user-4')).toBeDefined();
    });

    it('preserves exact timestamp values', () => {
      const exactExpires = 1234567890123;
      setTrackingCache('user-123', { allowed: true, expires: exactExpires });

      const result = getTrackingCache('user-123');
      expect(result?.expires).toBe(exactExpires);
    });

    it('handles zero and negative expire times', () => {
      setTrackingCache('user-zero', { allowed: true, expires: 0 });
      setTrackingCache('user-negative', { allowed: true, expires: -1000 });

      expect(getTrackingCache('user-zero')).toEqual({ allowed: true, expires: 0 });
      expect(getTrackingCache('user-negative')).toEqual({ allowed: true, expires: -1000 });
    });
  });

  describe('memory bounds', () => {
    it('never exceeds MAX_CACHE_SIZE', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      const MAX_CACHE_SIZE = 5000;
      const ENTRIES_TO_ADD = MAX_CACHE_SIZE + 1000;

      for (let i = 0; i < ENTRIES_TO_ADD; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
        expect(trackingAllowedCache.size).toBeLessThanOrEqual(MAX_CACHE_SIZE);
      }

      expect(trackingAllowedCache.size).toBe(MAX_CACHE_SIZE);
    });

    it('maintains consistent state during eviction', () => {
      const expires = Date.now() + 5 * 60 * 1000;
      const MAX_CACHE_SIZE = 5000;

      // Fill to capacity
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Verify all recent entries exist (don't use getTrackingCache to avoid LRU updates)
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        expect(trackingAllowedCache.has(`user-${i}`)).toBe(true);
      }

      // Add more entries and verify eviction worked correctly
      for (let i = MAX_CACHE_SIZE; i < MAX_CACHE_SIZE + 100; i++) {
        setTrackingCache(`user-${i}`, { allowed: true, expires });
      }

      // Oldest 100 should be evicted
      for (let i = 0; i < 100; i++) {
        expect(trackingAllowedCache.has(`user-${i}`)).toBe(false);
      }

      // Remaining entries should exist
      for (let i = 100; i < MAX_CACHE_SIZE + 100; i++) {
        expect(trackingAllowedCache.has(`user-${i}`)).toBe(true);
      }
    });
  });
});

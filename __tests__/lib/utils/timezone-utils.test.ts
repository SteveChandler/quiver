/**
 * Unit tests for timezone-utils
 *
 * Tests the isNightHour function to ensure it correctly identifies
 * nighttime hours that are unrealistic for surfing.
 */

import { isNightHour, getLocalHour, getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';

describe('timezone-utils', () => {
  describe('isNightHour', () => {
    describe('morning hours (valid for surfing)', () => {
      it('should return false for 6 AM (first valid hour)', () => {
        expect(isNightHour(6)).toBe(false);
      });

      it('should return false for 7 AM', () => {
        expect(isNightHour(7)).toBe(false);
      });

      it('should return false for 9 AM (typical dawn patrol)', () => {
        expect(isNightHour(9)).toBe(false);
      });
    });

    describe('daytime hours (valid for surfing)', () => {
      it('should return false for 12 PM (noon)', () => {
        expect(isNightHour(12)).toBe(false);
      });

      it('should return false for 3 PM', () => {
        expect(isNightHour(15)).toBe(false);
      });

      it('should return false for 5 PM (last valid hour)', () => {
        expect(isNightHour(17)).toBe(false);
      });
    });

    describe('evening hours (too late for surfing)', () => {
      it('should return true for 6 PM (first invalid evening hour)', () => {
        expect(isNightHour(18)).toBe(true);
      });

      it('should return true for 7 PM', () => {
        expect(isNightHour(19)).toBe(true);
      });

      it('should return true for 8 PM', () => {
        expect(isNightHour(20)).toBe(true);
      });

      it('should return true for 9 PM', () => {
        expect(isNightHour(21)).toBe(true);
      });

      it('should return true for 10 PM', () => {
        expect(isNightHour(22)).toBe(true);
      });

      it('should return true for 11 PM', () => {
        expect(isNightHour(23)).toBe(true);
      });
    });

    describe('early morning hours (too early for surfing)', () => {
      it('should return true for midnight (0)', () => {
        expect(isNightHour(0)).toBe(true);
      });

      it('should return true for 1 AM', () => {
        expect(isNightHour(1)).toBe(true);
      });

      it('should return true for 3 AM', () => {
        expect(isNightHour(3)).toBe(true);
      });

      it('should return true for 5 AM (last invalid morning hour)', () => {
        expect(isNightHour(5)).toBe(true);
      });
    });

    describe('boundary conditions', () => {
      it('should correctly identify 5:59 AM as night (hour 5)', () => {
        // Hour 5 represents 5:00-5:59 AM
        expect(isNightHour(5)).toBe(true);
      });

      it('should correctly identify 6:00 AM as day (hour 6)', () => {
        // Hour 6 represents 6:00-6:59 AM
        expect(isNightHour(6)).toBe(false);
      });

      it('should correctly identify 5:59 PM as day (hour 17)', () => {
        // Hour 17 represents 5:00-5:59 PM
        expect(isNightHour(17)).toBe(false);
      });

      it('should correctly identify 6:00 PM as night (hour 18)', () => {
        // Hour 18 represents 6:00-6:59 PM
        expect(isNightHour(18)).toBe(true);
      });
    });

    describe('regression tests for late evening bug', () => {
      it('should filter out 7 PM recommendations', () => {
        // This was the bug: 7 PM was being recommended as a valid surf time
        expect(isNightHour(19)).toBe(true);
      });

      it('should filter out 8 PM recommendations', () => {
        expect(isNightHour(20)).toBe(true);
      });

      it('should filter out 9 PM recommendations', () => {
        expect(isNightHour(21)).toBe(true);
      });
    });
  });

  describe('getTimezoneFromCoords', () => {
    it('should return America/Los_Angeles for San Diego coordinates', () => {
      const tz = getTimezoneFromCoords(32.7157, -117.1611);
      expect(tz).toBe('America/Los_Angeles');
    });

    it('should return Pacific/Honolulu for Honolulu coordinates', () => {
      const tz = getTimezoneFromCoords(21.3069, -157.8583);
      expect(tz).toBe('Pacific/Honolulu');
    });

    it('should return America/New_York for Miami coordinates', () => {
      const tz = getTimezoneFromCoords(25.7617, -80.1918);
      expect(tz).toBe('America/New_York');
    });

    it('should return fallback timezone for invalid coordinates', () => {
      const tz = getTimezoneFromCoords(0, 0);
      // 0,0 is in the Atlantic, but invalid for our use case
      // Should still return a valid timezone
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('getLocalHour', () => {
    it('should convert UTC time to Pacific time correctly', () => {
      // 9 AM UTC = 1 AM Pacific (PST, UTC-8)
      const utcDate = new Date('2025-01-15T09:00:00Z');
      const localHour = getLocalHour(utcDate, 'America/Los_Angeles');
      expect(localHour).toBe(1);
    });

    it('should convert UTC time to Eastern time correctly', () => {
      // 9 AM UTC = 4 AM Eastern (EST, UTC-5)
      const utcDate = new Date('2025-01-15T09:00:00Z');
      const localHour = getLocalHour(utcDate, 'America/New_York');
      expect(localHour).toBe(4);
    });

    it('should convert UTC time to Hawaii time correctly', () => {
      // 9 AM UTC = 11 PM Hawaii previous day (HST, UTC-10)
      const utcDate = new Date('2025-01-15T09:00:00Z');
      const localHour = getLocalHour(utcDate, 'Pacific/Honolulu');
      expect(localHour).toBe(23);
    });

    it('should handle midnight correctly', () => {
      const utcDate = new Date('2025-01-15T08:00:00Z'); // 8 AM UTC = midnight Pacific
      const localHour = getLocalHour(utcDate, 'America/Los_Angeles');
      expect(localHour).toBe(0);
    });
  });
});

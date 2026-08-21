/**
 * Unit tests for timezone-utils
 *
 * Tests the isNightHour function to ensure it correctly identifies
 * nighttime hours that are unrealistic for surfing.
 */

import {
  findCanonicalTimezoneFromCoords,
  findTimezoneFromCoords,
  getLocalHour,
  getTimezoneFromCoords,
  isNightHour,
} from '@/lib/utils/timezone-utils.server';
import { getLocalDateString } from "@/lib/utils/timezone-utils";

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

      it('should return false for 5 PM', () => {
        expect(isNightHour(17)).toBe(false);
      });

      it('should return false for 6 PM (evening glass-off sessions)', () => {
        expect(isNightHour(18)).toBe(false);
      });

      it('should return false for 7 PM', () => {
        expect(isNightHour(19)).toBe(false);
      });

      it('should return false for 8 PM (last valid hour for summer sunset sessions)', () => {
        expect(isNightHour(20)).toBe(false);
      });
    });

    describe('evening hours (too late for surfing)', () => {
      it('should return true for 9 PM (first invalid evening hour)', () => {
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

      it('should return true for 4 AM (last invalid morning hour)', () => {
        expect(isNightHour(4)).toBe(true);
      });
    });

    describe('dawn patrol hours (valid for early surfing)', () => {
      it('should return false for 5 AM (dawn patrol start)', () => {
        expect(isNightHour(5)).toBe(false);
      });
    });

    describe('boundary conditions', () => {
      it('should correctly identify 4:59 AM as night (hour 4)', () => {
        // Hour 4 represents 4:00-4:59 AM
        expect(isNightHour(4)).toBe(true);
      });

      it('should correctly identify 5:00 AM as day (hour 5) - dawn patrol', () => {
        // Hour 5 represents 5:00-5:59 AM - dawn patrol starts
        expect(isNightHour(5)).toBe(false);
      });

      it('should correctly identify 8:59 PM as day (hour 20)', () => {
        // Hour 20 represents 8:00-8:59 PM - last valid hour
        expect(isNightHour(20)).toBe(false);
      });

      it('should correctly identify 9:00 PM as night (hour 21)', () => {
        // Hour 21 represents 9:00-9:59 PM - too late for surfing
        expect(isNightHour(21)).toBe(true);
      });
    });

    describe('regression tests for night hour filtering', () => {
      it('should allow 7 PM for evening glass-off sessions', () => {
        // 7 PM is valid for summer evening sessions when sunset is late
        expect(isNightHour(19)).toBe(false);
      });

      it('should allow 8 PM for late summer sunset sessions', () => {
        // 8 PM can still have surfable light in summer
        expect(isNightHour(20)).toBe(false);
      });

      it('should filter out 9 PM recommendations (too dark)', () => {
        // 9 PM is always too late regardless of season
        expect(isNightHour(21)).toBe(true);
      });

      it('should allow 5 AM for dawn patrol', () => {
        // 5 AM should be valid for early morning sessions
        expect(isNightHour(5)).toBe(false);
      });

      it('should filter out midnight recommendations', () => {
        // Midnight should never be recommended
        expect(isNightHour(0)).toBe(true);
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

  describe('findTimezoneFromCoords', () => {
    it('returns the coordinate timezone without a default fallback', () => {
      expect(findTimezoneFromCoords(32.7157, -117.1611)).toBe('America/Los_Angeles');
      expect(findTimezoneFromCoords(21.3069, -157.8583)).toBe('Pacific/Honolulu');
    });

    it('returns null for invalid coordinates', () => {
      expect(findTimezoneFromCoords(Number.NaN, -117.1611)).toBeNull();
      expect(findTimezoneFromCoords(91, -117.1611)).toBeNull();
      expect(findTimezoneFromCoords(32.7157, -181)).toBeNull();
    });
  });

  describe('findCanonicalTimezoneFromCoords', () => {
    it('returns the canonical zone where the merged dataset would collapse it', () => {
      // geo-tz/now merges these into America/Caracas and America/Los_Angeles
      // because the offsets currently match. Persisted values must not.
      expect(findCanonicalTimezoneFromCoords(18.458392, -67.164863)).toBe(
        'America/Puerto_Rico'
      );
      expect(findCanonicalTimezoneFromCoords(32.262, -116.995)).toBe(
        'America/Tijuana'
      );
    });

    it('agrees with the merged dataset where no merging occurs', () => {
      expect(findCanonicalTimezoneFromCoords(32.7157, -117.1611)).toBe(
        'America/Los_Angeles'
      );
      expect(findCanonicalTimezoneFromCoords(21.3069, -157.8583)).toBe(
        'Pacific/Honolulu'
      );
    });

    it('resolves the beaches repaired on 2026-08-20', () => {
      // Galveston - 61st Street Pier and Robert Moses State Park, which sat on
      // America/Los_Angeles until the timezone repair.
      expect(findCanonicalTimezoneFromCoords(29.26477, -94.82505)).toBe(
        'America/Chicago'
      );
      expect(findCanonicalTimezoneFromCoords(40.6231559, -73.2598405)).toBe(
        'America/New_York'
      );
      // Pensacola Pier, west of the Apalachicola River and therefore Central.
      expect(findCanonicalTimezoneFromCoords(30.33008, -87.14253)).toBe(
        'America/Chicago'
      );
    });

    it('returns null for invalid coordinates rather than defaulting', () => {
      expect(findCanonicalTimezoneFromCoords(Number.NaN, -117.1611)).toBeNull();
      expect(findCanonicalTimezoneFromCoords(91, -117.1611)).toBeNull();
      expect(findCanonicalTimezoneFromCoords(32.7157, -181)).toBeNull();
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

  describe("getLocalDateString", () => {
    describe("Pacific Time (America/Los_Angeles)", () => {
      it("should return the beach-local date across UTC rollover (LA)", () => {
        // 00:30Z is still the prior day in America/Los_Angeles (PST)
        const utcDate = new Date("2026-01-07T00:30:00Z");
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2026-01-06");
      });

      it("should handle late evening Pacific time without UTC flip (regression test)", () => {
        // Critical bug fix: 11 PM PT Dec 5 should NOT flip to Dec 6
        // This was the root cause of "Surf Intel not available" after 4pm PT
        const utcDate = new Date("2024-12-06T07:00:00Z"); // 11 PM PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle 4pm Pacific time correctly", () => {
        // 4pm PT is when the bug manifested (midnight UTC)
        const utcDate = new Date("2024-12-06T00:00:00Z"); // 4 PM PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle midnight Pacific time (start of day)", () => {
        const utcDate = new Date("2024-12-05T08:00:00Z"); // Midnight PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle noon Pacific time (middle of day)", () => {
        const utcDate = new Date("2024-12-05T20:00:00Z"); // Noon PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle DST transition dates correctly", () => {
        // March DST transition (PST → PDT): UTC-8 → UTC-7
        const utcDateSpring = new Date("2024-03-10T09:00:00Z"); // 1 AM PST (before DST)
        const localDateSpring = getLocalDateString(utcDateSpring, "America/Los_Angeles");
        expect(localDateSpring).toBe("2024-03-10");

        // November DST transition (PDT → PST): UTC-7 → UTC-8
        const utcDateFall = new Date("2024-11-03T09:00:00Z"); // 2 AM PDT (before DST ends)
        const localDateFall = getLocalDateString(utcDateFall, "America/Los_Angeles");
        expect(localDateFall).toBe("2024-11-03");
      });
    });

    describe("Eastern Time (America/New_York)", () => {
      it("should return correct date for Eastern timezone", () => {
        // 02:00 UTC is 9 PM ET previous day (EST, UTC-5)
        const utcDate = new Date("2024-12-06T02:00:00Z");
        const localDate = getLocalDateString(utcDate, "America/New_York");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle midnight Eastern time", () => {
        const utcDate = new Date("2024-12-05T05:00:00Z"); // Midnight ET Dec 5
        const localDate = getLocalDateString(utcDate, "America/New_York");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle late evening Eastern time", () => {
        const utcDate = new Date("2024-12-06T04:00:00Z"); // 11 PM ET Dec 5
        const localDate = getLocalDateString(utcDate, "America/New_York");
        expect(localDate).toBe("2024-12-05");
      });
    });

    describe("Hawaii Time (Pacific/Honolulu)", () => {
      it("should return correct date for Hawaii timezone", () => {
        // 09:00 UTC is 11 PM HST previous day (HST, UTC-10)
        const utcDate = new Date("2024-12-06T09:00:00Z");
        const localDate = getLocalDateString(utcDate, "Pacific/Honolulu");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle midnight Hawaii time", () => {
        const utcDate = new Date("2024-12-05T10:00:00Z"); // Midnight HST Dec 5
        const localDate = getLocalDateString(utcDate, "Pacific/Honolulu");
        expect(localDate).toBe("2024-12-05");
      });

      it("should handle late evening Hawaii time", () => {
        const utcDate = new Date("2024-12-06T09:00:00Z"); // 11 PM HST Dec 5
        const localDate = getLocalDateString(utcDate, "Pacific/Honolulu");
        expect(localDate).toBe("2024-12-05");
      });

      it("should not have DST transitions (Hawaii doesn't observe DST)", () => {
        // Hawaii stays at UTC-10 year-round, no DST
        const summerDate = new Date("2024-07-15T10:00:00Z"); // Midnight HST
        const winterDate = new Date("2024-01-15T10:00:00Z"); // Midnight HST

        expect(getLocalDateString(summerDate, "Pacific/Honolulu")).toBe("2024-07-15");
        expect(getLocalDateString(winterDate, "Pacific/Honolulu")).toBe("2024-01-15");
      });
    });

    describe("edge cases and format validation", () => {
      it("should return YYYY-MM-DD format", () => {
        const utcDate = new Date("2024-01-05T12:00:00Z");
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should pad single-digit months and days with zeros", () => {
        const utcDate = new Date("2024-01-05T12:00:00Z");
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-01-05");
      });

      it("should handle year boundaries correctly (New Year's Eve/Day)", () => {
        // 9 AM UTC Jan 1 = 1 AM PT Jan 1
        const newYearUTC = new Date("2025-01-01T09:00:00Z");
        expect(getLocalDateString(newYearUTC, "America/Los_Angeles")).toBe("2025-01-01");

        // 2 AM UTC Jan 1 = 6 PM PT Dec 31
        const newYearEveUTC = new Date("2025-01-01T02:00:00Z");
        expect(getLocalDateString(newYearEveUTC, "America/Los_Angeles")).toBe("2024-12-31");
      });

      it("should handle null timezone by using default", () => {
        const utcDate = new Date("2024-12-05T12:00:00Z");
        const localDate = getLocalDateString(utcDate, null);
        // Should use DEFAULT_TIMEZONE (America/Los_Angeles)
        expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should handle undefined timezone by using default", () => {
        const utcDate = new Date("2024-12-05T12:00:00Z");
        const localDate = getLocalDateString(utcDate);
        // Should use DEFAULT_TIMEZONE (America/Los_Angeles)
        expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should handle leap year date correctly", () => {
        const leapYearDate = new Date("2024-02-29T12:00:00Z");
        const localDate = getLocalDateString(leapYearDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-02-29");
      });

      it("should handle last day of month correctly", () => {
        const endOfMonth = new Date("2024-12-31T23:00:00Z"); // 3 PM PT Dec 31
        const localDate = getLocalDateString(endOfMonth, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-31");
      });
    });

    describe("fallback behavior on error", () => {
      it("should fallback gracefully for invalid timezone", () => {
        const utcDate = new Date("2024-12-05T12:00:00Z");
        // Invalid timezone string - formatInTimeZone will throw, but getLocalDateString handles it
        const localDate = getLocalDateString(utcDate, "Invalid/Timezone");
        // Should still return a valid date string (fallback to local machine date)
        expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe("real-world Surf Intel scenarios", () => {
      it("should match forecast_date for morning surf session (6 AM PT)", () => {
        const utcDate = new Date("2024-12-05T14:00:00Z"); // 6 AM PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should match forecast_date for afternoon surf session (2 PM PT)", () => {
        const utcDate = new Date("2024-12-05T22:00:00Z"); // 2 PM PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });

      it("should match forecast_date for evening surf session (5 PM PT)", () => {
        // This is critical: 5 PM PT should still be Dec 5, not Dec 6
        const utcDate = new Date("2024-12-06T01:00:00Z"); // 5 PM PT Dec 5
        const localDate = getLocalDateString(utcDate, "America/Los_Angeles");
        expect(localDate).toBe("2024-12-05");
      });
    });
  });
});

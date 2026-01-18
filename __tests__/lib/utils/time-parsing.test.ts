// __tests__/lib/utils/time-parsing.test.ts
import {
  parseTimeToHour,
  toTimeString,
  formatTimeRange,
  isWithinTimeRange,
  getHourFromDate,
} from '@/lib/utils/time-parsing';

describe('time-parsing', () => {
  describe('parseTimeToHour', () => {
    it('should parse 24-hour format', () => {
      expect(parseTimeToHour('14:30')).toBe(14.5);
      expect(parseTimeToHour('08:00')).toBe(8);
      expect(parseTimeToHour('23:45')).toBe(23.75);
    });

    it('should parse 12-hour format', () => {
      expect(parseTimeToHour('2:30 PM')).toBe(14.5);
      expect(parseTimeToHour('8:00 AM')).toBe(8);
      expect(parseTimeToHour('12:00 PM')).toBe(12);
      expect(parseTimeToHour('12:00 AM')).toBe(0);
    });

    it('should return null for invalid formats', () => {
      expect(parseTimeToHour('invalid')).toBeNull();
      expect(parseTimeToHour('')).toBeNull();
      expect(parseTimeToHour('25:00')).toBeNull();
    });
  });

  describe('toTimeString', () => {
    it('should format hours to 12-hour string', () => {
      expect(toTimeString(14.5)).toBe('2:30 PM');
      expect(toTimeString(8)).toBe('8:00 AM');
      expect(toTimeString(0)).toBe('12:00 AM');
      expect(toTimeString(12)).toBe('12:00 PM');
    });

    it('should format to 24-hour when specified', () => {
      expect(toTimeString(14.5, { format24: true })).toBe('14:30');
      expect(toTimeString(8, { format24: true })).toBe('08:00');
    });
  });

  describe('formatTimeRange', () => {
    it('should format time ranges', () => {
      expect(formatTimeRange(6, 9)).toBe('6:00 AM - 9:00 AM');
      expect(formatTimeRange(14, 17)).toBe('2:00 PM - 5:00 PM');
    });
  });

  describe('isWithinTimeRange', () => {
    it('should check if hour is within range', () => {
      expect(isWithinTimeRange(7, 6, 9)).toBe(true);
      expect(isWithinTimeRange(5, 6, 9)).toBe(false);
      expect(isWithinTimeRange(10, 6, 9)).toBe(false);
    });

    it('should handle ranges crossing midnight', () => {
      expect(isWithinTimeRange(23, 22, 2)).toBe(true);
      expect(isWithinTimeRange(1, 22, 2)).toBe(true);
      expect(isWithinTimeRange(12, 22, 2)).toBe(false);
    });
  });

  describe('getHourFromDate', () => {
    it('should extract hour from Date object', () => {
      const date = new Date('2024-01-15T14:30:00');
      expect(getHourFromDate(date)).toBe(14);
    });

    it('should extract hour from ISO string', () => {
      expect(getHourFromDate('2024-01-15T08:00:00')).toBe(8);
    });

    it('should return null for invalid inputs', () => {
      expect(getHourFromDate(null)).toBeNull();
      expect(getHourFromDate(undefined)).toBeNull();
      expect(getHourFromDate('invalid')).toBeNull();
    });
  });
});

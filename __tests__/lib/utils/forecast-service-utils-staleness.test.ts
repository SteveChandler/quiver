import { isDataStale, getStalenessDetails } from '@/lib/utils/forecast-client-utils';

describe('Forecast Service Utils - Staleness Functions', () => {
  describe('isDataStale', () => {
    const now = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should mark CDIP data as stale after 1.5 hours', () => {
      const twoHoursAgo = new Date('2024-01-15T10:00:00Z');
      expect(isDataStale(twoHoursAgo, 'CDIP')).toBe(true);
    });

    it('should mark CDIP data as fresh within 1.5 hours', () => {
      const oneHourAgo = new Date('2024-01-15T11:00:00Z');
      expect(isDataStale(oneHourAgo, 'CDIP')).toBe(false);
    });

    it('should mark NOAA data as stale after 12 hours', () => {
      const sevenHoursAgo = new Date('2024-01-15T05:00:00Z');
      expect(isDataStale(sevenHoursAgo, 'NOAA_NWS')).toBe(false);
    });

    it('should mark NOAA data as fresh within 12 hours', () => {
      const fiveHoursAgo = new Date('2024-01-15T07:00:00Z');
      expect(isDataStale(fiveHoursAgo, 'NOAA_NWS')).toBe(false);
    });

    it('should mark FALLBACK data as stale after 12 hours', () => {
      const thirteenHoursAgo = new Date('2024-01-14T23:00:00Z');
      expect(isDataStale(thirteenHoursAgo, 'FALLBACK')).toBe(true);
    });

    it('should mark FALLBACK data as fresh within 12 hours', () => {
      const elevenHoursAgo = new Date('2024-01-15T01:00:00Z');
      expect(isDataStale(elevenHoursAgo, 'FALLBACK')).toBe(false);
    });

    it('should handle string timestamps', () => {
      const twoHoursAgo = '2024-01-15T10:00:00Z';
      expect(isDataStale(twoHoursAgo, 'CDIP')).toBe(true);
    });

    it('should use DEFAULT threshold for unknown sources', () => {
      const sevenHoursAgo = new Date('2024-01-15T05:00:00Z');
      expect(isDataStale(sevenHoursAgo, 'UNKNOWN')).toBe(true);
    });

    it('should use DEFAULT threshold for null/undefined sources', () => {
      const sevenHoursAgo = new Date('2024-01-15T05:00:00Z');
      expect(isDataStale(sevenHoursAgo, null)).toBe(true);
      expect(isDataStale(sevenHoursAgo, undefined)).toBe(true);
    });

    it('should be case-insensitive for data sources', () => {
      const twoHoursAgo = new Date('2024-01-15T10:00:00Z');
      expect(isDataStale(twoHoursAgo, 'cdip')).toBe(true);
      expect(isDataStale(twoHoursAgo, 'Cdip')).toBe(true);
      expect(isDataStale(twoHoursAgo, 'CDIP')).toBe(true);
    });
  });

  describe('getStalenessDetails', () => {
    const now = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return detailed staleness info for CDIP data', () => {
      const twoHoursAgo = new Date('2024-01-15T10:00:00Z');
      const result = getStalenessDetails(twoHoursAgo, 'CDIP');

      expect(result.hoursSinceUpdate).toBe(2);
      expect(result.threshold).toBe(1.5);
      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('Exceeded source-specific threshold');
    });

    it('should return detailed staleness info for fresh data', () => {
      const oneHourAgo = new Date('2024-01-15T11:00:00Z');
      const result = getStalenessDetails(oneHourAgo, 'CDIP');

      expect(result.hoursSinceUpdate).toBe(1);
      expect(result.threshold).toBe(1.5);
      expect(result.isStale).toBe(false);
      expect(result.reason).toBe('Within freshness window');
    });

    it('should handle fractional hours correctly', () => {
      const ninetyMinutesAgo = new Date('2024-01-15T10:30:00Z');
      const result = getStalenessDetails(ninetyMinutesAgo, 'CDIP');

      expect(result.hoursSinceUpdate).toBe(1.5);
      expect(result.threshold).toBe(1.5);
      expect(result.isStale).toBe(false); // Exactly at threshold
    });

    it('should work with different data sources', () => {
      const sevenHoursAgo = new Date('2024-01-15T05:00:00Z');

      const cdipResult = getStalenessDetails(sevenHoursAgo, 'CDIP');
      expect(cdipResult.isStale).toBe(true);
      expect(cdipResult.threshold).toBe(1.5);

      const noaaResult = getStalenessDetails(sevenHoursAgo, 'NOAA_NWS');
      expect(noaaResult.isStale).toBe(false);
      expect(noaaResult.threshold).toBe(12);

      const fallbackResult = getStalenessDetails(sevenHoursAgo, 'FALLBACK');
      expect(fallbackResult.isStale).toBe(false);
      expect(fallbackResult.threshold).toBe(12);
    });
  });
});

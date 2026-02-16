import {
  STALENESS_THRESHOLDS,
  getStalenessThreshold,
  getStalenessInfo,
} from '@/lib/config/forecast-staleness';

describe('Forecast Staleness Configuration', () => {
  describe('STALENESS_THRESHOLDS', () => {
    it('should have correct thresholds for each source', () => {
      expect(STALENESS_THRESHOLDS.CDIP).toBe(4);
      expect(STALENESS_THRESHOLDS.NOAA_NWS).toBe(12);
      expect(STALENESS_THRESHOLDS.FALLBACK).toBe(12);
      expect(STALENESS_THRESHOLDS.DEFAULT).toBe(6);
    });
  });

  describe('getStalenessThreshold', () => {
    it('should return correct threshold for CDIP', () => {
      expect(getStalenessThreshold('CDIP')).toBe(4);
      expect(getStalenessThreshold('cdip')).toBe(4);
      expect(getStalenessThreshold('Cdip')).toBe(4);
    });

    it('should return correct threshold for NOAA_NWS', () => {
      expect(getStalenessThreshold('NOAA_NWS')).toBe(12);
      expect(getStalenessThreshold('noaa_nws')).toBe(12);
      expect(getStalenessThreshold('Noaa_Nws')).toBe(12);
    });

    it('should return correct threshold for FALLBACK', () => {
      expect(getStalenessThreshold('FALLBACK')).toBe(12);
      expect(getStalenessThreshold('fallback')).toBe(12);
      expect(getStalenessThreshold('Fallback')).toBe(12);
    });

    it('should return DEFAULT threshold for unknown sources', () => {
      expect(getStalenessThreshold('UNKNOWN')).toBe(6);
      expect(getStalenessThreshold('random_source')).toBe(6);
      expect(getStalenessThreshold('')).toBe(6);
    });

    it('should return DEFAULT threshold for null/undefined', () => {
      expect(getStalenessThreshold(null)).toBe(6);
      expect(getStalenessThreshold(undefined)).toBe(6);
    });
  });

  describe('getStalenessInfo', () => {
    it('should correctly identify stale CDIP data (> 4 hours)', () => {
      const result = getStalenessInfo(5, 'CDIP');
      expect(result.isStale).toBe(true);
      expect(result.threshold).toBe(4);
      expect(result.reason).toBe('Exceeded source-specific threshold');
    });

    it('should correctly identify fresh CDIP data (< 4 hours)', () => {
      const result = getStalenessInfo(3, 'CDIP');
      expect(result.isStale).toBe(false);
      expect(result.threshold).toBe(4);
      expect(result.reason).toBe('Within freshness window');
    });

    it('should correctly identify stale NOAA data (> 12 hours)', () => {
      const result = getStalenessInfo(13, 'NOAA_NWS');
      expect(result.isStale).toBe(true);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBe('Exceeded source-specific threshold');
    });

    it('should correctly identify fresh NOAA data (< 12 hours)', () => {
      const result = getStalenessInfo(11, 'NOAA_NWS');
      expect(result.isStale).toBe(false);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBe('Within freshness window');
    });

    it('should correctly identify stale FALLBACK data (> 12 hours)', () => {
      const result = getStalenessInfo(13, 'FALLBACK');
      expect(result.isStale).toBe(true);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBe('Exceeded source-specific threshold');
    });

    it('should correctly identify fresh FALLBACK data (< 12 hours)', () => {
      const result = getStalenessInfo(11, 'FALLBACK');
      expect(result.isStale).toBe(false);
      expect(result.threshold).toBe(12);
      expect(result.reason).toBe('Within freshness window');
    });

    it('should use DEFAULT threshold for unknown sources', () => {
      const result = getStalenessInfo(7, 'UNKNOWN');
      expect(result.isStale).toBe(true);
      expect(result.threshold).toBe(6);
    });

    it('should handle edge case exactly at threshold', () => {
      const result = getStalenessInfo(12, 'NOAA_NWS');
      expect(result.isStale).toBe(false);
      expect(result.threshold).toBe(12);
    });
  });
});

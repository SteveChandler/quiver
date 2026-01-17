import {
  DISCOVERY_LIMITS,
  DISCOVERY_SCORING,
  DISCOVERY_TIMEOUTS,
  DISCOVERY_WINDOWS,
} from '@/lib/config/discovery-config';

describe('discovery-config', () => {
  describe('DISCOVERY_LIMITS', () => {
    it('should have MAX_CANDIDATES defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.MAX_CANDIDATES).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.MAX_CANDIDATES).toBe('number');
    });

    it('should have MAX_RESULTS defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.MAX_RESULTS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.MAX_RESULTS).toBe('number');
    });

    it('should have MAX_RESULTS <= MAX_CANDIDATES', () => {
      expect(DISCOVERY_LIMITS.MAX_RESULTS).toBeLessThanOrEqual(
        DISCOVERY_LIMITS.MAX_CANDIDATES
      );
    });

    it('should have DEFAULT_RESULTS defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.DEFAULT_RESULTS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.DEFAULT_RESULTS).toBe('number');
    });

    it('should have DEFAULT_RESULTS <= MAX_RESULTS', () => {
      expect(DISCOVERY_LIMITS.DEFAULT_RESULTS).toBeLessThanOrEqual(
        DISCOVERY_LIMITS.MAX_RESULTS
      );
    });

    it('should have FORECAST_BATCH_SIZE defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.FORECAST_BATCH_SIZE).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.FORECAST_BATCH_SIZE).toBe('number');
    });
  });

  describe('DISCOVERY_SCORING', () => {
    it('should have scoring weights that sum to 1.0', () => {
      const sum =
        DISCOVERY_SCORING.CONDITIONS_WEIGHT +
        DISCOVERY_SCORING.CONFIDENCE_WEIGHT;
      expect(sum).toBeCloseTo(1.0);
    });

    it('should have CONDITIONS_WEIGHT between 0 and 1', () => {
      expect(DISCOVERY_SCORING.CONDITIONS_WEIGHT).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_SCORING.CONDITIONS_WEIGHT).toBeLessThanOrEqual(1);
    });

    it('should have CONFIDENCE_WEIGHT between 0 and 1', () => {
      expect(DISCOVERY_SCORING.CONFIDENCE_WEIGHT).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_SCORING.CONFIDENCE_WEIGHT).toBeLessThanOrEqual(1);
    });

    it('should have MINIMUM_SCORE_THRESHOLD between 0 and 100', () => {
      expect(DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD).toBeLessThanOrEqual(100);
    });

    it('should have MINIMUM_SCORE_THRESHOLD_MORNING between 0 and 100', () => {
      expect(DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD_MORNING).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD_MORNING).toBeLessThanOrEqual(100);
    });

    it('should have MINIMUM_SCORE_THRESHOLD_MORNING < MINIMUM_SCORE_THRESHOLD', () => {
      expect(DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD_MORNING).toBeLessThan(
        DISCOVERY_SCORING.MINIMUM_SCORE_THRESHOLD
      );
    });
  });

  describe('DISCOVERY_TIMEOUTS', () => {
    it('should have TOTAL_REQUEST_MS as a positive number', () => {
      expect(DISCOVERY_TIMEOUTS.TOTAL_REQUEST_MS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_TIMEOUTS.TOTAL_REQUEST_MS).toBe('number');
    });

    it('should have FORECAST_FETCH_MS as a positive number', () => {
      expect(DISCOVERY_TIMEOUTS.FORECAST_FETCH_MS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_TIMEOUTS.FORECAST_FETCH_MS).toBe('number');
    });

    it('should have DB_QUERY_MS as a positive number', () => {
      expect(DISCOVERY_TIMEOUTS.DB_QUERY_MS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_TIMEOUTS.DB_QUERY_MS).toBe('number');
    });

    it('should have FORECAST_FETCH_MS <= TOTAL_REQUEST_MS', () => {
      expect(DISCOVERY_TIMEOUTS.FORECAST_FETCH_MS).toBeLessThanOrEqual(
        DISCOVERY_TIMEOUTS.TOTAL_REQUEST_MS
      );
    });

    it('should have DB_QUERY_MS <= TOTAL_REQUEST_MS', () => {
      expect(DISCOVERY_TIMEOUTS.DB_QUERY_MS).toBeLessThanOrEqual(
        DISCOVERY_TIMEOUTS.TOTAL_REQUEST_MS
      );
    });
  });

  describe('DISCOVERY_WINDOWS', () => {
    it('should have WINDOW_SIZE_HOURS as a positive number', () => {
      expect(DISCOVERY_WINDOWS.WINDOW_SIZE_HOURS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_WINDOWS.WINDOW_SIZE_HOURS).toBe('number');
    });

    it('should have MAX_LOOKAHEAD_HOURS as a positive number', () => {
      expect(DISCOVERY_WINDOWS.MAX_LOOKAHEAD_HOURS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_WINDOWS.MAX_LOOKAHEAD_HOURS).toBe('number');
    });

    it('should have PREFERRED_START_HOUR between 0 and 23', () => {
      expect(DISCOVERY_WINDOWS.PREFERRED_START_HOUR).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_WINDOWS.PREFERRED_START_HOUR).toBeLessThanOrEqual(23);
    });

    it('should have PREFERRED_END_HOUR between 0 and 23', () => {
      expect(DISCOVERY_WINDOWS.PREFERRED_END_HOUR).toBeGreaterThanOrEqual(0);
      expect(DISCOVERY_WINDOWS.PREFERRED_END_HOUR).toBeLessThanOrEqual(23);
    });

    it('should have PREFERRED_START_HOUR < PREFERRED_END_HOUR', () => {
      expect(DISCOVERY_WINDOWS.PREFERRED_START_HOUR).toBeLessThan(
        DISCOVERY_WINDOWS.PREFERRED_END_HOUR
      );
    });
  });
});

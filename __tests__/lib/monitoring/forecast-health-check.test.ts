/**
 * Tests for Forecast Health Check
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type QueryResult = { data: any[] | null; error: { message: string } | null };
const enhancedLatestMock = jest.fn<() => Promise<QueryResult>>();
const marineLatestMock = jest.fn<() => Promise<QueryResult>>();
const tideLatestMock = jest.fn<() => Promise<QueryResult>>();
const sunLatestMock = jest.fn<() => Promise<QueryResult>>();
const ioosStationsMock = jest.fn<() => Promise<QueryResult>>();

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === 'beaches') {
        return {
          select: jest.fn(() =>
            Promise.resolve({
              data: [
                { id: 'beach-1', name: 'Beach One' },
                { id: 'beach-2', name: 'Beach Two' },
                { id: 'beach-3', name: 'Beach Three' },
              ],
              error: null,
            })
          ),
        };
      }

      if (table === 'v_enhanced_forecast_latest') {
        return {
          select: jest.fn(() => enhancedLatestMock()),
        };
      }

      if (table === 'v_marine_forecast_latest') {
        return {
          select: jest.fn(() => marineLatestMock()),
        };
      }

      if (table === 'v_tide_forecast_latest') {
        return {
          select: jest.fn(() => tideLatestMock()),
        };
      }

      if (table === 'v_sun_times_latest') {
        return {
          select: jest.fn(() => sunLatestMock()),
        };
      }

      if (table === 'ioos_stations') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ioosStationsMock()),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe('Forecast Health Check', () => {
  let checkForecastHealth: typeof import('@/lib/monitoring/forecast-health-check').checkForecastHealth;

  beforeEach(async () => {
    enhancedLatestMock.mockReset();
    marineLatestMock.mockReset();
    tideLatestMock.mockReset();
    sunLatestMock.mockReset();
    ioosStationsMock.mockReset();
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-12T12:00:00Z'));
    ({ checkForecastHealth } = await import('@/lib/monitoring/forecast-health-check'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports full-stack health using latest-per-beach views', async () => {
    const nowIso = new Date('2025-12-12T12:00:00Z').toISOString();
    // Use 18h for warning stale (between WARNING_STALE_HOURS=16 and CRITICAL_STALE_HOURS=24)
    const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    enhancedLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', updated_at: nowIso, data_source: 'NOAA_NWS' },
        { beach_id: 'beach-2', updated_at: eighteenHoursAgo, data_source: 'CDIP' },
        { beach_id: 'beach-3', updated_at: twentyFiveHoursAgo, data_source: 'NOAA_NWS' },
        // Orphaned row should be ignored by the health check filter
        { beach_id: 'beach-999', updated_at: nowIso, data_source: 'NOAA_NWS' },
      ],
      error: null,
    });

    marineLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'ndbc', is_observed: true },
        { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'cdip', is_observed: true },
        { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'cdip_persistence', is_observed: false },
      ],
      error: null,
    });

    tideLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'noaa' },
        { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'noaa' },
        { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'noaa' },
      ],
      error: null,
    });

    sunLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-2', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-3', created_at: nowIso, date: '2025-12-12', source: 'computed' },
      ],
      error: null,
    });

    ioosStationsMock.mockResolvedValueOnce({
      data: [
        { station_id: 'station-1', source_network: 'cdip', last_seen_at: nowIso, active: true, nearest_beach_id: 'beach-1' },
      ],
      error: null,
    });

    const metrics = await checkForecastHealth();

    expect(metrics.totalBeaches).toBe(3);
    expect(metrics.enhancedAvailable).toBe(true);
    expect(metrics.beachesWithForecasts).toBe(3);
    expect(metrics.coveragePercentage).toBe(1);
    expect(metrics.beachesWithStaleData).toBe(2);
    expect(metrics.beachesWithCriticalStaleData).toBe(1);
    expect(metrics.beachesWithWarningStaleData).toBe(1);
    expect(metrics.healthStatus).toBe('critical');

    expect(metrics.sources.enhanced.available).toBe(true);
    expect(metrics.sources.marine.available).toBe(true);
    expect(metrics.sources.tide.available).toBe(true);
    expect(metrics.sources.sun.available).toBe(true);

    expect(metrics.sources.enhanced.beachesWithStaleData).toBe(2);
    expect(metrics.sources.marine.coveragePercentage).toBe(1);
    expect(metrics.sources.tide.coveragePercentage).toBe(1);
    expect(metrics.sources.sun.coveragePercentage).toBe(1);

    expect(enhancedLatestMock).toHaveBeenCalledTimes(1);
    expect(marineLatestMock).toHaveBeenCalledTimes(1);
    expect(tideLatestMock).toHaveBeenCalledTimes(1);
    expect(sunLatestMock).toHaveBeenCalledTimes(1);
  });

  it('does not mark overall status as critical when only marine/tide are critical', async () => {
    const nowIso = new Date('2025-12-12T12:00:00Z').toISOString();
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Enhanced is fresh
    enhancedLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', updated_at: nowIso, data_source: 'NOAA_NWS' },
        { beach_id: 'beach-2', updated_at: nowIso, data_source: 'CDIP' },
        { beach_id: 'beach-3', updated_at: nowIso, data_source: 'NOAA_NWS' },
      ],
      error: null,
    });

    // Marine is critical-stale (>6h)
    marineLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: sevenHoursAgo, ts: sevenHoursAgo, source: 'ndbc', is_observed: true },
        { beach_id: 'beach-2', created_at: sevenHoursAgo, ts: sevenHoursAgo, source: 'cdip', is_observed: true },
        { beach_id: 'beach-3', created_at: sevenHoursAgo, ts: sevenHoursAgo, source: 'cdip_persistence', is_observed: false },
      ],
      error: null,
    });

    // Tide is critical-stale (>336h / 14 days)
    tideLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: fifteenDaysAgo, ts: fifteenDaysAgo, source: 'noaa' },
        { beach_id: 'beach-2', created_at: fifteenDaysAgo, ts: fifteenDaysAgo, source: 'noaa' },
        { beach_id: 'beach-3', created_at: fifteenDaysAgo, ts: fifteenDaysAgo, source: 'noaa' },
      ],
      error: null,
    });

    // Sun is fresh
    sunLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-2', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-3', created_at: nowIso, date: '2025-12-12', source: 'computed' },
      ],
      error: null,
    });

    // IOOS is fresh
    ioosStationsMock.mockResolvedValueOnce({
      data: [
        { station_id: 'station-1', source_network: 'cdip', last_seen_at: nowIso, active: true, nearest_beach_id: 'beach-1' },
      ],
      error: null,
    });

    const metrics = await checkForecastHealth();

    // Enhanced is healthy, so overall should be degraded (not critical) even though marine/tide are critical.
    expect(metrics.enhancedAvailable).toBe(true);
    expect(metrics.sources.enhanced.beachesWithCriticalStaleData).toBe(0);
    expect(metrics.sources.marine.beachesWithCriticalStaleData).toBe(3);
    expect(metrics.sources.tide.beachesWithCriticalStaleData).toBe(3);
    expect(metrics.healthStatus).toBe('degraded');
  });

  it('honors MONITORING_MIN_FORECAST_COVERAGE for fixture-sized environments', async () => {
    const originalMinForecastCoverage = process.env.MONITORING_MIN_FORECAST_COVERAGE;
    process.env.MONITORING_MIN_FORECAST_COVERAGE = '0.3';

    try {
      const nowIso = new Date('2025-12-12T12:00:00Z').toISOString();

      enhancedLatestMock.mockResolvedValueOnce({
        data: [
          { beach_id: 'beach-1', updated_at: nowIso, data_source: 'NOAA_NWS' },
        ],
        error: null,
      });

      marineLatestMock.mockResolvedValueOnce({
        data: [
          { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'ndbc', is_observed: true },
          { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'cdip', is_observed: true },
          { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'cdip_persistence', is_observed: false },
        ],
        error: null,
      });

      tideLatestMock.mockResolvedValueOnce({
        data: [
          { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'noaa' },
          { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'noaa' },
          { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'noaa' },
        ],
        error: null,
      });

      sunLatestMock.mockResolvedValueOnce({
        data: [
          { beach_id: 'beach-1', created_at: nowIso, date: '2025-12-12', source: 'computed' },
          { beach_id: 'beach-2', created_at: nowIso, date: '2025-12-12', source: 'computed' },
          { beach_id: 'beach-3', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        ],
        error: null,
      });

      ioosStationsMock.mockResolvedValueOnce({
        data: [
          { station_id: 'station-1', source_network: 'cdip', last_seen_at: nowIso, active: true, nearest_beach_id: 'beach-1' },
        ],
        error: null,
      });

      const metrics = await checkForecastHealth();

      expect(metrics.coveragePercentage).toBeCloseTo(1 / 3);
      expect(metrics.healthStatus).toBe('healthy');
    } finally {
      if (originalMinForecastCoverage === undefined) {
        delete process.env.MONITORING_MIN_FORECAST_COVERAGE;
      } else {
        process.env.MONITORING_MIN_FORECAST_COVERAGE = originalMinForecastCoverage;
      }
    }
  });

  it('preserves beach count and reports enhanced as unavailable when latest enhanced view query fails', async () => {
    const nowIso = new Date('2025-12-12T12:00:00Z').toISOString();

    enhancedLatestMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'canceling statement due to statement timeout' },
    });

    // Secondary sources still load (helps debugging even when enhanced fails)
    marineLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'ndbc', is_observed: true },
        { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'cdip', is_observed: true },
        { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'cdip_persistence', is_observed: false },
      ],
      error: null,
    });

    tideLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, ts: nowIso, source: 'noaa' },
        { beach_id: 'beach-2', created_at: nowIso, ts: nowIso, source: 'noaa' },
        { beach_id: 'beach-3', created_at: nowIso, ts: nowIso, source: 'noaa' },
      ],
      error: null,
    });

    sunLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-2', created_at: nowIso, date: '2025-12-12', source: 'computed' },
        { beach_id: 'beach-3', created_at: nowIso, date: '2025-12-12', source: 'computed' },
      ],
      error: null,
    });

    ioosStationsMock.mockResolvedValueOnce({
      data: [
        { station_id: 'station-1', source_network: 'cdip', last_seen_at: nowIso, active: true, nearest_beach_id: 'beach-1' },
      ],
      error: null,
    });

    const metrics = await checkForecastHealth();

    expect(metrics.totalBeaches).toBe(3);
    expect(metrics.enhancedAvailable).toBe(false);
    expect(metrics.healthStatus).toBe('critical');
    expect(metrics.issues.join(' | ')).toContain('statement timeout');
  });
});

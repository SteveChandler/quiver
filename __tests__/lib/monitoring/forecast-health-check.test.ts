/**
 * Tests for Forecast Health Check
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type QueryResult = { data: any[] | null; error: { message: string } | null };
const enhancedLatestMock = jest.fn<() => Promise<QueryResult>>();
const marineLatestMock = jest.fn<() => Promise<QueryResult>>();
const tideLatestMock = jest.fn<() => Promise<QueryResult>>();
const sunLatestMock = jest.fn<() => Promise<QueryResult>>();

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
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    enhancedLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', updated_at: nowIso, data_source: 'NOAA_NWS' },
        { beach_id: 'beach-2', updated_at: thirteenHoursAgo, data_source: 'CDIP' },
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

    const metrics = await checkForecastHealth();

    expect(metrics.totalBeaches).toBe(3);
    expect(metrics.beachesWithForecasts).toBe(3);
    expect(metrics.coveragePercentage).toBe(1);
    expect(metrics.beachesWithStaleData).toBe(2);
    expect(metrics.beachesWithCriticalStaleData).toBe(1);
    expect(metrics.beachesWithWarningStaleData).toBe(1);
    expect(metrics.healthStatus).toBe('critical');

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
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

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

    // Tide is critical-stale (>48h)
    tideLatestMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', created_at: threeDaysAgo, ts: threeDaysAgo, source: 'noaa' },
        { beach_id: 'beach-2', created_at: threeDaysAgo, ts: threeDaysAgo, source: 'noaa' },
        { beach_id: 'beach-3', created_at: threeDaysAgo, ts: threeDaysAgo, source: 'noaa' },
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

    const metrics = await checkForecastHealth();

    // Enhanced is healthy, so overall should be degraded (not critical) even though marine/tide are critical.
    expect(metrics.sources.enhanced.beachesWithCriticalStaleData).toBe(0);
    expect(metrics.sources.marine.beachesWithCriticalStaleData).toBe(3);
    expect(metrics.sources.tide.beachesWithCriticalStaleData).toBe(3);
    expect(metrics.healthStatus).toBe('degraded');
  });
});

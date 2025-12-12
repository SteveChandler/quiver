/**
 * Tests for Forecast Health Check
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/lib/utils/forecast-client-utils', () => ({
  isDataStale: jest.fn(() => false),
}));

type RangeResult = { data: any[] | null; error: { message: string } | null };
const rangeMock = jest.fn<() => Promise<RangeResult>>();

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
          select: jest.fn(() => rangeMock()),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe('Forecast Health Check', () => {
  let checkForecastHealth: typeof import('@/lib/monitoring/forecast-health-check').checkForecastHealth;

  beforeEach(async () => {
    rangeMock.mockReset();
    jest.resetModules();
    ({ checkForecastHealth } = await import('@/lib/monitoring/forecast-health-check'));
  });

  it('paginates enhanced_forecasts so coverage is not undercounted', async () => {
    const nowIso = new Date().toISOString();

    rangeMock.mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', updated_at: nowIso, data_source: 'NOAA_NWS' },
        { beach_id: 'beach-2', updated_at: nowIso, data_source: 'CDIP' },
        { beach_id: 'beach-3', updated_at: nowIso, data_source: 'CDIP' },
        // Orphaned row should be ignored by the health check filter
        { beach_id: 'beach-999', updated_at: nowIso, data_source: 'NOAA_NWS' },
      ],
      error: null,
    });

    const metrics = await checkForecastHealth();

    expect(metrics.totalBeaches).toBe(3);
    expect(metrics.beachesWithForecasts).toBe(3);
    expect(metrics.coveragePercentage).toBe(1);
    expect(metrics.beachesWithStaleData).toBe(0);
    expect(metrics.healthStatus).toBe('healthy');

    expect(rangeMock).toHaveBeenCalledTimes(1);
  });
});

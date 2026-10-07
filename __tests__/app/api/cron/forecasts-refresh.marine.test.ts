/** @jest-environment node */
import { GET } from '@/app/api/cron/forecasts/refresh/route';
import { NwsWindService } from '@/lib/services/nws-wind-service';
import { apiClient } from '@/lib/utils/api-retry';

jest.mock('@/lib/cron/observability', () => ({
  withObservedCron: (_: string, fn: unknown) => fn,
  observedCronRun: { getStore: () => undefined },
}));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  validateCronRequest: () => true,
  createSuccessResponse: (data: unknown) => Response.json({ success: true, data }),
  createErrorResponse: (error: string, details: unknown, status = 500) => Response.json({ error, details }, { status }),
  handleApiError: () => Response.json({ error: 'failed' }, { status: 500 }),
}));
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceRoleClient: () => ({ from: mockFrom }) }));
jest.mock('@/lib/services/ndbc-service', () => ({
  getNearestNDBCStation: (...args: unknown[]) => mockNearest(...args),
  fetchLatestNDBCObservation: (...args: unknown[]) => mockObservation(...args),
}));
jest.mock('@/lib/services/cdip', () => ({ CDIPService: jest.fn(() => ({
  getNearestStation: (...args: unknown[]) => mockCdipNearest(...args),
  fetchBuoyDataWithDiagnostics: (...args: unknown[]) => mockCdipFetch(...args),
})) }));
jest.mock('@/lib/services/nws-wind-service', () => ({ NwsWindService: jest.fn(() => ({ fetchHourlyWindPoints: (...args: unknown[]) => mockWind(...args) })) }));

const mockCdipNearest = jest.fn();
const mockWind = jest.fn();
let beachCountry: string | null;
const mockCdipFetch = jest.fn();
const mockFrom = jest.fn();
const mockNearest = jest.fn();
const mockObservation = jest.fn();
const now = new Date('2026-09-09T12:00:00Z');
let previous: string | null;
let ledger: Record<string, any>[];
let failLedger: boolean;
let ledgerAttempts: number;
let latest: Record<string, unknown>[];
let written: Record<string, unknown>[][];
let failWrite: boolean;
let observed: Record<string, unknown> | null;

function query(data: unknown): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'not', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'range', 'abortSignal']) builder[method] = () => builder;
  builder.range = (from: number, to: number) => query(Array.isArray(data) ? data.slice(from, to + 1) : data);
  builder.maybeSingle = async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: Array.isArray(data) ? data.slice(0, 1000) : data, error: null }).then(resolve);
  return builder;
}

beforeEach(() => {
  jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate'] });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  previous = null; written = []; failWrite = false; observed = null;
  ledger = []; failLedger = false; latest = []; ledgerAttempts = 0;
  mockNearest.mockReset().mockResolvedValue(null);
  mockCdipNearest.mockReset().mockResolvedValue(null);
  mockCdipFetch.mockReset();
  mockObservation.mockReset().mockResolvedValue(null);
  mockWind.mockReset().mockResolvedValue([]);
  beachCountry = 'USA';
  mockFrom.mockImplementation((table: string) => {
    if (table === 'beaches') return query(['a', 'b', 'c'].map((id, i) => ({ id, name: id, lat: 32 + i, lon: -117, country: beachCountry })));
    if (table === 'v_marine_forecast_latest') return query(latest);
    if (table === 'cron_runs') return {
      ...query(ledger.length ? [ledger[ledger.length - 1]] : [{ summary: { result: { marineCoverage: { lastAttemptedBeachId: previous } } } }]),
      insert: async (row: Record<string, unknown>) => {
        ledgerAttempts++;
        if (failLedger) return { error: { message: 'private ledger error' } };
        ledger.push(row);
        return { error: null };
      },
    };
    if (table === 'marine_forecasts') return {
      ...query(observed),
      select: (fields: string) => query(fields.includes('beach_id') ? latest : observed),
      upsert: async (rows: Record<string, unknown>[]) => {
        written.push(rows);
        return { error: failWrite ? { message: 'private database error' } : null };
      },
    };
    throw new Error(`Unexpected table ${table}`);
  });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(['ndbc', 'cdip'])('shares the in-flight %s fetch and still writes rows for both beaches', async (provider) => {
  let release!: (value: unknown) => void;
  const pending = new Promise(resolve => { release = resolve; });
  const fetch = provider === 'ndbc' ? mockObservation : mockCdipFetch;
  if (provider === 'ndbc') mockNearest.mockResolvedValue({ id: 'shared' });
  else mockCdipNearest.mockResolvedValue('shared');
  fetch.mockReturnValue(pending);

  const refresh = GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  await jest.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith('shared');
  expect(written).toEqual([]);
  release(provider === 'ndbc'
    ? { ts: '2026-09-09T11:00:00.000Z', wave_height_m: 1.5, wave_period_s: 10 }
    : { skipReason: 'success', data: { data: [{ timestamp: '2026-09-09T11:00:00Z', significantWaveHeight: 5, peakWavePeriod: 10 }] } });

  const response = await refresh;
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(written.flat()).toEqual(['a', 'b'].map(beach_id => expect.objectContaining({
    beach_id, source: provider, is_observed: true, ts: '2026-09-09T11:00:00.000Z',
    wave_height_m: provider === 'ndbc' ? 1.5 : 5 * 0.3048, wave_period_s: 10,
  })));
  expect(body.data.totals.marine).toBe(2);
  expect(body.data.marineCoverage).toMatchObject({ expectedCoverage: 2, actualCoverage: 2,
    attemptedCoverage: 2, lastAttemptedBeachId: 'b', rejectionCounts: {}, coverageGaps: {},
    providerOutcomes: provider === 'cdip' ? { success: 2 } : {} });

  ledger = []; written = [];
  await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(written.flat()).toHaveLength(2);
});

it.each(['ndbc', 'cdip'])('counts a shared rejected %s fetch for each beach', async (provider) => {
  const fetch = provider === 'ndbc' ? mockObservation : mockCdipFetch;
  if (provider === 'ndbc') mockNearest.mockResolvedValue({ id: 'shared' });
  else mockCdipNearest.mockResolvedValue('shared');
  fetch.mockRejectedValue(new Error('private provider failure'));
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  const body = await response.json();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(503);
  expect(body.data.marineCoverage).toMatchObject({ expectedCoverage: 2, actualCoverage: 0,
    attemptedCoverage: 2, rejectionCounts: { wave_fetch_failed: 2 } });
  expect(written).toEqual([]);
});

it('retains empty CDIP diagnostics across batches and counts each beach fallback', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, FORECAST_REFRESH_BATCH_SIZE: '1', FORECAST_REFRESH_BATCH_DELAY_MS: '0' });
  mockCdipNearest.mockImplementation((_lat: number, _lon: number, _radius: number, excluded: string[]) =>
    Promise.resolve(excluded.length ? 'alternate' : 'shared'));
  mockCdipFetch.mockImplementation((station: string) => Promise.resolve(station === 'shared'
    ? { skipReason: 'cdip_404', data: null }
    : { skipReason: 'success', data: { data: [{ timestamp: '2026-09-09T11:00:00Z', significantWaveHeight: 5, peakWavePeriod: 10 }] } }));
  const refresh = GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  await jest.runAllTimersAsync();
  const response = await refresh;
  expect(response.status).toBe(200);
  expect(mockCdipFetch.mock.calls).toEqual([['shared'], ['alternate']]);
  expect(written.flat().map(row => row.beach_id)).toEqual(['a', 'b']);
  expect((await response.json()).data.marineCoverage).toMatchObject({ actualCoverage: 2,
    providerOutcomes: { cdip_404: 2, success: 2 } });
});

it('shares the real NDBC candidate probe and writes its observation for both beaches', async () => {
  const actual = jest.requireActual<typeof import('@/lib/services/ndbc-service')>('@/lib/services/ndbc-service');
  mockNearest.mockImplementation(actual.getNearestNDBCStation);
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async input => {
    const url = String(input);
    if (url.endsWith('ndbcmapstations.json')) return Response.json({ station: [
      { id: 'shared-probe', name: 'fixture', lat: 32.5, lon: -117, data: 'y' },
    ] });
    if (url.endsWith('/shared-probe.txt')) return new Response('#YY MM DD hh mm WVHT DPD\n2026 09 09 11 00 1.5 10\n');
    throw new Error(`Unexpected mocked URL: ${url}`);
  });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  expect(response.status).toBe(200);
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/shared-probe.txt'))).toHaveLength(1);
  expect(mockObservation).not.toHaveBeenCalled();
  expect(written.flat()).toEqual(['a', 'b'].map(beach_id => expect.objectContaining({
    beach_id, source: 'ndbc', is_observed: true, wave_height_m: 1.5, wave_period_s: 10,
  })));
  expect((await response.json()).data.marineCoverage).toMatchObject({ actualCoverage: 2, rejectionCounts: {} });
});

it.each([false, true])('shares the real NWS grid request and preserves per-beach rows and failures (failure: %s)', async fail => {
  const actual = jest.requireActual<typeof import('@/lib/services/nws-wind-service')>('@/lib/services/nws-wind-service');
  jest.mocked(NwsWindService).mockImplementationOnce(() => new actual.NwsWindService());
  mockNearest.mockResolvedValue({ id: 'shared' });
  mockObservation.mockResolvedValue({ ts: '2026-09-09T11:00:00Z', wave_height_m: 1.5, wave_period_s: 10 });
  const hourlyUrl = 'https://api.weather.gov/gridpoints/SGX/53,34/forecast/hourly';
  const fetch = jest.spyOn(apiClient, 'fetchNOAAData').mockImplementation(async url => {
    if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: hourlyUrl } });
    if (url !== hourlyUrl) throw new Error(`Unexpected mocked URL: ${url}`);
    if (fail) throw new Error('private grid outage');
    return Response.json({ properties: { periods: [{ startTime: '2026-09-09T15:00:00Z', windSpeed: '10 mph', windDirection: 'NW' }] } });
  });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  const body = await response.json();
  expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(1);
  expect(response.status).toBe(fail ? 503 : 200);
  for (const beachId of ['a', 'b']) {
    const rows = written.flat().filter(row => row.beach_id === beachId);
    expect(rows).toHaveLength(fail ? 1 : 2);
    expect(rows).toContainEqual(expect.objectContaining({ source: 'ndbc', wave_height_m: 1.5, wave_period_s: 10 }));
    const expectedWind = expect.objectContaining({ source: 'nws_wind',
      ts: '2026-09-09T15:00:00.000Z', created_at: now.toISOString(), wind_speed_ms: 10 * 0.44704,
      wind_direction_deg: 315, wave_height_m: null, is_observed: false });
    expect(rows.filter(row => row.source === 'nws_wind')).toEqual(fail ? [] : [expectedWind]);
  }
  expect(body.data.totals.marine).toBe(fail ? 2 : 4);
  expect(body.data.marineCoverage).toMatchObject({ actualCoverage: 2, attemptedCoverage: 2,
    rejectionCounts: fail ? { wind_fetch_failed: 2 } : {} });
});

it('advances past a beach with no data on the next bounded run', async () => {
  const request = () => new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1');
  const first = await GET(request());
  const body = await first.json();
  // No buoy in range is a coverage gap, not a failed run (2026-10-02: every
  // hourly run had failed for a month on Baja and Hawaii beaches).
  expect(first.status).toBe(200);
  expect(body.data.marineCoverage.coverageGaps.no_wave_station_in_range).toBe(1);
  expect(body.data.marineCoverage.rejectionCounts).toEqual({});
  expect(ledger[0]).toMatchObject({ status: 'ok', legitimately_zero_reason: expect.stringContaining('coverage gaps') });
  expect(ledger[0].summary.result.marineCoverage.lastAttemptedBeachId).toBe('a');
  await GET(request());
  expect(mockNearest.mock.calls.map(args => args[0])).toEqual([32, 33]);
});

it('does not refresh an old observation or project it into fresh-looking data', async () => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-06T12:00:00Z', wave_height_m: 1.6, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(200);
  expect((await response.json()).data.marineCoverage.coverageGaps.no_recent_wave_observation).toBe(1);
  expect(written).toEqual([]);
});

it('does not ask NWS for wind outside the US and counts it as a coverage gap', async () => {
  beachCountry = 'Mexico';
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  const body = await response.json();
  expect(mockWind).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
  expect(body.data.marineCoverage.coverageGaps.outside_nws_coverage).toBe(1);
});

it('still fails the run when NWS wind fails for a US beach', async () => {
  mockWind.mockRejectedValue(new Error('private NWS outage'));
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(body.data.marineCoverage.rejectionCounts).toEqual({ wind_fetch_failed: 1 });
  expect(JSON.stringify(body)).not.toContain('private');
});

it('reports failed writes without exposing database errors', async () => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-09T11:00:00Z', wave_height_m: 1.6, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  failWrite = true;
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.data.totals.marine).toBe(0);
  expect(body.data.marineCoverage.rejectionCounts.write_failed).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toContain('private');
});


it('retains one beach when another provider times out and resumes after both', async () => {
  mockNearest.mockRejectedValueOnce(new Error('private provider failure')).mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-09T11:00:00Z', wave_height_m: 1.6, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(body.data.marineCoverage).toMatchObject({ expectedCoverage: 2, actualCoverage: 1,
    attemptedCoverage: 2, lastAttemptedBeachId: 'b', rejectionCounts: { wave_fetch_failed: 1 } });
  expect(body.data.totals.marine).toBe(14);
  expect(written.flat().every(row => row.beach_id === 'b')).toBe(true);
  expect(written.flat().every(row => row.created_at === observed?.ts)).toBe(true);
  expect(JSON.stringify(body)).not.toContain('private');
});

it('preserves numerical values for fresh observations and projections', async () => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-09T11:00:00Z', wave_height_m: 0, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data.marineCoverage.actualCoverage).toBe(1);
  expect(body.data.totals.marine).toBe(14);
  expect(written.flat()).toHaveLength(14);
  expect(written.flat().every(row => row.wave_height_m === 0 && row.wave_period_s === 10)).toBe(true);
});

it.each([NaN, -1, null])('rejects malformed wave height %s without writes', async (height) => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-09T11:00:00Z', wave_height_m: height, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  // Unusable buoy data is a coverage gap; nothing is written from it.
  expect(response.status).toBe(200);
  expect((await response.json()).data.marineCoverage.coverageGaps.no_recent_wave_observation).toBe(1);
  expect(written).toEqual([]);
});


it('preserves the durable cursor when the time budget allows no attempts', async () => {
  previous = 'b';
  const before = process.env.FORECAST_CRON_TIME_BUDGET_MS;
  process.env.FORECAST_CRON_TIME_BUDGET_MS = '0';
  try {
    const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
    expect(response.status).toBe(503);
    expect((await response.json()).data.marineCoverage).toMatchObject({
      attemptedCoverage: 0, lastAttemptedBeachId: 'b', actualCoverage: 0, expectedCoverage: 0,
      freshnessCoverage: { expectedCoverage: 3, actualCoverage: 0 },
      rejectionCounts: { freshness_budget_exhausted: 1 },
    });
    expect(mockNearest).not.toHaveBeenCalled();
  } finally {
    if (before === undefined) delete process.env.FORECAST_CRON_TIME_BUDGET_MS;
    else process.env.FORECAST_CRON_TIME_BUDGET_MS = before;
  }
});


it('uses the existing CDIP diagnostic contract and tries at most one alternate station', async () => {
  mockCdipNearest.mockResolvedValueOnce('first').mockResolvedValueOnce('second');
  mockCdipFetch.mockResolvedValueOnce({ data: null, skipReason: 'cdip_404', errorMessage: 'private provider response' })
    .mockResolvedValueOnce({ data: { data: [{ timestamp: '2026-09-09T11:00:00Z',
      significantWaveHeight: 5, peakWavePeriod: 10 }] }, skipReason: 'success' });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.data.marineCoverage).toMatchObject({ actualCoverage: 1, providerOutcomes: { cdip_404: 1, success: 1 } });
  expect(mockCdipFetch).toHaveBeenCalledTimes(2);
  expect(mockCdipNearest.mock.calls[1][3]).toContain('first');
  expect(written[0][0].wave_height_m).toBe(5 * 0.3048);
  expect(JSON.stringify(body)).not.toContain('private');
});


it.each([
  { source: 'nws_wind', wave_height_m: null, wave_period_s: null },
  { wave_height_m: null },
  { wave_period_s: 0 },
  { ts: '2026-09-09T13:00:00Z' },
  { ts: '2026-09-08T12:00:00Z' },
])('does not skip unusable or stale cached waves: %j', async (overrides) => {
  latest = ['a', 'b', 'c'].map(beach_id => ({ beach_id, created_at: now.toISOString(),
    ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10, ...overrides }));
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(mockNearest).toHaveBeenCalledTimes(1);
  // Re-attempted, not treated as a no-op refresh; with no buoy in range that is a coverage gap.
  expect(response.status).toBe(200);
  expect(ledger[0].legitimately_zero_reason).toContain('no_wave_station_in_range');
});

it('records a legitimate no-op only for fresh usable wave coverage', async () => {
  latest = ['a', 'b', 'c'].map(beach_id => ({ beach_id, created_at: now.toISOString(),
    ts: '2026-09-09T11:00:00Z', wave_height_m: 0, wave_period_s: 10 }));
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine'));
  expect(response.status).toBe(200);
  expect(mockNearest).not.toHaveBeenCalled();
  expect(ledger[0]).toMatchObject({ status: 'ok', legitimately_zero_reason: 'No marine caches require refresh' });
});

it('degrades a failed cursor write while retaining usable wave totals', async () => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  failLedger = true;
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(body.data.totals.marine).toBe(14);
  expect(body.data.marineCoverage).toMatchObject({ actualCoverage: 1, rejectionCounts: { cursor_write_failed: 1 } });
  expect(ledger).toEqual([]);
  expect(ledgerAttempts).toBe(1);
  expect(JSON.stringify(body)).not.toContain('private');
});

it.each([{ significantWaveHeight: null }, { timestamp: 'invalid' }])(
  'tries the alternate when the first CDIP station has unusable points: %j', async (invalid) => {
    const point = { timestamp: '2026-09-09T11:00:00Z', significantWaveHeight: 5, peakWavePeriod: 10 };
    mockCdipNearest.mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    mockCdipFetch.mockResolvedValueOnce({ skipReason: 'success', data: { data: [{ ...point, ...invalid }] } })
      .mockResolvedValueOnce({ skipReason: 'success', data: { data: [point] } });
    const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
    expect(response.status).toBe(200);
    expect(mockCdipFetch).toHaveBeenCalledTimes(2);
    expect(written.flat()).toHaveLength(1);
    expect(written[0][0].wave_height_m).toBe(5 * 0.3048);
  },
);


it('reads fresh usable coverage past the PostgREST page limit', async () => {
  const wave = { ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10 };
  latest = [...Array.from({ length: 1000 }, () => ({ beach_id: 'a', ...wave, wave_period_s: 0 })),
    ...['a', 'b', 'c'].map(beach_id => ({ beach_id, ...wave }))];
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine'));
  expect(response.status).toBe(200);
  expect(mockNearest).not.toHaveBeenCalled();
});

it('keeps a usable CDIP point alongside malformed points', async () => {
  mockCdipNearest.mockResolvedValue('first');
  mockCdipFetch.mockResolvedValue({ skipReason: 'success', data: { data: [
    { timestamp: 'invalid', significantWaveHeight: 5, peakWavePeriod: 10 },
    { timestamp: '2026-09-09T11:00:00Z', significantWaveHeight: 0, peakWavePeriod: 10 },
  ] } });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(200);
  expect(mockCdipFetch).toHaveBeenCalledTimes(1);
  expect(written.flat()).toHaveLength(1);
  expect(written[0][0].wave_height_m).toBe(0);
});

it('bounds empty CDIP fallback to two stations and persists degraded coverage', async () => {
  mockCdipNearest.mockResolvedValueOnce('first').mockResolvedValueOnce('second').mockResolvedValue('third');
  mockCdipFetch.mockResolvedValue({ skipReason: 'success', data: { data: [] } });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(200);
  expect(mockCdipFetch).toHaveBeenCalledTimes(2);
  expect(ledger[0]).toMatchObject({ status: 'ok', produced: 0, legitimately_zero_reason: expect.stringContaining('no_recent_wave_observation') });
  expect(written).toEqual([]);
});


it.each([false, true])('checks the cursor acknowledgement through real PostgREST transport (failure: %s)', async (failCursor) => {
  const { createClient } = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  const inserted: Record<string, any>[] = [];
  const requests: { url: URL; method: string }[] = [];
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    requests.push({ url, method });
    if (url.pathname === '/rest/v1/beaches') return Response.json([{ id: 'a', name: 'a', lat: 32, lon: -117 }]);
    if (url.pathname === '/rest/v1/cron_runs' && method === 'GET') {
      return Response.json([]);
    }
    if (url.pathname === '/rest/v1/cron_runs' && method === 'POST') {
      inserted.push(JSON.parse(String(init?.body)));
      return failCursor ? Response.json({ message: 'private transport error', code: 'fixture' }, { status: 400 })
        : new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/marine_forecasts' && method === 'GET') {
      return Response.json([]);
    }
    if (url.pathname === '/rest/v1/marine_forecasts' && method === 'POST') {
      written.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected mocked request: ${method} ${url.pathname}`);
  });
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false },
  });
  mockFrom.mockImplementation(client.from.bind(client));
  mockNearest.mockResolvedValue({ id: 'fixture' });
  mockObservation.mockResolvedValue({ ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10 });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  const body = await response.json();
  expect(response.status).toBe(failCursor ? 503 : 200);
  expect(body.data.totals.marine).toBe(1);
  expect(body.data.marineCoverage.rejectionCounts).toEqual(failCursor ? { cursor_write_failed: 1 } : {});
  const cursorRequest = requests.find(({ url, method }) => url.pathname === '/rest/v1/cron_runs' && method === 'GET');
  expect(cursorRequest?.url.searchParams.get('summary->result->marineCoverage->>lastAttemptedBeachId')).toBe('not.is.null');
  expect(cursorRequest?.url.searchParams.get('route')).toBe('eq./api/cron/forecasts/refresh?source=marine');
  const inventoryRequest = requests.find(({ url }) => url.pathname === '/rest/v1/marine_forecasts'
    && url.searchParams.get('select')?.includes('beach_id'));
  expect(inventoryRequest?.url.searchParams.get('beach_id')).toBe('in.(a)');
  expect(inventoryRequest?.url.searchParams.get('is_observed')).toBe('eq.true');
  expect(inventoryRequest?.url.searchParams.get('source')).toBe('in.(cdip,ndbc)');
  expect(inventoryRequest?.url.searchParams.getAll('ts')).toEqual(['gte.2026-09-09T00:00:00.000Z', 'lte.2026-09-09T12:00:00.000Z']);
  expect(inventoryRequest?.url.searchParams.get('limit')).toBe('1000');
  expect(inserted).toHaveLength(1);
  expect(inserted[0].summary.result.marineCoverage.lastAttemptedBeachId).toBe('a');
  expect(written.flat()).toHaveLength(1);
  expect(JSON.stringify(body)).not.toContain('private');
});


it.each(['none', 'timeout', 'malformed', 'transport'])('bounds all 495 beaches and retains usable output after a freshness failure: %s', async (failure) => {
  const failBatch = failure !== 'none';
  const timeout = jest.spyOn(AbortSignal, 'timeout');
  const { createClient } = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  const beaches = Array.from({ length: 495 }, (_, i) => ({ id: `beach-${String(i).padStart(3, '0')}`, name: 'fixture', lat: 32, lon: -117 }));
  const checked: string[][] = [];
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname.endsWith('/beaches')) return Response.json(beaches);
    if (url.pathname.endsWith('/cron_runs')) {
      if (method === 'GET') return Response.json([]);
      ledger.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (url.pathname.endsWith('/marine_forecasts') && method === 'POST') {
      written.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (url.searchParams.get('select')?.includes('beach_id')) {
      const ids = (url.searchParams.get('beach_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',');
      checked.push(ids);
      if (!ids[0] || ids.length > 25) return Response.json({ code: '57014', message: 'private timeout' }, { status: 500 });
      if (failBatch && checked.length === 1) {
        if (failure === 'malformed') return Response.json(null);
        if (failure === 'transport') throw new DOMException('private timeout', 'TimeoutError');
        return Response.json({ code: '57014', message: 'private timeout' }, { status: 500 });
      }
      // Fresh valid-zero waves in the first 475; the final 20 need ingestion.
      return Response.json(ids.filter(id => id < 'beach-475').map(beach_id => ({ beach_id,
        ts: '2026-09-09T11:00:00Z', wave_height_m: 0, wave_period_s: 10 })));
    }
    return Response.json([]);
  });
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false },
  });
  mockFrom.mockImplementation(client.from.bind(client));
  mockNearest.mockResolvedValue({ id: 'fixture' });
  mockObservation.mockResolvedValue({ ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10 });
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=2'));
  const body = await response.json();
  expect(response.status).toBe(failBatch ? 503 : 200);
  expect(checked).toHaveLength(20);
  expect(timeout.mock.calls).toEqual(Array.from({ length: 20 }, () => [8000]));
  expect(checked.flat()).toEqual(beaches.map(b => b.id));
  expect(body.data.marineCoverage).toMatchObject({ expectedCoverage: 2, actualCoverage: 2,
    lastAttemptedBeachId: 'beach-476', freshnessCoverage: { expectedCoverage: 495, actualCoverage: failBatch ? 470 : 495 } });
  expect(written.flat().map(row => row.beach_id).sort()).toEqual(['beach-475', 'beach-476']);
  expect(ledger[0].status).toBe(failBatch ? 'failed' : 'ok');
  expect(body.data.marineCoverage.freshnessCoverage.failures).toEqual(failBatch ? [{
    beachIds: beaches.slice(0, 25).map(b => b.id), attemptedAt: now.toISOString(), attempts: 1,
    code: failure === 'timeout' ? '57014' : 'unknown',
  }] : []);
  expect(JSON.stringify(body)).not.toContain('private');
});

it.each([
  { budgetMs: 20_000, abortAfterMs: 8_000, checked: 1, produced: 1 },
  { budgetMs: 2_000, abortAfterMs: 2_000, checked: 0, produced: 0 },
])('cancels stalled HTTP within the remaining $budgetMs ms budget', async ({ budgetMs, abortAfterMs, checked, produced }) => {
  jest.replaceProperty(process, 'env', { ...process.env, FORECAST_CRON_TIME_BUDGET_MS: String(budgetMs) });
  // Native AbortSignal.timeout uses Node's internal clock; drive its signal with Jest's clock.
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation((delay: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('private transport timeout', 'TimeoutError')), delay);
    return controller.signal;
  });
  const { createClient } = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  const beaches = Array.from({ length: 26 }, (_, i) => ({ id: `beach-${String(i).padStart(3, '0')}`, name: 'fixture', lat: 32, lon: -117 }));
  const cursor = beaches[25].id;
  let inventoryRequests = 0;
  let aborts = 0;
  let stalledSignal: AbortSignal | null | undefined;
  let signalStarted!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname.endsWith('/beaches')) return Response.json(beaches);
    if (url.pathname.endsWith('/cron_runs')) {
      if (method === 'GET') return Response.json([{ summary: { result: { marineCoverage: { lastAttemptedBeachId: cursor } } } }]);
      ledger.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (url.pathname.endsWith('/marine_forecasts') && method === 'POST') {
      written.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (url.searchParams.get('select')?.includes('beach_id')) {
      inventoryRequests++;
      if (inventoryRequests === 1) {
        stalledSignal = init?.signal;
        signalStarted();
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw new Error('Missing request cancellation signal');
          const onAbort = (): void => { aborts++; reject(signal.reason); };
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort, { once: true });
        });
      }
    }
    return Response.json([]);
  });
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false },
  });
  mockFrom.mockImplementation(client.from.bind(client));
  mockNearest.mockResolvedValue({ id: 'fixture' });
  mockObservation.mockResolvedValue({ ts: '2026-09-09T11:00:00Z', wave_height_m: 1, wave_period_s: 10 });
  let settled = false;
  const pending = GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'))
    .then(response => { settled = true; return response; });
  await started;
  expect(stalledSignal).toBeInstanceOf(AbortSignal);
  expect(timeout).toHaveBeenNthCalledWith(1, abortAfterMs);
  await jest.advanceTimersByTimeAsync(abortAfterMs - 1);
  expect(aborts).toBe(0);
  expect(settled).toBe(false);
  expect(mockNearest).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(aborts).toBe(1);
  expect(stalledSignal?.aborted).toBe(true);
  const response = await pending;
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(inventoryRequests).toBe(1 + checked);
  expect(mockNearest).toHaveBeenCalledTimes(produced);
  expect(written.flat().map(row => row.beach_id)).toEqual(produced ? [cursor] : []);
  expect(body.data.marineCoverage).toMatchObject({ actualCoverage: produced, attemptedCoverage: produced,
    lastAttemptedBeachId: cursor, freshnessCoverage: { expectedCoverage: 26, actualCoverage: checked,
      failures: [{ beachIds: beaches.slice(0, 25).map(b => b.id), attempts: 1, code: 'unknown' }] } });
  expect(body.data.marineCoverage.rejectionCounts).toEqual(produced
    ? { freshness_read_failed: 1 } : { freshness_read_failed: 1, freshness_budget_exhausted: 1 });
  expect(ledger[0]).toMatchObject({ status: 'failed', legitimately_zero_reason: null });
  expect(JSON.stringify(body)).not.toContain('private');
});

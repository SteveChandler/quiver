/** @jest-environment node */
import { GET } from '@/app/api/cron/forecasts/refresh/route';

jest.mock('@/lib/cron/observability', () => ({ withObservedCron: (_: string, fn: unknown) => fn }));
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
  fetchLatestNDBCObservation: () => mockObservation(),
}));
jest.mock('@/lib/services/cdip', () => ({ CDIPService: jest.fn(() => ({
  getNearestStation: (...args: unknown[]) => mockCdipNearest(...args),
  fetchBuoyDataWithDiagnostics: (...args: unknown[]) => mockCdipFetch(...args),
})) }));
jest.mock('@/lib/services/nws-wind-service', () => ({ NwsWindService: jest.fn(() => ({ fetchHourlyWindPoints: async () => [] })) }));

const mockCdipNearest = jest.fn();
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
  for (const method of ['select', 'not', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'range']) builder[method] = () => builder;
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
  mockFrom.mockImplementation((table: string) => {
    if (table === 'beaches') return query(['a', 'b', 'c'].map((id, i) => ({ id, name: id, lat: 32 + i, lon: -117 })));
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

it('advances past a beach with no data on the next bounded run', async () => {
  const request = () => new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1');
  const first = await GET(request());
  const body = await first.json();
  expect(first.status).toBe(503);
  expect(body.data.marineCoverage.rejectionCounts.missing_wave_observation).toBe(1);
  expect(ledger[0].summary.result.marineCoverage.lastAttemptedBeachId).toBe('a');
  await GET(request());
  expect(mockNearest.mock.calls.map(args => args[0])).toEqual([32, 33]);
});

it('does not refresh an old observation or project it into fresh-looking data', async () => {
  mockNearest.mockResolvedValue({ id: 'fixture' });
  observed = { ts: '2026-09-06T12:00:00Z', wave_height_m: 1.6, wave_period_s: 10, source: 'ndbc' };
  mockObservation.mockResolvedValue(observed);
  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=marine&maxBeaches=1'));
  expect(response.status).toBe(503);
  expect(written).toEqual([]);
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
  expect(response.status).toBe(503);
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
      attemptedCoverage: 0, lastAttemptedBeachId: 'b', actualCoverage: 0, expectedCoverage: 1,
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
  expect(response.status).toBe(503);
  expect(mockNearest).toHaveBeenCalledTimes(1);
  expect(ledger[0]).toMatchObject({ status: 'failed', legitimately_zero_reason: null });
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
  latest = [...Array.from({ length: 1000 }, (_, i) => ({ beach_id: `other-${i}`, ...wave })),
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
  expect(response.status).toBe(503);
  expect(mockCdipFetch).toHaveBeenCalledTimes(2);
  expect(ledger[0]).toMatchObject({ status: 'failed', produced: 0 });
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
  expect(inventoryRequest?.url.searchParams.get('is_observed')).toBe('eq.true');
  expect(inventoryRequest?.url.searchParams.get('source')).toBe('in.(cdip,ndbc)');
  expect(inventoryRequest?.url.searchParams.getAll('ts')).toEqual(['gte.2026-09-09T00:00:00.000Z', 'lte.2026-09-09T12:00:00.000Z']);
  expect(inventoryRequest?.url.searchParams.get('limit')).toBe('1000');
  expect(inserted).toHaveLength(1);
  expect(inserted[0].summary.result.marineCoverage.lastAttemptedBeachId).toBe('a');
  expect(written.flat()).toHaveLength(1);
  expect(JSON.stringify(body)).not.toContain('private');
});

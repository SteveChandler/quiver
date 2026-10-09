/** @jest-environment node */
import { GET } from '@/app/api/cron/forecasts/refresh/route';

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  validateCronRequest: () => true,
  createSuccessResponse: (data: unknown) => Response.json({ success: true, data }),
  createErrorResponse: (error: string, details: unknown, status = 500) => Response.json({ error, details }, { status }),
  handleApiError: () => Response.json({ error: 'failed' }, { status: 500 }),
}));
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceRoleClient: () => mockClient }));
jest.mock('@/lib/services/ndbc-service', () => ({ getNearestNDBCStation: (...args: unknown[]) => mockNearest(...args) }));
jest.mock('@/lib/services/cdip', () => ({ CDIPService: jest.fn(() => ({ getNearestStation: async () => null })) }));
jest.mock('@/lib/services/nws-wind-service', () => ({ NwsWindService: jest.fn(() => ({ fetchHourlyWindPoints: async () => [] })) }));

const { createClient } = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
let mockClient: ReturnType<typeof createClient>;
const mockNearest = jest.fn();
type RunRow = {
  id: string;
  route: string;
  job: string;
  status: string;
  started_at: string;
  summary?: { result?: { marineCoverage?: { lastAttemptedBeachId?: string | null } } };
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockNearest.mockReset().mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

it.each([false, true])('resumes successive marine runs through both real wrappers (historical cursor: %s)', async historical => {
  const route = '/api/cron/forecasts/refresh';
  const job = `${route}?source=marine`;
  const rows: RunRow[] = historical ? [{ id: 'historical', route: job, job, status: 'ok',
    started_at: '2026-01-01T00:00:00Z', summary: { result: { marineCoverage: { lastAttemptedBeachId: 'a' } } } }] : [];
  const [firstBeach, secondBeach] = historical ? ['b', 'c'] : ['a', 'b'];
  const cursorQueries: URL[] = [];
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname === '/rest/v1/beaches') return Response.json(['a', 'b', 'c'].map((id, i) => ({ id, name: id, lat: 32 + i, lon: -117 })));
    if (url.pathname === '/rest/v1/marine_forecasts' && method === 'GET') return Response.json([]);
    if (url.pathname !== '/rest/v1/cron_runs') throw new Error(`Unexpected mocked request: ${method} ${url.pathname}`);
    if (method === 'POST') {
      const row: RunRow = { ...JSON.parse(String(init?.body)), id: `run-${rows.length}`, started_at: new Date(Date.now() + rows.length).toISOString() };
      rows.push(row);
      return Response.json({ id: row.id }, { status: 201 });
    }
    const matching = rows.filter(row => {
      for (const column of ['job', 'route', 'id', 'status'] as const) {
        const filter = url.searchParams.get(column);
        if (filter && filter !== `eq.${row[column]}`) return false;
      }
      const cutoff = url.searchParams.get('started_at');
      if (cutoff && row.started_at >= cutoff.slice(3)) return false;
      const cursorFilter = url.searchParams.get('summary->result->marineCoverage->>lastAttemptedBeachId');
      return !cursorFilter || row.summary?.result?.marineCoverage?.lastAttemptedBeachId != null;
    });
    if (method === 'PATCH') {
      for (const row of matching) Object.assign(row, JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (method !== 'GET') throw new Error(`Unexpected cron_runs method: ${method}`);
    cursorQueries.push(url);
    return Response.json(matching.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 1));
  });
  mockClient = createClient('http://localhost', 'fixture-key', {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const request = (): Request => new Request(`http://localhost${job}&maxBeaches=1`);
  const first = await GET(request());
  expect(first.status).toBe(200);
  expect((await first.json()).data.marineCoverage.lastAttemptedBeachId).toBe(firstBeach);
  const firstRow = rows[historical ? 1 : 0];
  expect(firstRow).toMatchObject({ route, job, status: 'ok',
    summary: { result: { marineCoverage: { lastAttemptedBeachId: firstBeach } }, cron_outcome: { job } } });

  const second = await GET(request());
  expect(second.status).toBe(200);
  expect((await second.json()).data.marineCoverage.lastAttemptedBeachId).toBe(secondBeach);
  expect(mockNearest.mock.calls.map(args => args[0])).toEqual(historical ? [33, 34] : [32, 33]);
  expect(rows).toHaveLength(historical ? 3 : 2);
  expect(rows.at(-1)).toMatchObject({ route, job, status: 'ok',
    summary: { result: { marineCoverage: { lastAttemptedBeachId: secondBeach } } } });
  expect(cursorQueries.map(url => url.searchParams.get('job'))).toEqual([`eq.${job}`, `eq.${job}`]);
  expect(cursorQueries.map(url => url.searchParams.get('summary->result->marineCoverage->>lastAttemptedBeachId'))).toEqual(['not.is.null', 'not.is.null']);
});

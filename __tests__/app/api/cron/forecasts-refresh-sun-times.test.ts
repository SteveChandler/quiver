/** @jest-environment node */
import { GET } from '@/app/api/cron/forecasts/refresh/route';
import { getLocalDateString } from '@/lib/utils/timezone-utils';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import SunCalc from 'suncalc';

jest.mock('@/lib/cron/observability', () => ({
  withObservedCron: (_: string, handler: unknown) => handler,
}));
jest.mock('@/lib/cron/outcome', () => ({
  withCronOutcome: async (_: unknown, handler: () => Promise<unknown>) => handler(),
}));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  validateCronRequest: () => true,
  createSuccessResponse: (data: unknown) => Response.json({ success: true, data }),
  createErrorResponse: (error: string, details: unknown, status = 500) => Response.json({ error, details }, { status }),
  handleApiError: () => Response.json({ error: 'failed' }, { status: 500 }),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: () => ({ from: mockFrom }),
}));
jest.mock('@/lib/services/cdip', () => ({ CDIPService: jest.fn() }));
jest.mock('@/lib/services/nws-wind-service', () => ({ NwsWindService: jest.fn() }));

const mockFrom = jest.fn();
const mockUpsert = jest.fn();
const mockBeachSelect = jest.fn();

type SunRow = {
  beach_id: string;
  date: string;
  sunrise_utc: string;
  sunset_utc: string;
  source: string;
  created_at: string;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-12T02:30:00Z') });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each([
  { name: 'San Diego', timezone: 'America/Los_Angeles', lat: 32.8, lon: -117.25, firstDay: 11 },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', lat: 35.3, lon: 139.5, firstDay: 12 },
  { name: 'Honolulu', timezone: 'Pacific/Honolulu', lat: 21.3, lon: -157.8, firstDay: 11 },
])('writes seven beach-local solar days for $name', async (beach) => {
  const getTimes = jest.spyOn(SunCalc, 'getTimes');
  mockBeachSelect.mockImplementation((fields: string) => {
    const result = { data: [{ id: 'beach', ...beach, timezone: fields.includes('timezone') ? beach.timezone : undefined }], error: null };
    const builder = {
      not: () => builder,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'beaches') return { select: mockBeachSelect };
    if (table === 'v_sun_times_latest') return { select: async () => ({ data: [], error: null }) };
    if (table === 'sun_times') return { upsert: mockUpsert };
    throw new Error(`Unexpected table: ${table}`);
  });

  const response = await GET(new Request('http://localhost/api/cron/forecasts/refresh?source=sun'));
  expect(response.status).toBe(200);
  expect((await response.json()).data.totals.sun).toBe(7);
  const rows: SunRow[] = mockUpsert.mock.calls.flatMap(([batch]: [SunRow[]]) => batch);
  const dates = Array.from({ length: 7 }, (_, index) => `2026-10-${beach.firstDay + index}`);
  expect(rows.map((row) => row.date)).toEqual(dates);
  expect(mockBeachSelect).toHaveBeenCalledWith(expect.stringContaining('timezone'));
  for (const row of rows) {
    expect(getLocalDateString(new Date(row.sunrise_utc), beach.timezone)).toBe(row.date);
    expect(getLocalDateString(new Date(row.sunset_utc), beach.timezone)).toBe(row.date);
    expect(getTimes).toHaveBeenCalledWith(localDateTimeToUTC(row.date, '12:00:00', beach.timezone), beach.lat, beach.lon);
    expect(row).toMatchObject({ beach_id: 'beach', source: 'computed', created_at: '2026-10-12T02:30:00.000Z' });
    expect(mockUpsert).toHaveBeenCalledWith([row], { onConflict: 'beach_id,date,source' });
  }
});

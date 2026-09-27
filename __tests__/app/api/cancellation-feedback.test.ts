/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/cancellation-feedback/route';

jest.mock('@supabase/realtime-js', () => ({ RealtimeClient: jest.fn(() => ({ setAuth: jest.fn(), disconnect: jest.fn() })) }));
jest.mock('@/lib/supabase/server', () => ({ ...jest.requireActual('@/lib/supabase/server'), createSupabaseServiceRoleClient: jest.fn() }));
const user = '11111111-1111-4111-8111-111111111111';
const originalFetch = global.fetch;
const originalEnabled = process.env.CANCELLATION_FEEDBACK_ENABLED;
const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.');
const event = { provider_event_id: 'event-1', event_type: 'CANCELLATION', period_type: 'TRIAL', cancellation_reason: 'UNSUBSCRIBE', event_timestamp: new Date().toISOString(), expiration_at: null };
let latest: typeof event | null;
let saved: { cancellation_event_id: string; outcome?: string; reason?: string | null; note?: string } | null;
const filters: unknown[][] = [];
const upsert = jest.fn();
const from = jest.fn((table: string) => {
  const chain: Record<string, jest.Mock> = {};
  for (const name of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
    chain[name] = jest.fn((...args) => { filters.push([table, name, ...args]); return chain; });
  }
  chain.maybeSingle = jest.fn(async () => ({ data: table === 'revenuecat_provider_events' ? latest : saved, error: null }));
  chain.upsert = upsert;
  return chain;
});
let requestNumber = 0;
function request(body?: unknown, authorized = true): NextRequest {
  return new NextRequest('http://localhost/api/cancellation-feedback', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: authorized ? `Bearer ${token}` : 'Bearer invalid', 'Content-Type': 'application/json', 'x-real-ip': `192.0.2.${++requestNumber}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const body = { cancellation_event_id: 'event-1', outcome: 'submitted', reason: 'avoid_charge', note: '', source: 'native_home', app_version: '1.0.4', app_build: '20' };
beforeEach(() => {
  process.env.CANCELLATION_FEEDBACK_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  filters.length = 0; from.mockClear(); upsert.mockReset();
  upsert.mockImplementation(async value => { saved ??= value; return { error: null }; });
  latest = { ...event }; saved = null;
  jest.mocked(createSupabaseServiceRoleClient).mockResolvedValue({ from } as never);
  global.fetch = jest.fn(async (_url, init) => {
    const valid = new Headers(init?.headers).get('authorization') === `Bearer ${token}`;
    return new Response(JSON.stringify(valid ? { id: user, email: 'fixture@example.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } : { message: 'Invalid JWT' }), { status: valid ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; process.env.CANCELLATION_FEEDBACK_ENABLED = originalEnabled; });

it('authenticates Bearer requests and scopes production cancellations to the account and recent window', async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ cancellation: { id: 'event-1', is_trial: true, cancelled_at: event.event_timestamp, expires_at: null } });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(filters).toEqual(expect.arrayContaining([
    ['revenuecat_provider_events', 'eq', 'app_user_id', user],
    ['revenuecat_provider_events', 'eq', 'environment', 'PRODUCTION'],
    ['revenuecat_provider_events', 'in', 'store', ['APP_STORE', 'PLAY_STORE']],
    ['revenuecat_provider_events', 'gte', 'event_timestamp', expect.any(String)],
    ['revenuecat_provider_events', 'order', 'event_timestamp', { ascending: false }],
    ['revenuecat_provider_events', 'limit', 1],
  ]));
});
it('rejects invalid auth without reading or writing feedback', async () => {
  expect((await POST(request(body, false))).status).toBe(401);
  expect(from).not.toHaveBeenCalled();
});
it.each(['UNCANCELLATION', 'INITIAL_PURCHASE', 'RENEWAL'])('does not prompt after a newer %s', async event_type => {
  latest = { ...event, event_type };
  expect(await (await GET(request())).json()).toEqual({ cancellation: null });
});
it.each(['BILLING_ERROR', 'CUSTOMER_SUPPORT', 'UNKNOWN', null])('excludes non-voluntary or unknown cancellation reason %s', async cancellation_reason => {
  latest = { ...event, cancellation_reason } as typeof event;
  expect(await (await GET(request())).json()).toEqual({ cancellation: null });
});
it('suppresses an already answered or dismissed cancellation', async () => {
  saved = { cancellation_event_id: 'event-1' };
  expect(await (await GET(request())).json()).toEqual({ cancellation: null });
});
it('saves with server ownership and uses conflict-ignore for retries and competing devices', async () => {
  expect((await POST(request(body))).status).toBe(200);
  expect(upsert).toHaveBeenCalledWith({ ...body, user_id: user }, { onConflict: 'cancellation_event_id', ignoreDuplicates: true });
});
it('accepts dismissal without inventing a reason', async () => {
  expect((await POST(request({ ...body, outcome: 'dismissed', reason: null }))).status).toBe(200);
});
it.each([{ ...body, user_id: user }, { ...body, reason: 'invented' }, { ...body, note: 'x'.repeat(2001) }, { ...body, outcome: 'dismissed' }])('rejects invalid submission before any database access', async invalid => {
  expect((await POST(request(invalid))).status).toBe(400);
  expect(from).not.toHaveBeenCalled();
});
it('rejects another account’s event and stale cancellation ids', async () => {
  expect((await POST(request({ ...body, cancellation_event_id: 'someone-elses-event' }))).status).toBe(409);
  expect(upsert).not.toHaveBeenCalled();
});
it('stays hidden and rejects writes while rollout is disabled', async () => {
  process.env.CANCELLATION_FEEDBACK_ENABLED = 'false';
  expect(await (await GET(request())).json()).toEqual({ cancellation: null });
  expect((await POST(request(body))).status).toBe(503);
  expect(from).not.toHaveBeenCalled();
});

it('accepts an identical retry but rejects a conflicting answer without claiming it was saved', async () => {
  saved = { ...body };
  expect((await POST(request(body))).status).toBe(200);
  expect((await POST(request({ ...body, note: 'Changed after a lost response' }))).status).toBe(409);
  expect(saved.note).toBe('');
});
it('returns a failure when persistence fails', async () => {
  upsert.mockResolvedValue({ error: new Error('Database unavailable') });
  expect((await POST(request(body))).status).toBe(500);
});

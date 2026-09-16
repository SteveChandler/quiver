/** @jest-environment node */
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/offers/route';
import fixtures from '@/contracts/pro-offers-v1.json';
jest.mock('@supabase/realtime-js', () => ({ RealtimeClient: jest.fn(() => ({ setAuth: jest.fn(), disconnect: jest.fn() })) }));
const mockRpc = jest.fn();
jest.mock('@/lib/email/lifecycle', () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
// Real withAuth, withRateLimit, Supabase SDK and cookie decoding. Only Auth's HTTP transport is substituted.
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const originalFetch = global.fetch;
function token(id: string): string {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture'].join('.');
}
let ip = 0;
function request(headers: Record<string,string>, address?: string): NextRequest {
  return new NextRequest('http://localhost/api/offers', { headers: { 'x-real-ip': address ?? `192.0.2.${++ip}`, ...headers } });
}
beforeEach(() => {
  process.env.PRO_OFFERS_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  mockRpc.mockClear(); mockRpc.mockImplementation(async (_name, args) => ({ ...fixtures.owned, offers: args.p_user_id === user ? fixtures.owned.offers : [] }));
  global.fetch = jest.fn(async (_url, options) => {
    const authorization = new Headers(options?.headers).get('authorization');
    const id = authorization === `Bearer ${token(user)}` ? user : authorization === `Bearer ${token(other)}` ? other : null;
    return new Response(JSON.stringify(id ? { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } : { message: 'Invalid JWT' }), { status: id ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });
it('validates Bearer identity and isolates the owned response', async () => {
  const response = await GET(request({ Authorization: `Bearer ${token(user)}` }));
  expect(response.status).toBe(200); expect(await response.json()).toEqual(fixtures.owned);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  const second = await GET(request({ Authorization: `Bearer ${token(other)}` }));
  expect(second.status).toBe(200); expect((await second.json()).offers).toEqual([]);
  expect(mockRpc).toHaveBeenLastCalledWith('list_owned_pro_offers', { p_user_id: other });
});
it('uses real SSR cookie decoding and validates that token through Auth', async () => {
  const session = { access_token: token(user), refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: user } };
  const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const response = await GET(request({ cookie }));
  expect(response.status).toBe(200); expect(mockRpc).toHaveBeenCalledWith('list_owned_pro_offers', { p_user_id: user });
});
it('invalid Bearer never falls back to a cookie or reaches the account RPC', async () => {
  expect((await GET(request({ Authorization: 'Bearer invalid' }))).status).toBe(401);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('the real rate limiter returns 429 with a retry time', async () => {
  let response: Response | undefined;
  for (let i=0; i<130; i++) {
    response = await GET(request({ Authorization: `Bearer ${token(user)}` }, '192.0.2.250'));
    if (response.status === 429) break;
  }
  expectConsoleWarnings([/Burst limit exceeded/, /RATE_LIMIT_VIOLATION/]);
  expect(response?.status).toBe(429); expect(Number(response?.headers.get('Retry-After'))).toBeGreaterThan(0);
});

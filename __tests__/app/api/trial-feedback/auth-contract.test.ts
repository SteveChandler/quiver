/** @jest-environment node */
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/trial-feedback/route';
import { POST as redeem } from '@/app/api/trial-feedback/redemption/route';
import fixtures from '@/contracts/trial-feedback-v1.json';
jest.mock('@supabase/realtime-js', () => ({ RealtimeClient: jest.fn(() => ({ setAuth: jest.fn(), disconnect: jest.fn() })) }));
const mockRpc = jest.fn(), mockRefresh = jest.fn();
jest.mock('@/lib/subscription/offer-automation', () => ({ refreshLifecycleUserEligibility: (...args: unknown[]) => mockRefresh(...args) }));
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
  return new NextRequest('http://localhost/api/trial-feedback', { headers: { 'x-real-ip': address ?? `192.0.2.${++ip}`, ...headers } });
}
beforeEach(() => {
  process.env.TRIAL_FEEDBACK_WORKER_ENABLED = 'true'; process.env.TRIAL_FEEDBACK_ENABLED = 'true'; process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  mockRpc.mockClear(); mockRpc.mockImplementation(async (_name, args) => ({ ...fixtures.available, user_id: args.p_user_id }));
  global.fetch = jest.fn(async (_url, options) => {
    const authorization = new Headers(options?.headers).get('authorization');
    const id = authorization === `Bearer ${token(user)}` ? user : authorization === `Bearer ${token(other)}` ? other : null;
    return new Response(JSON.stringify(id ? { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } : { message: 'Invalid JWT' }), { status: id ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });
it('validates Bearer identity and isolates the owned response', async () => {
  const response = await GET(request({ Authorization: `Bearer ${token(user)}` }));
  expect(response.status).toBe(200); expect(await response.json()).toEqual(fixtures.available);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  const second = await GET(request({ Authorization: `Bearer ${token(other)}` }));
  expect(second.status).toBe(200); expect((await second.json()).user_id).toBe(other);
  expect(mockRpc).toHaveBeenLastCalledWith('trial_feedback_context', { p_user_id: other });
});
it('uses real SSR cookie decoding and validates that token through Auth', async () => {
  const session = { access_token: token(user), refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: user } };
  const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const response = await GET(request({ cookie }));
  expect(response.status).toBe(200); expect(mockRpc).toHaveBeenCalledWith('trial_feedback_context', { p_user_id: user });
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

function mutation(body: unknown): NextRequest {
 return new NextRequest('http://localhost/api/trial-feedback', { method:'POST',headers:{Authorization:`Bearer ${token(user)}`,'Content-Type':'application/json','x-real-ip':`198.51.100.${++ip}`},body:JSON.stringify(body)});
}
it('saves feedback for the authenticated identity and rejects caller-supplied ownership',async () => {
 mockRpc.mockResolvedValue(fixtures.submitted);
 const body={request_id:other,reason:'time',note:'A little more time'};
 expect((await POST(mutation({...body,user_id:other}))).status).toBe(400);
 expect(mockRpc).not.toHaveBeenCalled();
 const response=await POST(mutation(body));expect(response.status).toBe(200);
 expect(await response.json()).toEqual(fixtures.submitted);
 expect(mockRpc).toHaveBeenCalledWith('submit_trial_feedback',{p_user_id:user,p_request_id:other,p_reason:'time',p_note:'A little more time',p_message_id:null});
});
it('requires explicit acceptance and uses the persisted reservation',async () => {
 expect((await redeem(mutation({action:'reserve',request_id:other,terms_version:'v1',accept:false}))).status).toBe(400);
 expect(mockRpc).not.toHaveBeenCalled();
 mockRpc.mockResolvedValue({...fixtures.submitted,reservation_id:other,redemption_state:'reserved'});
 const response=await redeem(mutation({action:'reserve',request_id:other,terms_version:'v1',accept:true}));
 expect(response.status).toBe(200);expect((await response.json()).reservation_id).toBe(other);
 expect(mockRpc).toHaveBeenCalledWith('reserve_trial_feedback_offer',{p_user_id:user,p_request_id:other,p_terms_version:'v1'});
});
it('paused redemption cannot reserve but still reconciles existing receipts',async () => {
 process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED='false';
 expect((await redeem(mutation({action:'reserve',request_id:other,terms_version:'v1',accept:true}))).status).toBe(503);
 expect(mockRpc).not.toHaveBeenCalled();
 mockRpc.mockResolvedValue(fixtures.submitted);
 const response=await redeem(mutation({action:'reconcile'}));expect(response.status).toBe(200);expect((await response.json()).offer).toBeNull();
 expect(mockRpc).toHaveBeenCalledWith('reconcile_trial_feedback',{p_user_id:user});
});
it('cannot reserve while receipt reconciliation is disabled',async () => {
 process.env.TRIAL_FEEDBACK_WORKER_ENABLED='false';
 expect((await redeem(mutation({action:'reserve',request_id:other,terms_version:'v1',accept:true}))).status).toBe(503);
 expect(mockRpc).not.toHaveBeenCalled();
});
it.each(['STRIPE','RC_BILLING'])('holds %s redemption until its billing adapter is implemented',async store => {
 mockRpc.mockResolvedValue({...fixtures.submitted,offer:{...fixtures.submitted.offer,store}});
 const response=await GET(request({Authorization:`Bearer ${token(user)}`}));
 expect(response.status).toBe(200);expect((await response.json()).offer).toBeNull();
 const reserved=await redeem(mutation({action:'reserve',request_id:other,terms_version:'v1',accept:true}));
 expect(reserved.status).toBe(409);expect(mockRpc.mock.calls.some(([name])=>name==='reserve_trial_feedback_offer')).toBe(false);
});
it('starts only the account-owned reservation and refuses a repeated provider handoff',async () => {
 let started=false;
 mockRpc.mockImplementation(async name => {
  if(name==='begin_trial_feedback_handoff') {const allowed=!started;started=true;return allowed;}
  return fixtures.submitted;
 });
 const body={action:'handoff',reservation_id:other};
 expect((await redeem(mutation(body))).status).toBe(200);
 expect(mockRpc).toHaveBeenCalledWith('begin_trial_feedback_handoff',{p_user_id:user,p_reservation_id:other});
 expect((await redeem(mutation(body))).status).toBe(409);
});

/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/cancellation-feedback/route';
import { GET as getOffers, POST as enroll } from '@/app/api/offers/route';
import fixtures from '@/contracts/pro-offers-v1.json';
const context = { management_store: 'APP_STORE', contract_version: 1, user_id: '11111111-1111-4111-8111-111111111111', cancellation_confirmed: false, feedback_submitted: false,
  offer: { program_id: 'cancellation_month', months: 1, terms_version: 'v1', award_id: null } };
jest.mock('@supabase/realtime-js', () => ({ RealtimeClient: jest.fn(() => ({ setAuth: jest.fn(), disconnect: jest.fn() })) }));
const mockRpc = jest.fn();
jest.mock('@/lib/email/lifecycle', () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
// Real withAuth, withRateLimit, Supabase SDK and cookie decoding. Only Auth's HTTP transport is substituted.
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const originalFetch = global.fetch;
function token(id: string): string {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: 4102444800 })).toString('base64url'), 'fixture'].join('.');
}
let ip = 0;
function request(headers: Record<string,string>, address?: string): NextRequest {
  return new NextRequest('http://localhost/api/cancellation-feedback', { headers: { 'x-real-ip': address ?? `192.0.2.${++ip}`, ...headers } });
}
beforeEach(() => {
  process.env.PRO_OFFERS_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  mockRpc.mockClear(); mockRpc.mockImplementation(async (_name, args) => ({ ...context, user_id: args.p_user_id }));
  global.fetch = jest.fn(async (_url, options) => {
    const authorization = new Headers(options?.headers).get('authorization');
    const id = authorization === `Bearer ${token(user)}` ? user : authorization === `Bearer ${token(other)}` ? other : null;
    return new Response(JSON.stringify(id ? { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } : { message: 'Invalid JWT' }), { status: id ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });
function mutation(body: unknown): NextRequest {
 return new NextRequest('http://localhost/api/cancellation-feedback', { method:'POST',headers:{Authorization:`Bearer ${token(user)}`,'Content-Type':'application/json','x-real-ip':`198.51.100.${++ip}`},body:JSON.stringify(body)});
}
it('authenticates bearer ownership and never accepts user-supplied ownership', async () => {
 expect((await GET(request({Authorization:'Bearer invalid'}))).status).toBe(401);
 expect(mockRpc).not.toHaveBeenCalled();
 expect((await GET(request({Authorization:`Bearer ${token(user)}`}))).status).toBe(200);
 expect(mockRpc).toHaveBeenCalledWith('cancellation_feedback_context',{p_user_id:user});
 mockRpc.mockClear();
 expect((await POST(mutation({action:'submit',request_id:other,reason:'feature',user_id:other}))).status).toBe(400);
 expect(mockRpc).not.toHaveBeenCalled();
});
it.each(['feature','technical','other'])('saves optional blank %s feedback while gifts are paused', async reason => {
 process.env.PRO_OFFERS_ENABLED='false'; mockRpc.mockResolvedValue(other);
 const response=await POST(mutation({action:'submit',request_id:other,reason}));
 expect(response.status).toBe(200); expect(await response.json()).toEqual({contract_version:1,submission_id:other});
 expect(mockRpc).toHaveBeenCalledWith('submit_cancellation_feedback',{p_user_id:user,p_request_id:other,p_reason:reason,p_note:''});
});
it('bounds notes and stores text without returning it', async () => {
 expect((await POST(mutation({action:'submit',request_id:other,reason:'technical',note:'x'.repeat(2001)}))).status).toBe(400);
 expect(mockRpc).not.toHaveBeenCalled();mockRpc.mockResolvedValue(other);
 const response=await POST(mutation({action:'submit',request_id:other,reason:'technical',note:'  My issue  '}));
 expect(response.status).toBe(200);expect(await response.json()).not.toHaveProperty('note');
 expect(mockRpc).toHaveBeenCalledWith('submit_cancellation_feedback',expect.objectContaining({p_note:'My issue'}));
});
it('requires explicit acceptance and trusts only the server award result', async () => {
 expect((await POST(mutation({action:'accept',request_id:other,terms_version:'v1',accept:false}))).status).toBe(400);
 expect(mockRpc).not.toHaveBeenCalled();mockRpc.mockResolvedValue(other);
 const response=await POST(mutation({action:'accept',request_id:other,terms_version:'v1',accept:true}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual({contract_version:1,award_id:other});
 expect(mockRpc).toHaveBeenCalledWith('accept_cancellation_gift',{p_user_id:user,p_request_id:other,p_terms_version:'v1',p_code_hash:expect.stringMatching(/^[a-f0-9]{64}$/)});
});
it('hides and blocks gifts when globally disabled while retaining feedback context', async () => {
 process.env.PRO_OFFERS_ENABLED='false';
 const response=await GET(request({Authorization:`Bearer ${token(user)}`}));
 expect(await response.json()).toEqual({...context,offer:null});mockRpc.mockClear();
 expect((await POST(mutation({action:'accept',request_id:other,terms_version:'v1',accept:true}))).status).toBe(503);
 expect(mockRpc).not.toHaveBeenCalled();
});
it('returns a recoverable HTTP error without exposing private text', async () => {
 mockRpc.mockRejectedValue(new Error('Private note database error'));
 const response=await POST(mutation({action:'submit',request_id:other,reason:'technical',note:'Private note'}));
 expect(response.status).toBe(409); expect(JSON.stringify(await response.json())).not.toContain('Private note');
});
it('preserves old client program responses; opt-in exposes the new account gifts', async () => {
 const original=fixtures.owned.offers[0];
 const owned={...fixtures.owned,offers:[original,{...original,award_id:other,program_id:'manual_month',months:1,earned:true}]};
 mockRpc.mockResolvedValue(owned);
 const legacy=await getOffers(request({Authorization:`Bearer ${token(user)}`}));
 expect((await legacy.json()).offers).toEqual([original]);
 const modernRequest=new NextRequest('http://localhost/api/offers?include_cancellation_gifts=true',{headers:{Authorization:`Bearer ${token(user)}`,'x-real-ip':`203.0.113.${++ip}`}});
 const modern=await getOffers(modernRequest);expect((await modern.json()).offers).toEqual(owned.offers);
 const response=await enroll(mutation({terms_version:'v1',accept:true}));
 expect(response.status).toBe(200);expect((await response.json()).offers).toEqual([original]);
});

it.each(['APP_STORE','PLAY_STORE','STRIPE','RC_BILLING',null])('returns authoritative management store %s without platform inference', async store => {
 mockRpc.mockResolvedValue({...context,management_store:store,offer:null});
 const response=await GET(request({Authorization:`Bearer ${token(user)}`}));
 expect(response.status).toBe(200);expect((await response.json()).management_store).toBe(store);
});

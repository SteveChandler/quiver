/** @jest-environment node */
import { createHmac } from 'node:crypto';
import { lifecycleRpc } from '@/lib/email/lifecycle';
import { fulfillProOffer, reconcileProOffers } from '@/lib/subscription/offer-fulfillment';
import { ownedOffersSchema } from '@/lib/subscription/offer-contract';
import { syncGmailReplies } from '@/lib/email/gmail-replies';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const url = process.env.EMAIL_CONTRACT_URL!;
const secret = process.env.EMAIL_CONTRACT_JWT_SECRET!;
const realFetch: typeof fetch = (globalThis as unknown as { emailContractFetch: typeof fetch }).emailContractFetch;
function jwt(role: string, sub?: string): string {
  const parts = [Buffer.from(JSON.stringify({ alg:'HS256',typ:'JWT' })).toString('base64url'),Buffer.from(JSON.stringify({ role, sub, exp:Math.floor(Date.now()/1000)+3600 })).toString('base64url')].join('.');
  return `${parts}.${createHmac('sha256',secret).update(parts).digest('base64url')}`;
}
async function rest(path: string, role = 'service_role', sub?: string, init?: RequestInit): Promise<Response> {
  return realFetch(`${url}/${path}`, { ...init, headers: { Authorization:`Bearer ${jwt(role,sub)}`, 'Content-Type':'application/json', ...init?.headers } });
}
const json = (body: unknown, status=200): Response => new Response(JSON.stringify(body),{status});
beforeAll(() => {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('Use the isolated HTTP contract runner');
  process.env.NEXT_PUBLIC_SUPABASE_URL=url; process.env.SUPABASE_SERVICE_ROLE_KEY=jwt('service_role');
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=jwt('anon'); process.env.PRO_OFFERS_ENABLED='true';
  process.env.REVENUECAT_SECRET_API_KEY='local-v1'; process.env.REVENUECAT_V2_SECRET_API_KEY='local-v2';process.env.REVENUECAT_PROJECT_ID='projfixture';
  global.fetch = ((input,init) => {
    const target=String(input).replace(`${url}/rest/v1/`,`${url}/`);
    if (!target.startsWith(`${url}/`)) throw new Error('External network forbidden in contract test');
    return realFetch(target,init);
  }) as typeof fetch;
});
it('runs enrollment → authenticated session replay → claim → provider receipt → product mirror and reply pause', async () => {
  expect(await lifecycleRpc('enroll_automatic_pro_offers')).toBe(2);
  expect(await lifecycleRpc('enroll_automatic_pro_offers')).toBe(0);
  for (let i=1;i<=5;i++) {
    const payload={id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`,user_id:user,status:'completed'};
    for(let replay=0;replay<2;replay++) {
      const response=await rest('sessions?on_conflict=id','authenticated',user,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
      expect(response.status).toBe(201);
    }
  }
  const forbidden=await rest('sessions','authenticated',other,{method:'POST',body:JSON.stringify({user_id:user,status:'completed'})});
  expect(forbidden.status).toBe(403);
  const sessions=await rest(`sessions?user_id=eq.${user}`); expect(await sessions.json()).toHaveLength(5);
  const offers=ownedOffersSchema.parse(await lifecycleRpc('list_owned_pro_offers',{p_user_id:user}));
  const award=offers.offers[0]; expect(award.earned).toBe(true);expect(award.completed_sessions).toBe(5);
  const noProvider=jest.fn();expect(await fulfillProOffer(other,award.award_id,noProvider)).toEqual({status:'not_found'});expect(noProvider).not.toHaveBeenCalled();
  let expiry: string|null=null; let posts=0;
  const provider: typeof fetch=async (input,init) => {
    const path=String(input);
    if(path.includes('/v2/')) return json(path.includes('/aliases')?{items:[{id:user}],next_page:null}:{id:user,project_id:'projfixture'});
    if(init?.method==='POST') { posts++;expiry=new Date(JSON.parse(String(init.body)).end_time_ms).toISOString();return json({}); }
    return json({subscriber:{original_app_user_id:user,entitlements:expiry?{'Quiver Pro':{product_identifier:'rc_promo_fixture',expires_date:expiry}}:{},subscriptions:expiry?{rc_promo_fixture:{store:'promotional',is_sandbox:false,expires_date:expiry}}:{}}});
  };
  const result=await fulfillProOffer(user,award.award_id,provider);expect(result).toMatchObject({status:'verified',mirror_verified:true});expect(posts).toBe(1);
  expect((await fulfillProOffer(user,award.award_id,provider)).status).toBe('verified');expect(posts).toBe(1);
  const grants=await rest(`earned_pro_grants?user_id=eq.${user}`); expect(await grants.json()).toHaveLength(1);
  const patch=await rest(`user_entitlements?user_id=eq.${user}`,'service_role',undefined,{method:'PATCH',body:JSON.stringify({is_pro:true,expires_at:expiry,product_id:'rc_promo_fixture'})});expect(patch.status).toBe(204);
  expect(await reconcileProOffers(provider)).toEqual({checked:0,unresolved:0});
  expect((await fulfillProOffer(user,award.award_id,provider))).toMatchObject({mirror_verified:true});
  Object.assign(process.env,{EMAIL_GMAIL_REPLY_SYNC_ENABLED:'true',EMAIL_GMAIL_ACCOUNT:'mail@gmail.com',EMAIL_REPLY_MAILBOX:'steve@quiversurf.app',EMAIL_GMAIL_CLIENT_ID:'fixture',EMAIL_GMAIL_CLIENT_SECRET:'fixture',EMAIL_GMAIL_REFRESH_TOKEN:'fixture'});
  const mailbox=jest.fn().mockResolvedValueOnce(json({access_token:'fixture'})).mockResolvedValueOnce(json({emailAddress:'mail@gmail.com'})).mockResolvedValueOnce(json({historyId:'102',history:[{messagesAdded:[{message:{id:'m1'}}]}]})).mockResolvedValueOnce(json({id:'m1',threadId:'t1',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'Surfer <surfer@example.com>'},{name:'To',value:'steve@quiversurf.app'},{name:'X-Forwarded-To',value:'mail@gmail.com'}]}}));
  expect(await syncGmailReplies(mailbox)).toEqual({processed:1});
  expect(await lifecycleRpc('evaluate_email_lifecycle',{p_user_id:user})).toMatchObject({status:'held',reason:'reply_paused'});
});

it('reconciles a lost grant response with GETs only and never grants twice', async () => {
  for (let i=1;i<=5;i++) expect((await rest('sessions','authenticated',other,{method:'POST',body:JSON.stringify({id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12,'0')}`,user_id:other,status:'completed'})})).status).toBe(201);
  const award=ownedOffersSchema.parse(await lifecycleRpc('list_owned_pro_offers',{p_user_id:other})).offers[0];
  let expiry: string|null=null;let posts=0;
  const provider: typeof fetch=async (input,init) => {
    const path=String(input);
    if(path.includes('/v2/')) return json(path.includes('/aliases')?{items:[{id:other}],next_page:null}:{id:other,project_id:'projfixture'});
    if(init?.method==='POST') {posts++;expiry=new Date(JSON.parse(String(init.body)).end_time_ms).toISOString();throw new TypeError('Response lost after provider grant');}
    return json({subscriber:{original_app_user_id:other,entitlements:expiry?{'Quiver Pro':{product_identifier:'rc_promo_fixture',expires_date:expiry}}:{},subscriptions:expiry?{rc_promo_fixture:{store:'promotional',is_sandbox:false,expires_date:expiry}}:{}}});
  };
  expect(await fulfillProOffer(other,award.award_id,provider)).toEqual({status:'reconciliation_required'});
  expect((await fulfillProOffer(other,award.award_id,provider)).status).toBe('reconciliation_required');expect(posts).toBe(1);
  expect(await reconcileProOffers(provider)).toEqual({checked:1,unresolved:0});
  expect(await fulfillProOffer(other,award.award_id,provider)).toMatchObject({status:'verified',mirror_verified:true});expect(posts).toBe(1);
  const denied=await rest('rpc/list_owned_pro_offers','authenticated',other,{method:'POST',body:JSON.stringify({p_user_id:user})});
  expect([401,403,404]).toContain(denied.status);
});

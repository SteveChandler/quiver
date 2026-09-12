/** @jest-environment node */
import { runProOfferAutomation, refreshLifecycleEligibility, refreshLifecycleUserEligibility } from '@/lib/subscription/offer-automation';
const mockRpc = jest.fn(), mockClaim = jest.fn(), mockReconcile = jest.fn(), mockRead = jest.fn();
jest.mock('@/lib/email/lifecycle', () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
jest.mock('@/lib/subscription/offer-fulfillment', () => ({ fulfillProOffer: (...args: unknown[]) => mockClaim(...args), reconcileProOffers: () => mockReconcile() }));
jest.mock('@/lib/subscription/offer-provider', () => ({ ...jest.requireActual('@/lib/subscription/offer-provider'), readOfferSubscriber: (...args: unknown[]) => mockRead(...args) }));
const user_id = '11111111-1111-4111-8111-111111111111', award_id = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { jest.resetAllMocks(); process.env.PRO_OFFERS_ENABLED = 'true'; process.env.REVENUECAT_SECRET_API_KEY = 'fixture'; });
it('automatically claims the due accepted reward and persists retry scheduling', async () => {
  mockRpc.mockImplementation(async name => name === 'email_automation_health' ? {approval_unavailable:0} : name === 'enroll_automatic_pro_offers' ? 1 : name === 'pro_offer_fulfillment_queue' ? [{ user_id, award_id }] : null);
  mockReconcile.mockResolvedValue({ checked: 0, unresolved: 0 }); mockClaim.mockResolvedValue({ status: 'held_active_access' });
  expect(await runProOfferAutomation()).toEqual({ checked: 0, unresolved: 0, attempted: 1, enrolled: 1 });
  expect(mockClaim).toHaveBeenCalledWith(user_id, award_id, fetch);
  expect(mockRpc).toHaveBeenLastCalledWith('defer_pro_offer_retry', { p_award_id: award_id });
});
it('disabled worker makes no RPCs or provider calls', async () => {
  delete process.env.PRO_OFFERS_ENABLED;
  expect((await runProOfferAutomation()).attempted).toBe(0); expect(mockRpc).not.toHaveBeenCalled();
});
it('reports expired program approval even when the fulfillment queue is empty', async () => {
 mockRpc.mockImplementation(async name => name === 'email_automation_health' ? {approval_unavailable:1} : name === 'enroll_automatic_pro_offers' ? 0 : []);
 mockReconcile.mockResolvedValue({checked:0,unresolved:0});
 expect(await runProOfferAutomation()).toEqual({checked:0,unresolved:1,attempted:0,enrolled:0});
 expect(mockClaim).not.toHaveBeenCalled();
});
it('failed provider reads never write fresh eligibility evidence', async () => {
  mockRpc.mockImplementation(async name => name === 'lifecycle_entitlement_queue' ? [user_id] : null);
  mockRead.mockRejectedValue(Error('offline'));
  expect(await refreshLifecycleEligibility()).toEqual({ checked: 0, failed: 1 });
  expect(mockRpc.mock.calls.some(([name]) => name === 'record_lifecycle_provider_snapshot')).toBe(false);
  expect(mockRpc).toHaveBeenCalledWith('record_lifecycle_entitlement_attempt', {p_user_id:user_id});
});

it('refreshes a newly paid user before a promo reservation without changing enrollment', async () => {
 mockRead.mockResolvedValue({entitlements:{'Quiver Pro':{expires_date:null,product_identifier:'paid'}},subscriptions:{}});
 await refreshLifecycleUserEligibility(user_id);
 expect(mockRead).toHaveBeenCalledWith(user_id,'fixture',fetch);
 expect(mockRpc.mock.calls).toEqual([['record_lifecycle_entitlement_attempt',{p_user_id:user_id}],['record_lifecycle_provider_snapshot',{p_user_id:user_id,p_active:true,p_trial:null}]]);
});

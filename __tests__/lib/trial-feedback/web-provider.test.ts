/** @jest-environment node */
import { assertOriginalWebTrial, extendWebTrial, readWebSubscription, verifyWebProduct, webManagementUrl, webSubscriptionSchema } from '@/lib/trial-feedback/web-provider';
import { readOfferSubscriber } from '@/lib/subscription/offer-provider';
jest.mock('@/lib/subscription/offer-provider', () => ({ readOfferSubscriber: jest.fn(async () => ({})) }));
const user = 'dddd0000-0000-4000-8000-000000000004';
const start = Date.now() - 86400000;
const end = start + 14 * 86400000;
const base = { object: 'subscription', id: 'subfixture', customer_id: user, original_customer_id: user, product_id: 'prodfixture', starts_at: start,
  current_period_starts_at: start, current_period_ends_at: end, store: 'rc_billing', environment: 'production', ownership: 'purchased', store_subscription_identifier: 'web-fixture',
  status: 'trialing', gives_access: true, pending_payment: false, auto_renewal_status: 'will_not_renew', total_revenue_in_usd: { currency: 'USD', gross: 0 } };
const originalFetch = global.fetch;
const env = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, { REVENUECAT_PROJECT_ID: 'projfixture', REVENUECAT_V2_SECRET_API_KEY: 'fixture', REVENUECAT_SECRET_API_KEY: 'fixture' });
  global.fetch = jest.fn(async () => new Response(JSON.stringify(base), { status: 200 })) as typeof fetch;
});
afterAll(() => { global.fetch = originalFetch; process.env = env; });
it('checks account aliases then reads the exact existing subscription', async () => {
  const result = await readWebSubscription(user, 'subfixture');
  expect(result.id).toBe('subfixture');
  expect(readOfferSubscriber).toHaveBeenCalledWith(user, 'fixture', expect.any(Function));
  expect(global.fetch).toHaveBeenCalledWith('https://api.revenuecat.com/v2/projects/projfixture/subscriptions/subfixture', expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'error' }));
});
it.each([
  { customer_id: 'different' }, { original_customer_id: 'different' }, { id: 'subdifferent' }, { environment: 'sandbox' },
  { store: 'app_store' }, { ownership: 'family_shared' }, { pending_changes: { auto_renewal_status: 'will_renew' } }, { product_change: { status: 'pending' } },
])('rejects mismatched/unsafe provider identity or scheduled changes: %j', async patch => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ ...base, ...patch }), { status: 200 })) as typeof fetch;
  await expect(readWebSubscription(user, 'subfixture')).rejects.toThrow();
});
it.each([{ items: [base, base], next_page: null }, { items: [], next_page: null }, { items: [base], next_page: '/more' }])('rejects ambiguous or incomplete discovery: %j', async list => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify(list), { status: 200 })) as typeof fetch;
  await expect(readWebSubscription(user)).rejects.toThrow();
});
it.each([
  { status: 'active' }, { gives_access: false }, { pending_payment: true }, { auto_renewal_status: 'will_renew' },
  { current_period_starts_at: start + 1000 }, { starts_at: start - 1000 }, { current_period_ends_at: end + 1000 },
  { total_revenue_in_usd: { currency: 'USD', gross: 0.01 } },
])('rejects a changed original trial: %j', patch => {
  expect(() => assertOriginalWebTrial(webSubscriptionSchema.parse({ ...base, ...patch }), new Date(start).toISOString(), new Date(end).toISOString())).toThrow('web_billing_trial_changed');
});
it('rejects a trial at the billing boundary', () => {
  const soon = Date.now() + 1000;
  expect(() => assertOriginalWebTrial(webSubscriptionSchema.parse({ ...base, current_period_ends_at: soon }), new Date(start).toISOString(), new Date(soon).toISOString())).toThrow();
});
it('requires the verified store product and original two-week trial', async () => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ id: 'prodfixture', store_identifier: 'different', type: 'subscription', state: 'active', subscription: { trial_duration: 'P2W' } }), { status: 200 })) as typeof fetch;
  await expect(verifyWebProduct(webSubscriptionSchema.parse(base), 'pro')).rejects.toThrow('web_billing_product_mismatch');
});
it('uses an absolute extension and never retries an uncertain response', async () => {
  global.fetch = jest.fn(async () => { throw new Error('token-bearing provider failure'); }) as typeof fetch;
  await expect(extendWebTrial('subfixture', new Date(end).toISOString())).rejects.toThrow('web_billing_request_unconfirmed');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/actions/extend'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ extend_until_ms: end }) }));
});
it.each(['https://evil.example/appfixture/subfixture?token=x', 'https://billing.revenuecat.com/appfixture/subwrong?token=x', 'https://billing.revenuecat.com/appfixture/subfixture', 'https://billing.revenuecat.com.evil.example/appfixture/subfixture?token=x', 'https://user@billing.revenuecat.com/appfixture/subfixture?token=x'])('rejects an unsafe portal URL: %s', async url => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ object: 'authenticated_management_url', management_url: url }), { status: 200 })) as typeof fetch;
  await expect(webManagementUrl('subfixture')).rejects.toThrow();
});

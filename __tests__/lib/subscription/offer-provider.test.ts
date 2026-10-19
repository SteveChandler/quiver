/** @jest-environment node */
import { readOfferSubscriber } from '@/lib/subscription/offer-provider';
const user = '11111111-1111-4111-8111-111111111111';
const anonymous = '$RCAnonymousID:abcdef';
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
beforeEach(() => { process.env.REVENUECAT_PROJECT_ID = 'projfixture'; process.env.REVENUECAT_V2_SECRET_API_KEY = 'v2-secret'; });
it('accepts a verified anonymous alias and uses separate v2/v1 credentials', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(json({ id: anonymous, project_id: 'projfixture' }))
    .mockResolvedValueOnce(json({ items: [{ id: user }, { id: anonymous }], next_page: null }))
    .mockResolvedValueOnce(json({ subscriber: { original_app_user_id: anonymous, entitlements: {}, subscriptions: {} } }));
  expect((await readOfferSubscriber(user, 'v1-secret', fetcher)).original_app_user_id).toBe(anonymous);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer v2-secret');
  expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer v1-secret');
});
it.each([404, 429, 500])('v2 %s never reaches v1 get-or-create', async status => {
  const fetcher = jest.fn().mockResolvedValue(json({}, status));
  await expect(readOfferSubscriber(user, 'fixture', fetcher)).rejects.toThrow('unavailable');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  { items: [{ id: user }, { id: '22222222-2222-4222-8222-222222222222' }], next_page: null },
  { items: [{ id: anonymous }], next_page: null },
  { items: [{ id: user }], next_page: 'https://evil.example/steal' },
])('rejects ambiguous accounts and unsafe/incomplete alias evidence', async aliases => {
  const fetcher = jest.fn().mockResolvedValueOnce(json({ id: anonymous, project_id: 'projfixture' })).mockResolvedValue(json(aliases));
  await expect(readOfferSubscriber(user, 'fixture', fetcher)).rejects.toThrow(/identity|pagination/);
  expect(fetcher.mock.calls.some(([url]) => url.includes('/v1/'))).toBe(false);
});
it('retries a timed-out RevenueCat read once instead of failing the user', async () => {
  const timeout = (): Promise<Response> => Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  const fetcher = jest.fn().mockImplementationOnce(timeout).mockResolvedValueOnce(json({ id: user, project_id: 'projfixture' }))
    .mockResolvedValueOnce(json({ items: [{ id: user }], next_page: null }))
    .mockImplementationOnce(timeout).mockResolvedValueOnce(json({ subscriber: { original_app_user_id: user, entitlements: {}, subscriptions: {} } }));
  expect((await readOfferSubscriber(user, 'v1-secret', fetcher)).original_app_user_id).toBe(user);
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it('gives up after a second timeout', async () => {
  const fetcher = jest.fn().mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  await expect(readOfferSubscriber(user, 'fixture', fetcher)).rejects.toThrow('timeout');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

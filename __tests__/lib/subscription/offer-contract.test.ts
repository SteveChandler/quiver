/** @jest-environment node */
import fixtures from '@/contracts/pro-offers-v1.json';
import { ownedOffersSchema, offerResultSchema, offerHttpStatus } from '@/lib/subscription/offer-contract';
it('validates the installed native contract including every result', () => {
  expect(ownedOffersSchema.parse(fixtures.owned)).toEqual(fixtures.owned);
  for (const result of fixtures.results) expect(offerResultSchema.parse(result)).toEqual(result);
  expect(fixtures.results.map(result => offerHttpStatus(offerResultSchema.parse(result)))).toEqual([200,200,409,503,404,409,409,409,503]);
});
it.each([{ status: 'verified' }, { status: 'not_earned', completed_sessions: 5 }, { status: 'preview', months: 12 }, { status: 'success' }])('rejects malformed success or invented state', value => {
  expect(offerResultSchema.safeParse(value).success).toBe(false);
});

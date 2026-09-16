import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OwnedOffers } from '@/app/offers/claim/owned-offers';
import fixture from '@/contracts/pro-offers-v1.json';
let mockUser = fixture.owned.user_id;
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { id: mockUser } }) }));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; mockUser = fixture.owned.user_id; });
it('saves the authenticated claim, presents waiting access truthfully and reloads persisted status', async () => {
  let claimed = false;
  const transport = jest.fn(async (input: RequestInfo | URL, _options?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/claim')) { claimed=true; return new Response(JSON.stringify({status:'held_active_access',contract_version:1}), {status:409}); }
    return new Response(JSON.stringify({...fixture.owned,offers:[{...fixture.owned.offers[0],claim_requested:claimed}]}), {status:200});
  }); global.fetch = transport;
  render(<OwnedOffers enabled />);
  fireEvent.click(await screen.findByRole('button',{name:'Accept and save my claim'}));
  await screen.findByText(/will start automatically after your current access ends/);
  expect(screen.queryByRole('button',{name:'Accept and save my claim'})).toBeNull();
  const claims = transport.mock.calls.filter(([path]) => String(path).endsWith('/claim'));
  expect(claims).toHaveLength(1);
  expect(JSON.parse(String(claims[0][1]?.body))).toEqual({awardId:fixture.owned.offers[0].award_id,mode:'claim'});
});
it('ignores a stale response from the previous account', async () => {
  let resolve: (value: unknown) => void = () => {};
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise(done => { resolve=done; })).mockResolvedValue({ok:true,status:200,json:async () => ({...fixture.owned,user_id:mockUser,offers:[],enrollment:null})});
  const view=render(<OwnedOffers enabled />);
  mockUser='22222222-2222-4222-8222-222222222222';view.rerender(<OwnedOffers enabled />);
  await screen.findByText(/No offers are available/);
  resolve({ok:true,status:200,json:async () => fixture.owned});
  await waitFor(() => expect(screen.queryByText('One month of Pro for five sessions')).toBeNull());
});

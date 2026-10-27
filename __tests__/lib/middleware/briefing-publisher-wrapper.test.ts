/** @jest-environment node */
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));

import { NextRequest, NextResponse } from 'next/server';
import { withBriefingPublisher } from '@/lib/middleware/api-wrappers/briefing-publisher-wrapper';

const PILOT = '23a9c100-dbee-4d1b-9178-3456a45935ad';
const TOKEN = 'p'.repeat(40);

function call(token: string | null = TOKEN) {
  const handler = jest.fn(async () => NextResponse.json({ ok: true }));
  const route = withBriefingPublisher(handler);
  const request = new NextRequest('http://localhost/api/internal/swell-briefing/input', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { handler, response: route(request) };
}

describe('withBriefingPublisher', () => {
  beforeEach(() => {
    process.env.SWELL_BRIEFING_ENABLED = 'true';
    process.env.SWELL_BRIEFING_PILOT_USER_ID = PILOT;
    process.env.SWELL_BRIEFING_PUBLISHER_TOKEN = TOKEN;
    delete process.env.SWELL_OUTLOOK_ENABLED;
    delete process.env.SWELL_OUTLOOK_USER_ALLOWLIST;
  });

  afterEach(() => {
    delete process.env.SWELL_BRIEFING_ENABLED;
    delete process.env.SWELL_BRIEFING_PILOT_USER_ID;
    delete process.env.SWELL_BRIEFING_PUBLISHER_TOKEN;
  });

  it('publishes for the pilot with the Swell Outlook flag off', async () => {
    const { handler, response } = call();
    expect((await response).status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.anything(), { userId: PILOT, region: 'san-diego' });
  });

  it('refuses a wrong token, and looks unconfigured when the briefing flag is off', async () => {
    expect((await call('x'.repeat(40)).response).status).toBe(401);
    delete process.env.SWELL_BRIEFING_ENABLED;
    const { handler, response } = call();
    expect((await response).status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});

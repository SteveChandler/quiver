import { expect, test, type BrowserContext } from '@playwright/test';
import { getProdReadonlyAuthBlockReason } from '../utils/prod-readonly-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function getAccessToken(context: BrowserContext): Promise<string> {
  const chunks = (await context.cookies())
    .filter(
      (cookie) =>
        cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'),
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true }),
    );
  const encoded = chunks.map((cookie) => cookie.value).join('');
  const raw = encoded.startsWith('base64-')
    ? Buffer.from(encoded.slice('base64-'.length), 'base64').toString('utf8')
    : decodeURIComponent(encoded);
  const session = JSON.parse(raw) as { access_token?: unknown };
  if (typeof session.access_token !== 'string' || !session.access_token) {
    throw new Error('Approved prod-readonly session has no access token');
  }
  return session.access_token;
}

test.describe.configure({ mode: 'serial' });

test.describe('Prod Read-Only Auth API', () => {
  let accessToken: string | null = null;

  test.beforeEach(async ({ context }) => {
    const blockReason = getProdReadonlyAuthBlockReason();
    // eslint-disable-next-line playwright/no-skipped-test -- auth specs are explicitly marked blocked when prod-readonly auth bootstrap fails.
    test.skip(Boolean(blockReason), blockReason ?? undefined);
    accessToken = await getAccessToken(context);
  });

  for (const [label, query] of [
    ['friends', 'page=1&limit=10&feed_type=friends'],
    ['nearby', 'page=1&limit=10&lat=32.75&lon=-117.25&radius_miles=30'],
  ] as const) {
    test(`@smoke authenticated public sessions ${label} feed remains healthy`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sessions/public?${query}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const body = await response.text();

      expect(response.status(), body).toBe(200);
      expect(response.headers()['cache-control']).toContain('private');
      const json = JSON.parse(body);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  }
});

import { expect, test } from '@playwright/test';
import { checkServerSession } from '../utils/auth-helpers';
import { getProdReadonlyAuthBlockReason } from '../utils/prod-readonly-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });

test.describe('Prod Read-Only Auth API', () => {
  test.beforeEach(async ({ page }) => {
    const blockReason = getProdReadonlyAuthBlockReason();
    // eslint-disable-next-line playwright/no-skipped-test -- auth specs are explicitly marked blocked when prod-readonly auth bootstrap fails.
    test.skip(Boolean(blockReason), blockReason ?? undefined);

    const session = await checkServerSession(page, { baseUrl: BASE_URL });
    expect(session.hasSession, 'Approved prod-readonly session must be active').toBe(true);
  });

  for (const [label, query] of [
    ['friends', 'page=1&limit=10&feed_type=friends'],
    ['nearby', 'page=1&limit=10&lat=32.75&lon=-117.25&radius_miles=30'],
  ] as const) {
    test(`@smoke authenticated public sessions ${label} feed remains healthy`, async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/sessions/public?${query}`);
      const body = await response.text();

      expect(response.status(), body).toBe(200);
      expect(response.headers()['cache-control']).toContain('private');
      const json = JSON.parse(body);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  }
});

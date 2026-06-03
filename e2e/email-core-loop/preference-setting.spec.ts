/**
 * E2E Tests: Retired Email Preference Links
 *
 * Legacy 1-tap preference links are intentionally no-op now. Keep one
 * request-level contract so old emails render the current retired/expired UX
 * without carrying the historical write-path fixmes.
 *
 * @project guest
 */

import { expect, test } from '@playwright/test';
import {
  generatePrefsToken,
  isEmailTokenTestingAvailable,
} from '../utils/email-token-helpers';

const TEST_USER_ID = '6faced01-8c47-4821-bf2f-cafb0cadca27';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Email Preference Setting retired-link contract', () => {
  test('valid legacy preference token returns the retired-link page', async ({ request }) => {
    skipWhen(!isEmailTokenTestingAvailable(), 'Requires email token secret');

    const token = await generatePrefsToken(TEST_USER_ID);
    const response = await request.get(`/api/prefs/set?time=dawn&token=${token}`);
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(html).toContain('Link retired');
    expect(html).toContain("This email-preference link isn&#39;t wired up anymore");
    expect(html).toContain('set your home beach and notification preferences');
    expect(html).toContain('Open Quiver');
    expect(html).not.toContain('Saved');
  });

  test('invalid or missing tokens return the expired-link page', async ({ request }) => {
    const invalidResponse = await request.get('/api/prefs/set?time=dawn&token=invalid');
    const missingResponse = await request.get('/api/prefs/set?time=dawn');
    const invalidHtml = await invalidResponse.text();
    const missingHtml = await missingResponse.text();

    expect(invalidResponse.status()).toBe(400);
    expect(missingResponse.status()).toBe(400);
    expect(invalidHtml).toContain('Link Expired');
    expect(missingHtml).toContain('Link Expired');
    expect(invalidHtml).not.toContain('Saved');
    expect(missingHtml).not.toContain('Saved');
  });
});

function skipWhen(condition: boolean, reason: string): void {
  // eslint-disable-next-line playwright/no-skipped-test -- valid-token coverage requires local EMAIL_TOKEN_SECRET matching the server.
  test.skip(condition, reason);
}

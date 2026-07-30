/**
 * Forecast Window OG Image API Contract Tests
 *
 * Public endpoint covered by the repo's API Playwright project.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OG_FORECAST_WINDOW_ENDPOINT = `${BASE_URL}/api/og/forecast-window`;
const VALID_WINDOW = '2026-06-03T14%3A30%3A00.000Z';

test.describe('Forecast Window OG Image API Contract', () => {
  test('returns a 1200x630 PNG for a valid slug and window', async ({ request }) => {
    const response = await request.get(
      `${OG_FORECAST_WINDOW_ENDPOINT}?slug=la-jolla-shores&window=${VALID_WINDOW}`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const body = await response.body();
    expect(body.length).toBeGreaterThan(1000);
    expect(body.readUInt32BE(16)).toBe(1200);
    expect(body.readUInt32BE(20)).toBe(630);
  });

  test('returns fallback PNGs for missing, malformed, and unknown inputs', async ({ request }) => {
    const paths = [
      OG_FORECAST_WINDOW_ENDPOINT,
      `${OG_FORECAST_WINDOW_ENDPOINT}?slug=la-jolla-shores&window=opaque-window`,
      `${OG_FORECAST_WINDOW_ENDPOINT}?slug=this-beach-does-not-exist-99999&window=${VALID_WINDOW}`,
    ];

    for (const path of paths) {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
      const body = await response.body();
      expect(body.length).toBeGreaterThan(1000);
      expect(body.readUInt32BE(16)).toBe(1200);
      expect(body.readUInt32BE(20)).toBe(630);
    }
  });

  test('disables caching so cards always render live forecast data', async ({ request }) => {
    const response = await request.get(
      `${OG_FORECAST_WINDOW_ENDPOINT}?slug=la-jolla-shores&window=${VALID_WINDOW}`,
    );
    const cacheControl = response.headers()['cache-control'] || '';

    expect(cacheControl).toContain('no-store');
  });
});

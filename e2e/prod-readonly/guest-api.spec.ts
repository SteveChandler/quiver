import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Prod Read-Only Guest API', () => {
  test('sitemap returns valid XML', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);

    const body = await response.text();
    expect(body).toMatch(/<urlset|<sitemapindex/);
    expect(body).toMatch(/<url>/);
  });

  test('beach OG endpoint returns an image', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/og/beach?slug=blacks`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/image\/(png|jpeg|webp)/);
  });

  test('deep health check reports a non-critical healthy payload', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health?deep=true`);

    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.data.status).not.toBe('critical');
    expect(json.data.checks.database).toBe(true);
    expect(json.data.checks.enhancedForecasts).toBeTruthy();
    expect(json.data.checks.enhancedForecasts.coverage).toBeGreaterThan(0);
  });

  test('featured beaches endpoint returns stable public fields', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/beaches/featured`);

    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(Array.isArray(json.data.beaches)).toBe(true);
    expect(json.data.beaches.length).toBeGreaterThan(0);

    const firstBeach = json.data.beaches[0];
    expect(firstBeach).toHaveProperty('id');
    expect(firstBeach).toHaveProperty('name');
    expect(firstBeach).toHaveProperty('slug');
  });

  for (const [label, query] of [
    ['global', 'page=1&limit=10'],
    ['friends', 'page=1&limit=10&feed_type=friends'],
    ['nearby', 'page=1&limit=10&lat=32.75&lon=-117.25&radius_miles=30'],
  ] as const) {
    test(`@smoke public sessions ${label} feed does not return a server error`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sessions/public?${query}`);
      const body = await response.text();

      expect(response.status(), body).toBe(200);
      const json = JSON.parse(body);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  }
});

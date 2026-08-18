/**
 * Guest Service Health Tests: Data Pipeline Validation
 *
 * Validates that production services are returning actual data, not just responding.
 * Tests the health check endpoint, featured beaches API, and beach page data rendering.
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';
import { TEST_BEACHES } from './fixtures/test-data';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { ensureLocalBeachForecastFixture } from './utils/local-supabase-fixtures';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BLACKS_BEACH_URL = buildBeachUrl(TEST_BEACHES.blacks);
const isLocalSupabaseTarget =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost');
const minForecastCoverage = isLocalSupabaseTarget ? 0 : 0.5;

test.describe('Service Health: Data Pipeline @smoke', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Service Health: Data Pipeline @smoke' });
  });

  test('Deep health check reports non-critical status @smoke @requires-data', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health?deep=true`);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const json = await response.json();

    expect(json.data.status).not.toBe('critical');

    expect(json.data.checks.database).toBe(true);
    expect(json.data.checks.enhancedForecasts).toBeTruthy();
    expect(json.data.checks.enhancedForecasts.coverage).toBeGreaterThan(minForecastCoverage);

    console.log('[Health Check]', {
      status: json.data.status,
      coverage: json.data.checks.enhancedForecasts.coverage,
      issues: json.data.issues?.length ?? 0,
    });

    test.info().annotations.push({
      type: 'health-status',
      description: `Status: ${json.data.status}, Coverage: ${json.data.checks.enhancedForecasts.coverage}`,
    });
  });

  test('Featured beaches endpoint returns data @smoke', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/beaches/featured`);

    expect(response.status()).toBe(200);

    const json = await response.json();

    expect(Array.isArray(json.data.beaches)).toBe(true);
    expect(json.data.beaches.length).toBeGreaterThan(0);

    const firstBeach = json.data.beaches[0];
    expect(firstBeach).toHaveProperty('id');
    expect(firstBeach).toHaveProperty('name');
    expect(firstBeach).toHaveProperty('slug');

    console.log(`[Featured Beaches] Returned ${json.data.beaches.length} beaches`);
  });
});

test.describe('Service Health: Beach Data Rendering @smoke', () => {
  let cleanupForecastFixture: (() => Promise<void>) | undefined;

  test.beforeAll(async () => {
    cleanupForecastFixture = await ensureLocalBeachForecastFixture({
      dataSource: 'e2e_guest_service_fixture',
      slug: 'blacks',
    });
  });

  test.afterAll(async () => {
    await cleanupForecastFixture?.();
  });

  test('Beach page renders wave data @smoke @requires-data', async ({ page }) => {
    await page.goto(BLACKS_BEACH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForLoadState('load', { timeout: 15000 });

    const forecastPanel = page.getByRole('tabpanel').filter({
      has: page.getByRole('heading', {
        name: /^(Current|Forecasted) Conditions$/i,
        level: 2,
      }),
    }).first();
    await expect(forecastPanel).toBeVisible({ timeout: 15000 });
    await expect(forecastPanel.getByText(/^Swell$/i).first()).toBeVisible();
    await expect(forecastPanel.getByText(/Face height|Forecast height/i).first()).toBeVisible();
    await expect(forecastPanel).toContainText(/\d+(\.\d+)?\s*ft/i);

    const text = await forecastPanel.textContent({ timeout: 1000 }).catch(() => '');
    const snippet = text?.slice(0, 200) ?? '';
    test.info().annotations.push({
      type: 'wave-data',
      description: `SurfCall: ${snippet}`,
    });
  });

  test('Beach page title contains wave info @smoke @requires-data', async ({ page }) => {
    await page.goto(BLACKS_BEACH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForLoadState('load', { timeout: 15000 });

    const title = await page.title();

    expect(title).toMatch(/blacks/i);
    expect(title).toMatch(/surf report|forecast/i);

    test.info().annotations.push({
      type: 'page-title',
      description: title,
    });
  });
});

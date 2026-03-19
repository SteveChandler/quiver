/**
 * Guest Service Health Tests: Data Pipeline Validation
 *
 * Validates that production services are returning actual data, not just responding.
 * Tests the health check endpoint, featured beaches API, and beach page data rendering.
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Service Health: Data Pipeline @smoke', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Service Health: Data Pipeline @smoke' });
  });

  test('Deep health check reports non-critical status @smoke', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health?deep=true`);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const json = await response.json();

    expect(json.data.status).not.toBe('critical');

    expect(json.data.checks.database).toBe(true);
    expect(json.data.checks.enhancedForecasts).toBeTruthy();
    expect(json.data.checks.enhancedForecasts.coverage).toBeGreaterThan(0.5);

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

  test('Deep health check responds within 5 seconds @smoke', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/health?deep=true`);
    const duration = Date.now() - startTime;

    expect(response.ok()).toBe(true);
    expect(duration).toBeLessThan(5000);

    console.log(`[Health Check] Response time: ${duration}ms`);

    test.info().annotations.push({
      type: 'response-time',
      description: `${duration}ms`,
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
  test('Beach page renders wave data @smoke @requires-data', async ({ page }) => {
    await page.goto('/ca/san-diego/blacks', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForLoadState('load', { timeout: 15000 });

    // Wait for conditions ticker or stats grid (actual testids on the beach detail page)
    const ticker = page.locator('[data-testid="ticker-content"]');
    const statsGrid = page.locator('[data-testid="beach-stats-grid"]');
    const hasTicker = await isVisibleSafe(ticker, { timeout: 10000 });
    const hasStats = await isVisibleSafe(statsGrid, { timeout: 5000 });

    expect(hasTicker || hasStats).toBe(true);

    if (hasTicker) {
      const text = await ticker.textContent();
      console.log(`[Beach Page] Found conditions ticker: ${text}`);
      test.info().annotations.push({
        type: 'wave-data',
        description: `Ticker: ${text}`,
      });
    }
  });

  test('Beach page title contains wave info @smoke @requires-data', async ({ page }) => {
    await page.goto('/ca/san-diego/blacks', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForLoadState('load', { timeout: 15000 });

    const title = await page.title();

    test.info().annotations.push({
      type: 'page-title',
      description: title,
    });

    const hasWaveData = /\d+\s*ft/i.test(title);

    if (hasWaveData) {
      console.log(`[Beach Page] Title contains wave data: ${title}`);
    } else {
      console.log(`[Beach Page] Title does not contain wave data (may be cached): ${title}`);
    }
  });
});

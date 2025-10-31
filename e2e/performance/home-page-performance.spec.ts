import { test, expect } from '@playwright/test';
import {
  collectWebVitals,
  collectPerformanceTimings,
  assertWebVitalsThresholds,
  collectNetworkMetrics,
  createPerformanceReport,
} from '../../__tests__/performance/helpers/web-vitals-helpers';

/**
 * Home Page Performance Test Suite
 *
 * Tests performance metrics for both authenticated and guest user flows on the home page.
 * Includes testing for:
 * - Page load time and Web Vitals
 * - Tab navigation performance
 * - Data fetching (beaches, sessions, profile)
 * - Search autocomplete
 * - Progressive loading for guest landing page
 */

test.describe('Home Page Performance (Authenticated)', () => {
  const HOME_URL = '/';

  test.beforeEach(async ({ page }) => {
    // Clear cookies and start fresh for each test
    await page.context().clearCookies();
  });

  test('should load home page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Wait for home screen to be visible
    await page.waitForSelector('[data-testid="home-screen"], .home-screen, main', {
      timeout: 5000,
      state: 'visible'
    });

    const loadTime = Date.now() - startTime;

    console.log(`[Home Page Load] ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should meet Web Vitals thresholds', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Collect Web Vitals with enough wait time for metrics to populate
    const metrics = await collectWebVitals(page, 4000);
    console.log('[Home Page Web Vitals]', JSON.stringify(metrics, null, 2));

    const { passed, failures } = assertWebVitalsThresholds(metrics, {
      lcp: 2500,  // Largest Contentful Paint
      fid: 100,   // First Input Delay
      cls: 0.1,   // Cumulative Layout Shift
      fcp: 1800,  // First Contentful Paint
    });

    if (!passed) {
      console.error('[Home Page Web Vitals] Failures:', failures);
    }

    expect(passed).toBe(true);
  });

  test('should have good performance timings', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    const timings = await collectPerformanceTimings(page);
    console.log('[Home Page Timings]', JSON.stringify(timings, null, 2));

    // DOM Content Loaded should be fast
    expect(timings.domContentLoaded).toBeLessThan(2000);

    // Complete load time
    expect(timings.loadComplete).toBeLessThan(3500);

    // First Paint should be quick
    if (timings.firstPaint > 0) {
      expect(timings.firstPaint).toBeLessThan(1500);
    }
  });

  test('should load data in parallel efficiently', async ({ page }) => {
    const startTime = Date.now();

    // Track network requests for data loading
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
      }
    });

    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    console.log(`[Home Page Data Load] ${loadTime}ms`);
    console.log(`[API Requests] ${apiRequests.length} requests:`, apiRequests);

    // Should make parallel requests for beaches, sessions, profile
    expect(apiRequests.length).toBeGreaterThan(0);

    // Total load should be reasonable
    expect(loadTime).toBeLessThan(3500);
  });

  test('should switch tabs quickly (Forecast → Nearby → Community)', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Wait for tabs to be present
    await page.waitForSelector('role=tablist', { timeout: 5000 });

    // Test Forecast → Nearby transition
    const forecastToNearbyStart = Date.now();
    const nearbyTab = page.getByRole('tab', { name: /nearby/i });
    await nearbyTab.click();
    await page.waitForSelector('[role="tabpanel"]');
    const forecastToNearbyTime = Date.now() - forecastToNearbyStart;

    console.log(`[Tab Switch: Forecast → Nearby] ${forecastToNearbyTime}ms`);
    expect(forecastToNearbyTime).toBeLessThan(200);

    // Test Nearby → Community transition
    const nearbyCommunityStart = Date.now();
    const communityTab = page.getByRole('tab', { name: /community/i });
    await communityTab.click();
    await page.waitForSelector('[role="tabpanel"]');
    const nearbyCommunityTime = Date.now() - nearbyCommunityStart;

    console.log(`[Tab Switch: Nearby → Community] ${nearbyCommunityTime}ms`);
    expect(nearbyCommunityTime).toBeLessThan(200);

    // Test Community → Forecast transition
    const communityForecastStart = Date.now();
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();
    await page.waitForSelector('[role="tabpanel"]');
    const communityForecastTime = Date.now() - communityForecastStart;

    console.log(`[Tab Switch: Community → Forecast] ${communityForecastTime}ms`);
    expect(communityForecastTime).toBeLessThan(200);
  });

  test('should have responsive beach search autocomplete', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Find search input (may be in different locations depending on tab)
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[aria-label*="search" i]').first();

    // Wait for search to be available
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    const startTime = Date.now();

    // Type search query
    await searchInput.fill('Ocean');

    // Wait for autocomplete results
    await page.waitForSelector('role=option, [role="listbox"], .autocomplete-results', {
      timeout: 2000,
      state: 'visible'
    }).catch(() => {
      // Some implementations may not show results immediately
      console.log('[Search] No immediate autocomplete results');
    });

    const responseTime = Date.now() - startTime;

    console.log(`[Beach Search Autocomplete] ${responseTime}ms`);
    expect(responseTime).toBeLessThan(800);
  });

  test('should have efficient network usage', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    const networkMetrics = await collectNetworkMetrics(page);
    console.log('[Home Page Network Metrics]', JSON.stringify(networkMetrics, null, 2));

    // Should not have excessive requests
    expect(networkMetrics.totalRequests).toBeLessThan(100);

    // Total transfer size should be reasonable (in bytes)
    expect(networkMetrics.totalSize).toBeLessThan(3 * 1024 * 1024); // 3MB

    // Slowest request should not be too slow
    if (networkMetrics.slowestRequest.duration > 0) {
      expect(networkMetrics.slowestRequest.duration).toBeLessThan(5000);
    }
  });

  test('should render above-the-fold content quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(HOME_URL);

    // Wait for critical above-the-fold elements
    await Promise.race([
      page.waitForSelector('.welcome-section, [data-testid="welcome"], h1', {
        state: 'visible',
        timeout: 3000
      }),
      page.waitForSelector('role=tablist', {
        state: 'visible',
        timeout: 3000
      }),
    ]);

    const renderTime = Date.now() - startTime;

    console.log(`[Above-the-fold Render] ${renderTime}ms`);
    expect(renderTime).toBeLessThan(1500);
  });
});

test.describe('Home Page Performance (Guest Landing Page)', () => {
  const HOME_URL = '/';

  test.use({
    storageState: { cookies: [], origins: [] } // Guest context
  });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should load landing page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Wait for landing page hero
    await page.waitForSelector('.hero-section, [data-testid="hero"], h1', {
      timeout: 5000,
      state: 'visible'
    });

    const loadTime = Date.now() - startTime;

    console.log(`[Landing Page Load] ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should meet Web Vitals thresholds for landing page', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    const metrics = await collectWebVitals(page, 4000);
    console.log('[Landing Page Web Vitals]', JSON.stringify(metrics, null, 2));

    const { passed, failures } = assertWebVitalsThresholds(metrics, {
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      fcp: 1800,
    });

    if (!passed) {
      console.error('[Landing Page Web Vitals] Failures:', failures);
    }

    expect(passed).toBe(true);
  });

  test('should render hero section quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(HOME_URL);

    // Wait for hero section to be visible
    await page.waitForSelector('.hero-section, [data-testid="hero"], h1', {
      state: 'visible',
      timeout: 3000
    });

    const heroRenderTime = Date.now() - startTime;

    console.log(`[Landing Page Hero LCP] ${heroRenderTime}ms`);
    expect(heroRenderTime).toBeLessThan(1500);
  });

  test('should progressively load sections with IntersectionObserver', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Check that sections load as user scrolls
    // Hero should be visible immediately
    const heroVisible = await page.isVisible('.hero-section, [data-testid="hero"]', { timeout: 1000 });
    expect(heroVisible).toBe(true);

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // Check that more sections become visible
    const sectionsLoaded = await page.locator('section').count();
    console.log(`[Progressive Loading] ${sectionsLoaded} sections loaded`);

    expect(sectionsLoaded).toBeGreaterThan(1);
  });

  test('should have good search functionality performance', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Find search input on landing page
    const searchInput = page.locator('input[type="search"], input[placeholder*="beach" i], input[aria-label*="search" i]').first();

    // Wait for search to be available
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    const startTime = Date.now();

    await searchInput.fill('San Diego');

    // Wait for some response (autocomplete or navigation)
    await page.waitForTimeout(500);

    const responseTime = Date.now() - startTime;

    console.log(`[Landing Page Search] ${responseTime}ms`);
    expect(responseTime).toBeLessThan(1000);
  });

  test('should have efficient network usage on landing page', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    const networkMetrics = await collectNetworkMetrics(page);
    console.log('[Landing Page Network Metrics]', JSON.stringify(networkMetrics, null, 2));

    // Landing page should be lightweight
    expect(networkMetrics.totalRequests).toBeLessThan(80);

    // Images should be optimized
    if (networkMetrics.byType.image) {
      console.log(`[Images] ${networkMetrics.byType.image.count} images, ${networkMetrics.byType.image.size} bytes`);
    }
  });

  test('should have low Cumulative Layout Shift (CLS)', async ({ page }) => {
    await page.goto(HOME_URL);
    await page.waitForLoadState('networkidle');

    // Scroll to trigger any potential layout shifts
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await page.waitForTimeout(500);

    const metrics = await collectWebVitals(page, 2000);

    console.log(`[Landing Page CLS] ${metrics.cls}`);
    expect(metrics.cls).toBeLessThan(0.1);
  });
});

test.describe('Home Page Performance (Cross-flow)', () => {
  test('should generate comprehensive performance report', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await collectWebVitals(page, 4000);
    const timings = await collectPerformanceTimings(page);

    const report = createPerformanceReport(metrics, timings);

    console.log('\n' + '='.repeat(60));
    console.log('HOME PAGE PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(report);
    console.log('='.repeat(60) + '\n');

    // Report should be generated successfully
    expect(report).toBeTruthy();
    expect(report.length).toBeGreaterThan(0);
  });
});

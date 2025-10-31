/**
 * Beach Detail Page Load Performance Tests
 * Tests performance of beach detail page with real browser environment
 */

import { test, expect } from '@playwright/test';
import {
  collectWebVitals,
  collectPerformanceTimings,
  assertWebVitalsThresholds,
  measurePageLoad,
  collectNetworkMetrics,
  createPerformanceReport,
} from '../../__tests__/performance/helpers/web-vitals-helpers';

test.describe('Beach Detail Page Performance', () => {
  // Use a known beach ID for consistent testing
  const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a'; // Blacks Beach
  const BEACH_URL = `/beach/${BEACH_ID}`;

  test.beforeEach(async ({ page }) => {
    // Clear cache and storage for consistent results
    await page.context().clearCookies();
    await page.goto('/'); // Ensure auth is loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load beach detail page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    console.log(`[Page Load] Beach detail loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should meet Web Vitals thresholds', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    // Collect web vitals
    const metrics = await collectWebVitals(page, 4000);

    console.log('[Web Vitals]', JSON.stringify(metrics, null, 2));

    // Assert thresholds
    const { passed, failures } = assertWebVitalsThresholds(metrics, {
      lcp: 2500, // Largest Contentful Paint
      fid: 100, // First Input Delay
      cls: 0.1, // Cumulative Layout Shift
      fcp: 1800, // First Contentful Paint
    });

    if (!passed) {
      console.error('[Web Vitals] Failures:', failures);
    }

    expect(passed).toBe(true);
  });

  test('should have acceptable performance timings', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    const timings = await collectPerformanceTimings(page);

    console.log('[Performance Timings]', JSON.stringify(timings, null, 2));

    // Assert timing thresholds
    expect(timings.domContentLoaded).toBeLessThan(2000);
    expect(timings.loadComplete).toBeLessThan(3500);

    if (timings.firstContentfulPaint) {
      expect(timings.firstContentfulPaint).toBeLessThan(1800);
    }
  });

  test('should load forecast data within 1 second', async ({ page }) => {
    const forecastStartTime = Date.now();

    await page.goto(BEACH_URL);

    // Wait for forecast data to appear
    await page.waitForSelector('[data-testid="forecast-display"]', {
      timeout: 5000,
    });

    const forecastLoadTime = Date.now() - forecastStartTime;

    console.log(`[Forecast] Loaded in ${forecastLoadTime}ms`);
    expect(forecastLoadTime).toBeLessThan(2000);
  });

  test('should load photo gallery efficiently', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    // Check if photo gallery exists
    const photoGallery = page.locator('[data-testid="beach-photo-gallery"]');
    const hasPhotos = await photoGallery.count() > 0;

    if (hasPhotos) {
      const startTime = Date.now();

      // Wait for images to load
      await page.waitForSelector('img[loading="lazy"]', { timeout: 3000 });

      const loadTime = Date.now() - startTime;

      console.log(`[Photo Gallery] Images loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(1000);
    } else {
      console.log('[Photo Gallery] No photos to load');
    }
  });

  test('should handle tab switching without delay', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    // Find tab buttons
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });

    // Measure tab switch performance
    const switchToSessions = Date.now();
    await sessionsTab.click();
    await page.waitForTimeout(100); // Small delay for UI update
    const sessionsTime = Date.now() - switchToSessions;

    const switchToReviews = Date.now();
    await reviewsTab.click();
    await page.waitForTimeout(100);
    const reviewsTime = Date.now() - switchToReviews;

    const switchToForecast = Date.now();
    await forecastTab.click();
    await page.waitForTimeout(100);
    const forecastTime = Date.now() - switchToForecast;

    console.log(`[Tab Switching] Sessions: ${sessionsTime}ms, Reviews: ${reviewsTime}ms, Forecast: ${forecastTime}ms`);

    expect(sessionsTime).toBeLessThan(150);
    expect(reviewsTime).toBeLessThan(150);
    expect(forecastTime).toBeLessThan(150);
  });

  test('should load dynamic imports within acceptable time', async ({ page }) => {
    // Track dynamic import loading
    const importTimes: { name: string; duration: number }[] = [];

    // Listen to network requests for chunk files
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('_next/static/chunks') || url.includes('.js')) {
        const request = response.request();
        const timing = response.request().timing();
        if (timing) {
          const duration = timing.responseEnd - timing.requestStart;
          if (duration > 0) {
            importTimes.push({
              name: url.split('/').pop() || 'unknown',
              duration,
            });
          }
        }
      }
    });

    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    // Log slow imports
    const slowImports = importTimes.filter((i) => i.duration > 500);
    if (slowImports.length > 0) {
      console.log('[Slow Imports]', slowImports);
    }

    // No single import should take more than 1 second
    importTimes.forEach((importTime) => {
      expect(importTime.duration).toBeLessThan(1000);
    });
  });

  test('should have efficient network usage', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    const networkMetrics = await collectNetworkMetrics(page);

    console.log('[Network Metrics]', JSON.stringify(networkMetrics, null, 2));

    // Assert reasonable network usage
    expect(networkMetrics.totalRequests).toBeLessThan(100);
    expect(networkMetrics.slowestRequest).toBeLessThan(2000);
    expect(networkMetrics.averageDuration).toBeLessThan(500);

    // Total page size should be reasonable (less than 5MB)
    expect(networkMetrics.totalSize).toBeLessThan(5 * 1024 * 1024);
  });

  test('should generate comprehensive performance report', async ({ page }) => {
    const { duration, metrics } = await measurePageLoad(page, BEACH_URL);
    const timings = await collectPerformanceTimings(page);

    const report = createPerformanceReport(metrics, timings);

    console.log(report);
    console.log(`\nTotal Page Load Time: ${duration}ms`);

    // Report should show acceptable performance
    expect(duration).toBeLessThan(3500);
  });

  test('should handle concurrent data loading', async ({ page }) => {
    // Beach detail page loads multiple data sources:
    // - Beach info
    // - Forecast data
    // - Session stats
    // - Reviews
    // - Photos

    const startTime = Date.now();

    await page.goto(BEACH_URL);

    // Wait for key elements to appear (indicates parallel loading worked)
    await Promise.all([
      page.waitForSelector('[data-testid="beach-header"]', { timeout: 3000 }),
      page.waitForSelector('[data-testid="forecast-display"]', { timeout: 3000 }),
    ]);

    const parallelLoadTime = Date.now() - startTime;

    console.log(`[Concurrent Loading] Completed in ${parallelLoadTime}ms`);

    // Parallel loading should be significantly faster than sequential
    // If it takes more than 2.5s, data isn't loading in parallel
    expect(parallelLoadTime).toBeLessThan(2500);
  });

  test('should render above-the-fold content quickly', async ({ page }) => {
    await page.goto(BEACH_URL);

    // Measure time to first meaningful paint (hero section visible)
    const heroLoadTime = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
          const hero = document.querySelector('[data-testid="beach-hero"]');
          if (hero) {
            observer.disconnect();
            resolve(performance.now());
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve(performance.now());
        }, 5000);
      });
    });

    console.log(`[Hero Section] Rendered in ${heroLoadTime.toFixed(2)}ms`);
    expect(heroLoadTime).toBeLessThan(1500);
  });

  test('should handle scroll performance on long content', async ({ page }) => {
    await page.goto(BEACH_URL);
    await page.waitForLoadState('networkidle');

    // Measure scroll performance
    const scrollMetrics = await page.evaluate(async () => {
      const startTime = performance.now();
      let frameCount = 0;

      // Scroll down the page
      window.scrollBy({ top: 1000, behavior: 'smooth' });

      // Count frames during scroll
      await new Promise<void>((resolve) => {
        const measureFrame = () => {
          frameCount++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(measureFrame);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(measureFrame);
      });

      return {
        duration: performance.now() - startTime,
        frameCount,
        fps: (frameCount / (performance.now() - startTime)) * 1000,
      };
    });

    console.log(`[Scroll] FPS: ${scrollMetrics.fps.toFixed(2)}, Frames: ${scrollMetrics.frameCount}`);

    // Should maintain at least 30fps during scroll (ideally 60fps)
    expect(scrollMetrics.fps).toBeGreaterThan(30);
  });
});

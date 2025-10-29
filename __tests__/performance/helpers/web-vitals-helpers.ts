/**
 * Web Vitals helpers for Playwright E2E performance testing
 */

import type { Page } from '@playwright/test';

export interface WebVitalsMetrics {
  cls?: number; // Cumulative Layout Shift
  fid?: number; // First Input Delay
  lcp?: number; // Largest Contentful Paint
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  inp?: number; // Interaction to Next Paint
}

export interface PerformanceTimings {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

/**
 * Collect Web Vitals metrics from a Playwright page
 * Uses the web-vitals library if available, falls back to Performance API
 */
export async function collectWebVitals(
  page: Page,
  waitTime: number = 3000
): Promise<WebVitalsMetrics> {
  // Inject web vitals collection script
  await page.addInitScript(() => {
    (window as any).__webVitalsMetrics = {};

    // Try to use web-vitals library if available
    if (typeof (window as any).webVitals !== 'undefined') {
      const { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } = (window as any).webVitals;

      onCLS((metric: any) => {
        (window as any).__webVitalsMetrics.cls = metric.value;
      });
      onFID((metric: any) => {
        (window as any).__webVitalsMetrics.fid = metric.value;
      });
      onLCP((metric: any) => {
        (window as any).__webVitalsMetrics.lcp = metric.value;
      });
      onFCP((metric: any) => {
        (window as any).__webVitalsMetrics.fcp = metric.value;
      });
      onTTFB((metric: any) => {
        (window as any).__webVitalsMetrics.ttfb = metric.value;
      });
      if (onINP) {
        onINP((metric: any) => {
          (window as any).__webVitalsMetrics.inp = metric.value;
        });
      }
    }
  });

  // Wait for metrics to be collected
  await page.waitForTimeout(waitTime);

  // Collect metrics
  const metrics = await page.evaluate(() => {
    const collected: WebVitalsMetrics = (window as any).__webVitalsMetrics || {};

    // Fallback to Performance API if web-vitals not available
    if (!collected.lcp && window.performance) {
      const perfEntries = performance.getEntriesByType('largest-contentful-paint');
      if (perfEntries.length > 0) {
        const lcpEntry = perfEntries[perfEntries.length - 1] as any;
        collected.lcp = lcpEntry.renderTime || lcpEntry.loadTime;
      }
    }

    if (!collected.fcp && window.performance) {
      const perfEntries = performance.getEntriesByType('paint');
      const fcpEntry = perfEntries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        collected.fcp = fcpEntry.startTime;
      }
    }

    if (!collected.cls && (window as any).PerformanceObserver) {
      // CLS is harder to get without the library, this is approximate
      let cls = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            cls += (entry as any).value || 0;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        collected.cls = cls;
      } catch (e) {
        // Layout shift API not available
      }
    }

    return collected;
  });

  return metrics;
}

/**
 * Collect performance timing information
 */
export async function collectPerformanceTimings(page: Page): Promise<PerformanceTimings> {
  return await page.evaluate(() => {
    const timing = performance.timing;
    const navigationStart = timing.navigationStart;

    const timings: PerformanceTimings = {
      navigationStart: 0,
      domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
      loadComplete: timing.loadEventEnd - navigationStart,
    };

    // Get paint timings
    const paintEntries = performance.getEntriesByType('paint');
    const fpEntry = paintEntries.find((entry) => entry.name === 'first-paint');
    const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

    if (fpEntry) {
      timings.firstPaint = fpEntry.startTime;
    }
    if (fcpEntry) {
      timings.firstContentfulPaint = fcpEntry.startTime;
    }

    return timings;
  });
}

/**
 * Assert Web Vitals metrics meet thresholds
 */
export function assertWebVitalsThresholds(
  metrics: WebVitalsMetrics,
  thresholds: Partial<WebVitalsMetrics> = {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    fcp: 1800,
  }
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (metrics.lcp !== undefined && thresholds.lcp !== undefined) {
    if (metrics.lcp > thresholds.lcp) {
      failures.push(`LCP: ${metrics.lcp.toFixed(2)}ms > ${thresholds.lcp}ms`);
    }
  }

  if (metrics.fid !== undefined && thresholds.fid !== undefined) {
    if (metrics.fid > thresholds.fid) {
      failures.push(`FID: ${metrics.fid.toFixed(2)}ms > ${thresholds.fid}ms`);
    }
  }

  if (metrics.cls !== undefined && thresholds.cls !== undefined) {
    if (metrics.cls > thresholds.cls) {
      failures.push(`CLS: ${metrics.cls.toFixed(4)} > ${thresholds.cls}`);
    }
  }

  if (metrics.fcp !== undefined && thresholds.fcp !== undefined) {
    if (metrics.fcp > thresholds.fcp) {
      failures.push(`FCP: ${metrics.fcp.toFixed(2)}ms > ${thresholds.fcp}ms`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Measure page load time
 */
export async function measurePageLoad(
  page: Page,
  url: string
): Promise<{ duration: number; metrics: WebVitalsMetrics }> {
  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  const duration = Date.now() - startTime;

  const metrics = await collectWebVitals(page);

  return { duration, metrics };
}

/**
 * Measure navigation time
 */
export async function measureNavigation(
  page: Page,
  navigationFn: () => Promise<void>
): Promise<number> {
  const startTime = Date.now();
  await navigationFn();
  await page.waitForLoadState('networkidle');
  return Date.now() - startTime;
}

/**
 * Collect network performance metrics
 */
export async function collectNetworkMetrics(page: Page) {
  return await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const metrics = {
      totalRequests: resources.length,
      totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      slowestRequest: Math.max(...resources.map((r) => r.duration)),
      averageDuration: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
      byType: {} as Record<string, { count: number; size: number; duration: number }>,
    };

    resources.forEach((resource) => {
      const type = resource.initiatorType || 'other';
      if (!metrics.byType[type]) {
        metrics.byType[type] = { count: 0, size: 0, duration: 0 };
      }
      metrics.byType[type].count++;
      metrics.byType[type].size += resource.transferSize || 0;
      metrics.byType[type].duration += resource.duration;
    });

    return metrics;
  });
}

/**
 * Wait for specific performance mark
 */
export async function waitForPerformanceMark(
  page: Page,
  markName: string,
  timeoutMs: number = 5000
): Promise<number> {
  const startTime = Date.now();

  try {
    await page.waitForFunction(
      (name) => {
        const entries = performance.getEntriesByName(name, 'mark');
        return entries.length > 0;
      },
      markName,
      { timeout: timeoutMs }
    );

    const markTime = await page.evaluate((name) => {
      const entries = performance.getEntriesByName(name, 'mark');
      return entries[0]?.startTime || 0;
    }, markName);

    return markTime;
  } catch (error) {
    throw new Error(
      `Performance mark "${markName}" not found within ${timeoutMs}ms (waited ${Date.now() - startTime}ms)`
    );
  }
}

/**
 * Create a performance report
 */
export function createPerformanceReport(
  metrics: WebVitalsMetrics,
  timings: PerformanceTimings
): string {
  return `
Performance Report:
------------------
Web Vitals:
  LCP: ${metrics.lcp?.toFixed(2) || 'N/A'}ms
  FID: ${metrics.fid?.toFixed(2) || 'N/A'}ms
  CLS: ${metrics.cls?.toFixed(4) || 'N/A'}
  FCP: ${metrics.fcp?.toFixed(2) || 'N/A'}ms
  TTFB: ${metrics.ttfb?.toFixed(2) || 'N/A'}ms
  INP: ${metrics.inp?.toFixed(2) || 'N/A'}ms

Page Timings:
  DOM Content Loaded: ${timings.domContentLoaded.toFixed(2)}ms
  Load Complete: ${timings.loadComplete.toFixed(2)}ms
  First Paint: ${timings.firstPaint?.toFixed(2) || 'N/A'}ms
  First Contentful Paint: ${timings.firstContentfulPaint?.toFixed(2) || 'N/A'}ms
  `.trim();
}

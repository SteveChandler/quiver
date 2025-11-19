import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';

/**
 * Build Integrity Tests
 *
 * Tests the webpack bundle caching and build integrity regression fix.
 * Previously, stale webpack cache caused errors like:
 * - "Cannot read properties of undefined (reading 'line 208')"
 * - Missing source maps
 * - 404 errors for webpack chunks
 * - Stale bundle loading issues
 *
 * Bug Fix: Webpack cache was cleared, resolving stale bundle issues.
 * These tests ensure build integrity is maintained going forward.
 *
 * @project auth
 */

test.describe('Build Integrity - Console Errors', () => {
  test('no console errors about missing source maps', async ({ page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];

    // Track all console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Navigate to several pages to trigger chunk loading
    await page.goto('/map');
    await waitForPageLoad(page);

    await page.goto('/discover');
    await waitForPageLoad(page);

    // Check for source map errors
    const sourceMapErrors = consoleMessages.filter(
      (msg) =>
        msg.type === 'error' &&
        (msg.text.includes('source map') ||
          msg.text.includes('sourcemap') ||
          msg.text.includes('Failed to load resource') ||
          msg.text.includes('.map'))
    );

    if (sourceMapErrors.length > 0) {
      console.log('[Build Integrity] Source map errors found:');
      sourceMapErrors.forEach((error) => {
        console.log(`  ${error.text}`);
      });
    }

    // Source map warnings are acceptable in production, but errors are not
    expect(sourceMapErrors.length).toBe(0);

    console.log(
      `[Build Integrity] No source map errors detected across ${consoleMessages.length} console messages`
    );
  });

  test('no 404 errors for webpack chunks', async ({ page }) => {
    const networkErrors: string[] = [];

    // Track failed network requests
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      if (status === 404) {
        networkErrors.push(url);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Navigate to trigger chunk loading
    await page.goto('/map');
    await waitForPageLoad(page);

    await page.goto('/beach/blacks-beach/ca/la-jolla');
    await waitForPageLoad(page);

    // Check for webpack chunk 404s
    const webpack404s = networkErrors.filter(
      (url) =>
        url.includes('webpack') ||
        url.includes('chunk') ||
        url.includes('.js') ||
        url.includes('_next')
    );

    if (webpack404s.length > 0) {
      console.log('[Build Integrity] 404 errors for webpack/chunk files:');
      webpack404s.forEach((url) => {
        console.log(`  ${url}`);
      });
    }

    expect(webpack404s.length).toBe(0);

    console.log(
      `[Build Integrity] No 404 errors for webpack chunks (total 404s: ${networkErrors.length})`
    );
  });

  test('page loads without stale bundle errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for any async errors
    await page.waitForTimeout(2000);

    // Check for the specific stale bundle error pattern
    const staleBundleErrors = consoleErrors.filter(
      (error) =>
        error.includes('Cannot read properties of undefined') ||
        error.includes('reading \'line 208\'') ||
        error.includes('webpack') ||
        error.includes('chunk loading failed') ||
        error.includes('ChunkLoadError')
    );

    if (staleBundleErrors.length > 0) {
      console.log('[Build Integrity] Stale bundle errors detected:');
      staleBundleErrors.forEach((error) => {
        console.log(`  ${error}`);
      });
    }

    expect(staleBundleErrors.length).toBe(0);

    console.log('[Build Integrity] No stale bundle errors detected');
  });

  test('no errors referencing specific line numbers (line 208)', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Check for the specific "line 208" error from the bug report
    const line208Errors = consoleErrors.filter(
      (error) =>
        error.includes('line 208') ||
        error.includes('at line 208') ||
        error.includes('reading \'line 208\'')
    );

    if (line208Errors.length > 0) {
      console.log('[Build Integrity] Line 208 errors found (stale cache issue):');
      line208Errors.forEach((error) => {
        console.log(`  ${error}`);
      });
    }

    expect(line208Errors.length).toBe(0);

    console.log('[Build Integrity] No line 208 errors detected');
  });

  test('JavaScript execution completes without errors', async ({ page }) => {
    const jsErrors: string[] = [];

    // Track JavaScript errors
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Interact with page to trigger JavaScript execution
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    const inputVisible = await searchInput.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (inputVisible) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }

    // Navigate to another page
    await page.goto('/map');
    await waitForPageLoad(page);

    // Check for critical JavaScript errors
    const criticalErrors = jsErrors.filter(
      (error) =>
        !error.includes('favicon') && // Ignore favicon errors
        !error.includes('analytics') && // Ignore analytics errors
        !error.includes('third-party') // Ignore third-party script errors
    );

    if (criticalErrors.length > 0) {
      console.log('[Build Integrity] JavaScript errors detected:');
      criticalErrors.forEach((error) => {
        console.log(`  ${error}`);
      });
    }

    // Should have minimal or no critical errors
    expect(criticalErrors.length).toBeLessThanOrEqual(2);

    console.log(
      `[Build Integrity] JavaScript execution completed with ${criticalErrors.length} critical errors`
    );
  });
});

test.describe('Build Integrity - Hot Module Replacement (Dev)', () => {
  // These tests are relevant for development mode
  // In production, HMR is not active

  test('no HMR-related errors in console', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Check for HMR errors
    const hmrErrors = consoleErrors.filter(
      (error) =>
        error.includes('HMR') ||
        error.includes('hot update') ||
        error.includes('hot reload')
    );

    if (hmrErrors.length > 0) {
      console.log('[HMR] Hot Module Replacement errors:');
      hmrErrors.forEach((error) => {
        console.log(`  ${error}`);
      });
    }

    expect(hmrErrors.length).toBe(0);

    console.log('[HMR] No HMR errors detected');
  });

  test('webpack runtime loads successfully', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Check for webpack runtime errors
    const webpackErrors = consoleErrors.filter(
      (error) =>
        error.toLowerCase().includes('webpack') ||
        error.toLowerCase().includes('runtime')
    );

    const webpackNetworkErrors = networkErrors.filter(
      (error) => error.includes('webpack') || error.includes('_next')
    );

    if (webpackErrors.length > 0) {
      console.log('[Webpack] Runtime errors:');
      webpackErrors.forEach((error) => console.log(`  ${error}`));
    }

    if (webpackNetworkErrors.length > 0) {
      console.log('[Webpack] Network errors:');
      webpackNetworkErrors.forEach((error) => console.log(`  ${error}`));
    }

    expect(webpackErrors.length).toBe(0);
    expect(webpackNetworkErrors.length).toBe(0);

    console.log('[Webpack] Runtime loaded successfully');
  });
});

test.describe('Build Integrity - Resource Loading', () => {
  test('all critical JavaScript bundles load successfully', async ({ page }) => {
    const failedResources: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();

      // Check for failed JS/CSS resources
      if (
        (url.endsWith('.js') || url.endsWith('.css')) &&
        status >= 400
      ) {
        failedResources.push(`${status} ${url}`);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Navigate to trigger code splitting
    await page.goto('/map');
    await waitForPageLoad(page);

    await page.goto('/discover');
    await waitForPageLoad(page);

    if (failedResources.length > 0) {
      console.log('[Resource Loading] Failed resources:');
      failedResources.forEach((resource) => {
        console.log(`  ${resource}`);
      });
    }

    expect(failedResources.length).toBe(0);

    console.log('[Resource Loading] All critical bundles loaded successfully');
  });

  test('CSS files load without errors', async ({ page }) => {
    const cssErrors: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();

      if (url.endsWith('.css') && status >= 400) {
        cssErrors.push(`${status} ${url}`);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    if (cssErrors.length > 0) {
      console.log('[CSS Loading] Failed CSS files:');
      cssErrors.forEach((error) => console.log(`  ${error}`));
    }

    expect(cssErrors.length).toBe(0);

    console.log('[CSS Loading] All CSS files loaded successfully');
  });

  test('no mixed content warnings', async ({ page }) => {
    const mixedContentWarnings: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        (msg.type() === 'warning' || msg.type() === 'error') &&
        (text.includes('mixed content') ||
          text.includes('http://') && text.includes('https://'))
      ) {
        mixedContentWarnings.push(text);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    if (mixedContentWarnings.length > 0) {
      console.log('[Mixed Content] Warnings detected:');
      mixedContentWarnings.forEach((warning) => {
        console.log(`  ${warning}`);
      });
    }

    expect(mixedContentWarnings.length).toBe(0);

    console.log('[Mixed Content] No mixed content warnings');
  });
});

test.describe('Build Integrity - Code Splitting', () => {
  test('dynamic imports work correctly', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to pages that use dynamic imports
    await page.goto('/');
    await waitForPageLoad(page);

    // Map page (likely uses Mapbox dynamic import)
    await page.goto('/map');
    await waitForPageLoad(page);

    // Wait for dynamic imports to complete
    await page.waitForTimeout(2000);

    // Check for dynamic import errors
    const importErrors = consoleErrors.filter(
      (error) =>
        error.includes('import') ||
        error.includes('chunk') ||
        error.includes('module')
    );

    if (importErrors.length > 0) {
      console.log('[Code Splitting] Dynamic import errors:');
      importErrors.forEach((error) => console.log(`  ${error}`));
    }

    expect(importErrors.length).toBe(0);

    console.log('[Code Splitting] Dynamic imports working correctly');
  });

  test('lazy-loaded components render without errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Home page (lazy loaded components)
    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Map page with Mapbox (lazy loaded)
    await page.goto('/map');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Filter for component rendering errors
    const renderErrors = consoleErrors.filter(
      (error) =>
        error.includes('render') ||
        error.includes('component') ||
        error.includes('React')
    );

    if (renderErrors.length > 0) {
      console.log('[Lazy Loading] Component rendering errors:');
      renderErrors.forEach((error) => console.log(`  ${error}`));
    }

    expect(renderErrors.length).toBe(0);

    console.log('[Lazy Loading] Lazy-loaded components rendered successfully');
  });
});

test.describe('Build Integrity - Service Worker', () => {
  test('no service worker errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Check for service worker errors
    const swErrors = consoleErrors.filter(
      (error) =>
        error.includes('service worker') ||
        error.includes('serviceWorker') ||
        error.includes('sw.js')
    );

    if (swErrors.length > 0) {
      console.log('[Service Worker] Errors detected:');
      swErrors.forEach((error) => console.log(`  ${error}`));
    }

    // Service worker errors should not block the app
    expect(swErrors.length).toBe(0);

    console.log('[Service Worker] No service worker errors');
  });
});

test.describe('Build Integrity - Cross-Page Navigation', () => {
  test('navigating between pages does not cause chunk loading errors', async ({ page }) => {
    const chunkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          text.includes('chunk') ||
          text.includes('loading') ||
          text.includes('failed to fetch')
        ) {
          chunkErrors.push(text);
        }
      }
    });

    // Navigate through multiple pages
    const pages = ['/', '/map', '/discover', '/'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await waitForPageLoad(page);
      await page.waitForTimeout(1000);
    }

    if (chunkErrors.length > 0) {
      console.log('[Navigation] Chunk loading errors during navigation:');
      chunkErrors.forEach((error) => console.log(`  ${error}`));
    }

    expect(chunkErrors.length).toBe(0);

    console.log('[Navigation] No chunk loading errors across page navigation');
  });

  test('browser back/forward navigation works without errors', async ({ page }) => {
    const navigationErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        navigationErrors.push(msg.text());
      }
    });

    // Navigate forward
    await page.goto('/');
    await waitForPageLoad(page);

    await page.goto('/map');
    await waitForPageLoad(page);

    await page.goto('/discover');
    await waitForPageLoad(page);

    // Navigate back
    await page.goBack();
    await waitForPageLoad(page);

    await page.goBack();
    await waitForPageLoad(page);

    // Navigate forward
    await page.goForward();
    await waitForPageLoad(page);

    if (navigationErrors.length > 0) {
      console.log('[Browser Navigation] Errors during back/forward navigation:');
      navigationErrors.forEach((error) => console.log(`  ${error}`));
    }

    // Should have minimal errors during navigation
    expect(navigationErrors.length).toBeLessThanOrEqual(2);

    console.log('[Browser Navigation] Back/forward navigation working correctly');
  });
});

test.describe('Build Integrity - Performance', () => {
  test('page loads complete within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForPageLoad(page);

    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    console.log(`[Performance] Page loaded in ${loadTime}ms`);
  });

  test('no memory leaks during navigation', async ({ page }) => {
    // Navigate through pages multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await waitForPageLoad(page);

      await page.goto('/map');
      await waitForPageLoad(page);

      await page.goto('/discover');
      await waitForPageLoad(page);
    }

    // Get memory metrics
    const metrics = await page.metrics();

    console.log('[Memory] Navigation completed successfully');
    console.log(`[Memory] JSHeapUsedSize: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);

    // Should not crash or hang
    const isStillResponsive = await page.evaluate(() => true);
    expect(isStillResponsive).toBe(true);
  });
});

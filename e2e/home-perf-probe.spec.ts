import { test, expect, type Request } from '@playwright/test';

import { ensureAuthenticated } from './utils/auth-helpers';
import { assertNoErrors, setupErrorDetection, type ErrorCapture } from './utils/error-detection';

/**
 * Opt-in measurement probe for the signed-in home screen.
 * Records each request and time to a rendered surf call. Only rendering and
 * runtime errors are assertions; variable wall-clock timings are reported.
 */
test.describe('@perf signed-in home', () => {
  // Register only when explicitly requested; this probe uses a real account.
  if (!process.env.RUN_PERF_PROBE) return;

  let errorCapture: ErrorCapture;
  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });
  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'signed-in home performance probe' });
  });

  test('records the request waterfall and time to first call', async ({ page }) => {
    await ensureAuthenticated(page);

    type Timed = {
      url: string;
      method: string;
      status?: number;
      startedAt: number;
      endedAt?: number;
    };
    const timed = new Map<Request, Timed>();
    let t0 = 0;

    page.on('request', (r) => {
      const u = r.url();
      if (!/\/api\/|_next\/data|\.rsc/.test(u) && !r.headers()['next-action']) return;
      timed.set(r, {
        // Query parameters and profile IDs are unnecessary for a timing report.
        url: new URL(u).pathname.replace(
          /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi,
          '<id>',
        ),
        method: r.method(),
        startedAt: Date.now() - t0,
      });
    });
    page.on('response', (r) => {
      const rec = timed.get(r.request());
      if (!rec) return;
      rec.endedAt = Date.now() - t0;
      rec.status = r.status();
    });

    t0 = Date.now();
    await page.goto('/', { waitUntil: 'commit' });

    // The rendered call — the moment the page is actually useful.
    const hero = page.locator('section[role="banner"]');
    let heroMs = -1;
    try {
      await hero.waitFor({ state: 'visible', timeout: 60_000 });
      heroMs = Date.now() - t0;
    } catch {
      heroMs = -1;
    }

    // Let dependent requests (activity, photos) settle so they show up.
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const totalMs = Date.now() - t0;

    const rows = [...timed.values()]
      .filter((r) => r.endedAt !== undefined)
      .sort((a, b) => a.startedAt - b.startedAt);

    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      const fcp = performance
        .getEntriesByName('first-contentful-paint')
        .map((e) => Math.round(e.startTime))[0];
      return {
        ttfbMs: n ? Math.round(n.responseStart - n.requestStart) : null,
        domContentLoadedMs: n ? Math.round(n.domContentLoadedEventEnd) : null,
        loadMs: n ? Math.round(n.loadEventEnd) : null,
        firstContentfulPaintMs: fcp ?? null,
      };
    });

    console.log('\n===== HOME PERF PROBE =====');
    console.log('time to rendered surf call (ms):', heroMs);
    console.log('time to network idle (ms):', totalMs);
    console.log('navigation timing:', JSON.stringify(nav));
    console.log('discovery requests:', [...timed.values()].filter(
      (r) => r.url === '/api/surf/discover',
    ).length);
    console.log('\nrequest waterfall (start -> end, duration):');
    for (const r of rows) {
      const dur = (r.endedAt ?? 0) - r.startedAt;
      console.log(
        `  ${String(r.startedAt).padStart(6)}ms -> ${String(r.endedAt).padStart(6)}ms  ` +
          `${String(dur).padStart(6)}ms  ${r.status}  ${r.method} ${r.url.slice(0, 110)}`
      );
    }
    console.log('===========================\n');

    expect(heroMs).toBeGreaterThan(-1);
  });
});

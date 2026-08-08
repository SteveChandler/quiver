import { test, expect } from '@playwright/test';

import { ensureAuthenticated } from './utils/auth-helpers';

/**
 * Temporary measurement probe for the signed-in home screen.
 *
 * Not a assertion-style test — it records the request waterfall and the time
 * to a rendered surf call so the actual bottleneck can be identified instead
 * of guessed at. Tagged @perf so it never runs in the normal suite.
 */
test.describe('@perf signed-in home', () => {
  // Opt-in only. This is a measurement tool, not a gate — it has no meaningful
  // pass/fail and would just add minutes to every suite run.
  test.skip(
    !process.env.RUN_PERF_PROBE,
    'Measurement probe — run with RUN_PERF_PROBE=1'
  );

  test('records the request waterfall and time to first call', async ({ page }) => {
    await ensureAuthenticated(page);

    type Timed = {
      url: string;
      method: string;
      status?: number;
      startedAt: number;
      endedAt?: number;
    };
    const timed = new Map<string, Timed>();
    let t0 = 0;

    page.on('request', (r) => {
      const u = r.url();
      if (!/\/api\/|_next\/data|\.rsc/.test(u)) return;
      timed.set(u + r.method(), {
        url: u.replace(/^https?:\/\/[^/]+/, ''),
        method: r.method(),
        startedAt: Date.now() - t0,
      });
    });
    page.on('response', (r) => {
      const rec = timed.get(r.url() + r.request().method());
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

    /* eslint-disable no-console -- probe output is the deliverable */
    console.log('\n===== HOME PERF PROBE =====');
    console.log('time to rendered surf call (ms):', heroMs);
    console.log('time to network idle (ms):', totalMs);
    console.log('navigation timing:', JSON.stringify(nav));
    console.log('\nrequest waterfall (start -> end, duration):');
    for (const r of rows) {
      const dur = (r.endedAt ?? 0) - r.startedAt;
      console.log(
        `  ${String(r.startedAt).padStart(6)}ms -> ${String(r.endedAt).padStart(6)}ms  ` +
          `${String(dur).padStart(6)}ms  ${r.status}  ${r.method} ${r.url.slice(0, 110)}`
      );
    }
    console.log('===========================\n');
    /* eslint-enable no-console */

    expect(heroMs).toBeGreaterThan(-1);
  });
});

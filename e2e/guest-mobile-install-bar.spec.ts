/**
 * Mobile install bar on beach detail (anonymous iPhone visitors).
 *
 * The bar is gated by the build-time flag NEXT_PUBLIC_INSTALL_BAR_ENABLED. Run
 * with the flag on to exercise the bar:
 *
 *   NEXT_PUBLIC_INSTALL_BAR_ENABLED=true npx playwright test e2e/guest-mobile-install-bar.spec.ts
 *
 * Without it the same specs assert today's behaviour (no bar, signup bar and
 * in-page asks unchanged), so the spec is valid in both states.
 *
 * @project guest
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from './utils/error-detection';

const BAR_ON = process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED === 'true';

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const BAR = '[data-testid="install-bar"]';
const VISIBLE_BAR = '[data-testid="install-bar"][data-visible="true"]';
const SIGNUP_BAR = '[data-testid="sticky-signup-bar"]';
const IN_PAGE_ASKS = [
  'section[aria-label="Get the Quiver app"]',
  '[data-testid^="content-page-app-handoff-cta"]',
];

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo(0, top), y);
}

async function openBeach(page: Page): Promise<void> {
  await navigateToBeach(page, TEST_BEACHES.blacks);
  await page.waitForLoadState('load');
}

test.describe('Install bar on beach detail', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Install bar' });
  });

  for (const [name, userAgent] of [
    ['iPhone Safari', IPHONE_SAFARI_UA],
    ['iPhone Chrome', IPHONE_CHROME_UA],
  ] as const) {
    test.describe(name, () => {
      test.use({
        userAgent,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });

      if (!BAR_ON) {
        test('flag off: no bar, signup bar and in-page asks unchanged', async ({ page }) => {
          await openBeach(page);
          await scrollTo(page, 600);

          await expect(page.locator(BAR)).toHaveCount(0);
          await expect(page.locator(SIGNUP_BAR)).toBeVisible();
        });
      }

      if (BAR_ON) {
        test('shows the bar only after scrolling, in place of the signup bar', async ({ page }) => {
          await openBeach(page);

          await expect(page.locator(BAR)).toHaveAttribute('data-visible', 'false');
          await scrollTo(page, 700);
          await expect(page.locator(VISIBLE_BAR)).toBeVisible();
          await expect(page.locator(SIGNUP_BAR)).toHaveCount(0);

          const link = page.getByRole('link', { name: 'Get the app' });
          const href = (await link.getAttribute('href')) ?? '';
          expect(href).toContain('https://go.quiversurf.app/app/handoff');
          expect(new URL(href).searchParams.get('placement')).toBe('install_bar');
        });

        test('is the only install ask: no iPhone banner, in-page sections or second bar', async ({ page }) => {
          await openBeach(page);
          await expect(page.getByTestId('iphone-app-banner')).toHaveCount(0);
          for (const selector of IN_PAGE_ASKS) {
            await expect(page.locator(selector)).toHaveCount(0);
          }

          // Walk the page: at no scroll position is more than one install ask on screen.
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < height; y += 400) {
            await scrollTo(page, y);
            // eslint-disable-next-line playwright/no-wait-for-timeout -- let the rAF-throttled scroll handler settle
            await page.waitForTimeout(80);
            const asksInView = await page.evaluate(
              ([bar, ...inPage]) => {
                const vh = window.innerHeight;
                const inView = (el: Element) => {
                  const r = el.getBoundingClientRect();
                  return r.height > 0 && r.bottom > 0 && r.top < vh;
                };
                const selectors = [bar, ...inPage];
                return selectors.flatMap((s) => Array.from(document.querySelectorAll(s))).filter(inView).length;
              },
              [VISIBLE_BAR, ...IN_PAGE_ASKS],
            );
            expect(asksInView).toBeLessThanOrEqual(1);
          }
        });

        test('dismissal persists across reloads and hands the slot back to the signup bar', async ({ page }) => {
          await openBeach(page);
          await scrollTo(page, 700);
          await expect(page.locator(VISIBLE_BAR)).toBeVisible();
          await page.getByRole('button', { name: 'Dismiss app install bar' }).click();
          await expect(page.locator(BAR)).toHaveCount(0);
          await expect(page.locator(SIGNUP_BAR)).toHaveCount(1);

          await page.reload();
          await page.waitForLoadState('load');
          await scrollTo(page, 700);
          await expect(page.locator(BAR)).toHaveCount(0);
          await expect(page.locator(SIGNUP_BAR)).toBeVisible();
        });

        test('the bar causes no layout shift', async ({ page }) => {
          await page.addInitScript(() => {
            const w = window as unknown as { __barShift: number };
            w.__barShift = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as unknown as Array<{
                hadRecentInput: boolean;
                value: number;
                sources?: Array<{ node: Node | null }>;
              }>) {
                const nodes = (entry.sources ?? []).map((s) => s.node);
                const fromBar = nodes.some((n) => n instanceof Element && n.closest('[data-testid="install-bar"]'));
                if (!entry.hadRecentInput && fromBar) w.__barShift += entry.value;
              }
            }).observe({ type: 'layout-shift', buffered: true });
          });

          await openBeach(page);
          await scrollTo(page, 700);
          // eslint-disable-next-line playwright/no-wait-for-timeout -- allow the bar's transition to finish before reading shifts
          await page.waitForTimeout(600);

          const shift = await page.evaluate(() => (window as unknown as { __barShift: number }).__barShift);
          expect(shift).toBe(0);
        });
      }
    });
  }

  for (const [name, userAgent, viewport] of [
    ['Android Chrome', ANDROID_UA, { width: 412, height: 915 }],
    ['desktop', undefined, { width: 1280, height: 800 }],
  ] as const) {
    test.describe(name, () => {
      test.use({ ...(userAgent ? { userAgent } : {}), viewport });

      test('never sees the install bar', async ({ page }) => {
        await openBeach(page);
        await scrollTo(page, 900);

        await expect(page.locator(BAR)).toHaveCount(0);
      });
    });
  }
});

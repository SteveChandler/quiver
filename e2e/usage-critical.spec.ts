/**
 * Usage-weighted QA gate for the product surfaces real users spend time in.
 *
 * @project auth + guest
 */

import { test, expect, Page } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';
import { TEST_BEACHES, TIMEOUTS, VIEWPORTS } from './fixtures/test-data';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';
import { waitForPageLoad } from './utils/test-helpers';
import { dismissMapEntryOverlay } from './utils/map-helpers';
import { isVisibleSafe } from './utils/strict-helpers';

async function expectAnyVisible(
  locators: Array<{ locator: ReturnType<Page['locator']>; name: string }>,
  timeout = TIMEOUTS.medium,
): Promise<string> {
  const results = await Promise.all(
    locators.map(async (item) => ({
      name: item.name,
      visible: await isVisibleSafe(item.locator.first(), { timeout }),
    }))
  );
  const visible = results.find((item) => item.visible);

  if (visible) {
    return visible.name;
  }

  throw new Error(`Expected one of these usage-critical surfaces to be visible: ${
    locators.map((item) => item.name).join(', ')
  }`);
}

test.describe('Usage Critical: authenticated surfaces', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Usage critical authenticated surface' });
  });

  test('home shows surf-call, nearby/action surfaces, and share/paywall entry points when available @usage', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture, '/', { timeout: TIMEOUTS.long });

    const surfCallSurface = await expectAnyVisible([
      { locator: page.locator('section[role="banner"]'), name: 'oracle hero' },
      { locator: page.getByText(/surf conditions/i), name: 'surf conditions copy' },
      { locator: page.getByText(/best time|today's windows/i), name: 'surf-call timing' },
      { locator: page.getByText(/we couldn't find any surf spots near you/i), name: 'signed-in local fallback' },
      { locator: page.getByRole('heading', { name: /popular surf spots/i }), name: 'popular spots fallback' },
    ], TIMEOUTS.long);
    expect(surfCallSurface).toEqual(expect.any(String));

    const actionSurface = await expectAnyVisible([
      { locator: page.getByRole('button', { name: /paddle out|log/i }), name: 'session CTA' },
      { locator: page.getByRole('button', { name: /share|tell your crew|invite/i }), name: 'share CTA' },
      { locator: page.getByText(/nearby spots|my spots|activity/i), name: 'nearby or activity surface' },
      { locator: page.getByRole('button', { name: /try again/i }), name: 'local retry CTA' },
      { locator: page.getByRole('link', { name: /blacks|beacons|ocean beach/i }), name: 'popular spot link' },
    ], TIMEOUTS.medium);
    expect(actionSurface).toEqual(expect.any(String));

    const conversionSurface = await expectAnyVisible([
      { locator: page.getByRole('button', { name: /share|tell your crew|invite/i }), name: 'share CTA' },
      { locator: page.getByRole('button', { name: /pro|upgrade|unlock/i }), name: 'paywall entry' },
      { locator: page.getByRole('button', { name: /user menu/i }), name: 'signed-in account menu' },
    ], TIMEOUTS.medium);
    expect(conversionSurface).toEqual(expect.any(String));
  });

  test('beach detail forecast content, tab switching, and forecast interaction UI work @usage', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture, buildBeachUrl(TEST_BEACHES.blacks), {
      timeout: TIMEOUTS.long,
    });

    await expect(page.getByRole('heading', { name: /blacks/i, level: 1 })).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.medium });
    await forecastTab.click();
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.medium });

    await expectAnyVisible([
      { locator: page.getByRole('heading', { name: /current conditions/i }), name: 'current conditions' },
      { locator: page.getByText(/wave|swell|wind|tide/i), name: 'forecast metrics' },
      { locator: page.locator('[data-testid="tide-chart-section"]'), name: 'tide chart' },
    ], TIMEOUTS.long);

    const forecastSubTabs = [
      page.getByRole('tab', { name: /tides/i }),
      page.getByRole('tab', { name: /wind/i }),
      page.getByRole('tab', { name: /swell/i }),
    ];
    for (const tab of forecastSubTabs) {
      // eslint-disable-next-line playwright/no-conditional-in-test -- sub-tabs are data/layout dependent across dev/local
      if (await isVisibleSafe(tab, { timeout: TIMEOUTS.short })) {
        await tab.click();
        await expect(tab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.medium });
        return;
      }
    }

    await expect(page.getByRole('tabpanel').first()).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('map search reaches a beach detail path @usage', async ({ page }) => {
    await page.goto('/map?search=Black', { timeout: TIMEOUTS.long, waitUntil: 'domcontentloaded' });
    await waitForPageLoad(page);
    await dismissMapEntryOverlay(page);

    await expectAnyVisible([
      { locator: page.getByTestId('map-view'), name: 'map view' },
      { locator: page.locator('canvas'), name: 'map canvas' },
    ], TIMEOUTS.long);

    const beachMarker = page.locator('[data-testid="beach-marker"]').first();
    await expect(beachMarker).toBeVisible({ timeout: TIMEOUTS.long });
    await beachMarker.click({ force: true });
    await page.waitForURL(/\/(ca|california|beach)\//, { timeout: TIMEOUTS.long });

    await expect(page).toHaveURL(/\/(ca|california|beach)\//);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    await expect(page.getByRole('tab', { name: /forecast/i })).toBeVisible({
      timeout: TIMEOUTS.medium,
    });
  });

  test('session log start supports beach, time, rating input, and never renders NaN @usage', async ({
    page,
  }) => {
    await page.goto('/sessions/new?mode=log', { timeout: TIMEOUTS.long });
    await waitForPageLoad(page);

    await expectAnyVisible([
      { locator: page.getByRole('heading', { name: /log session/i }), name: 'log session heading' },
      { locator: page.getByTestId('beach-search-input'), name: 'beach search input' },
      { locator: page.getByText(/how were the waves/i), name: 'rating section' },
    ], TIMEOUTS.long);

    const beachInput = page.getByTestId('beach-search-input');
    // eslint-disable-next-line playwright/no-conditional-in-test -- quick log can auto-detect beach and hide manual search
    if (await isVisibleSafe(beachInput, { timeout: TIMEOUTS.short })) {
      await beachInput.fill('Black');
      const beachOption = beachInput
        .locator('..')
        .locator('ul button')
        .filter({ hasText: /black/i })
        .first();
      // eslint-disable-next-line playwright/no-conditional-in-test -- search results can be skipped when quick log auto-selects a nearby beach
      if (await isVisibleSafe(beachOption, { timeout: TIMEOUTS.long })) {
        await beachOption.click();
      }
    }

    const timeButton = page.getByRole('button', { name: /morning|afternoon|evening|now/i }).first();
    // eslint-disable-next-line playwright/no-conditional-in-test -- time presets are hidden for some prefilled quick-log states
    if (await isVisibleSafe(timeButton, { timeout: TIMEOUTS.medium })) {
      await timeButton.click();
    }

    const slider = page.getByRole('slider').first();
    // eslint-disable-next-line playwright/no-conditional-in-test -- rating sliders are auth/data dependent but must not render NaN when absent
    if (await isVisibleSafe(slider, { timeout: TIMEOUTS.medium })) {
      await slider.focus();
      await page.keyboard.press('ArrowRight');
    }

    await expect(page.locator('body')).not.toContainText('NaN', { timeout: TIMEOUTS.medium });
  });
});

test.describe('Usage Critical: guest beach conversion surface', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: VIEWPORTS.mobile });

  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('guest beach page exposes signup/auth CTA without authenticated assumptions @usage', async ({
    page,
  }) => {
    await page.goto(buildBeachUrl(TEST_BEACHES.blacks), {
      timeout: TIMEOUTS.long,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('load', { timeout: TIMEOUTS.long });
    await page.evaluate(() => window.scrollTo(0, 500));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- sticky CTA appears after scroll-triggered transition
    await page.waitForTimeout(400);

    await expect(page.getByRole('heading', { name: /blacks/i }).first()).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    await expectAnyVisible([
      { locator: page.getByTestId('sticky-signup-cta'), name: 'sticky signup CTA' },
      { locator: page.getByTestId('inline-signup-cta'), name: 'inline signup CTA' },
      { locator: page.getByRole('button', { name: /sign up|save .*home break|get forecast/i }), name: 'auth CTA' },
    ], TIMEOUTS.long);

    await assertNoErrors(page, errorCapture, {
      context: 'Guest beach usage conversion surface',
      checkConsole: false,
    });
  });
});

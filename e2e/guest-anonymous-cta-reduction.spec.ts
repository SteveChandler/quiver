import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/** Signed-out contract for the visual beach detail page. @project guest */

test.describe('Anonymous beach page — visual layout', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await page.waitForLoadState('load');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Anonymous CTA reduction' });
  });

  // -------------------------------------------------------------------------
  // Retired MatchScoreTeaser stays absent.
  // -------------------------------------------------------------------------

  test('MatchScoreTeaser card is NOT rendered for anonymous users', async ({ page }) => {
    const teaserCard = page.getByTestId('match-score-teaser-card');
    const isVisible = await isVisibleSafe(teaserCard, { timeout: 3000 });
    expect(isVisible).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Removed CTAs — these should still be absent for anonymous users
  // -------------------------------------------------------------------------

  test('legacy "Get Alerts" InlineSignupCta wording is NOT rendered for anonymous users', async ({ page }) => {
    // The retired "Get Alerts for …" heading must not return.
    const legacyHeading = page.getByRole('heading', { name: /get alerts for/i });
    const headingVisible = await isVisibleSafe(legacyHeading, { timeout: 3000 });
    expect(headingVisible).toBe(false);
  });

  test('Horizon-strip upsell banner is NOT rendered for anonymous users', async ({ page }) => {
    // The "See 12-day outlook →" motion button above the tabs should be removed.
    const horizonBanner = page.getByText(/see 12-day outlook/i);
    const isVisible = await isVisibleSafe(horizonBanner, { timeout: 5000 });
    expect(isVisible).toBe(false);
  });

  test('PersonalizedForecastTeaser is NOT rendered for anonymous users', async ({ page }) => {
    const teaserHeading = page.getByRole('heading', { name: /your surf call/i });
    const teaserButton = page.getByRole('button', { name: /see your surf call/i });

    const headingVisible = await isVisibleSafe(teaserHeading, { timeout: 5000 });
    const buttonVisible = await isVisibleSafe(teaserButton, { timeout: 3000 });

    expect(headingVisible).toBe(false);
    expect(buttonVisible).toBe(false);
  });

  test('a signed-out visitor sees the surf call, for most surfers', async ({ page }) => {
    const call = page.getByTestId('beach-public-call');
    await expect(call).toBeVisible();
    await expect(call).toContainText(/for most surfers/i);
    await expect(call).toContainText(/epic|good|fair|rideable|meh|no call (today|tomorrow)|surf call unavailable/i);
  });

  test('one primary action (Watch or Open in the app) plus Share, and no signup asks', async ({ page }) => {
    await expect(page.getByTestId('beach-share-button')).toBeVisible();
    const watch = page.getByTestId('beach-watch-button');
    // eslint-disable-next-line playwright/no-conditional-in-test -- no call means no watch window
    if (await watch.count()) await expect(watch).toContainText(/Watch|Open in the app/);
    await page.mouse.wheel(0, 4000);
    await expect(page.getByTestId('sticky-signup-bar')).toHaveCount(0);
    await expect(page.getByTestId('inline-signup-cta')).toHaveCount(0);
    await expect(page.locator('[data-testid^="content-page-app-handoff-cta"]')).toHaveCount(0);
  });

  test('the visual sections render', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Surf Forecast/);
    await expect(page.getByTestId('beach-visual-hero')).toBeVisible();
    await expect(page.getByTestId('beach-week')).toBeVisible();
    await expect(page.getByTestId('beach-hourly-chart')).toBeVisible();
  });
});

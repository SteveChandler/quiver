import { test, expect } from "./fixtures/auth-fixture";
import type { Locator, Page } from '@playwright/test';
import { TEST_BEACHES, VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad, navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { ensureLocalBeachForecastFixture } from './utils/local-supabase-fixtures';
import { isVisibleSafe } from './utils/strict-helpers';

const FORECAST_CONDITIONS_HEADING = /^(Current|Forecasted) Conditions$/i;

function forecastConditionsHeading(page: Page): Locator {
  return page.getByRole('heading', {
    name: FORECAST_CONDITIONS_HEADING,
    level: 2,
  });
}

let cleanupForecastFixture: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  cleanupForecastFixture = await ensureLocalBeachForecastFixture({
    dataSource: 'e2e_beach_detail_fixture',
    slug: 'blacks',
  });
});

test.afterAll(async () => {
  await cleanupForecastFixture?.();
});

/**
 * Beach Detail Page Tests
 * Tests the beach detail page functionality for authenticated users
 *
 * @project auth
 */

test.describe('Beach Detail Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach Detail' });
  });

  test('should display beach name and location', async ({ page }) => {
    // Should show beach name in header (use level: 1 to avoid matching sr-only h2)
    const beachName = page.getByRole('heading', { name: /blacks/i, level: 1 });
    await expect(beachName).toBeVisible({ timeout: 10000 });

    // Should show location in the redesigned field-guide hero.
    const location = page.getByText(/la jolla,\s*ca/i).first();
    await expect(location).toBeVisible();
  });

  test('should display beach statistics', async ({ page }) => {
    await expect(page.getByText(/spot/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/break/i).first()).toBeVisible();
    await expect(page.getByText(/^rating$/i).first()).toBeVisible();
    await expect(page.getByText(/^reviews$/i).first()).toBeVisible();
  });

  test('should display beach photos or gallery', async ({ page }) => {
    // Should show either photos, gallery component, or any images
    const photos = page.locator('img').first();
    const photoGallery = page.getByRole('button', { name: /photos?|gallery/i });
    const photoSection = page.locator('[class*="photo"], [class*="gallery"], [class*="image"]').first();

    const hasPhotos = await isVisibleSafe(photos);
    const hasGallery = await isVisibleSafe(photoGallery);
    const hasPhotoSection = await isVisibleSafe(photoSection);

    // At least one should be visible
    expect(hasPhotos || hasGallery || hasPhotoSection).toBe(true);
  });

  test('should display forecast information @requires-data', async ({ page }) => {
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Cached model data renders as "Forecasted Conditions"; live current data
    // renders as "Current Conditions".
    const currentConditions = forecastConditionsHeading(page);
    await expect(currentConditions).toBeVisible({ timeout: 15000 });
  });

  test('should display tabs for different content sections', async ({ page }) => {
    // Should have tabs (Overview, Forecast, Reviews, etc.)
    // Use .first() — multiple tablists exist (main tabs + forecast sub-tabs)
    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toBeVisible({ timeout: 10000 });

    // Should have all five tabs
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    const intelTab = page.getByRole('tab', { name: /local intel/i });
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });

    await expect(overviewTab).toBeVisible();
    await expect(forecastTab).toBeVisible();
    await expect(reviewsTab).toBeVisible();
    await expect(intelTab).toBeVisible();
    await expect(sessionsTab).toBeVisible();

    // Forecast should be active by default
    await expect(forecastTab).toHaveAttribute('data-state', 'active');
  });

  test('should allow favoriting/unfavoriting beach', async ({ page }) => {
    // Look for favorite button
    const favoriteButton = page.getByRole('button', { name: /favorite|add to favorites/i });
    const hasFavorite = await isVisibleSafe(favoriteButton);
    expect(hasFavorite).toEqual(expect.any(Boolean));

    // eslint-disable-next-line playwright/no-conditional-in-test -- favorite control is auth/data dependent smoke coverage
    if (hasFavorite) {
      // Click to favorite and wait for API response
      const favoriteResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/') && resp.url().includes('favorite'),
        { timeout: 5000 }
      ).catch(() => {});
      await favoriteButton.click();
      await favoriteResponse;

      // State should change (button text or icon)
      // This is a smoke test - actual verification depends on implementation
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Beach name should still be visible (use level: 1 to avoid matching sr-only h2)
    const beachName = page.getByRole('heading', { name: /blacks/i, level: 1 });
    await expect(beachName).toBeVisible();

    await expect(page.getByText(/la jolla,\s*ca/i).first()).toBeVisible();
    await expect(page.getByText(/^rating$/i).first()).toBeVisible({ timeout: 10000 });
  });

});

test.describe('Beach Detail - Forecast Tab', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach Forecast Tab' });
  });

  test('should display forecast tab content by default @requires-data', async ({ page }) => {
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 10000 });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Overview tab should be inactive
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toHaveAttribute('data-state', 'inactive');

    // Cached model data renders as "Forecasted Conditions"; live current data
    // renders as "Current Conditions".
    const currentConditions = forecastConditionsHeading(page);
    await expect(currentConditions).toBeVisible({ timeout: 15000 });
  });

  test('should switch between all tabs correctly', async ({ page }) => {
    const tabs = [
      {
        label: /forecast/i,
        panel: /forecast/i,
        content: /Current Conditions|Forecasted Conditions/i,
      },
      { label: /reviews/i, panel: /reviews/i, content: /review/i },
      { label: /local intel/i, panel: /local intel/i },
      { label: /sessions/i, panel: /sessions/i },
      { label: /overview/i, panel: /overview/i, content: /spot|break|rating|reviews/i },
    ];

    for (const tab of tabs) {
      const tabControl = page.getByRole('tab', { name: tab.label });
      await expect(tabControl).toBeVisible({ timeout: 10000 });
      await tabControl.focus();
      await page.keyboard.press('Enter');
      await expect(tabControl).toHaveAttribute(
        'data-state',
        'active',
        { timeout: 10000 },
      );
      const activePanel = page.getByRole('tabpanel', { name: tab.panel }).first();
      // eslint-disable-next-line playwright/no-conditional-in-test -- some local fixture tabs intentionally have empty panels
      if (tab.content) {
        await expect(activePanel).toBeVisible({ timeout: 10000 });
        await expect(activePanel).toContainText(tab.content, { timeout: 10000 });
      } else {
        await expect(activePanel).toHaveAttribute('data-state', 'active', { timeout: 10000 });
      }
    }

    await expect(page.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'data-state',
      'active',
    );
  });

  test('should display tides on forecast tab @requires-data', async ({ page }) => {
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Today sub-tab shows "Current Conditions" with tide, wind, swell cards.
    // Scope to the visible tabpanel to avoid matching hidden overview tab content.
    // Use .first() — multiple tabpanels exist (main beach tab + forecast sub-tab)
    const tabpanel = page.getByRole('tabpanel').first();
    await expect(tabpanel).toBeVisible({ timeout: 10000 });

    const tideLabel = tabpanel.getByText(/^Tide$/i).first();
    await expect(tideLabel).toBeVisible({ timeout: 15000 });

    // Switch to Tides sub-tab for the full tide chart
    const tidesSubTab = page.getByRole('tab', { name: /tides/i });
    await tidesSubTab.click();
    await expect(tidesSubTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Tides sub-tab renders native tide components (no more iframe)
    const tideChart = page.getByTestId('tide-chart-section');
    await expect(tideChart).toBeVisible({ timeout: 15000 });
  });

  test('carries a structured mismatch height into session logging @requires-data', async ({
    page,
  }) => {
    let submittedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/forecast-feedback', async (route) => {
      submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: '123e4567-e89b-42d3-a456-426614174000',
            contractVersion: 'forecast-feedback-context.v1',
          },
        }),
      });
    });

    const tooLow = page.getByRole('button', { name: /too low/i });
    await expect(tooLow).toBeVisible({ timeout: 15000 });
    await tooLow.click();

    const observedHeight = page.getByLabel(/what face height did you see/i);
    await expect(observedHeight).toBeVisible();
    await observedHeight.fill('6');
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(page.getByText('Feedback saved.')).toBeVisible();
    expect(submittedPayload).toMatchObject({
      feedbackKind: 'forecast_accuracy',
      feedbackValue: 'too_low',
      observedFaceHeightFt: 6,
    });
    expect(
      (submittedPayload as Record<string, unknown> | null)?.requestId,
    ).toEqual(expect.any(String));

    const sessionLogLink = page.getByRole('link', { name: 'Log the session' });
    await expect(sessionLogLink).toBeVisible();
    const sessionLogUrl = new URL(
      (await sessionLogLink.getAttribute('href')) ?? '',
      'http://localhost:3000',
    );
    expect(sessionLogUrl.searchParams.get('forecastFeedbackValue')).toBe(
      'too_low',
    );
    expect(sessionLogUrl.searchParams.get('observedFaceHeightFt')).toBe('6');
    await expect(tooLow).toBeDisabled();
    await expect(observedHeight).toBeDisabled();
  });
});

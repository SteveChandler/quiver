import { test, expect } from '@playwright/test';
import { TEST_BEACHES, VIEWPORTS, TIMEOUTS } from '../fixtures/test-data';
import { navigateToBeach } from '../utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

/**
 * Yesterday's Accuracy Card - E2E Tests
 *
 * Tests the accuracy card on the Forecast tab that shows
 * predicted vs actual wave heights from buoy observations.
 *
 * Note: Card visibility depends on real data availability and accuracy thresholds.
 * Tests use soft assertions where data may not be available.
 *
 * @project auth
 */

test.describe("Yesterday's Accuracy Card", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Yesterday's Accuracy Card" });
  });

  test('should show accuracy card on Forecast tab for observable beach when data available', async ({ page }) => {
    // Blacks Beach is an observable beach (near CDIP/Scripps station)
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Switch to Forecast tab
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.medium });
    await forecastTab.click();

    // Wait for the Today sub-tab to be visible (more reliable than Current Conditions which requires currentForecast)
    await expect(
      page.getByRole('tab', { name: /^Today$/i })
    ).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for content to load
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });

    // Card may or may not be visible depending on data availability and accuracy thresholds.
    // If visible, verify its content structure.
    const card = page.getByTestId('yesterdays-accuracy-card');

    // Wait for accuracy data to load (async fetch on mount).
    // Race: card appears OR additional wait time — avoids hardcoded timeout.
    await Promise.race([
      card.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Promise.race fallback for async accuracy data load
      page.waitForTimeout(3000),
    ]);

    const isVisible = await isVisibleSafe(card);

    if (isVisible) {
      // Verify card contains expected elements
      await expect(card.getByText(/Yesterday['’]s Accuracy/i)).toBeVisible();
      await expect(card.getByText(/Predicted/i)).toBeVisible();
      await expect(card.getByText(/Actual/i)).toBeVisible();
      await expect(card.getByText(/Accuracy/i)).toBeVisible();
      await expect(card.getByText(/ft/)).toBeVisible();
      await expect(card.getByText(/observation/i)).toBeVisible();

      // Verify progress bar exists
      await expect(card.getByTestId('accuracy-bar')).toBeVisible();
    }
    // If not visible, that's okay - data may not be available or accuracy may be poor
  });

  test('should display accuracy values in feet format', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.medium });
    await forecastTab.click();

    // Wait for the Today sub-tab to be visible
    await expect(
      page.getByRole('tab', { name: /^Today$/i })
    ).toBeVisible({ timeout: TIMEOUTS.long });

    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });

    const card = page.getByTestId('yesterdays-accuracy-card');

    await Promise.race([
      card.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Promise.race fallback for async accuracy data load
      page.waitForTimeout(3000),
    ]);

    const isVisible = await isVisibleSafe(card);

    if (isVisible) {
      // Should show values in feet (e.g., "3.2 ft")
      const cardText = await card.textContent();
      expect(cardText).toMatch(/\d+\.\d+\s*ft/);
      // Should show percentage (e.g., "85%")
      expect(cardText).toMatch(/\d+%/);
    }
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.medium });
    await forecastTab.click();

    // Wait for the Today sub-tab to be visible
    await expect(
      page.getByRole('tab', { name: /^Today$/i })
    ).toBeVisible({ timeout: TIMEOUTS.long });

    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });

    // Card should render cleanly on mobile if data is available
    const card = page.getByTestId('yesterdays-accuracy-card');

    await Promise.race([
      card.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      // eslint-disable-next-line playwright/no-wait-for-timeout -- Promise.race fallback for async accuracy data load
      page.waitForTimeout(3000),
    ]);

    const isVisible = await isVisibleSafe(card);

    if (isVisible) {
      // On mobile, card should still be fully visible (not clipped)
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(200);
        expect(box.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
      }
    }
  });
});

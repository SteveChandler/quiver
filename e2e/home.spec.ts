import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { VIEWPORTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';

/**
 * Authenticated Home Screen Tests
 * Tests the home screen/dashboard for logged-in users
 *
 * HomeScreen components tested:
 * - Welcome section with greeting and action buttons
 * - Forecast and Local Intel tabs
 * - ForecastTab content
 *
 * @project auth
 */

test.describe('Authenticated Home Screen', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('Welcome Section', () => {
    test('should display personalized greeting @smoke', async ({ page }) => {
      // HomeScreen shows "Hey, {name}!" greeting
      const greeting = page.getByRole('heading', { name: /hey,/i });
      await expect(greeting).toBeVisible({ timeout: 10000 });

      // Greeting should contain "Hey," followed by user name or "Surfer" fallback
      const greetingText = await greeting.textContent();
      expect(greetingText).toMatch(/Hey,\s*.+!/);
    });

    test('should display Plan Session button @smoke', async ({ page }) => {
      // Use first() since there may be multiple Plan Session buttons (e.g., forecast cards)
      await page.waitForTimeout(5000);
      const planButton = page.getByRole('button', { name: /plan session/i }).first();
      await expect(planButton).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to plan session wizard when clicking Plan Session', async ({ page }) => {
      // Use first() to get the main action button available on the page
      const planButton = page.getByRole('button', { name: /plan session/i }).first();
      await expect(planButton).toBeVisible({ timeout: 10000 });

      await planButton.click();

      // Should navigate to session wizard in plan mode
      await page.waitForURL('**/sessions/new?mode=plan', { timeout: 10000 });
      expect(page.url()).toContain('/sessions/new?mode=plan');
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should display Forecast tab as active by default @smoke', async ({ page }) => {
      // Wait for tabs to load
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toBeVisible({ timeout: 10000 });

      // Forecast tab should be selected/active by default
      await expect(forecastTab).toHaveAttribute('data-state', 'active');

      // Authenticated HomeScreen should NOT show the extra home search bar
      await expect(page.getByPlaceholder(/search by beach, spot, or region/i)).toHaveCount(0);
    });

    test('should display Local Intel tab', async ({ page }) => {
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });
      await expect(localIntelTab).toBeVisible({ timeout: 10000 });
    });

    test('should switch to Local Intel tab when clicked', async ({ page }) => {
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });
      await expect(localIntelTab).toBeVisible({ timeout: 10000 });

      await localIntelTab.click();

      // Local Intel tab should now be active
      await expect(localIntelTab).toHaveAttribute('data-state', 'active');

      // Forecast tab should no longer be active
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toHaveAttribute('data-state', 'inactive');
    });

    test('should display tab content when switching tabs', async ({ page }) => {
      // Start on Forecast tab - should see forecast content
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toHaveAttribute('data-state', 'active');

      // Switch to Local Intel
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });
      await localIntelTab.click();

      // Wait for tab switch animation
      await page.waitForTimeout(500);

      // Local Intel tab should now be active
      await expect(localIntelTab).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Forecast Tab Content', () => {
    test('should display forecast content when user has home beach', async ({ page }) => {
      // Ensure we're on Forecast tab
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toHaveAttribute('data-state', 'active');

      // Look for forecast-related content
      const forecastContent = page.locator('text=/forecast|conditions|swell|wind|waves/i').first();
      const hasContent = await forecastContent.isVisible({ timeout: 10000 }).catch(() => false);

      // Also check for "No Surf Spots Found" message (user without home beach)
      const noSpotsMessage = page.locator('text=/no surf spots|set.*home beach/i').first();
      const hasNoSpots = await noSpotsMessage.isVisible({ timeout: 2000 }).catch(() => false);

      // Either forecast content OR no spots message should be visible
      expect(hasContent || hasNoSpots).toBe(true);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Check for errors after viewport change
      await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

      // Greeting should still be visible
      const greeting = page.getByRole('heading', { name: /hey,/i });
      await expect(greeting).toBeVisible({ timeout: 10000 });

      // Action buttons should be visible (use first() since multiple Plan Session buttons exist)
      const planButton = page.getByRole('button', { name: /plan session/i }).first();
      await expect(planButton).toBeVisible();

      // Tabs should be visible
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toBeVisible();
    });
  });
});

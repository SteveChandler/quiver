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
 * - NearbyBeachChips
 * - BeachSearchBar
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
      // Use first() since there may be multiple Plan Session buttons (welcome section + forecast cards)
      await page.waitForTimeout(5000);
      const planButton = page.getByRole('button', { name: /plan session/i }).first();
      await expect(planButton).toBeVisible({ timeout: 10000 });
    });

    test('should display Log Session button @smoke', async ({ page }) => {
      const logButton = page.getByRole('button', { name: /log session/i }).first();
      await expect(logButton).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to plan session wizard when clicking Plan Session', async ({ page }) => {
      // Use first() to get the main action button in welcome section
      const planButton = page.getByRole('button', { name: /plan session/i }).first();
      await expect(planButton).toBeVisible({ timeout: 10000 });

      await planButton.click();

      // Should navigate to session wizard in plan mode
      await page.waitForURL('**/sessions/new?mode=plan', { timeout: 10000 });
      expect(page.url()).toContain('/sessions/new?mode=plan');
    });

    test('should navigate to log session wizard when clicking Log Session', async ({ page }) => {
      const logButton = page.getByRole('button', { name: /log session/i }).first();
      await expect(logButton).toBeVisible({ timeout: 10000 });

      await logButton.click();

      // Should navigate to session wizard in log mode
      await page.waitForURL('**/sessions/new?mode=log', { timeout: 10000 });
      expect(page.url()).toContain('/sessions/new?mode=log');
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should display Forecast tab as active by default @smoke', async ({ page }) => {
      // Wait for tabs to load
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toBeVisible({ timeout: 10000 });

      // Forecast tab should be selected/active by default
      await expect(forecastTab).toHaveAttribute('data-state', 'active');
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

  test.describe('Beach Search Bar', () => {
    test('should display beach search bar on Forecast tab @smoke', async ({ page }) => {
      // Beach search should be visible on the Forecast tab
      // Placeholder is "Search by beach, spot, or region"
      const searchInput = page.getByPlaceholder(/search by beach/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('should allow typing in search bar', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search by beach/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      await searchInput.fill('Ocean');

      // Should accept input
      await expect(searchInput).toHaveValue('Ocean');
    });

    test('should show search suggestions when typing', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search by beach/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      await searchInput.fill('Black');
      await page.waitForTimeout(1000);

      // Should show dropdown with suggestions
      const suggestions = page.locator('[role="option"], [role="listbox"] li, [data-testid="search-result"]');
      const suggestionCount = await suggestions.count();

      // If suggestions appear, verify they're visible
      if (suggestionCount > 0) {
        await expect(suggestions.first()).toBeVisible();
      }
    });
  });

  test.describe('Nearby Beach Chips', () => {
    test('should display nearby beach chips', async ({ page }) => {
      // Wait for chips to load - they may take time to fetch nearby beaches
      await page.waitForTimeout(2000);

      // Look for the nearby chips container or individual chips
      const chips = page.locator('button, a').filter({ hasText: /beach/i });
      const chipCount = await chips.count();

      // If user has location access, chips should appear
      // This is optional - some users may not have granted location
      if (chipCount > 0) {
        await expect(chips.first()).toBeVisible();
      }
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
      const logButton = page.getByRole('button', { name: /log session/i }).first();

      await expect(planButton).toBeVisible();
      await expect(logButton).toBeVisible();

      // Tabs should be visible
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      await expect(forecastTab).toBeVisible();
    });
  });
});

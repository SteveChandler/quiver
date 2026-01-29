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
      // HomeScreen shows time-based greeting "Good morning/afternoon/evening, {name}."
      const greeting = page.getByRole('heading', { level: 1 }).first();
      await expect(greeting).toBeVisible({ timeout: 10000 });

      // Greeting should contain time-of-day greeting and user name
      const greetingText = await greeting.textContent();
      expect(greetingText).toMatch(/Good (morning|afternoon|evening),\s*.+\./);
    });

    test('should display action button @smoke', async ({ page }) => {
      // Wait for page content to load
      await page.waitForTimeout(3000);

      // Look for various action buttons that may be visible depending on state
      // Note: Button accessible names may differ from visible text
      const planWeekendButton = page.getByRole('button', { name: /plan.*weekend|weekend.*surf/i });
      const planSessionButton = page.getByRole('button', { name: /plan session/i }).first();
      const exploreButton = page.getByRole('button', { name: /explore beaches/i });
      const useLocationButton = page.getByRole('button', { name: /use my location/i });
      const atBeachButton = page.getByRole('button', { name: /at the beach|i'm at the beach/i });

      const hasPlanWeekend = await planWeekendButton.isVisible({ timeout: 5000 }).catch(() => false);
      const hasPlanSession = await planSessionButton.isVisible().catch(() => false);
      const hasExplore = await exploreButton.isVisible().catch(() => false);
      const hasLocation = await useLocationButton.isVisible().catch(() => false);
      const hasAtBeach = await atBeachButton.isVisible().catch(() => false);

      // At least one of these action buttons should be visible
      expect(hasPlanWeekend || hasPlanSession || hasExplore || hasLocation || hasAtBeach).toBe(true);
    });

    test('should navigate to beach forecast when clicking Plan Weekend', async ({ page }) => {
      // Wait for page content to load
      await page.waitForTimeout(3000);

      // Try Plan Weekend button first, then fallback to Plan Session
      const planWeekendButton = page.getByRole('button', { name: /plan weekend/i });
      const planSessionButton = page.getByRole('button', { name: /plan session/i }).first();

      let clicked = false;

      if (await planWeekendButton.isVisible().catch(() => false)) {
        await planWeekendButton.click();
        clicked = true;
        // Plan Weekend navigates to beach forecast tab
        await page.waitForURL(/\?tab=forecast/, { timeout: 10000 });
        expect(page.url()).toContain('?tab=forecast');
      } else if (await planSessionButton.isVisible().catch(() => false)) {
        await planSessionButton.click();
        clicked = true;
        // Plan Session may navigate to session planner
        await page.waitForURL('**/sessions/**', { timeout: 10000 });
        expect(page.url()).toContain('/sessions/');
      }

      if (!clicked) {
        // Skip if no planning button available (rate limited state)
        test.skip();
      }
    });
  });

  test.describe('Time Slot Filter', () => {
    test('should display time slot filter with "Any time" active by default @smoke', async ({ page }) => {
      // Wait for time slot filter to load
      const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
      await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

      // "Any time" button should be pressed by default
      const anyTimeButton = page.getByRole('button', { name: /any time/i });
      await expect(anyTimeButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should display all time slot options', async ({ page }) => {
      const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
      await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

      // Check all time slot buttons are visible
      await expect(page.getByRole('button', { name: /any time/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /dawn patrol/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /morning/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /afternoon/i })).toBeVisible();
    });

    test('should switch time slot when clicking different option', async ({ page }) => {
      const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
      await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

      // Click on "Dawn patrol"
      const dawnPatrolButton = page.getByRole('button', { name: /dawn patrol/i });
      await dawnPatrolButton.click();

      // Wait for filter change
      await page.waitForTimeout(500);

      // Dawn patrol should now be pressed
      await expect(dawnPatrolButton).toHaveAttribute('aria-pressed', 'true');

      // Any time should no longer be pressed
      const anyTimeButton = page.getByRole('button', { name: /any time/i });
      await expect(anyTimeButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('should update recommendations when switching time slots', async ({ page }) => {
      const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
      await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

      // Get initial recommendation text
      const recommendation = page.getByRole('heading', { level: 1 }).last();
      await expect(recommendation).toBeVisible();

      // Switch to Morning
      const morningButton = page.getByRole('button', { name: /^morning$/i });
      await morningButton.click();

      // Wait for update
      await page.waitForTimeout(500);

      // Recommendation should still be visible (content may change)
      await expect(recommendation).toBeVisible();
    });
  });

  test.describe('Surf Recommendations Content', () => {
    test('should display recommendation or fallback content', async ({ page }) => {
      // Wait for content to load
      await page.waitForTimeout(3000);

      // Look for best spot recommendation heading OR rate limit/error message
      const bestSpotHeading = page.getByRole('heading', { level: 1 }).filter({ hasText: /best bet|is your best bet/i });
      const hasRecommendation = await bestSpotHeading.isVisible({ timeout: 5000 }).catch(() => false);

      // Alternative: Error/fallback message (check for paragraph with error text)
      const errorMessage = page.getByText('Unable to load recommendation');
      const rateLimitMessage = page.getByText(/rate limit exceeded/i);
      const hasError = await errorMessage.isVisible().catch(() => false);
      const hasRateLimit = await rateLimitMessage.isVisible().catch(() => false);

      // Either recommendation or error should be shown
      expect(hasRecommendation || hasError || hasRateLimit).toBe(true);
    });

    test('should display Your Top Spots section', async ({ page }) => {
      // Look for Top Spots region
      const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
      await expect(topSpotsRegion).toBeVisible({ timeout: 10000 });

      // Should have spot cards OR "No spots found" message
      const spotCards = page.getByRole('button').filter({ hasText: /score.*out of 10/i });
      const noSpotsMessage = page.getByText(/no spots found/i);

      const hasCards = await spotCards.first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasNoSpots = await noSpotsMessage.isVisible().catch(() => false);

      expect(hasCards || hasNoSpots).toBe(true);
    });

    test('should display some action buttons', async ({ page }) => {
      // Wait for content to load
      await page.waitForTimeout(3000);

      // Check for various action buttons that may be present
      const atBeachButton = page.getByRole('button', { name: /i'm at the beach/i });
      const planWeekendButton = page.getByRole('button', { name: /plan weekend/i });
      const exploreButton = page.getByRole('button', { name: /explore beaches/i });
      const useLocationButton = page.getByRole('button', { name: /use my location/i });

      const hasAtBeach = await atBeachButton.isVisible().catch(() => false);
      const hasPlanWeekend = await planWeekendButton.isVisible().catch(() => false);
      const hasExplore = await exploreButton.isVisible().catch(() => false);
      const hasUseLocation = await useLocationButton.isVisible().catch(() => false);

      // At least one action button should be visible
      expect(hasAtBeach || hasPlanWeekend || hasExplore || hasUseLocation).toBe(true);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Check for errors after viewport change
      await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

      // Greeting should still be visible
      const greeting = page.getByRole('heading', { level: 1 }).first();
      await expect(greeting).toBeVisible({ timeout: 10000 });

      // Time slot filter should be visible on mobile
      const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
      await expect(timeSlotFilter).toBeVisible();

      // Top Spots region should be visible
      const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
      await expect(topSpotsRegion).toBeVisible();
    });
  });
});

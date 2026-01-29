import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  ensureAuthenticated,
} from './utils/test-helpers';
import {
  createDiscoveryFixture,
  removeSurfDiscoveryCacheInitScript,
} from './fixtures/discovery-fixture';

/**
 * Plan Weekend Button Navigation Tests
 *
 * Tests for the "Plan Weekend" button behavior - navigates to beach forecast tab.
 *
 * @project auth
 */

test.describe('Plan Weekend Button Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createDiscoveryFixture()),
      });
    });

    await ensureAuthenticated(page);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('navigates to beach forecast tab when clicked', async ({ page }) => {
    // Wait for hero recommendation to fully load
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();
    await expect(planWeekendButton).toBeEnabled();
    await planWeekendButton.click();

    // Should navigate to beach page with forecast tab
    await page.waitForURL(/\?tab=forecast/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\?tab=forecast/);
  });

  test('forecast tab is active on destination page', async ({ page }) => {
    // Wait for hero recommendation to fully load
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();
    await expect(planWeekendButton).toBeEnabled();
    await planWeekendButton.click();

    await page.waitForURL(/\?tab=forecast/, { timeout: 20_000 });

    // Verify forecast tab is active
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 10_000 });
    await expect(forecastTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Plan Weekend and At Beach buttons navigate to different destinations', async ({ page }) => {
    // Wait for hero recommendation to fully load
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    // Both buttons should be visible
    const planWeekendButton = page.getByTestId("plan-weekend-button");
    const atBeachButton = page.getByTestId("at-beach-button");

    await expect(planWeekendButton).toBeVisible();
    await expect(atBeachButton).toBeVisible();

    // Test Plan Weekend -> Forecast Tab
    await planWeekendButton.click();
    await expect(page).toHaveURL(/\?tab=forecast/, { timeout: 20_000 });

    // Go back
    await page.goBack();
    await waitForPageLoad(page);

    // Wait for buttons again
    await expect(atBeachButton).toBeVisible({ timeout: 10_000 });

    // Test At Beach -> Session Logger (mode=log)
    await atBeachButton.click();
    await expect(page).toHaveURL(/\/sessions\/new\?.*mode=log/, { timeout: 20_000 });
  });

  test('button has proper touch target size on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for hero recommendation to fully load
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();

    // Verify touch target size (accessibility - iOS guideline is 44px)
    const box = await planWeekendButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await planWeekendButton.click();
    await expect(page).toHaveURL(/\?tab=forecast/, { timeout: 20_000 });
  });
});

test.describe('Plan Weekend - Empty State', () => {
  test('shows fallback UI when no recommendations exist', async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    // Mock empty recommendations
    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createDiscoveryFixture({ empty: true })),
      });
    });

    await ensureAuthenticated(page);
    await page.goto('/');
    await waitForPageLoad(page);

    // With empty recommendations, the Plan Weekend button should NOT be visible
    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).not.toBeVisible({ timeout: 10_000 });

    // Fallback UI should be shown instead - either the fallback actions or time slot empty state
    const fallbackActions = page.getByTestId("fallback-actions");
    const timeSlotEmpty = page.getByTestId("time-slot-empty-state");

    // At least one of the fallback UIs should be visible
    const hasFallback = await fallbackActions.isVisible().catch(() => false);
    const hasTimeSlotEmpty = await timeSlotEmpty.isVisible().catch(() => false);

    expect(hasFallback || hasTimeSlotEmpty).toBe(true);
  });
});

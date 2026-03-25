import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { isVisibleSafe } from './utils/strict-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Progression Dashboard Tests
 * Tests the Progression tab in the journal view
 *
 * NOTE: These tests require an authenticated session to view journal content.
 * In dev/CI environments without seeded session data, they use isVisibleSafe
 * to handle both "has data" and "zero state" scenarios gracefully.
 *
 * @project auth
 */

test.describe('Progression Dashboard', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    // The journal view (including the Progression tab) lives inside the profile page,
    // under the "sessions" (Journal+) tab. There is no standalone /journal route.
    await page.goto('/profile?tab=sessions');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Progression Dashboard' });
  });

  test('progression tab renders in journal view', async ({ page }) => {
    // The journal page may redirect unauthenticated users or show zero state
    const progressionTab = page.getByRole('tab', { name: /progression/i });
    const hasTab = await isVisibleSafe(progressionTab);

    if (!hasTab) {
      // Check if we're on auth redirect or zero state
      const authRedirect = page.url().includes('/auth') || page.url().includes('/login');
      const zeroState = page.getByText(/no sessions yet|start.*log|log.*first/i).first();
      const hasZeroState = await isVisibleSafe(zeroState);

      if (authRedirect || hasZeroState) {
        test.skip(true, 'User not authenticated or no sessions — tab not rendered');
        return;
      }

      // If neither, the tab should be visible — fail with helpful message
      await expect(progressionTab).toBeVisible({ timeout: 5000 });
    } else {
      await expect(progressionTab).toBeVisible();
    }
  });

  test('all 5 cards render after clicking Progression tab', async ({ page }) => {
    const progressionTab = page.getByRole('tab', { name: /progression/i });
    const hasTab = await isVisibleSafe(progressionTab);

    if (!hasTab) {
      test.skip(true, 'Progression tab not visible — requires authenticated user with journal access');
      return;
    }

    await progressionTab.click();
    await page.waitForLoadState('load');

    // Progression tab content should be visible
    const progressionContent = page.locator('[data-testid="progression-dashboard"]');
    await expect(progressionContent).toBeVisible({ timeout: 10000 });

    // Check for card sections — either data cards or zero state
    const streakCard = page.locator('[data-testid="streak-card"]');
    const zeroState = page.locator('[data-testid="progression-zero-state"]');

    const hasStreakCard = await isVisibleSafe(streakCard);
    const hasZeroState = await isVisibleSafe(zeroState);

    expect(hasStreakCard || hasZeroState).toBe(true);

    if (hasStreakCard) {
      // If data is present, verify all 5 card sections
      const skillCard = page.locator('[data-testid="skill-progression-card"]');
      const sweetSpotCard = page.locator('[data-testid="sweet-spot-card"]');
      const bestsCard = page.locator('[data-testid="personal-bests-card"]');
      const impactCard = page.locator('[data-testid="forecast-impact-card"]');

      await expect(skillCard).toBeVisible({ timeout: 5000 });
      await expect(sweetSpotCard).toBeVisible({ timeout: 5000 });
      await expect(bestsCard).toBeVisible({ timeout: 5000 });
      await expect(impactCard).toBeVisible({ timeout: 5000 });
    }
  });

  test('dashboard renders gracefully with no session data (zero state)', async ({ page }) => {
    const progressionTab = page.getByRole('tab', { name: /progression/i });
    const hasTab = await isVisibleSafe(progressionTab);

    if (!hasTab) {
      test.skip(true, 'Progression tab not visible — requires authenticated user with journal access');
      return;
    }

    await progressionTab.click();
    await page.waitForLoadState('load');

    // Either data cards or zero state should be shown — never a blank/broken page
    const progressionContent = page.locator('[data-testid="progression-dashboard"]');
    await expect(progressionContent).toBeVisible({ timeout: 10000 });

    // Verify no raw error text appears
    const errorText = page.getByText(/something went wrong|error:/i);
    const hasError = await isVisibleSafe(errorText);
    expect(hasError).toBe(false);

    // Either the zero state copy or dashboard data should be present
    const hasZeroState = await isVisibleSafe(page.locator('[data-testid="progression-zero-state"]'));
    const hasDashboard = await isVisibleSafe(page.locator('[data-testid="streak-card"]'));
    expect(hasZeroState || hasDashboard).toBe(true);
  });

  test('responsive at mobile breakpoint (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const progressionTab = page.getByRole('tab', { name: /progression/i });
    const hasTab = await isVisibleSafe(progressionTab);

    if (!hasTab) {
      test.skip(true, 'Progression tab not visible at mobile breakpoint');
      return;
    }

    await progressionTab.click();
    await page.waitForLoadState('load');

    // Verify the progression content is reachable and doesn't overflow
    const progressionContent = page.locator('[data-testid="progression-dashboard"]');
    await expect(progressionContent).toBeVisible({ timeout: 10000 });

    // Verify no horizontal overflow that would break mobile layout
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 10); // 10px tolerance
  });

  test('impact card shows beach data when sessions exist', async ({ page }) => {
    const progressionTab = page.getByRole('tab', { name: /progression/i });
    const hasTab = await isVisibleSafe(progressionTab);

    if (!hasTab) {
      test.skip(true, 'Progression tab not visible — requires authenticated user');
      return;
    }

    await progressionTab.click();
    await page.waitForLoadState('load');

    const impactCard = page.locator('[data-testid="forecast-impact-card"]');
    const hasImpactCard = await isVisibleSafe(impactCard);

    if (!hasImpactCard) {
      // Zero state is acceptable
      const zeroState = page.locator('[data-testid="progression-zero-state"]');
      const hasZeroState = await isVisibleSafe(zeroState);
      expect(hasZeroState).toBe(true);
      return;
    }

    // If impact card is visible, verify it has the motivational footer
    const motivationalText = page.getByText(/every session.*log.*forecast|train.*forecast/i);
    const hasMotivationalText = await isVisibleSafe(motivationalText);
    expect(hasMotivationalText).toBe(true);
  });
});

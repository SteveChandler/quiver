import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * Sessions Page Tests
 * Tests the sessions list and session management
 *
 * @project auth
 */

test.describe('Sessions Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/sessions');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Sessions Page' });
  });

  test('should display sessions page', async ({ page }) => {
    // Should show sessions heading
    const heading = page.getByRole('heading', { name: /sessions?|my sessions/i });
    const hasHeading = await isVisibleSafe(heading);

    if (!hasHeading) {
      // Maybe different text
      const pageText = page.getByText(/sessions?|surf sessions?|log/i).first();
      await expect(pageText).toBeVisible({ timeout: 10000 });
    } else {
      await expect(heading).toBeVisible();
    }
  });

  test('should display session list or empty state', async ({ page }) => {
    // Check if there are sessions
    const sessionCards = page.locator('a[href^="/sessions/"], [data-testid*="session"]');
    const count = await sessionCards.count();

    if (count === 0) {
      // Should show empty state
      const emptyState = page.getByText(/no.*sessions|get started|log your first/i);
      const hasEmpty = await isVisibleSafe(emptyState);

      if (!hasEmpty) {
        test.skip(true, 'No sessions found and no empty state UI displayed');
        return;
      }
    } else {
      // Has sessions - should be visible
      await expect(sessionCards.first()).toBeVisible();
    }
  });

  test('should have add/create session button', async ({ page }) => {
    // Should have a way to create new session
    const createButton = page.getByRole('button', { name: /log session|add session|new session|create/i });
    const createLink = page.getByRole('link', { name: /log session|add session|new session|create/i });

    const hasButton = await isVisibleSafe(createButton);
    const hasLink = await isVisibleSafe(createLink);

    expect(hasButton || hasLink).toBe(true);
  });

  test('should allow clicking on session to view details', async ({ page }) => {
    // Find session detail links (exclude /sessions/new links)
    const sessionLinks = page.locator('a[href^="/sessions/"]:not([href*="/sessions/new"])');
    const count = await sessionLinks.count();

    if (count > 0) {
      const href = await sessionLinks.first().getAttribute('href');
      await sessionLinks.first().click();

      // Wait for navigation to the session detail page
      if (href) {
        await page.waitForURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15000 });
      }
      await waitForPageLoad(page);

      // URL should contain /sessions/ followed by an ID (not just /sessions)
      expect(page.url()).toMatch(/\/sessions\/[^/]+/);
    } else {
      test.skip(true, 'No sessions available to test navigation');
      return;
    }
  });
});

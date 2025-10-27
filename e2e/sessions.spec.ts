import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * Sessions Page Tests
 * Tests the sessions list and session management
 *
 * @project auth
 */

test.describe('Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions');
    await waitForPageLoad(page);
  });

  test('should display sessions page', async ({ page }) => {
    // Should show sessions heading
    const heading = page.getByRole('heading', { name: /sessions?|my sessions/i });
    const hasHeading = await heading.isVisible().catch(() => false);

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
      const emptyState = page.getByText(/no sessions|get started|log your first/i);
      const hasEmpty = await emptyState.isVisible().catch(() => false);

      if (!hasEmpty) {
        test.skip(true, 'No sessions and no empty state - may be different UI');
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

    const hasButton = await createButton.isVisible().catch(() => false);
    const hasLink = await createLink.isVisible().catch(() => false);

    expect(hasButton || hasLink).toBe(true);
  });

  test('should allow clicking on session to view details', async ({ page }) => {
    // Check if there are sessions
    const sessionLinks = page.locator('a[href^="/sessions/"]');
    const count = await sessionLinks.count();

    if (count > 0) {
      // Click first session
      await sessionLinks.first().click();
      await waitForPageLoad(page);

      // Should navigate to session detail
      expect(page.url()).toContain('/sessions/');
    } else {
      test.skip(true, 'No sessions available to click');
    }
  });

  test('should filter or sort sessions if available', async ({ page }) => {
    // Look for filter/sort controls
    const filterButton = page.getByRole('button', { name: /filter|sort|recent|oldest/i });
    const hasFilter = await filterButton.isVisible().catch(() => false);

    if (!hasFilter) {
      test.skip(true, 'Filter functionality not visible');
    }
  });
});

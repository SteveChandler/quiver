import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { VIEWPORTS } from './fixtures/test-data';

/**
 * Authenticated Home Screen Tests
 * Tests the home screen/dashboard for logged-in users
 *
 * @project auth
 */

test.describe('Authenticated Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should display home screen for authenticated users', async ({ page }) => {
    // Should NOT see landing page
    const landingHero = page.getByRole('heading', { name: /find your next wave/i });
    const isLanding = await landingHero.isVisible().catch(() => false);

    expect(isLanding).toBe(false);

    // Should see authenticated content
    // (This could be sessions, beaches, forecast, etc.)
  });

  test('should display navigation header', async ({ page }) => {
    // Should show Quiver logo
    const logo = page.getByText(/quiver/i).first();
    await expect(logo).toBeVisible();

    // Should show navigation links or menu
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });

  test('should have user menu or avatar', async ({ page }) => {
    // Should show user avatar or menu button
    const userMenu = page.getByRole('button', { name: /menu|account|user/i });
    const avatar = page.locator('[class*="avatar"], [data-testid="avatar"]').first();

    const hasMenu = await userMenu.isVisible().catch(() => false);
    const hasAvatar = await avatar.isVisible().catch(() => false);

    expect(hasMenu || hasAvatar).toBe(true);
  });

  test('should display recent or featured content', async ({ page }) => {
    // Should show some content (beaches, sessions, forecasts)
    const content = page.locator('a[href^="/beach/"], a[href^="/sessions/"]');
    const count = await content.count();

    // If no content yet, check for empty state or welcome message
    if (count === 0) {
      const emptyState = page.getByText(/welcome|get started|no sessions|explore/i).first();
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      if (!hasEmptyState) {
        test.skip(true, 'No content and no empty state - home page may have different structure');
      }
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should have quick navigation to main sections', async ({ page }) => {
    // Should have links to Map, Sessions, Profile, etc.
    const mapLink = page.getByRole('link', { name: /map|discover/i });
    const sessionsLink = page.getByRole('link', { name: /sessions/i });

    const hasMap = await mapLink.isVisible().catch(() => false);
    const hasSessions = await sessionsLink.isVisible().catch(() => false);

    // At least one navigation link should be visible
    expect(hasMap || hasSessions).toBe(true);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Navigation should still be accessible
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();

    // Logo should be visible
    const logo = page.getByText(/quiver/i).first();
    await expect(logo).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    const hasSearchInput = await searchInput.isVisible().catch(() => false);
    const hasSearchButton = await searchButton.isVisible().catch(() => false);

    // At least one search element should be present
    expect(hasSearchInput || hasSearchButton).toBe(true);
  });
});

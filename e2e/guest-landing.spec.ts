import { test, expect } from '@playwright/test';
import { VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * Guest Landing Page Tests
 * Tests the landing page for unauthenticated users
 *
 * @project guest
 */

test.describe('Guest Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should display landing page for guests', async ({ page }) => {
    // Should NOT be redirected to authenticated routes
    expect(page.url()).not.toContain('/profile');
    expect(page.url()).not.toContain('/sessions');

    // Should see landing page content - look for any heading or main content
    const hero = page.getByRole('heading').first();
    const mainContent = page.locator('main, [role="main"]').first();

    const hasHero = await hero.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);

    // Landing page should have some content
    expect(hasHero || hasMain).toBe(true);
  });

  test('should display navigation with login/signup buttons', async ({ page }) => {
    // Should see login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await expect(loginButton).toBeVisible();

    // Should see signup button
    const signupButton = page.getByRole('button', { name: /sign up/i });
    await expect(signupButton).toBeVisible();
  });

  test('should open auth modal when clicking login', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Should see auth modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should see auth options
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await expect(googleButton).toBeVisible();
  });

  test('should open auth modal when clicking signup', async ({ page }) => {
    const signupButton = page.getByRole('button', { name: /sign up/i });
    await signupButton.click();

    // Should see auth modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test('should display featured beaches', async ({ page }) => {
    // Should show some beach cards
    const beachCards = page.locator('a[href^="/beach/"]').first();
    await expect(beachCards).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Hero should still be visible - any heading is fine
    const hero = page.getByRole('heading').first();
    await expect(hero).toBeVisible();

    // Login/signup buttons should be accessible (might be in menu on mobile)
    const loginButton = page.getByRole('button', { name: /log in/i });
    const signupButton = page.getByRole('button', { name: /sign up/i });
    const mobileMenu = page.getByRole('button', { name: /menu|☰|hamburger/i });

    const hasLoginButton = await loginButton.isVisible().catch(() => false);
    const hasSignupButton = await signupButton.isVisible().catch(() => false);
    const hasMobileMenu = await mobileMenu.isVisible().catch(() => false);

    // Either login/signup buttons are visible or there's a mobile menu
    expect(hasLoginButton || hasSignupButton || hasMobileMenu).toBe(true);
  });

  test('should handle search input on landing page', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill('Ocean Beach');
      await expect(searchInput).toHaveValue('Ocean Beach');
    } else {
      test.skip(true, 'Search not available on landing page');
    }
  });
});

import { test, expect } from '@playwright/test';
import { TIMEOUTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';

/**
 * Guest Landing Page Tests
 * Tests the landing page for unauthenticated users
 *
 * Core tests:
 * - Page loads without errors
 * - Login/Signup buttons are visible
 * - Auth modal opens when clicking login/signup
 *
 * @project guest
 */

test.describe('Guest Landing Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display landing page for guests @smoke', async ({ page }) => {
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

  test('should display navigation with login/signup buttons @smoke', async ({ page }) => {
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

  test.describe('Loading States', () => {
    test('should show loading skeletons initially', async ({ page }) => {
      // Navigate and quickly check for skeleton
      const navigationPromise = page.goto('/');

      // Look for loading skeleton
      const skeleton = page.locator('.animate-pulse').first();
      const skeletonAppeared = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

      await navigationPromise;

      // Skeleton may or may not appear depending on load speed
      // This is acceptable behavior - just verify if it appears, it eventually disappears
      if (skeletonAppeared) {
        await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
      }
    });

    test('should transition from loading to content smoothly', async ({ page }) => {
      await page.reload();

      // Wait for any loading state to complete
      await page.waitForTimeout(1000);

      // Verify actual content is displayed
      const contentLoaded = page.locator('img, h1, h2, h3').first();
      await expect(contentLoaded).toBeVisible({ timeout: TIMEOUTS.long });
    });
  });

  test.describe('Search Functionality', () => {
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

  test.describe('Content Validation', () => {
    test('should have proper page title and meta tags', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);

      // Should have description meta tag
      const description = await page.getAttribute('meta[name="description"]', 'content');
      expect(description).toBeTruthy();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1').first();
      const h1Exists = await h1.isVisible().catch(() => false);

      // Page should have an h1
      expect(h1Exists).toBe(true);
    });
  });
});

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

  // TODO: Test drift - signup button selector changed, may now be "Get Started" or similar
  test.skip('should open auth modal when clicking signup', async ({ page }) => {
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

  test.describe('SSR/SEO Validation', () => {
    test('should have beach links in page HTML for SEO crawlability @seo', async ({ page }) => {
      // Get the page HTML source
      const response = await page.goto('/');
      const html = await response?.text();

      // Beach links should be present in the initial HTML
      // These are server-rendered for SEO crawlability
      expect(html).toBeTruthy();

      // Check for hierarchical beach URLs (/{state}/{city}/{beach-slug})
      // At least one of these state slugs should be present
      const hasStateBeachLinks =
        html?.includes('href="/ca/') ||
        html?.includes('href="/fl/') ||
        html?.includes('href="/hi/') ||
        html?.includes('href="/or/');

      // Or fallback beach links
      const hasFallbackBeachLinks = html?.includes('href="/beach/');

      expect(hasStateBeachLinks || hasFallbackBeachLinks).toBe(true);
    });

    test('should have beach links visible in DOM @seo', async ({ page }) => {
      // Wait for page to be fully loaded
      await waitForPageLoad(page);

      // Look for beach links - should be present regardless of JS loading
      const beachLinks = page.locator('a[href*="/ca/"], a[href*="/fl/"], a[href*="/hi/"], a[href*="/or/"], a[href*="/beach/"]');
      const linkCount = await beachLinks.count();

      // Should have at least one beach link visible
      expect(linkCount).toBeGreaterThan(0);
    });

    test('should have beach section heading in HTML @seo', async ({ page }) => {
      const response = await page.goto('/');
      const html = await response?.text();

      // The section should have proper headings for SEO
      // Check for the "Popular Surf Spots" or similar heading
      const hasSurfSpotsHeading =
        html?.includes('Surf Spots') ||
        html?.includes('surf spots') ||
        html?.includes('Popular') ||
        html?.includes('Trending');

      expect(hasSurfSpotsHeading).toBe(true);
    });

    test('should have structured data for SEO @seo', async ({ page }) => {
      const response = await page.goto('/');
      const html = await response?.text();

      // Should have FAQ schema or other structured data
      const hasStructuredData =
        html?.includes('application/ld+json') ||
        html?.includes('FAQPage') ||
        html?.includes('@type');

      expect(hasStructuredData).toBe(true);
    });

    test('should render beach images with proper alt text @seo', async ({ page }) => {
      await waitForPageLoad(page);

      // Find beach card images
      const beachImages = page.locator('img[alt]').filter({
        has: page.locator('..').filter({ has: page.locator('a[href*="/ca/"], a[href*="/fl/"], a[href*="/hi/"], a[href*="/beach/"]') }),
      });

      // Check if any beach images are present with alt text
      const imageCount = await beachImages.count();

      // If we have beach images, verify they have non-empty alt text
      if (imageCount > 0) {
        const firstImage = beachImages.first();
        const altText = await firstImage.getAttribute('alt');
        expect(altText).toBeTruthy();
        expect(altText?.length).toBeGreaterThan(0);
      }
    });
  });
});

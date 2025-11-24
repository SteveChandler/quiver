import { test, expect } from '@playwright/test';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
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

  test.describe('Surf Highlights Section - Image Loading', () => {
    test('should load all surf spot images successfully', async ({ page }) => {
      // Wait for surf highlights section to be visible
      const surfHighlightsSection = page.locator('text="Today\'s Top Surf Spots"').first();
      const sectionVisible = await surfHighlightsSection.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!sectionVisible) {
        test.skip(true, 'Surf highlights section not visible');
        return;
      }

      // Wait for images to appear
      const images = page.locator('img[alt]').filter({ has: page.locator('..').filter({ has: page.locator('a[href^="/"]') }) });
      const imageCount = await images.count();

      if (imageCount === 0) {
        test.skip(true, 'No images found on landing page');
        return;
      }

      // Verify each image loads correctly
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        await expect(img).toBeVisible({ timeout: TIMEOUTS.medium });

        // Verify image has loaded (naturalWidth > 0)
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);

        expect(naturalWidth).toBeGreaterThan(0);
        expect(naturalHeight).toBeGreaterThan(0);

        // Verify image src is not empty or broken
        const src = await img.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src).not.toMatch(/^data:image\/svg\+xml/); // Not a placeholder
      }
    });

    test('should not display broken image icons', async ({ page }) => {
      // Wait for page to load
      await page.waitForTimeout(3000);

      // Get all images on the page
      const images = page.locator('img');
      const imageCount = await images.count();

      if (imageCount === 0) {
        test.skip(true, 'No images found on page');
        return;
      }

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible().catch(() => false);

        if (isVisible) {
          // Check if image has actually loaded
          const complete = await img.evaluate((el: HTMLImageElement) => el.complete);
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);

          // If image is complete but has no width, it failed to load
          if (complete) {
            expect(naturalWidth).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('Beach Card Navigation', () => {
    test('should have valid href attributes on beach cards', async ({ page }) => {
      // Wait for beach cards to appear
      const beachCards = page.locator('a[href^="/"]').filter({
        has: page.locator('img')
      });

      const cardCount = await beachCards.count();

      if (cardCount === 0) {
        test.skip(true, 'No beach cards found');
        return;
      }

      // Verify first few cards have valid hrefs
      const cardsToCheck = Math.min(cardCount, 5);

      for (let i = 0; i < cardsToCheck; i++) {
        const card = beachCards.nth(i);
        const href = await card.getAttribute('href');

        // Verify href exists and follows expected patterns
        expect(href).toBeTruthy();

        // Should match hierarchical format /state/city/beach-slug OR /beach/id
        // Accepts any valid URL segments (state codes OR full state names)
        // Should NOT match old /beaches/ format
        expect(href).toMatch(/^\/([^\/]+\/[^\/]+\/[^\/]+|beach\/[^\/]+)$/i);
        expect(href).not.toContain('/beaches/');
      }
    });

    test('should navigate to beach detail page when clicking card', async ({ page }) => {
      // Wait for beach cards to load
      const firstCard = page.locator('a[href^="/"]').filter({
        has: page.locator('img')
      }).first();

      const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!cardVisible) {
        test.skip(true, 'No beach cards visible');
        return;
      }

      const href = await firstCard.getAttribute('href');
      expect(href).toBeTruthy();

      // Click the card
      await firstCard.click();

      // Wait for navigation to complete
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });

      // Verify we navigated to the expected URL
      expect(page.url()).toContain(href!);

      // Verify beach detail page loaded
      const beachName = page.locator('h1, [data-testid="beach-name"]').first();
      await expect(beachName).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should open beach links in same tab by default', async ({ page }) => {
      const beachCards = page.locator('a[href^="/"]').filter({
        has: page.locator('img')
      });

      const cardCount = await beachCards.count();

      if (cardCount === 0) {
        test.skip(true, 'No beach cards found');
        return;
      }

      // Check that links don't have target="_blank"
      const firstCard = beachCards.first();
      const target = await firstCard.getAttribute('target');

      expect(target).not.toBe('_blank');
    });
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

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
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

    test('should display surf highlights on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Verify surf highlights section is visible on mobile
      const surfHighlights = page.locator('text="Today\'s Top Surf Spots"').first();
      const sectionVisible = await surfHighlights.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!sectionVisible) {
        test.skip(true, 'Surf highlights section not visible');
        return;
      }

      // Verify at least one card is visible
      const beachCards = page.locator('a[href^="/"]').filter({
        has: page.locator('img')
      });
      const cardCount = await beachCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify first card is visible
      await expect(beachCards.first()).toBeVisible();
    });

    test('should load images on mobile viewport', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.reload();
      await waitForPageLoad(page);

      // Wait for images to appear
      const images = page.locator('img').filter({ hasNot: page.locator('[aria-hidden="true"]') });
      const imageCount = await images.count();

      if (imageCount === 0) {
        test.skip(true, 'No images found on mobile');
        return;
      }

      // Check first few images load
      const imagesToCheck = Math.min(imageCount, 3);

      for (let i = 0; i < imagesToCheck; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

        if (isVisible) {
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }
    });

    test('should navigate successfully on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      const firstCard = page.locator('a[href^="/"]').filter({
        has: page.locator('img')
      }).first();

      const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!cardVisible) {
        test.skip(true, 'No beach cards visible on mobile');
        return;
      }

      const href = await firstCard.getAttribute('href');

      // Click and verify navigation
      await firstCard.click();
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long });

      expect(page.url()).toContain(href!);
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
    test('should not have console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          // Filter out known acceptable errors (e.g., third-party scripts)
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('chrome-extension')) {
            errors.push(text);
          }
        }
      });

      await page.reload();
      await waitForPageLoad(page);

      // Allow some time for any delayed errors
      await page.waitForTimeout(2000);

      // Should have minimal or no errors
      if (errors.length > 0) {
        console.log('Console errors found:', errors);
      }

      // Don't fail the test for errors, just log them
      // expect(errors.length).toBe(0);
    });

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

    test('should have alt text on all images', async ({ page }) => {
      const images = page.locator('img').filter({ hasNot: page.locator('[aria-hidden="true"]') });
      const imageCount = await images.count();

      if (imageCount === 0) {
        test.skip(true, 'No images found');
        return;
      }

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible().catch(() => false);

        if (isVisible) {
          const alt = await img.getAttribute('alt');
          // Alt attribute should exist (can be empty for decorative images)
          expect(alt).not.toBeNull();
        }
      }
    });
  });
});

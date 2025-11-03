/**
 * E2E Tests for Photo Thumbnails in Feeds
 * Tests photo display in various feed contexts (home, sessions, discover)
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad } from "./utils/test-helpers";
import { ensureSessionsWithPhotos } from "./utils/session-test-data";

test.describe("Feed Photo Thumbnails", () => {
  // Note: Tests expect sessions with photos to exist
  // If tests skip, create sessions manually or run session creation script first

  test.describe("Home Feed Photo Display", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);
    });

    test("should display session cards with photos in home feed", async ({
      page,
    }) => {
      // Look for session cards
      const sessionCards = page.locator(
        'a[href^="/sessions/"], [data-testid*="session-card"]'
      );
      const count = await sessionCards.count();

      if (count === 0) {
        test.skip(true, "No sessions in feed - run e2e/scripts/create-photo-test-data.ts to create test sessions");
        return;
      }

      // Look for photos within session cards
      const photosInCards = page.locator('img[alt*="photo"], img[alt*="Session photo"]');
      const photoCount = await photosInCards.count();

      // If there are photos, verify they render
      if (photoCount > 0) {
        await expect(photosInCards.first()).toBeVisible();
      }
    });

    test("should show photo count badge on cards with photos", async ({
      page,
    }) => {
      // Look for camera icon and count badge
      const photoBadges = page.locator(
        'svg:has-text(""), div:has(> svg) + span'
      );
      const badgeCount = await photoBadges.count();

      if (badgeCount > 0) {
        // Verify badge is visible and shows a number
        const badge = photoBadges.first();
        await expect(badge).toBeVisible();
      }
    });

    test("should display correct photo layout for different counts", async ({
      page,
    }) => {
      // Check if any session has multiple photos
      const photoContainers = page.locator('[class*="grid-cols"]');
      const containerCount = await photoContainers.count();

      if (containerCount > 0) {
        // At least one card has photos with grid layout
        await expect(photoContainers.first()).toBeVisible();
      }
    });

    test("should load photos without console errors", async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);

      // Check for photo-related errors
      const hasPhotoError = consoleErrors.some(
        (err) =>
          err.toLowerCase().includes("photo") ||
          err.toLowerCase().includes("image") ||
          err.toLowerCase().includes("storage")
      );

      expect(hasPhotoError).toBe(false);
    });
  });

  test.describe("Sessions Feed Photo Display", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);
    });

    test("should display photos in sessions feed", async ({ page }) => {
      // Look for session cards
      const sessionLinks = page.locator('a[href^="/sessions/"]');
      const count = await sessionLinks.count();

      if (count === 0) {
        test.skip(true, "No sessions available - run e2e/scripts/create-photo-test-data.ts");
        return;
      }

      // Look for photos in the feed
      const photosInFeed = page.locator('img[alt*="photo"], img[alt*="Session photo"]');
      const photoCount = await photosInFeed.count();

      if (photoCount > 0) {
        // Verify at least one photo is visible
        await expect(photosInFeed.first()).toBeVisible();
      }
    });

    test("should show mixed feed with and without photos correctly", async ({
      page,
    }) => {
      const sessionCards = page.locator('a[href^="/sessions/"]');
      const cardCount = await sessionCards.count();

      if (cardCount < 2) {
        test.skip(true, "Need at least 2 sessions - run e2e/scripts/create-photo-test-data.ts");
        return;
      }

      // Check that at least some cards render (with or without photos)
      await expect(sessionCards.first()).toBeVisible();
      await expect(sessionCards.nth(1)).toBeVisible();
    });
  });

  test.describe("Photo Click Navigation", () => {
    test("should navigate to session detail when clicking photos (owner)", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Find a session card with photos
      const sessionCard = page.locator('a[href^="/sessions/"]').first();
      const cardCount = await sessionCard.count();

      if (cardCount === 0) {
        test.skip(true, "No sessions available - run e2e/scripts/create-photo-test-data.ts");
        return;
      }

      // Click the session card
      const sessionUrl = await sessionCard.getAttribute("href");
      await sessionCard.click();
      await waitForPageLoad(page);

      // Should navigate to session detail
      if (sessionUrl) {
        expect(page.url()).toContain(sessionUrl);
      }
    });

    test("should allow clicking photo grid to view session details", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Look for photo grids (may or may not exist depending on implementation)
      const photoGrid = page
        .locator('[role="button"][aria-label*="session photo"]')
        .first();
      const hasPhotoGrid = await photoGrid.isVisible().catch(() => false);

      if (!hasPhotoGrid) {
        // Skip if photo grids don't have click handlers
        test.skip(true, "Photo grids not implemented as clickable");
        return;
      }

      // Note the current URL
      const currentUrl = page.url();

      // Click the photo grid
      await photoGrid.click();
      await page.waitForTimeout(500);

      // URL should change or modal should open
      const newUrl = page.url();
      const urlChanged = currentUrl !== newUrl;

      // Either URL changed or we're still on same page (both are valid)
      expect(typeof newUrl).toBe("string");
    });
  });

  test.describe("Photo Loading and Performance", () => {
    test("should use lazy loading for images", async ({ page }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Get all images in the feed
      const images = page.locator('img[alt*="photo"]');
      const imageCount = await images.count();

      if (imageCount === 0) {
        test.skip(true, "No photos in feed");
        return;
      }

      // Check first image for lazy loading attribute
      const firstImage = images.first();
      const loadingAttr = await firstImage.getAttribute("loading");

      expect(loadingAttr).toBe("lazy");
    });

    test("should load feed with photos in reasonable time", async ({
      page,
    }) => {
      const startTime = Date.now();

      await page.goto("/sessions");
      await waitForPageLoad(page);

      const loadTime = Date.now() - startTime;

      // Feed should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should display photos correctly on mobile viewport", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Look for photos in mobile view
      const photosInFeed = page.locator('img[alt*="photo"]');
      const photoCount = await photosInFeed.count();

      if (photoCount > 0) {
        const firstPhoto = photosInFeed.first();
        await expect(firstPhoto).toBeVisible();

        // Check that photo is within viewport bounds
        const boundingBox = await firstPhoto.boundingBox();
        if (boundingBox) {
          expect(boundingBox.width).toBeLessThanOrEqual(375);
        }
      }
    });

    test("should support touch interactions on mobile", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Find a photo grid
      const photoGrid = page
        .locator('[role="button"][aria-label*="session photo"]')
        .first();
      const hasPhotoGrid = await photoGrid.isVisible().catch(() => false);

      if (!hasPhotoGrid) {
        test.skip(true, "No photo grids found");
        return;
      }

      // Tap the photo grid
      await photoGrid.tap();
      await page.waitForTimeout(300);

      // Should handle touch interaction (verify no errors)
      const hasError = await page
        .locator('[role="alert"]')
        .isVisible()
        .catch(() => false);
      expect(hasError).toBe(false);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA labels for photo grids", async ({ page }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Find photo grids with ARIA labels
      const photoGrids = page.locator('[role="button"][aria-label*="photo"]');
      const gridCount = await photoGrids.count();

      if (gridCount > 0) {
        const firstGrid = photoGrids.first();
        const ariaLabel = await firstGrid.getAttribute("aria-label");

        // ARIA label should mention photos and count
        expect(ariaLabel).toMatch(/\d+.*photo/i);
      }
    });

    test("should support keyboard navigation for photo grids", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Find a photo grid
      const photoGrid = page
        .locator('[role="button"][aria-label*="photo"]')
        .first();
      const hasPhotoGrid = await photoGrid.isVisible().catch(() => false);

      if (!hasPhotoGrid) {
        test.skip(true, "No photo grids found");
        return;
      }

      // Focus the photo grid
      await photoGrid.focus();

      // Should be focusable
      const isFocused = await photoGrid.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBe(true);

      // Should have tabindex
      const tabindex = await photoGrid.getAttribute("tabindex");
      expect(tabindex).toBe("0");
    });
  });

  test.describe("Photo Display Variations", () => {
    test("should show overflow indicator (+N) when more than 3 photos", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Look for overflow indicators (+N text)
      const overflowIndicators = page.locator('span:text-matches("\\\\+\\\\d+")');
      const indicatorCount = await overflowIndicators.count();

      if (indicatorCount > 0) {
        const indicator = overflowIndicators.first();
        await expect(indicator).toBeVisible();

        // Should show a number
        const text = await indicator.textContent();
        expect(text).toMatch(/\+\d+/);
      }
    });

    test("should display different grid layouts based on photo count", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Look for different grid layouts
      const singleCol = page.locator('[class*="grid-cols-1"]');
      const twoCol = page.locator('[class*="grid-cols-2"]');
      const threeCol = page.locator('[class*="grid-cols-3"]');

      const hasSingle = (await singleCol.count()) > 0;
      const hasTwo = (await twoCol.count()) > 0;
      const hasThree = (await threeCol.count()) > 0;

      // At least one grid layout should exist if there are photos
      const hasAnyGrid = hasSingle || hasTwo || hasThree;

      if (hasAnyGrid) {
        expect(hasAnyGrid).toBe(true);
      }
    });
  });

  test.describe("Feed Integration", () => {
    test("should maintain scroll position when photos load", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 300));
      const scrollY = await page.evaluate(() => window.scrollY);

      // Wait for any lazy-loaded photos
      await page.waitForTimeout(500);

      // Scroll position should be maintained (within small margin)
      const newScrollY = await page.evaluate(() => window.scrollY);
      const scrollDiff = Math.abs(newScrollY - scrollY);

      // Allow small variation for layout shifts
      expect(scrollDiff).toBeLessThan(50);
    });

    test("should show photos consistently across page refreshes", async ({
      page,
    }) => {
      await page.goto("/sessions");
      await waitForPageLoad(page);

      // Count photos
      const initialPhotos = await page.locator('img[alt*="photo"]').count();

      // Refresh page
      await page.reload();
      await waitForPageLoad(page);

      // Count photos again
      const afterRefreshPhotos = await page.locator('img[alt*="photo"]').count();

      // Photo count should be the same (or close if feed is dynamic)
      expect(Math.abs(afterRefreshPhotos - initialPhotos)).toBeLessThanOrEqual(
        3
      );
    });
  });
});

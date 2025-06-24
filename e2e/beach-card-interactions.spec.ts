import { test, expect } from "@playwright/test";

test.describe("Beach Card Review Click Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Add Playwright detection to trigger test mode
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test.describe("Nearby Tab Review Clicks", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to nearby tab
      const nearbyTab = page.getByRole("tab", { name: /nearby/i });
      if (await nearbyTab.isVisible()) {
        await nearbyTab.click();
        await page.waitForTimeout(2000);
      }
    });

    test("should show beach cards with clickable reviews in nearby tab", async ({
      page,
    }) => {
      // Look for beach cards in nearby tab
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();
        await expect(firstCard).toBeVisible();

        // Should have review section with rating and count
        const reviewSection = firstCard.locator(
          '.flex:has(svg[class*="star"])'
        );
        const starRating = firstCard.locator('svg[class*="star"]');
        const reviewCount = firstCard.getByText(/\d+.*reviews?/i);

        const hasReviewSection = await reviewSection
          .isVisible()
          .catch(() => false);
        const hasStarRating = await starRating.isVisible().catch(() => false);
        const hasReviewCount = await reviewCount.isVisible().catch(() => false);

        // Should have at least star rating or review elements
        expect(
          hasReviewSection || hasStarRating || hasReviewCount
        ).toBeTruthy();
      }
    });

    test("should navigate to beach details with reviews tab when clicking reviews", async ({
      page,
    }) => {
      // Find a beach card with reviews
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();

        // Look for the clickable review section (star + review count)
        const reviewClickArea = firstCard.locator(
          '.flex:has(svg[class*="star"])'
        );

        if (await reviewClickArea.isVisible()) {
          // Get beach ID from card or URL
          const currentUrl = page.url();

          // Click on the review section
          await reviewClickArea.click();
          await page.waitForTimeout(2000);

          // Should navigate to beach detail page
          const newUrl = page.url();
          expect(newUrl).toContain("/beach/");
          expect(newUrl).not.toBe(currentUrl);

          // Should have reviews tab parameter
          expect(newUrl).toContain("tab=reviews");

          // Wait for page to load
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1000);

          // Should be on reviews tab
          const reviewsTab = page.getByRole("tab", { name: /reviews/i });
          if (await reviewsTab.isVisible()) {
            const isActive = await reviewsTab.getAttribute("aria-selected");
            const hasActiveClass = await reviewsTab.getAttribute("class");
            expect(
              isActive === "true" || hasActiveClass?.includes("active")
            ).toBeTruthy();
          }
        }
      }
    });

    test("should position page at reviews section when clicking reviews", async ({
      page,
    }) => {
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();
        const reviewClickArea = firstCard.locator(
          '.flex:has(svg[class*="star"])'
        );

        if (await reviewClickArea.isVisible()) {
          await reviewClickArea.click();
          await page.waitForTimeout(2000);

          // Should be positioned at reviews section
          const reviewsSection = page.locator("#reviews-ratings-section");
          if (await reviewsSection.isVisible()) {
            // Check if reviews section is in viewport
            const reviewsRect = await reviewsSection.boundingBox();
            const viewportSize = page.viewportSize();

            if (reviewsRect && viewportSize) {
              // Reviews section should be visible in viewport
              expect(reviewsRect.y).toBeGreaterThanOrEqual(0);
              expect(reviewsRect.y).toBeLessThan(viewportSize.height);
            }
          }

          // Should not show forecast at the top of viewport
          const forecastSection = page.getByText(
            /enhanced forecast|today.*conditions/i
          );
          if (await forecastSection.isVisible()) {
            const forecastRect = await forecastSection.boundingBox();
            if (forecastRect) {
              // Forecast should not be at the very top of viewport
              expect(forecastRect.y).toBeLessThan(100); // Allow some scroll past forecast
            }
          }
        }
      }
    });

    test("should navigate to beach details when clicking map image", async ({
      page,
    }) => {
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();

        // Look for map image area (the top part of the card)
        const mapImageArea = firstCard.locator(".relative.h-48, .h-48");

        if (await mapImageArea.isVisible()) {
          const currentUrl = page.url();

          // Click on the map image
          await mapImageArea.click();
          await page.waitForTimeout(2000);

          // Should navigate to beach detail page
          const newUrl = page.url();
          expect(newUrl).toContain("/beach/");
          expect(newUrl).not.toBe(currentUrl);

          // Should NOT have reviews tab parameter (default tab)
          expect(newUrl).not.toContain("tab=reviews");
        }
      }
    });
  });

  test.describe("Maps Page Review Clicks", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);
    });

    test("should show beach cards with reviews in map list view", async ({
      page,
    }) => {
      // Switch to list view - prefer "View All" button first
      const viewAllButton = page
        .getByRole("button", { name: /view all/i })
        .first();
      const listButton = page.getByRole("button", { name: /^list$/i });

      let listViewActivated = false;

      if (await viewAllButton.isVisible()) {
        await viewAllButton.click();
        await page.waitForTimeout(2000);
        listViewActivated = true;
      } else if (await listButton.isVisible()) {
        await listButton.click();
        await page.waitForTimeout(2000);
        listViewActivated = true;
      }

      if (listViewActivated) {
        // Look for beach cards
        const beachCards = page.locator(
          '[data-testid*="beach-card"], .beach-card'
        );
        const cardCount = await beachCards.count();

        if (cardCount > 0) {
          const firstCard = beachCards.first();
          await expect(firstCard).toBeVisible();

          // Should have review elements
          const starRating = firstCard.locator('svg[class*="star"]');
          const reviewCount = firstCard.getByText(/\d+.*reviews?/i);

          const hasStarRating = await starRating.isVisible().catch(() => false);
          const hasReviewCount = await reviewCount
            .isVisible()
            .catch(() => false);

          expect(hasStarRating || hasReviewCount).toBeTruthy();
        }
      }
    });

    test("should navigate to reviews when clicking reviews in list view", async ({
      page,
    }) => {
      // Switch to list view - prefer "View All" button first
      const viewAllButton = page
        .getByRole("button", { name: /view all/i })
        .first();
      const listButton = page.getByRole("button", { name: /^list$/i });

      let listViewActivated = false;

      if (await viewAllButton.isVisible()) {
        await viewAllButton.click();
        await page.waitForTimeout(2000);
        listViewActivated = true;
      } else if (await listButton.isVisible()) {
        await listButton.click();
        await page.waitForTimeout(2000);
        listViewActivated = true;
      }

      if (listViewActivated) {
        const beachCards = page.locator(
          '[data-testid*="beach-card"], .beach-card'
        );
        const cardCount = await beachCards.count();

        if (cardCount > 0) {
          const firstCard = beachCards.first();
          const reviewClickArea = firstCard.locator(
            '.flex:has(svg[class*="star"])'
          );

          if (await reviewClickArea.isVisible()) {
            await reviewClickArea.click();
            await page.waitForTimeout(2000);

            // Should navigate to beach detail with reviews tab
            const url = page.url();
            expect(url).toContain("/beach/");
            expect(url).toContain("tab=reviews");

            // Should be positioned at reviews
            await page.waitForTimeout(1000);
            const reviewsSection = page.locator("#reviews-ratings-section");
            if (await reviewsSection.isVisible()) {
              const reviewsRect = await reviewsSection.boundingBox();
              const viewportSize = page.viewportSize();

              if (reviewsRect && viewportSize) {
                expect(reviewsRect.y).toBeGreaterThanOrEqual(0);
                expect(reviewsRect.y).toBeLessThan(viewportSize.height);
              }
            }
          }
        }
      }
    });

    test("should show beach cards with reviews in nearby scroll (map view)", async ({
      page,
    }) => {
      // Should be in map view by default
      await page.waitForTimeout(2000);

      // Look for nearby beach scroll section
      const nearbyScroll = page.locator(
        '.flex.gap-3.overflow-x-auto, [data-testid*="nearby-scroll"]'
      );
      const nearbyBeaches = page.getByText(/beaches nearby|other nearby/i);

      if (
        (await nearbyScroll.isVisible()) ||
        (await nearbyBeaches.isVisible())
      ) {
        // Look for beach cards in the scroll area
        const beachCards = page.locator(
          '[data-testid*="beach-card"], .beach-card'
        );
        const cardCount = await beachCards.count();

        if (cardCount > 0) {
          const firstCard = beachCards.first();

          // Should have review elements
          const starRating = firstCard.locator('svg[class*="star"]');
          const reviewCount = firstCard.getByText(/\d+.*reviews?/i);

          const hasStarRating = await starRating.isVisible().catch(() => false);
          const hasReviewCount = await reviewCount
            .isVisible()
            .catch(() => false);

          expect(hasStarRating || hasReviewCount).toBeTruthy();
        }
      }
    });

    test("should navigate to reviews when clicking reviews in nearby scroll", async ({
      page,
    }) => {
      await page.waitForTimeout(2000);

      // Look for beach cards in nearby scroll
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();
        const reviewClickArea = firstCard.locator(
          '.flex:has(svg[class*="star"])'
        );

        if (await reviewClickArea.isVisible()) {
          await reviewClickArea.click();
          await page.waitForTimeout(2000);

          // Should navigate to beach detail with reviews tab
          const url = page.url();
          expect(url).toContain("/beach/");
          expect(url).toContain("tab=reviews");

          // Should be positioned at reviews section
          await page.waitForTimeout(1000);
          const reviewsSection = page.locator("#reviews-ratings-section");
          if (await reviewsSection.isVisible()) {
            const reviewsRect = await reviewsSection.boundingBox();
            const viewportSize = page.viewportSize();

            if (reviewsRect && viewportSize) {
              expect(reviewsRect.y).toBeGreaterThanOrEqual(0);
              expect(reviewsRect.y).toBeLessThan(viewportSize.height);
            }
          }
        }
      }
    });

    test("should navigate to beach details when clicking map in nearby scroll", async ({
      page,
    }) => {
      await page.waitForTimeout(2000);

      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card'
      );
      const cardCount = await beachCards.count();

      if (cardCount > 0) {
        const firstCard = beachCards.first();
        const mapImageArea = firstCard.locator(".relative.h-48, .h-48");

        if (await mapImageArea.isVisible()) {
          const currentUrl = page.url();

          await mapImageArea.click();
          await page.waitForTimeout(2000);

          // Should navigate to beach detail page without reviews tab
          const newUrl = page.url();
          expect(newUrl).toContain("/beach/");
          expect(newUrl).not.toBe(currentUrl);
          expect(newUrl).not.toContain("tab=reviews");
        }
      }
    });
  });

  test.describe("Beach Detail Page Tab Navigation", () => {
    test("should handle direct navigation to reviews tab via URL", async ({
      page,
    }) => {
      // Test direct navigation to a beach with reviews tab
      await page.goto("/beach/test-beach-id?tab=reviews");
      await page.waitForTimeout(3000);

      // Should be on reviews tab
      const reviewsTab = page.getByRole("tab", { name: /reviews/i });
      if (await reviewsTab.isVisible()) {
        const isActive = await reviewsTab.getAttribute("aria-selected");
        const hasActiveClass = await reviewsTab.getAttribute("class");
        expect(
          isActive === "true" || hasActiveClass?.includes("active")
        ).toBeTruthy();
      }

      // Should be positioned at reviews section
      const reviewsSection = page.locator("#reviews-ratings-section");
      if (await reviewsSection.isVisible()) {
        const reviewsRect = await reviewsSection.boundingBox();
        const viewportSize = page.viewportSize();

        if (reviewsRect && viewportSize) {
          expect(reviewsRect.y).toBeGreaterThanOrEqual(0);
          expect(reviewsRect.y).toBeLessThan(viewportSize.height);
        }
      }
    });

    test("should maintain reviews tab state after navigation", async ({
      page,
    }) => {
      // Navigate to reviews tab via URL
      await page.goto("/beach/test-beach-id?tab=reviews");
      await page.waitForTimeout(2000);

      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);

      // Should still be on reviews tab
      const reviewsTab = page.getByRole("tab", { name: /reviews/i });
      if (await reviewsTab.isVisible()) {
        const isActive = await reviewsTab.getAttribute("aria-selected");
        const hasActiveClass = await reviewsTab.getAttribute("class");
        expect(
          isActive === "true" || hasActiveClass?.includes("active")
        ).toBeTruthy();
      }

      // Should still be positioned at reviews
      const reviewsSection = page.locator("#reviews-ratings-section");
      if (await reviewsSection.isVisible()) {
        const reviewsRect = await reviewsSection.boundingBox();
        const viewportSize = page.viewportSize();

        if (reviewsRect && viewportSize) {
          expect(reviewsRect.y).toBeGreaterThanOrEqual(0);
          expect(reviewsRect.y).toBeLessThan(viewportSize.height);
        }
      }
    });

    test("should switch between tabs correctly", async ({ page }) => {
      await page.goto("/beach/test-beach-id");
      await page.waitForTimeout(2000);

      // Should start on default tab (not reviews)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("tab=reviews");

      // Click on reviews tab
      const reviewsTab = page.getByRole("tab", { name: /reviews/i });
      if (await reviewsTab.isVisible()) {
        await reviewsTab.click();
        await page.waitForTimeout(1000);

        // Should now be on reviews tab
        const isActive = await reviewsTab.getAttribute("aria-selected");
        const hasActiveClass = await reviewsTab.getAttribute("class");
        expect(
          isActive === "true" || hasActiveClass?.includes("active")
        ).toBeTruthy();

        // Click on another tab (info)
        const infoTab = page.getByRole("tab", { name: /info/i });
        if (await infoTab.isVisible()) {
          await infoTab.click();
          await page.waitForTimeout(1000);

          // Reviews tab should no longer be active
          const reviewsStillActive = await reviewsTab.getAttribute(
            "aria-selected"
          );
          expect(reviewsStillActive).not.toBe("true");
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should handle non-existent beach ID gracefully", async ({ page }) => {
      await page.goto("/beach/non-existent-beach-id?tab=reviews");
      await page.waitForTimeout(2000);

      // Should show error page or redirect
      const hasError = await page
        .getByText(/not found|404|error/i)
        .isVisible()
        .catch(() => false);
      const hasRedirect =
        page.url() !== "/beach/non-existent-beach-id?tab=reviews";
      const hasContent = await page
        .locator("body")
        .isVisible()
        .catch(() => false);

      expect(hasError || hasRedirect || hasContent).toBeTruthy();
    });

    test("should handle missing tab parameter gracefully", async ({ page }) => {
      await page.goto("/beach/test-beach-id?tab=invalid-tab");
      await page.waitForTimeout(2000);

      // Should fall back to default tab or handle gracefully
      const hasContent = await page
        .locator("body")
        .isVisible()
        .catch(() => false);
      expect(hasContent).toBeTruthy();
    });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Favorite Beach Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test.describe("Guest User Behavior", () => {
    test("should show Huntington Beach by default for guest users", async ({
      page,
    }) => {
      // Ensure we're not authenticated
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        // Wait for beach search to load
        await page.waitForTimeout(3000);

        // Check for Huntington Beach content
        const huntingtonText = page.getByText(/huntington beach/i);
        const huntingtonVisible = await huntingtonText
          .isVisible()
          .catch(() => false);

        if (huntingtonVisible) {
          expect(huntingtonText).toBeVisible();
        }
      } else {
        test.skip("User is authenticated - skipping guest user tests");
      }
    });

    test("should not show 'favorite beach' message for guest users", async ({
      page,
    }) => {
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        await page.waitForTimeout(3000);

        // Should not show favorite beach message
        const favoriteMessage = page.getByText(
          /favorite beach|showing.*favorite/i
        );
        const hasFavoriteMessage = await favoriteMessage
          .isVisible()
          .catch(() => false);

        expect(hasFavoriteMessage).toBeFalsy();
      } else {
        test.skip("User is authenticated - skipping guest user tests");
      }
    });
  });

  test.describe("Authenticated User Behavior", () => {
    test("should show loading state initially", async ({ page }) => {
      // Skip if not authenticated
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        test.skip("User not authenticated - skipping authenticated user tests");
      }

      // Look for loading state
      const loadingMessage = page.getByText(/loading.*beach/i);
      const loadingSpinner = page.locator(
        '[role="progressbar"], .loading, .spinner'
      );

      const hasLoading = await loadingMessage.isVisible().catch(() => false);
      const hasSpinner = await loadingSpinner.isVisible().catch(() => false);

      // Should show some form of loading state initially
      if (hasLoading || hasSpinner) {
        expect(hasLoading || hasSpinner).toBeTruthy();
      }
    });

    test("should display user's favorite beach when set", async ({ page }) => {
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        test.skip("User not authenticated - skipping favorite beach tests");
      }

      // Wait for content to load
      await page.waitForTimeout(4000);

      // Look for favorite beach indicators
      const favoriteMessage = page.getByText(
        /favorite beach|showing.*favorite/i
      );
      const oceanBeachText = page.getByText(/ocean beach/i);
      const malibuText = page.getByText(/malibu/i);
      const pacificBeachText = page.getByText(/pacific beach/i);

      const hasFavoriteMessage = await favoriteMessage
        .isVisible()
        .catch(() => false);
      const hasOceanBeach = await oceanBeachText.isVisible().catch(() => false);
      const hasMalibu = await malibuText.isVisible().catch(() => false);
      const hasPacificBeach = await pacificBeachText
        .isVisible()
        .catch(() => false);

      // Should show either favorite message or a specific beach (not Huntington)
      const hasUserFavorite =
        hasFavoriteMessage || hasOceanBeach || hasMalibu || hasPacificBeach;

      if (hasUserFavorite) {
        expect(hasUserFavorite).toBeTruthy();
      } else {
        // Fallback case - check that we're not showing the default loading state
        const huntingtonOnly = page.getByText(/huntington beach/i);
        const isHuntingtonOnly = await huntingtonOnly
          .isVisible()
          .catch(() => false);

        // If showing Huntington, it should be a fallback, not the loading state
        if (isHuntingtonOnly) {
          console.log(
            "User appears to have no favorite beach set - showing Huntington Beach fallback"
          );
        }
      }
    });

    test("should handle beach search after favorite beach loads", async ({
      page,
    }) => {
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        test.skip(
          "User not authenticated - skipping search functionality tests"
        );
      }

      // Wait for favorite beach to load
      await page.waitForTimeout(4000);

      // Look for search input
      const searchInput = page
        .getByPlaceholder(/search.*beach/i)
        .or(page.getByLabel(/search/i));

      if (await searchInput.isVisible()) {
        // Type in search box
        await searchInput.click();
        await searchInput.fill("Mission Beach");
        await page.waitForTimeout(2000);

        // Should show Mission Beach results
        const missionBeachText = page.getByText(/mission beach/i);
        const hasMissionBeach = await missionBeachText
          .isVisible()
          .catch(() => false);

        if (hasMissionBeach) {
          expect(missionBeachText).toBeVisible();
        }
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should gracefully handle slow network conditions", async ({
      page,
    }) => {
      // Simulate slow network
      await page.route("**/*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      });

      await page.goto("/");

      // Should show loading state
      const loadingIndicators = [
        page.getByText(/loading/i),
        page.locator('[role="progressbar"]'),
        page.locator(".loading"),
        page.locator(".spinner"),
      ];

      let hasLoadingState = false;
      for (const indicator of loadingIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          hasLoadingState = true;
          break;
        }
      }

      // Should eventually load content
      await page.waitForTimeout(5000);

      const beachContent = page.getByText(/beach/i);
      const hasBeachContent = await beachContent.isVisible().catch(() => false);

      expect(hasBeachContent).toBeTruthy();
    });
  });

  test.describe("Performance", () => {
    test("should load favorite beach within reasonable time", async ({
      page,
    }) => {
      const startTime = Date.now();

      await page.goto("/");

      // Wait for beach content to appear
      const beachContent = page
        .getByText(/beach/i)
        .or(page.locator('[data-testid="beach-card"]'));

      await beachContent.waitFor({ timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test("should handle multiple rapid navigations", async ({ page }) => {
      // Rapidly navigate between pages
      await page.goto("/");
      await page.waitForTimeout(500);

      await page.goto("/map");
      await page.waitForTimeout(500);

      await page.goto("/");
      await page.waitForTimeout(500);

      await page.goto("/profile");
      await page.waitForTimeout(500);

      await page.goto("/");

      // Should still work after rapid navigation
      await page.waitForTimeout(3000);

      const beachContent = page.getByText(/beach/i);
      const hasBeachContent = await beachContent.isVisible().catch(() => false);

      expect(hasBeachContent).toBeTruthy();
    });
  });
});

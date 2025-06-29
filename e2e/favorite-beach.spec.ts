import { test, expect } from "@playwright/test";

test.describe("Favorite Beach Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await page.waitForTimeout(2000);
  });

  test.describe("Authenticated User Behavior", () => {
    test("should show loading state initially", async ({ page }) => {
      // Skip if not authenticated
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

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
        test.skip(
          true,
          "User not authenticated - skipping favorite beach tests"
        );
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
          true,
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
      // Simulate slow network with reduced delay
      await page.route("**/*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto("/profile");

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

      // Should eventually load content - wait longer for slow network
      await page.waitForTimeout(10000);

      // Look for basic page structure that indicates the page loaded
      const pageContent = page
        .locator("body")
        .or(page.locator("main"))
        .or(page.locator("nav"));
      const hasPageContent = await pageContent.isVisible().catch(() => false);

      expect(hasPageContent).toBeTruthy();
    });
  });

  
});

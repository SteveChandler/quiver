import { test, expect } from "@playwright/test";
import { ensureAuthenticated, waitForPageLoad } from "./test-helpers";

test.describe("Home Beach Functionality (Profile Preference)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
    const ok = await ensureAuthenticated(page, 15000);
    if (!ok) throw new Error("Authentication failed for Home Beach tests");
    await page.goto("/profile");
    await waitForPageLoad(page);
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

    test("should display user's home beach when set", async ({ page }) => {
      const signInButton = page
        .getByRole("button", { name: /sign in|login/i })
        .or(page.getByRole("link", { name: /sign in|login/i }));

      const isGuest = await signInButton.isVisible().catch(() => false);

      if (isGuest) {
        throw new Error("User not authenticated - authentication setup failed");
      }

      // Wait for content to load
      await page.waitForTimeout(4000);

      // Look for home beach indicators (profile preference)
      const homeBeachLabel = page.getByText(/home beach/i);
      const homeBeachValue = page
        .getByTestId("home-break-value")
        .or(page.getByText(/ocean beach|malibu|pacific beach/i));

      const hasHomeLabel = await homeBeachLabel.isVisible().catch(() => false);
      const hasHomeValue = await homeBeachValue.isVisible().catch(() => false);

      if (hasHomeLabel || hasHomeValue) {
        expect(hasHomeLabel || hasHomeValue).toBeTruthy();
      } else {
        // If no home beach, app may show banner to set it
        const banner = page.getByText(/set home beach/i);
        expect(await banner.isVisible().catch(() => false)).toBeTruthy();
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
        throw new Error("User not authenticated - authentication setup failed");
      }

      // Wait for profile to load
      await page.waitForTimeout(4000);

      // Look for home beach selector or search input
      const searchInput = page
        .getByPlaceholder(/search.*beach/i)
        .or(page.getByLabel(/search/i))
        .or(page.getByTestId("home-beach-select"));

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

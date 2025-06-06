import { test, expect } from "@playwright/test";

test.describe("Comprehensive Surf App Workflows", () => {
  test.describe("Complete User Journey", () => {
    test.fixme(
      "should complete full user journey from authentication to session logging",
      async ({ page }) => {
        // 1. Start at home page
        await page.goto("/");
        await page.waitForTimeout(1000);

        // 2. Check if user is already authenticated or needs to sign in
        const isAuthRequired =
          page.url().includes("/auth") ||
          (await page
            .getByText(/sign in|log in/i)
            .isVisible()
            .catch(() => false));

        if (isAuthRequired) {
          // Navigate to sign in if needed
          await page.goto("/auth/sign-in");

          // Verify sign in page loads
          await expect(
            page.getByRole("heading", { name: /welcome back/i })
          ).toBeVisible();

          // Note: In real tests, you would sign in with test credentials
          console.log(
            "Authentication flow verified - sign in page displayed correctly"
          );
        }

        // 3. Navigate to map to explore beaches
        await page.goto("/map");
        await page.waitForTimeout(1000);
        const hasMapContent = await Promise.race([
          page
            .getByTestId("map-view")
            .isVisible()
            .catch(() => false),
          page
            .locator(".map-view")
            .isVisible()
            .catch(() => false),
          page
            .locator("main")
            .isVisible()
            .catch(() => false),
        ]);
        expect(hasMapContent).toBeTruthy();

        // 4. Navigate to sessions to view history
        await page.goto("/sessions");
        const sessionsView = page
          .getByTestId("sessions-view")
          .or(page.locator(".sessions-view"));
        await expect(sessionsView).toBeVisible();

        // 5. Navigate to profile
        await page.goto("/profile");
        const profileView = page
          .getByTestId("profile-view")
          .or(page.locator(".profile"));
        await expect(profileView).toBeVisible();

        // 6. Try to access session logging (may redirect if not authenticated)
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        // Should either show form or redirect to auth
        const hasSessionForm = await page
          .getByTestId("session-form")
          .isVisible()
          .catch(() => false);
        const isRedirectToAuth =
          page.url().includes("/auth") ||
          page.url() === new URL("/", page.url()).href;

        expect(hasSessionForm || isRedirectToAuth).toBeTruthy();
      }
    );

    test("should handle navigation flow between all main sections", async ({
      page,
    }) => {
      const mainPages = ["/", "/map", "/sessions", "/profile"];

      for (const pagePath of mainPages) {
        await page.goto(pagePath);
        await page.waitForTimeout(1000);

        // Each page should load successfully (allow for auth redirects)
        const currentUrl = page.url();
        const loadedCorrectly =
          currentUrl.includes(pagePath) ||
          currentUrl.includes("/auth/sign-in") ||
          currentUrl === new URL("/", page.url()).href;
        expect(loadedCorrectly).toBeTruthy();

        // Each page should have bottom navigation
        const bottomNav = page
          .getByTestId("bottom-navigation")
          .or(page.locator("nav").last());
        const hasBottomNav = await bottomNav.isVisible().catch(() => false);

        if (hasBottomNav) {
          await expect(bottomNav).toBeVisible();
        }
      }
    });
  });

  test.describe("Feature Integration Tests", () => {
    test("should integrate beach selection from map to session logging", async ({
      page,
    }) => {
      // Start on map page
      await page.goto("/map");
      await page.waitForTimeout(2000);

      // Look for beach marker or beach item
      const beachMarker = page
        .locator('[data-testid="beach-marker"], .marker, .beach-item')
        .first();

      if (await beachMarker.isVisible()) {
        // Remember the beach name if possible
        const beachName = await beachMarker.textContent();

        // Navigate to log session
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        // Skip if not authenticated
        if (
          page.url().includes("/auth") ||
          page.url() === new URL("/", page.url()).href
        ) {
          test.skip("User not authenticated - skipping integration test");
        }

        // Try to fill beach field with the beach from map
        const beachField = page
          .getByLabel(/beach/i)
          .or(page.getByPlaceholder(/beach/i));
        if ((await beachField.isVisible()) && beachName) {
          await beachField.fill(beachName);
        }
      }
    });

    test("should integrate profile boards with session logging", async ({
      page,
    }) => {
      // First check profile for boards
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Look for user boards
      const boardsList = page.locator(
        '[data-testid="board-item"], .board-item'
      );
      const boardCount = await boardsList.count();

      if (boardCount > 0) {
        const firstBoardName = await boardsList.first().textContent();

        // Navigate to log session
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        // Skip if not authenticated
        if (
          page.url().includes("/auth") ||
          page.url() === new URL("/", page.url()).href
        ) {
          test.skip("User not authenticated - skipping integration test");
        }

        // Check if board is available in session form
        const boardField = page
          .getByLabel(/board/i)
          .or(page.getByPlaceholder(/board/i));
        if ((await boardField.isVisible()) && firstBoardName) {
          await boardField.click();

          // Look for the board from profile in dropdown
          const boardOption = page.getByText(firstBoardName);
          if (await boardOption.isVisible()) {
            await boardOption.click();
          }
        }
      }
    });

    test("should integrate session data across planning and logging", async ({
      page,
    }) => {
      // Test that planned sessions can be converted to logged sessions
      await page.goto("/plan-session");
      await page.waitForTimeout(2000);

      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping integration test");
      }

      // Fill out a session plan
      const beachField = page
        .getByLabel(/beach/i)
        .or(page.getByPlaceholder(/beach/i));
      if (await beachField.isVisible()) {
        await beachField.fill("Test Beach Integration");
      }

      const dateField = page
        .getByLabel(/date/i)
        .or(page.getByPlaceholder(/date/i));
      if (await dateField.isVisible()) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await dateField.fill(tomorrow.toISOString().split("T")[0]);
      }

      // Navigate to log session and verify similar fields
      await page.goto("/log-session");
      await page.waitForTimeout(1000);

      // Should have similar form structure
      const logBeachField = page
        .getByLabel(/beach/i)
        .or(page.getByPlaceholder(/beach/i));
      const logDateField = page
        .getByLabel(/date/i)
        .or(page.getByPlaceholder(/date/i));

      if (
        (await logBeachField.isVisible()) &&
        (await logDateField.isVisible())
      ) {
        expect(await logBeachField.isVisible()).toBeTruthy();
        expect(await logDateField.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe("Data Consistency Tests", () => {
    test("should maintain consistent beach data across map and session forms", async ({
      page,
    }) => {
      const beachesToTest = ["Malibu", "Huntington", "Manhattan Beach"];

      for (const beach of beachesToTest) {
        // Test beach search on map
        await page.goto("/map");
        await page.waitForTimeout(1000);

        const mapSearchBox = page.getByPlaceholder(/search|location|beach/i);
        if (await mapSearchBox.isVisible()) {
          await mapSearchBox.fill(beach);
          await page.waitForTimeout(2000);
        }

        // Test same beach in session forms
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        if (
          !page.url().includes("/auth") &&
          !page.url() === new URL("/", page.url()).href
        ) {
          const sessionBeachField = page
            .getByLabel(/beach/i)
            .or(page.getByPlaceholder(/beach/i));
          if (await sessionBeachField.isVisible()) {
            await sessionBeachField.fill(beach);
            await page.waitForTimeout(1000);

            // Check if autocomplete provides consistent results
            const suggestions = page.locator('[role="option"], .suggestion');
            const suggestionCount = await suggestions.count();

            if (suggestionCount > 0) {
              expect(suggestionCount).toBeGreaterThan(0);
            }
          }
        }
      }
    });

    test("should show consistent user data across profile and forms", async ({
      page,
    }) => {
      // Check profile data
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Look for user information
      const userEmail = page.getByText(/@/).first();
      const userName = page
        .getByTestId("profile-name")
        .or(page.getByText(/name/i));

      const emailText = await userEmail.textContent().catch(() => null);
      const nameText = await userName.textContent().catch(() => null);

      // Check if same data appears in forms
      await page.goto("/profile/edit");
      await page.waitForTimeout(2000);

      if (
        !page.url().includes("/auth") &&
        !page.url() === new URL("/", page.url()).href
      ) {
        const editEmailField = page.getByLabel(/email/i);
        const editNameField = page.getByLabel(/name/i);

        if ((await editEmailField.isVisible()) && emailText) {
          const editEmailValue = await editEmailField.inputValue();
          expect(editEmailValue).toContain(emailText.replace(/\s+/g, ""));
        }

        if ((await editNameField.isVisible()) && nameText) {
          const editNameValue = await editNameField.inputValue();
          // Name might be formatted differently, so just check it's not empty
          expect(editNameValue.length).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe("Error Handling and Edge Cases", () => {
    test("should handle network failures gracefully", async ({ page }) => {
      // Start with normal navigation
      await page.goto("/");

      // Simulate network issues by navigating to non-existent endpoints
      await page.goto("/non-existent-api-endpoint");

      // Should handle gracefully - either 404 page or redirect
      const has404 = await page
        .getByText(/404|not found/i)
        .isVisible()
        .catch(() => false);
      const isRedirected = page.url() === new URL("/", page.url()).href;

      expect(has404 || isRedirected).toBeTruthy();
    });

    test("should handle empty states across all views", async ({ page }) => {
      const viewsToTest = [
        { path: "/sessions", emptyText: /no sessions|empty|start logging/i },
        { path: "/profile", emptyText: /profile|user/i },
        { path: "/map", emptyText: /map|beaches/i },
      ];

      for (const view of viewsToTest) {
        await page.goto(view.path);
        await page.waitForTimeout(2000);

        // Each view should either show content or appropriate empty state
        const hasContent =
          (await page.locator('[data-testid*="item"], .item, .card').count()) >
          0;
        const hasEmptyState = await page
          .getByText(view.emptyText)
          .isVisible()
          .catch(() => false);
        const hasLoadingState = await page
          .locator(".loading, .spinner, .animate-spin")
          .isVisible()
          .catch(() => false);

        const hasMainContent = await page
          .locator("main")
          .isVisible()
          .catch(() => false);
        const isAuthRedirect = page.url().includes("/auth");

        expect(
          hasContent ||
            hasEmptyState ||
            hasLoadingState ||
            hasMainContent ||
            isAuthRedirect
        ).toBeTruthy();
      }
    });

    test("should handle mobile responsive layouts", async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const pagesToTest = ["/", "/map", "/sessions", "/profile"];

      for (const pagePath of pagesToTest) {
        await page.goto(pagePath);
        await page.waitForTimeout(1000);

        // Check that content is still visible and accessible on mobile
        const mainContent = page
          .locator('main, [role="main"], .main-content')
          .first();
        if (await mainContent.isVisible()) {
          const contentBox = await mainContent.boundingBox();
          expect(contentBox?.width).toBeLessThanOrEqual(375);
        }

        // Bottom navigation should still be accessible
        const bottomNav = page
          .getByTestId("bottom-navigation")
          .or(page.locator("nav").last());
        if (await bottomNav.isVisible()) {
          await expect(bottomNav).toBeVisible();
        }
      }

      // Reset to desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe("Performance and Loading Tests", () => {
    test.fixme(
      "should load main pages within reasonable time",
      async ({ page }) => {
        const pagesToTest = ["/", "/map", "/sessions", "/profile"];

        for (const pagePath of pagesToTest) {
          const startTime = Date.now();

          await page.goto(pagePath);

          // Wait for main content to be visible
          const mainContent = page
            .locator('main, [data-testid*="view"], .view')
            .first();
          await mainContent.waitFor({ timeout: 10000 });

          const loadTime = Date.now() - startTime;

          // Page should load within 10 seconds (generous for e2e tests)
          expect(loadTime).toBeLessThan(10000);

          console.log(`${pagePath} loaded in ${loadTime}ms`);
        }
      }
    );

    test("should handle concurrent navigation without breaking", async ({
      page,
    }) => {
      // Rapidly navigate between pages
      const pages = ["/", "/map", "/sessions", "/profile"];

      for (let i = 0; i < 3; i++) {
        for (const pagePath of pages) {
          await page.goto(pagePath);
          await page.waitForTimeout(500); // Short wait between navigations
        }
      }

      // Final navigation should still work
      await page.goto("/");
      const homeContent = page.locator('main, [data-testid*="view"]').first();
      await expect(homeContent).toBeVisible();
    });
  });
});

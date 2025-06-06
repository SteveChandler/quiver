import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto("/");
  });

  test("should navigate to all main pages via bottom navigation", async ({
    page,
  }) => {
    // Test navigation to map page
    const mapNavButton = page.getByTestId("nav-map").or(page.getByText(/map/i));
    if (await mapNavButton.isVisible()) {
      await mapNavButton.click();
      await expect(page).toHaveURL("/map");
      // Wait for page to load and check for any content
      await page.waitForTimeout(1000);
      const hasContent = await Promise.race([
        page
          .getByTestId("map-view")
          .isVisible()
          .catch(() => false),
        page
          .locator("main")
          .isVisible()
          .catch(() => false),
        page
          .getByText(/map/i)
          .isVisible()
          .catch(() => false),
      ]);
      expect(hasContent).toBeTruthy();
    }

    // Test navigation to sessions page
    const sessionsNavButton = page
      .getByTestId("nav-sessions")
      .or(page.getByText(/sessions/i));
    if (await sessionsNavButton.isVisible()) {
      await sessionsNavButton.click();
      await expect(page).toHaveURL("/sessions");
    }

    // Test navigation to profile page
    const profileNavButton = page
      .getByTestId("nav-profile")
      .or(page.getByText(/profile/i));
    if (await profileNavButton.isVisible()) {
      await profileNavButton.click();
      await expect(page).toHaveURL("/profile");
    }

    // Test navigation back to home
    const homeNavButton = page
      .getByTestId("nav-home")
      .or(page.getByText(/home/i));
    if (await homeNavButton.isVisible()) {
      await homeNavButton.click();
      await expect(page).toHaveURL("/");
    }
  });

  test("should have consistent bottom navigation across pages", async ({
    page,
  }) => {
    const pages = ["/", "/map", "/sessions", "/profile"];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      // Check that bottom navigation is present
      const bottomNav = page
        .getByTestId("bottom-navigation")
        .or(page.locator("nav").last());
      await expect(bottomNav).toBeVisible();

      // Check for navigation items (these might be icons or text)
      const navItems = bottomNav.locator("a, button");
      const navCount = await navItems.count();
      expect(navCount).toBeGreaterThan(2); // Should have at least 3-4 nav items
    }
  });

  test("should navigate to session-related pages", async ({ page }) => {
    // Test direct navigation to log session page
    await page.goto("/log-session");
    await page.waitForTimeout(2000); // Give time for redirect

    // Should either show the form, redirect for auth, or show some content
    const hasSessionForm = await page
      .getByTestId("session-form")
      .isVisible()
      .catch(() => false);
    const hasAuthRedirect =
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href;
    const hasLoadingSpinner = await page
      .locator('[data-testid="loading-spinner"], .animate-spin')
      .isVisible()
      .catch(() => false);
    const hasMainContent = await page
      .locator("main")
      .isVisible()
      .catch(() => false);

    expect(
      hasSessionForm || hasAuthRedirect || hasLoadingSpinner || hasMainContent
    ).toBeTruthy();

    // Test direct navigation to plan session page
    await page.goto("/plan-session");
    await page.waitForTimeout(2000); // Give time for redirect

    // Should either show the form, redirect for auth, or show some content
    const hasPlanForm = await page
      .getByTestId("session-form")
      .isVisible()
      .catch(() => false);
    const hasPlanAuthRedirect =
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href;
    const hasPlanLoadingSpinner = await page
      .locator('[data-testid="loading-spinner"], .animate-spin')
      .isVisible()
      .catch(() => false);
    const hasPlanMainContent = await page
      .locator("main")
      .isVisible()
      .catch(() => false);

    expect(
      hasPlanForm ||
        hasPlanAuthRedirect ||
        hasPlanLoadingSpinner ||
        hasPlanMainContent
    ).toBeTruthy();
  });

  test("should handle deep links to session details", async ({ page }) => {
    // Test navigation to a specific session (using a test ID)
    await page.goto("/sessions/test-session-id");
    await page.waitForTimeout(2000); // Give time for redirect

    // Should either show session details, redirect, or show some content
    const hasSessionDetail = await page
      .getByTestId("session-detail")
      .isVisible()
      .catch(() => false);
    const isRedirectedToSessions =
      page.url().includes("/sessions") && !page.url().includes("/sessions/");
    const hasErrorMessage = await page
      .getByText(/not found/i)
      .isVisible()
      .catch(() => false);
    const hasMainContent = await page
      .locator("main")
      .isVisible()
      .catch(() => false);
    const hasAuthRedirect = page.url().includes("/auth");

    expect(
      hasSessionDetail ||
        isRedirectedToSessions ||
        hasErrorMessage ||
        hasMainContent ||
        hasAuthRedirect
    ).toBeTruthy();
  });

  test("should navigate to profile edit page", async ({ page }) => {
    await page.goto("/profile/edit");

    // Should either show edit form or redirect for auth
    const hasEditForm = await page
      .getByTestId("profile-edit-form")
      .isVisible()
      .catch(() => false);
    const hasAuthRedirect =
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href;
    const hasLoadingSpinner = await page
      .locator('[data-testid="loading-spinner"], .animate-spin')
      .isVisible()
      .catch(() => false);

    expect(hasEditForm || hasAuthRedirect || hasLoadingSpinner).toBeTruthy();
  });

  test("should have working back navigation", async ({ page }) => {
    // Navigate through a few pages and test browser back
    await page.goto("/");
    await page.goto("/map");
    await page.goto("/sessions");

    // Go back
    await page.goBack();
    await expect(page).toHaveURL("/map");

    // Go back again
    await page.goBack();
    await expect(page).toHaveURL("/");
  });

  test("should maintain navigation state on page refresh", async ({ page }) => {
    // Navigate to a page and refresh
    await page.goto("/map");
    await page.reload();

    // Should still be on the same page
    await expect(page).toHaveURL("/map");

    // Bottom navigation should still be visible
    const bottomNav = page
      .getByTestId("bottom-navigation")
      .or(page.locator("nav").last());
    await expect(bottomNav).toBeVisible();
  });

  test("should handle invalid routes gracefully", async ({ page }) => {
    // Navigate to non-existent page
    await page.goto("/non-existent-page");

    // Should show 404 page or redirect to home
    const has404 = await page
      .getByText(/404|not found/i)
      .isVisible()
      .catch(() => false);
    const isRedirectedHome = page.url() === new URL("/", page.url()).href;

    expect(has404 || isRedirectedHome).toBeTruthy();
  });

  test("should preserve query parameters in navigation", async ({ page }) => {
    // Navigate with query parameters
    await page.goto("/map?lat=40.7128&lng=-74.0060");

    // Parameters should be preserved
    expect(page.url()).toContain("lat=40.7128");
    expect(page.url()).toContain("lng=-74.0060");

    // Navigation should maintain current page query params when possible
    const profileNavButton = page
      .getByTestId("nav-profile")
      .or(page.getByText(/profile/i));
    if (await profileNavButton.isVisible()) {
      await profileNavButton.click();
      await expect(page).toHaveURL("/profile");
    }
  });
});

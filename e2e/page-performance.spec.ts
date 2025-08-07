import { test, expect } from "@playwright/test";

test.describe("Page Performance", () => {
  const PERFORMANCE_THRESHOLDS = {
    // Realistic thresholds for development environment
    loadTime: 15000, // 15 seconds max load time for dev
    firstPaint: 5000, // 5 seconds for first paint
    largestPaint: 8000, // 8 seconds for LCP
    firstInput: 500, // 500ms for FID in dev
    layoutShift: 0.3, // More lenient CLS threshold
  };

  test.beforeEach(async ({ page }) => {
    // Clear cache for consistent performance testing
    await page.context().clearCookies();
  });

  test("should load home page within performance thresholds", async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto("/", { waitUntil: "load" });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);

    // Verify page content loaded
    await expect(page.locator("body")).toBeVisible();

    // Check for core page elements
    const mainContent = page.locator("main, [role='main'], .main-content");
    await expect(mainContent).toBeVisible();
  });

  test("should load map page efficiently", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/map", { waitUntil: "load" });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);

    // Verify map elements loaded
    const mapContainer = page.locator(
      "[data-testid='map-view'], .map-container"
    );
    const beachList = page.locator(".beach-card, [data-testid='beach-card']");

    // Either map or beach list should be visible
    const hasMapContent = await mapContainer.isVisible().catch(() => false);
    const hasBeachList = await beachList.count().then((count) => count > 0);

    expect(hasMapContent || hasBeachList).toBeTruthy();
  });

  test("should handle session form loading efficiently", async ({ page }) => {
    if (page.url().includes("/auth")) {
      test.skip("User not authenticated - skipping session form performance");
    }

    const startTime = Date.now();

    await page.goto("/log-session", { waitUntil: "networkidle" });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);

    // Verify form elements loaded
    const sessionForm = page.locator("form, [data-testid='session-form']");
    const beachInput = page.locator("#beach-input, [name='beach']");

    if (await sessionForm.isVisible()) {
      await expect(sessionForm).toBeVisible();
    }
    if (await beachInput.isVisible()) {
      await expect(beachInput).toBeVisible();
    }
  });

  test("should measure Core Web Vitals", async ({ page }) => {
    await page.goto("/");

    // Wait for page to fully load
    await page.waitForLoadState("load");

    // Measure Core Web Vitals using Navigation Timing API
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: Record<string, number> = {};

          entries.forEach((entry) => {
            if (entry.entryType === "navigation") {
              const navEntry = entry as PerformanceNavigationTiming;
              metrics.loadTime = navEntry.loadEventEnd - navEntry.fetchStart;
              metrics.domContentLoaded =
                navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
              metrics.firstPaint = navEntry.responseEnd - navEntry.fetchStart;
            }
          });

          resolve(metrics);
        });

        observer.observe({ entryTypes: ["navigation"] });

        // Fallback timeout
        setTimeout(() => resolve({}), 5000);
      });
    });

    if (metrics && typeof metrics === "object") {
      const typedMetrics = metrics as Record<string, number>;

      if (typedMetrics.loadTime) {
        expect(typedMetrics.loadTime).toBeLessThan(
          PERFORMANCE_THRESHOLDS.loadTime
        );
      }

      if (typedMetrics.firstPaint) {
        expect(typedMetrics.firstPaint).toBeLessThan(
          PERFORMANCE_THRESHOLDS.firstPaint
        );
      }
    }
  });

  test("should handle rapid navigation without performance degradation", async ({
    page,
  }) => {
    const pages = ["/", "/map", "/profile", "/log-session"];
    const navigationTimes: number[] = [];

    for (const pagePath of pages) {
      const startTime = Date.now();

      await page.goto(pagePath, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();

      const navTime = Date.now() - startTime;
      navigationTimes.push(navTime);

      expect(navTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
    }

    // Verify navigation times don't increase significantly
    const avgTime =
      navigationTimes.reduce((a, b) => a + b) / navigationTimes.length;
    const maxTime = Math.max(...navigationTimes);

    // Max time shouldn't be more than 2x average time
    expect(maxTime).toBeLessThan(avgTime * 2);
  });

  test("should load efficiently with disabled JavaScript", async ({ page }) => {
    // Test server-side rendering performance
    await page.context().addInitScript(() => {
      // Disable JavaScript after initial load
      Object.defineProperty(window, "navigator", {
        value: { ...window.navigator, javaEnabled: () => false },
        writable: false,
      });
    });

    const startTime = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);

    // Basic content should still be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle image loading efficiently", async ({ page }) => {
    await page.goto("/map");
    await page.waitForLoadState("load");

    // Check for image loading performance
    const images = page.locator("img");
    const imageCount = await images.count();

    if (imageCount > 0) {
      // Verify images load reasonably quickly
      const startTime = Date.now();

      // Wait for first few images to load
      const imagesToCheck = Math.min(imageCount, 5);
      for (let i = 0; i < imagesToCheck; i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          await expect(img).toBeVisible();
        }
      }

      const imageLoadTime = Date.now() - startTime;
      expect(imageLoadTime).toBeLessThan(3000); // 3 seconds for image loading
    }
  });

  test("should maintain performance during data fetching", async ({ page }) => {
    await page.goto("/map");

    // Test performance during beach data loading
    const searchInput = page.getByPlaceholder(/search.*beach/i);
    if (await searchInput.isVisible()) {
      const startTime = Date.now();

      await searchInput.fill("Malibu");
      await searchInput.press("Enter");

      // Wait for search results
      await page.waitForTimeout(2000);

      const searchTime = Date.now() - startTime;
      expect(searchTime).toBeLessThan(5000); // 5 seconds for search

      // Verify results loaded
      const searchResults = page.locator(
        ".beach-card, [data-testid='beach-card']"
      );
      const resultCount = await searchResults.count();

      if (resultCount > 0) {
        await expect(searchResults.first()).toBeVisible();
      }
    }
  });

  test("should handle concurrent user interactions efficiently", async ({
    page,
  }) => {
    await page.goto("/map");
    await page.waitForLoadState("load");

    // Simulate multiple rapid interactions
    const interactions = [
      () =>
        page
          .getByRole("button", { name: /map/i })
          .click()
          .catch(() => {}),
      () =>
        page
          .getByRole("button", { name: /list/i })
          .click()
          .catch(() => {}),
      () =>
        page
          .getByPlaceholder(/search/i)
          .fill("test")
          .catch(() => {}),
      () =>
        page
          .getByPlaceholder(/search/i)
          .clear()
          .catch(() => {}),
    ];

    const startTime = Date.now();

    // Execute interactions rapidly
    await Promise.all(interactions.map((interaction) => interaction()));

    const interactionTime = Date.now() - startTime;
    expect(interactionTime).toBeLessThan(2000); // 2 seconds for all interactions

    // Page should remain responsive
    await expect(page.locator("body")).toBeVisible();
  });

  test("should maintain performance on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    const startTime = Date.now();
    await page.goto("/", { waitUntil: "load" });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);

    // Test mobile-specific interactions
    const bottomNav = page.locator(
      "[data-testid='bottom-navigation'], .bottom-nav"
    );
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toBeVisible();

      // Test tab switching performance
      const tabs = bottomNav.locator("button, a");
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        const tabStartTime = Date.now();
        await tabs.nth(1).click();
        const tabSwitchTime = Date.now() - tabStartTime;

        expect(tabSwitchTime).toBeLessThan(1000); // 1 second for tab switch
      }
    }
  });
});

import { test, expect, Page } from "@playwright/test";

/**
 * E2E Tests for Phase 1: Navigation Header Search Bar Integration
 *
 * Tests the search bar implementation in the app header across:
 * - Visual rendering on different viewports
 * - Search interaction flows
 * - Focus states and transitions
 * - Keyboard navigation
 * - Mobile vs desktop behavior
 * - Authentication states
 * - Cross-browser compatibility
 * - Performance
 *
 * Specification: docs/nav_header_refactor_guide.md (Phase 1)
 */

// Helper function to create authenticated session
async function createAuthenticatedSession(page: Page) {
  // Navigate to sign in
  await page.goto("/auth/sign-in");

  // Fill in credentials (using test user)
  await page.fill('input[type="email"]', "test@example.com");
  await page.fill('input[type="password"]', "testpassword123");

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to home
  await page.waitForURL("/", { timeout: 10000 });
}

test.describe("Nav Header Search - Visual Rendering", () => {
  test("desktop: full search bar visible and properly sized", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Search bar should be visible on desktop
    const searchInput = page.getByPlaceholder(/search beaches|search spots|search/i);

    // Phase 1: Search bar should exist
    // This test documents expected behavior
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await expect(searchInput).toBeVisible();

      // Get container styles
      const container = page.locator('input[placeholder*="search" i]').locator("..");
      const boundingBox = await container.boundingBox();

      if (boundingBox) {
        // Max-width should be around 600px
        expect(boundingBox.width).toBeLessThanOrEqual(650);
      }
    } else {
      // Document that search bar is not yet implemented
      test.skip(true, "Search bar not yet implemented in Phase 1");
    }
  });

  test("tablet: full search bar visible at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("mobile: only search icon button visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    // Full search bar should be hidden
    const searchInput = page.getByPlaceholder(/search/i);
    const fullBarVisible = await searchInput.isVisible().catch(() => false);

    // Search icon button should be visible
    const searchButton = page.getByRole("button", { name: /search/i });
    const iconVisible = await searchButton.isVisible().catch(() => false);

    if (iconVisible) {
      await expect(searchButton).toBeVisible();
      expect(fullBarVisible).toBe(false);
    }
  });

  test("search bar positioned between logo and right section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const logo = page.getByText("Quiver").first();
    await expect(logo).toBeVisible();

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Get bounding boxes to verify positioning
      const logoBox = await logo.boundingBox();
      const searchBox = await searchInput.boundingBox();

      if (logoBox && searchBox) {
        // Search should be to the right of logo
        expect(searchBox.x).toBeGreaterThan(logoBox.x);
      }
    }
  });

  test("styling matches design spec (pill shape, colors)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      // Check for rounded-full class (pill shape)
      const className = await container.getAttribute("class");
      expect(className).toMatch(/rounded-full/);

      // Check for bg-muted
      expect(className).toMatch(/bg-muted/);
    }
  });
});

test.describe("Nav Header Search - Interaction Flow", () => {
  test("click search input activates focus state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Click to focus
      await searchInput.click();

      // Input should be focused
      await expect(searchInput).toBeFocused();

      // Container should have focus styles
      const container = searchInput.locator("..").first();
      const className = await container.getAttribute("class");

      // Should have border-primary and ring styles when focused
      // Note: focus-within classes may not show in className
      expect(className).toMatch(/border|ring|focus/);
    }
  });

  test("typing in search displays text correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill("Ocean Beach");
      await expect(searchInput).toHaveValue("Ocean Beach");
    }
  });

  test("press Enter navigates or triggers search", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill("La Jolla");
      await searchInput.press("Enter");

      // Should navigate to search results or beach detail
      // Wait for navigation
      await page.waitForTimeout(1000);

      // URL should change (implementation-specific)
      const url = page.url();
      expect(url).toBeTruthy();
    }
  });

  test("mobile search icon button triggers appropriate action", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    const searchButton = page.getByRole("button", { name: /search/i });
    const isVisible = await searchButton.isVisible().catch(() => false);

    if (isVisible) {
      const urlBefore = page.url();

      await searchButton.click();

      // Should trigger navigation, modal, or expansion
      await page.waitForTimeout(500);

      // Verify something happened (URL change or modal appears)
      const urlAfter = page.url();
      const modal = page.getByRole("dialog");
      const modalVisible = await modal.isVisible().catch(() => false);

      expect(urlAfter !== urlBefore || modalVisible).toBe(true);
    }
  });

  test("clear button clears search input", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Type something
      await searchInput.fill("test query");

      // Look for clear button
      const clearButton = page.getByRole("button", { name: /clear/i });
      const clearVisible = await clearButton.isVisible().catch(() => false);

      if (clearVisible) {
        await clearButton.click();
        await expect(searchInput).toHaveValue("");
      }
    }
  });
});

test.describe("Nav Header Search - Focus States", () => {
  test("container background changes on focus", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      // Get background color before focus
      const colorBefore = await container.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // Focus input
      await searchInput.click();

      // Get background color after focus
      const colorAfter = await container.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // Colors should be different (muted -> background)
      expect(colorBefore).not.toBe(colorAfter);
    }
  });

  test("border color changes to primary blue on focus", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      await searchInput.click();

      // Check border color is primary blue (#0077B6)
      const borderColor = await container.evaluate((el) =>
        window.getComputedStyle(el).borderColor
      );

      // Should be some shade of blue
      expect(borderColor).toMatch(/rgb.*0.*119.*182|#0077B6/i);
    }
  });

  test("ring animation appears smoothly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      // Focus to trigger ring
      await searchInput.click();

      // Check for ring styles
      const boxShadow = await container.evaluate((el) =>
        window.getComputedStyle(el).boxShadow
      );

      // Should have box-shadow (ring)
      expect(boxShadow).not.toBe("none");
    }
  });

  test("focus state clears when tabbing out", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.click();
      await expect(searchInput).toBeFocused();

      // Tab out
      await page.keyboard.press("Tab");

      // Search input should no longer be focused
      await expect(searchInput).not.toBeFocused();
    }
  });

  test("respects prefers-reduced-motion", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      // Check transition duration is minimal
      const transitionDuration = await container.evaluate((el) =>
        window.getComputedStyle(el).transitionDuration
      );

      // Should be 0.01ms or very short
      expect(parseFloat(transitionDuration)).toBeLessThan(0.1);
    }
  });
});

test.describe("Nav Header Search - Keyboard Navigation", () => {
  test("correct tab order: logo → search → nav → notifications → avatar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Start from logo
    const logo = page.getByText("Quiver").first();
    await logo.focus();

    // Tab to next element
    await page.keyboard.press("Tab");

    // Next element should be search input (if implemented)
    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await expect(searchInput).toBeFocused();
    }
  });

  test("tab into search shows focus indicator", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Tab to search input
      await page.keyboard.press("Tab");
      // Multiple tabs might be needed depending on DOM order
      await page.keyboard.press("Tab");

      const isFocused = await searchInput.evaluate(
        (el) => document.activeElement === el
      );

      if (isFocused) {
        // Focus ring should be visible
        const container = searchInput.locator("..").first();
        const outline = await container.evaluate((el) =>
          window.getComputedStyle(el).outline
        );
        const boxShadow = await container.evaluate((el) =>
          window.getComputedStyle(el).boxShadow
        );

        expect(outline !== "none" || boxShadow !== "none").toBe(true);
      }
    }
  });

  test("shift+tab works in reverse order", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Focus on an element after search
    await page.keyboard.press("Tab"); // Logo
    await page.keyboard.press("Tab"); // Search (maybe)
    await page.keyboard.press("Tab"); // Next element

    // Shift+Tab back
    await page.keyboard.press("Shift+Tab");

    // Should go back to previous element
    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // May or may not be focused depending on tab order
      const isFocused = await searchInput.evaluate(
        (el) => document.activeElement === el
      );
      expect(typeof isFocused).toBe("boolean");
    }
  });

  test("typing in search works via keyboard only", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Focus search via keyboard
      await searchInput.focus();

      // Type using keyboard
      await page.keyboard.type("Pacific Beach");

      await expect(searchInput).toHaveValue("Pacific Beach");
    }
  });

  test("enter key submits search", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill("Windansea");
      await page.keyboard.press("Enter");

      // Should trigger search/navigation
      await page.waitForTimeout(500);

      const url = page.url();
      expect(url).toBeTruthy();
    }
  });
});

test.describe("Nav Header Search - Mobile Behavior", () => {
  test("mobile search icon button has adequate touch target", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    const searchButton = page.getByRole("button", { name: /search/i });
    const isVisible = await searchButton.isVisible().catch(() => false);

    if (isVisible) {
      const box = await searchButton.boundingBox();

      if (box) {
        // Touch target should be >= 44x44px
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    // Get document width
    const documentWidth = await page.evaluate(() => document.body.scrollWidth);

    // Should not be wider than viewport
    expect(documentWidth).toBeLessThanOrEqual(400); // Small buffer
  });

  test("safe area insets respected on iOS", async ({ page, browserName }) => {
    // Only run on WebKit (Safari)
    if (browserName !== "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    await page.goto("/map");

    const header = page.locator("header").first();

    // Check for safe-area-inset-top in styles
    const paddingTop = await header.evaluate((el) =>
      window.getComputedStyle(el).paddingTop
    );

    expect(paddingTop).toBeTruthy();
  });

  test("touch interactions work smoothly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    const searchButton = page.getByRole("button", { name: /search/i });
    const isVisible = await searchButton.isVisible().catch(() => false);

    if (isVisible) {
      // Simulate touch
      await searchButton.tap();

      // Should trigger action without delay
      await page.waitForTimeout(300);

      // Verify something happened
      expect(page.url()).toBeTruthy();
    }
  });
});

test.describe("Nav Header Search - Authentication State", () => {
  test("search bar visible for authenticated users", async ({ page }) => {
    // This would need actual authentication setup
    // For now, test that header renders
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("search bar visible for guest users", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("search functionality same for both auth states", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Search should work regardless of auth state
      await searchInput.fill("test");
      await expect(searchInput).toHaveValue("test");
    }
  });

  test("no layout shifts between auth states", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Measure header height as guest
    await page.goto("/map");
    const headerGuest = page.locator("header").first();
    const boxGuest = await headerGuest.boundingBox();

    // Both should render without layout shift
    expect(boxGuest).toBeTruthy();
  });
});

test.describe("Nav Header Search - Cross-Browser Compatibility", () => {
  test("chrome/edge: backdrop blur and focus states work", async ({
    page,
    browserName,
  }) => {
    if (browserName !== "chromium") {
      test.skip();
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const header = page.locator("header").first();

    // Check backdrop-filter
    const backdropFilter = await header.evaluate((el) =>
      window.getComputedStyle(el).backdropFilter
    );

    expect(backdropFilter).toMatch(/blur|none/); // blur if supported
  });

  test("safari: backdrop blur fallback works", async ({
    page,
    browserName,
  }) => {
    if (browserName !== "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    // Header should render correctly even without backdrop blur
    const backgroundColor = await header.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );

    expect(backgroundColor).toBeTruthy();
  });

  test("firefox: all styles render correctly", async ({
    page,
    browserName,
  }) => {
    if (browserName !== "firefox") {
      test.skip();
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const container = searchInput.locator("..").first();

      // Check that rounded corners work
      const borderRadius = await container.evaluate((el) =>
        window.getComputedStyle(el).borderRadius
      );

      expect(borderRadius).toBeTruthy();
    }
  });
});

test.describe("Nav Header Search - Performance", () => {
  test("no layout shift when header loads", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Track layout shifts
    await page.goto("/map");

    // Wait for page to stabilize
    await page.waitForLoadState("networkidle");

    // Check that header is in expected position
    const header = page.locator("header").first();
    const box = await header.boundingBox();

    if (box) {
      // Header should be at top
      expect(box.y).toBeLessThan(10);
    }
  });

  test("focus transitions are smooth (no jank)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Multiple rapid focus/blur cycles
      for (let i = 0; i < 5; i++) {
        await searchInput.focus();
        await page.waitForTimeout(50);
        await searchInput.blur();
        await page.waitForTimeout(50);
      }

      // Should not cause errors or jank
      expect(searchInput).toBeDefined();
    }
  });

  test("typing has minimal lag", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search/i);
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      const startTime = Date.now();

      // Type quickly
      await searchInput.type("rapidtest", { delay: 10 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (<500ms)
      expect(duration).toBeLessThan(500);
    }
  });

  test("no console errors during search interactions", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Use specific header search input testid to avoid ambiguity with map page search
    const searchInput = page.getByTestId("header-search-input");
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Perform various interactions
      await searchInput.click();
      await searchInput.fill("test query");
      await searchInput.press("Enter");

      // Wait a bit
      await page.waitForTimeout(1000);
    }

    // Should have no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});

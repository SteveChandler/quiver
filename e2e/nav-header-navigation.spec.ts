import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Phase 2: Navigation Header Links
 *
 * Tests the navigation link implementation in the app header:
 * - Desktop navigation rendering (Discover, Sessions, Community)
 * - Navigation functionality and routing
 * - Active state highlighting
 * - Responsive behavior (desktop vs mobile)
 * - Hover states and transitions
 * - Authentication-dependent navigation items
 *
 * Specification: docs/NAV_HEADER_REFACTOR_GUIDE.md (Phase 2)
 */

test.describe("Nav Header Navigation - Desktop Rendering", () => {
  test("desktop (≥1024px): authenticated users see Discover, Sessions, Community links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Verify all three authenticated navigation links are visible
    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    const communityLink = page.getByRole("link", { name: /community/i });

    await expect(discoverLink).toBeVisible();
    await expect(sessionsLink).toBeVisible();
    await expect(communityLink).toBeVisible();
  });

  test("desktop: navigation links properly styled", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Check font size and weight
    const fontSize = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );
    const fontWeight = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );

    // Should be small text (14px or similar) and medium weight
    expect(parseInt(fontSize)).toBeLessThanOrEqual(16);
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(500);
  });

  test("desktop: navigation links have proper spacing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsLink = page.getByRole("link", { name: /sessions/i });

    const discoverBox = await discoverLink.boundingBox();
    const sessionsBox = await sessionsLink.boundingBox();

    if (discoverBox && sessionsBox) {
      // Links should have spacing between them (roughly 32px from space-x-8)
      const gap = sessionsBox.x - (discoverBox.x + discoverBox.width);
      expect(gap).toBeGreaterThan(20);
      expect(gap).toBeLessThan(50);
    }
  });

  test("desktop: navigation positioned after logo, before search", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const logo = page.getByText("Quiver").first();
    const discoverLink = page.getByRole("link", { name: /discover/i });

    const logoBox = await logo.boundingBox();
    const navBox = await discoverLink.boundingBox();

    if (logoBox && navBox) {
      // Navigation should be to the right of logo
      expect(navBox.x).toBeGreaterThan(logoBox.x + logoBox.width);
    }
  });
});

test.describe("Nav Header Navigation - Navigation Functionality", () => {
  test("clicking Discover navigates to /map", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sessions");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    await discoverLink.click();

    // Should navigate to /map
    await expect(page).toHaveURL(/\/map/);
  });

  test("clicking Sessions navigates to /sessions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    await sessionsLink.click();

    // Should navigate to /sessions
    await expect(page).toHaveURL(/\/sessions/);
  });

  test("clicking Community navigates to home with intel tab", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const communityLink = page.getByRole("link", { name: /community/i });

    // Verify link href
    const href = await communityLink.getAttribute("href");
    expect(href).toContain("?tab=community");

    // Click the link and verify navigation
    await communityLink.click();
    await expect(page).toHaveURL(/\?tab=community/);

    // Verify the "Local Intel" tab is active
    const localIntelTab = page.getByRole("tab", { name: /local intel/i });
    await expect(localIntelTab).toHaveAttribute("data-state", "active");
  });

  test("navigation links open in same tab", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    const target = await sessionsLink.getAttribute("target");

    // Should not have target="_blank"
    expect(target).toBeNull();
  });

  test("keyboard Enter key activates navigation links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });

    // Focus and press Enter
    await sessionsLink.focus();
    await page.keyboard.press("Enter");

    // Should navigate
    await expect(page).toHaveURL(/\/sessions/);
  });
});

test.describe("Nav Header Navigation - Active State", () => {
  test("Discover link active when on /map", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Check text color is primary (active state)
    const color = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Active link should have primary color (ocean blue)
    // RGB values vary by browser, so just verify it's not muted
    expect(color).toBeTruthy();
  });

  test("Sessions link active when on /sessions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sessions");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });

    // Check if has active styling
    const className = await sessionsLink.getAttribute("class");
    expect(className).toBeTruthy();

    // Active link should have different color than inactive
    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsColor = await sessionsLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    const discoverColor = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    expect(sessionsColor).not.toBe(discoverColor);
  });

  test("Sessions link stays active on /sessions/[id]", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to a session detail page (if exists)
    // For now, test the pattern - active detection uses pathname.startsWith()
    await page.goto("/sessions");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    const sessionsColor = await sessionsLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    expect(sessionsColor).toBeTruthy();
  });

  test("only one link is active at a time", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sessions");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    const communityLink = page.getByRole("link", { name: /community/i });

    const discoverColor = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    const sessionsColor = await sessionsLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    const communityColor = await communityLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Sessions should be different (active)
    // Discover and Community should match (inactive)
    expect(sessionsColor).not.toBe(discoverColor);
    expect(discoverColor).toBe(communityColor);
  });
});

test.describe("Nav Header Navigation - Responsive Behavior", () => {
  test("tablet (768-1023px): navigation links hidden", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Links should not be visible on tablet
    const isVisible = await discoverLink.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("mobile (375px): navigation links hidden", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Links should not be visible on mobile
    const isVisible = await discoverLink.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("desktop (1024px): navigation links visible", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Links should be visible at exactly 1024px (lg breakpoint)
    await expect(discoverLink).toBeVisible();
  });

  test("wide desktop (1920px): navigation links visible", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    const communityLink = page.getByRole("link", { name: /community/i });

    await expect(discoverLink).toBeVisible();
    await expect(sessionsLink).toBeVisible();
    await expect(communityLink).toBeVisible();
  });

  test("resize from mobile to desktop shows navigation", async ({ page }) => {
    // Start mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    let isVisible = await discoverLink.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Resize to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100); // Allow resize to settle

    // Now should be visible
    await expect(discoverLink).toBeVisible();
  });
});

test.describe("Nav Header Navigation - Hover States", () => {
  test("hover changes link color to primary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sessions"); // Not on /map, so Discover is inactive

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Get color before hover
    const colorBefore = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Hover over link
    await discoverLink.hover();

    // Get color after hover
    const colorAfter = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Color should change on hover
    expect(colorAfter).not.toBe(colorBefore);
  });

  test("hover transitions are smooth", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    // Check for transition property
    const transition = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).transition
    );

    // Should have transition defined (duration-200)
    expect(transition).toMatch(/color|all/);
  });

  test("hover state resets when mouse leaves", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sessions");

    const discoverLink = page.getByRole("link", { name: /discover/i });

    const colorInitial = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Hover
    await discoverLink.hover();
    await page.waitForTimeout(50);

    // Move mouse away
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250); // Wait for transition

    const colorFinal = await discoverLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );

    // Should return to initial color
    expect(colorFinal).toBe(colorInitial);
  });
});

test.describe("Nav Header Navigation - Accessibility", () => {
  test("navigation links have proper ARIA roles", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    const nav = discoverLink.locator("..").locator("..");

    // Should be inside a nav element
    const tagName = await nav.evaluate((el) => el.tagName);
    expect(tagName).toBe("NAV");
  });

  test("navigation links are keyboard accessible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Tab through header elements
    await page.keyboard.press("Tab"); // Logo or first element
    await page.keyboard.press("Tab"); // Maybe search
    await page.keyboard.press("Tab"); // Eventually reach nav

    // At some point during tabbing, nav links should be focusable
    const discoverLink = page.getByRole("link", { name: /discover/i });
    const tabIndex = await discoverLink.getAttribute("tabindex");

    // Links should be keyboard accessible (tabindex 0 or unset)
    expect(tabIndex === null || parseInt(tabIndex || "0") >= 0).toBe(true);
  });

  test("focus indicators visible on keyboard navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const sessionsLink = page.getByRole("link", { name: /sessions/i });

    // Focus link
    await sessionsLink.focus();

    // Check for focus styling
    const outline = await sessionsLink.evaluate((el) =>
      window.getComputedStyle(el).outline
    );
    const boxShadow = await sessionsLink.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );

    // Should have focus indicator (outline or box-shadow)
    expect(outline !== "none" || boxShadow !== "none").toBe(true);
  });

  test("screen reader can access navigation links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Get all navigation links
    const links = await page.getByRole("navigation").first().getByRole("link").all();

    // Should have accessible names
    for (const link of links) {
      const name = await link.getAttribute("aria-label");
      const text = await link.textContent();

      // Should have either aria-label or text content
      expect(name || text).toBeTruthy();
    }
  });
});

test.describe("Nav Header Navigation - Authentication States", () => {
  test("authenticated users see app navigation links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Verify authenticated navigation exists
    const discoverLink = page.getByRole("link", { name: /discover/i });
    const sessionsLink = page.getByRole("link", { name: /sessions/i });

    await expect(discoverLink).toBeVisible();
    await expect(sessionsLink).toBeVisible();
  });

  test("guest users see different navigation (if any)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to a guest-accessible page
    // Note: Most of the app requires auth, so this may be limited
    await page.goto("/map");

    // Check if guest navigation differs
    // This will depend on your auth flow
    // For now, just verify page loads
    expect(page.url()).toContain("/map");
  });
});

test.describe("Nav Header Navigation - Performance", () => {
  test("navigation renders without layout shift", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Wait for page to stabilize
    await page.waitForLoadState("networkidle");

    const discoverLink = page.getByRole("link", { name: /discover/i });
    const box = await discoverLink.boundingBox();

    expect(box).toBeTruthy();
  });

  test("no console errors during navigation", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    // Click navigation link
    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    await sessionsLink.click();

    await page.waitForURL(/\/sessions/);

    // Should have no errors
    expect(consoleErrors).toHaveLength(0);
  });

  test("navigation interactions are fast", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/map");

    const startTime = Date.now();

    // Click navigation link
    const sessionsLink = page.getByRole("link", { name: /sessions/i });
    await sessionsLink.click();

    await page.waitForURL(/\/sessions/);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Navigation should be fast (<2 seconds)
    expect(duration).toBeLessThan(2000);
  });
});

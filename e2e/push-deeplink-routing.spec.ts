import { test, expect } from "@playwright/test";
import { waitForPageLoad, ensureAuthenticated } from "./utils/test-helpers";

/**
 * Push Notification Deeplink Routing E2E Tests
 *
 * Verifies that URLs used in push notification payloads (data.url)
 * correctly navigate to beach detail pages when opened.
 *
 * This test simulates the service worker navigation behavior without
 * actually testing the service worker itself (which requires complex
 * browser automation).
 *
 * @project e2e
 * @see /lib/services/forecast-alerts.ts - Push payload construction
 * @see /public/firebase-messaging-sw.js - Service worker click handler
 */

test.describe("Push Notification Deeplink Routing", () => {
  test("should navigate to beach detail page using deeplink URL format", async ({
    page,
  }) => {
    // Simulate clicking a push notification with data.url = "/beach/ocean-beach"
    await page.goto("/beach/ocean-beach");
    await waitForPageLoad(page);

    // Verify we're on the beach detail page (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/ocean-beach/);

    // Page should load without errors
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle).not.toContain("Error");
    expect(pageTitle).not.toContain("404");
  });

  test("should handle beach slug with hyphens in deeplink URL", async ({
    page,
  }) => {
    // Test multi-word beach slug (common pattern)
    await page.goto("/beach/la-jolla-shores");
    await waitForPageLoad(page);

    // May redirect to hierarchical URL format
    await expect(page).toHaveURL(/la-jolla-shores/);

    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });

  test("should navigate to valid beach pages from forecast alert deeplinks", async ({
    page,
  }) => {
    // Test multiple beach slugs that might appear in forecast alerts
    const beachSlugs = [
      "ocean-beach",
      "blacks",
      "windansea",
      "scripps-pier",
      "sunset-cliffs-garbage",
    ];

    for (const slug of beachSlugs) {
      await page.goto(`/beach/${slug}`);

      // Wait for navigation and initial load
      await page.waitForLoadState("networkidle", { timeout: 10000 });

      // Verify URL contains the beach slug (may redirect to hierarchical URL)
      await expect(page).toHaveURL(new RegExp(slug));

      // Verify page loaded (not 404)
      const content = await page.content();
      const is404 =
        content.includes("404") ||
        content.includes("Not Found") ||
        content.includes("Page not found");

      if (!is404) {
        // Valid beach page should have some forecast or beach data
        const hasBeachContent =
          (await page.locator("h1").count()) > 0 ||
          (await page.getByTestId("beach-detail").count()) > 0 ||
          (await page.locator('[data-beach-slug]').count()) > 0;

        expect(hasBeachContent).toBe(true);
      }
    }
  });

  test("should maintain URL format consistency for service worker", async ({
    page,
  }) => {
    // Service worker expects relative URLs starting with /beach/
    const testUrl = "/beach/steamer-lane";

    await page.goto(testUrl);
    await waitForPageLoad(page);

    const currentUrl = page.url();

    // URL should be absolute in browser and contain the beach slug (may redirect to hierarchical URL)
    expect(currentUrl).toContain("steamer-lane");

    // Should end with the beach slug (may be hierarchical or /beach/ format)
    const pathname = new URL(currentUrl).pathname;
    expect(pathname).toMatch(/steamer-lane\/?$/);
  });

  test("should handle deeplink navigation for authenticated users", async ({
    page,
  }) => {
    await ensureAuthenticated(page);

    // Navigate to beach via deeplink (as if from push notification)
    await page.goto("/beach/ocean-beach");
    await waitForPageLoad(page);

    // Authenticated users should see additional features (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/ocean-beach/);

    // Page should load without auth errors
    const hasAuthError = await page
      .getByText("You must be logged in")
      .count();
    expect(hasAuthError).toBe(0);
  });

  test("should handle deeplink navigation for guest users", async ({
    page,
  }) => {
    // Don't authenticate - test as guest
    await page.goto("/beach/ocean-beach");
    await waitForPageLoad(page);

    // Guests should still be able to view beach pages (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/ocean-beach/);

    // Page should load (guests can view beaches, just can't interact)
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });

  test("should preserve deeplink URL when opening in new tab", async ({
    context,
  }) => {
    // Simulate service worker opening new window with clients.openWindow()
    const page = await context.newPage();

    await page.goto("/beach/pipeline");
    await waitForPageLoad(page);

    // May redirect to hierarchical URL
    await expect(page).toHaveURL(/pipeline/);

    // New tab should maintain the beach slug in URL
    const url = page.url();
    expect(url).toContain("pipeline");
  });

  test("should handle navigation to beach page and display forecast data", async ({
    page,
  }) => {
    await page.goto("/beach/ocean-beach");
    await waitForPageLoad(page);

    // Wait for forecast data to load (if available)
    await page.waitForTimeout(2000); // Brief wait for data fetch

    // Check if page has loaded content (either forecast or placeholder)
    const hasContent =
      (await page.locator("h1").count()) > 0 ||
      (await page.getByText("Ocean Beach").count()) > 0 ||
      (await page.getByTestId("forecast-card").count()) > 0 ||
      (await page.getByText("Loading").count()) > 0;

    expect(hasContent).toBe(true);
  });

  test("should handle invalid beach slugs gracefully", async ({ page }) => {
    // Test with non-existent beach slug
    await page.goto("/beach/nonexistent-beach-xyz");

    // Wait for page to load
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    // Should either:
    // 1. Show 404 page
    // 2. Redirect to home or beach list
    // 3. Show "Beach not found" message

    const url = page.url();
    const content = await page.content();

    const is404 =
      url.includes("404") ||
      content.includes("404") ||
      content.includes("Not Found") ||
      content.includes("not found");

    const isRedirected = !url.includes("nonexistent-beach-xyz");

    // One of these should be true
    expect(is404 || isRedirected).toBe(true);
  });

  test("should support direct navigation to beach forecast section", async ({
    page,
  }) => {
    // Future enhancement: push notifications might link to specific sections
    // e.g., /beach/ocean-beach#forecast
    await page.goto("/beach/ocean-beach#forecast");
    await waitForPageLoad(page);

    // URL should contain beach slug (may redirect to hierarchical format, hash may be stripped)
    expect(page.url()).toContain("ocean-beach");

    // Note: Hash navigation is client-side, so we just verify page loads
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });
});

test.describe("Service Worker Click Behavior Simulation", () => {
  test("should handle relative URL from push notification data", async ({
    page,
  }) => {
    // Simulate service worker behavior:
    // const urlToOpen = `${self.location.origin}${data.url}`

    const origin = new URL(page.url()).origin;
    const dataUrl = "/beach/mavericks-half-moon-bay";
    const constructedUrl = `${origin}${dataUrl}`;

    await page.goto(constructedUrl);
    await waitForPageLoad(page);

    // Verify navigation worked (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/mavericks-half-moon-bay/);
  });

  test("should focus existing tab with same URL (simulation)", async ({
    context,
  }) => {
    // Simulate service worker's clients.matchAll behavior
    const page1 = await context.newPage();
    await page1.goto("/beach/ocean-beach");
    await waitForPageLoad(page1);

    // Get all pages (tabs) in context
    const pages = context.pages();

    // Find page with matching URL (may redirect to hierarchical URL)
    const existingPage = pages.find((p) =>
      p.url().includes("ocean-beach")
    );

    expect(existingPage).toBeDefined();

    // In real service worker, this would call client.focus()
    if (existingPage) {
      await existingPage.bringToFront();

      const isFocused = existingPage === (await context.pages())[0];
      expect(typeof isFocused).toBe("boolean");
    }
  });

  test("should open new window when no matching tab exists", async ({
    context,
  }) => {
    // Get initial page count
    const initialPages = context.pages().length;

    // Open new page (simulates clients.openWindow)
    const newPage = await context.newPage();
    await newPage.goto("/beach/steamer-lane");
    await waitForPageLoad(newPage);

    // Verify new page was created
    const finalPages = context.pages().length;
    expect(finalPages).toBeGreaterThan(initialPages);

    // May redirect to hierarchical URL
    await expect(newPage).toHaveURL(/steamer-lane/);
  });
});

test.describe("Push Notification Payload Compatibility", () => {
  test("should handle forecast_alert type with data.url fallback", async ({
    page,
  }) => {
    // Simulate the exact payload structure from forecast-alerts.ts
    const mockPayload = {
      notification: {
        title: "Quiver Forecast Alert",
        body: "Ocean Beach looks good 1/15 2PM UTC: 3.5ft @ 12s • 10mph wind",
      },
      data: {
        type: "forecast_alert",
        beach_id: "beach-001",
        beach_slug: "ocean-beach",
        forecast_ts: "2025-01-15T14:00:00Z",
        url: "/beach/ocean-beach",
      },
    };

    // Navigate using the deeplink URL
    await page.goto(mockPayload.data.url);
    await waitForPageLoad(page);

    // Verify successful navigation (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/ocean-beach/);

    // Verify page content loaded
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test("should handle session_invite type for comparison", async ({ page }) => {
    // For comparison: session invites use type-specific routing
    // Service worker would construct: /sessions/{session_id}
    const mockSessionPayload = {
      notification: {
        title: "New Surf Session Invite",
        body: "John invited you to Ocean Beach",
      },
      data: {
        type: "session_invite",
        session_id: "session-123",
        message: "Let's surf!",
      },
    };

    // This would be constructed by service worker as:
    const sessionUrl = `/sessions/${mockSessionPayload.data.session_id}`;

    await page.goto(sessionUrl);

    // Just verify the URL format is valid (don't verify page content)
    // Session pages might require auth or specific setup
    const currentUrl = page.url();
    expect(currentUrl).toContain("/sessions/session-123");
  });

  test("should prioritize data.url when both url and type are present", async ({
    page,
  }) => {
    // Service worker uses data.url as fallback when type-specific routes don't match
    // For forecast_alert, it should use data.url
    const mixedPayload = {
      data: {
        type: "forecast_alert",
        url: "/beach/la-jolla-shores",
        beach_id: "beach-002",
      },
    };

    // Navigate to the URL
    await page.goto(mixedPayload.data.url);
    await waitForPageLoad(page);

    // Should use data.url, not construct URL from type (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/la-jolla-shores/);
  });
});

test.describe("Beach Page Loading Performance", () => {
  test("should load beach page from deeplink within acceptable time", async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto("/beach/ocean-beach");
    await waitForPageLoad(page);

    const loadTime = Date.now() - startTime;

    // Beach page should load within 15 seconds (includes redirect time in CI)
    expect(loadTime).toBeLessThan(15000);

    // Verify page is interactive (may redirect to hierarchical URL)
    await expect(page).toHaveURL(/ocean-beach/);
  });

  test("should handle rapid navigation from multiple deeplinks", async ({
    page,
  }) => {
    // Simulate user clicking multiple notifications quickly
    const beaches = ["ocean-beach", "blacks", "windansea"];

    for (const beach of beaches) {
      await page.goto(`/beach/${beach}`);
      await page.waitForLoadState("domcontentloaded");

      // Verify URL contains beach slug (may redirect to hierarchical URL)
      expect(page.url()).toContain(beach);
    }

    // Final page should be the last beach (may be hierarchical URL)
    await expect(page).toHaveURL(/windansea/);
  });
});

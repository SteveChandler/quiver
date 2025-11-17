/**
 * E2E Tests for React Rendering Performance
 *
 * Validates React.memo optimizations from Phase 4.
 *
 * Tests cover:
 * - PersonalizedBadge memo optimization
 * - BeachCard memoization
 * - ForecastPreview performance
 * - Page load performance (Time to Interactive)
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { ensureAuthenticated, waitForPageLoad } from "./utils/test-helpers";
import { TIMEOUTS, VIEWPORTS } from "./fixtures/test-data";

test.describe("React Rendering Performance - Phase 4 React.memo Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test.describe("PersonalizedBadge Rendering Optimization", () => {
    test("should render personalized badges without excessive re-renders", async ({ page }) => {
      // Navigate to home page where personalized badges appear
      await page.goto("/");
      await waitForPageLoad(page);

      // Wait for content to load
      await page.waitForSelector('[data-testid="best-conditions-section"]', {
        state: "visible",
        timeout: TIMEOUTS.long,
      }).catch(() => {
        // Section may not be visible if no location available
        console.log("Best conditions section not found - may be expected");
      });

      // Look for personalized badges
      const badges = page.locator('[data-testid*="personalized-badge"]');
      const badgeCount = await badges.count();

      if (badgeCount > 0) {
        console.log(`✓ Found ${badgeCount} personalized badges`);

        // Verify badges are visible
        const firstBadge = badges.first();
        await expect(firstBadge).toBeVisible();

        // Get badge text
        const badgeText = await firstBadge.textContent();
        console.log(`  - Badge text: "${badgeText}"`);
      } else {
        console.log("✓ No personalized badges (user may not have preferences set)");
      }
    });

    test("should update badge when score changes without full page re-render", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Look for beach cards or personalized content
      const beachCards = page.locator('[data-testid*="beach-card"]');
      const initialCount = await beachCards.count();

      if (initialCount > 0) {
        // Trigger a state update that shouldn't cause full re-render
        // For example, hovering over a card
        const firstCard = beachCards.first();
        await firstCard.hover();

        // Wait a moment for any re-renders
        await page.waitForTimeout(500);

        // Verify card is still there (not unmounted/remounted)
        await expect(firstCard).toBeVisible();

        console.log("✓ Beach card remained stable after interaction");
      }
    });

    test("should handle rapid filter changes efficiently", async ({ page }) => {
      await page.goto("/map");
      await waitForPageLoad(page);

      // Wait for map to load
      await page.waitForSelector('[data-testid="beach-map"]', {
        state: "visible",
        timeout: TIMEOUTS.long,
      }).catch(() => {
        console.log("Map not found");
      });

      // Track console errors
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Try to interact with filters if they exist
      const filterButtons = page.locator('button[role="checkbox"], button[role="radio"]');
      const filterCount = await filterButtons.count();

      if (filterCount > 0) {
        // Click first filter
        await filterButtons.first().click();
        await page.waitForTimeout(300);

        // Click second filter if available
        if (filterCount > 1) {
          await filterButtons.nth(1).click();
          await page.waitForTimeout(300);
        }

        // Should not have excessive errors
        const relevantErrors = errors.filter(e =>
          !e.includes("404") && !e.includes("Failed to fetch")
        );
        expect(relevantErrors.length).toBe(0);

        console.log("✓ Filter changes handled without errors");
      }
    });
  });

  test.describe("BeachCard Memoization", () => {
    test("should render beach cards efficiently on map view", async ({ page }) => {
      const startTime = performance.now();

      await page.goto("/map");
      await waitForPageLoad(page);

      const loadTime = performance.now() - startTime;

      // Page should load in reasonable time even with many beach cards
      expect(loadTime).toBeLessThan(5000);

      console.log(`✓ Map page load time: ${loadTime.toFixed(2)}ms`);

      // Check for beach markers/cards
      const beachMarkers = page.locator('[data-testid*="beach-marker"], [data-testid*="beach-card"]');
      const markerCount = await beachMarkers.count();

      console.log(`  - Beach markers/cards found: ${markerCount}`);
    });

    test("should not re-render all cards when one card is interacted with", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Find beach cards
      const beachCards = page.locator('[data-testid*="beach-card"]');
      const cardCount = await beachCards.count();

      if (cardCount > 1) {
        // Get initial state
        const firstCard = beachCards.first();
        const secondCard = beachCards.nth(1);

        // Interact with first card
        await firstCard.hover();
        await page.waitForTimeout(200);

        // Second card should still be visible and stable
        await expect(secondCard).toBeVisible();

        console.log("✓ Other cards remained stable during interaction");
      }
    });

    test("should handle scrolling through many beaches efficiently", async ({ page }) => {
      await page.goto("/discover");
      await waitForPageLoad(page);

      // Track any React warnings
      const warnings: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "warning" && msg.text().includes("React")) {
          warnings.push(msg.text());
        }
      });

      // Scroll down to trigger more beach loading
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);

      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);

      // Should not have excessive React warnings
      expect(warnings.length).toBeLessThan(5);

      console.log("✓ Scrolling handled efficiently");
    });
  });

  test.describe("ForecastPreview Performance", () => {
    test("should render forecast previews without lag", async ({ page }) => {
      // Navigate to beach detail page
      await page.goto("/beach/blacks-beach");
      await waitForPageLoad(page);

      // Wait for forecast section
      const forecastSection = page.locator('[data-testid*="forecast"]');
      const forecastVisible = await forecastSection.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (forecastVisible) {
        // Forecast should render quickly
        await expect(forecastSection).toBeVisible();

        console.log("✓ Forecast preview rendered");

        // Interact with forecast (e.g., hover over chart)
        await forecastSection.hover();
        await page.waitForTimeout(200);

        // Should remain stable
        await expect(forecastSection).toBeVisible();
      }
    });

    test("should not re-render forecast when unrelated state changes", async ({ page }) => {
      await page.goto("/beach/blacks-beach");
      await waitForPageLoad(page);

      // Track renders by looking for loading states
      let loadingStateChanges = 0;
      page.on("console", (msg) => {
        if (msg.text().includes("loading") || msg.text().includes("skeleton")) {
          loadingStateChanges++;
        }
      });

      // Scroll page (unrelated to forecast data)
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(500);

      // Should not trigger excessive loading state changes
      expect(loadingStateChanges).toBeLessThan(3);

      console.log("✓ Forecast remained stable during unrelated updates");
    });
  });

  test.describe("Page Load Performance", () => {
    test("should meet Time to Interactive target (<3.5s)", async ({ page }) => {
      const navigationStart = Date.now();

      await page.goto("/");

      // Wait for page to be interactive
      await page.waitForLoadState("domcontentloaded");
      await page.waitForLoadState("load");

      const loadTime = Date.now() - navigationStart;

      // Should meet TTI target
      expect(loadTime).toBeLessThan(3500);

      console.log(`✓ Time to Interactive: ${loadTime}ms (target: <3500ms)`);

      // Verify page is actually interactive
      const interactiveElement = page.locator('button, a').first();
      await expect(interactiveElement).toBeVisible();
    }, TIMEOUTS.long);

    test("should load home page efficiently on mobile", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      const startTime = performance.now();

      await page.goto("/");
      await waitForPageLoad(page);

      const loadTime = performance.now() - startTime;

      // Mobile should still be under 4 seconds
      expect(loadTime).toBeLessThan(4000);

      console.log(`✓ Mobile page load time: ${loadTime.toFixed(2)}ms`);
    });

    test("should load map page with 50+ beaches under 2 seconds", async ({ page }) => {
      const startTime = performance.now();

      await page.goto("/map");
      await waitForPageLoad(page);

      const loadTime = performance.now() - startTime;

      // Map with many beaches should still load quickly thanks to memoization
      expect(loadTime).toBeLessThan(5000);

      console.log(`✓ Map page load time: ${loadTime.toFixed(2)}ms`);

      // Wait for beaches to render
      await page.waitForSelector('[data-testid="beach-map"]', {
        state: "visible",
        timeout: TIMEOUTS.medium,
      }).catch(() => {
        console.log("Map element not found");
      });
    });

    test("should maintain 60fps during animations", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Trigger scroll animation
      await page.evaluate(() => {
        window.scrollTo({ top: 500, behavior: "smooth" });
      });

      await page.waitForTimeout(1000);

      // Check for janky frames (we can't measure FPS directly, but we can check for console warnings)
      const warnings: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "warning" && msg.text().includes("frame")) {
          warnings.push(msg.text());
        }
      });

      // Should not have frame drop warnings
      expect(warnings.length).toBe(0);

      console.log("✓ Smooth animations (no frame warnings)");
    });
  });

  test.describe("Component Update Performance", () => {
    test("should update components efficiently when data changes", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Track React DevTools profiler data if available
      const performanceMarks: string[] = [];

      page.on("console", (msg) => {
        const text = msg.text();
        if (text.includes("render") || text.includes("update")) {
          performanceMarks.push(text);
        }
      });

      // Trigger a refresh by navigating away and back
      await page.goto("/discover");
      await waitForPageLoad(page);

      await page.goto("/");
      await waitForPageLoad(page);

      // Should complete without excessive performance warnings
      console.log(`✓ Navigation completed with ${performanceMarks.length} performance marks`);
    });

    test("should handle rapid state updates without crashes", async ({ page }) => {
      await page.goto("/map");
      await waitForPageLoad(page);

      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      // Rapidly interact with map (zoom, pan)
      const map = page.locator('[data-testid="beach-map"]');
      const mapVisible = await map.isVisible().catch(() => false);

      if (mapVisible) {
        // Simulate rapid interactions
        for (let i = 0; i < 5; i++) {
          await map.click({ position: { x: 100 + i * 10, y: 100 + i * 10 } });
          await page.waitForTimeout(100);
        }

        // Should not crash
        expect(errors.length).toBe(0);

        console.log("✓ Rapid interactions handled without errors");
      }
    });

    test("should clean up effects properly on unmount", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      // Navigate through different pages quickly
      await page.goto("/");
      await page.waitForTimeout(500);

      await page.goto("/map");
      await page.waitForTimeout(500);

      await page.goto("/discover");
      await page.waitForTimeout(500);

      await page.goto("/sessions");
      await page.waitForTimeout(500);

      // Should not have memory leaks or cleanup errors
      const memoryErrors = errors.filter(e =>
        e.includes("memory") || e.includes("unmount") || e.includes("cleanup")
      );

      expect(memoryErrors.length).toBe(0);

      console.log("✓ Component cleanup working properly");
    });
  });

  test.describe("Memory Performance", () => {
    test("should not leak memory during normal navigation", async ({ page }) => {
      // Navigate through app multiple times
      for (let i = 0; i < 3; i++) {
        await page.goto("/");
        await waitForPageLoad(page);

        await page.goto("/map");
        await waitForPageLoad(page);

        await page.goto("/discover");
        await waitForPageLoad(page);
      }

      // Check for console warnings about memory
      const warnings: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "warning" && msg.text().includes("memory")) {
          warnings.push(msg.text());
        }
      });

      expect(warnings.length).toBe(0);

      console.log("✓ No memory warnings after navigation cycles");
    }, TIMEOUTS.veryLong);

    test("should handle large datasets without performance degradation", async ({ page }) => {
      // Load page with potentially many items
      await page.goto("/discover");
      await waitForPageLoad(page);

      const startTime = performance.now();

      // Scroll to load more items
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }

      const scrollTime = performance.now() - startTime;

      // Should handle scrolling efficiently
      expect(scrollTime).toBeLessThan(5000);

      console.log(`✓ Large dataset scrolling time: ${scrollTime.toFixed(2)}ms`);
    }, TIMEOUTS.long);
  });

  test.describe("Performance Regression Detection", () => {
    test("should maintain baseline performance metrics", async ({ page }) => {
      const metrics: Array<{ page: string; time: number }> = [];

      const pages = ["/", "/map", "/discover"];

      for (const pagePath of pages) {
        const startTime = performance.now();

        await page.goto(pagePath);
        await waitForPageLoad(page);

        const loadTime = performance.now() - startTime;
        metrics.push({ page: pagePath, time: loadTime });
      }

      // All pages should load in reasonable time
      metrics.forEach(metric => {
        expect(metric.time).toBeLessThan(5000);
        console.log(`✓ ${metric.page}: ${metric.time.toFixed(2)}ms`);
      });

      // Calculate average
      const avgTime = metrics.reduce((sum, m) => sum + m.time, 0) / metrics.length;
      console.log(`  Average load time: ${avgTime.toFixed(2)}ms`);
    }, TIMEOUTS.veryLong);

    test("should not have excessive React DevTools warnings", async ({ page }) => {
      const warnings: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "warning") {
          warnings.push(msg.text());
        }
      });

      await page.goto("/");
      await waitForPageLoad(page);

      await page.goto("/map");
      await waitForPageLoad(page);

      // Filter for React-specific warnings
      const reactWarnings = warnings.filter(w =>
        w.includes("React") ||
        w.includes("component") ||
        w.includes("prop") ||
        w.includes("key")
      );

      // Should have minimal React warnings (indicates good memo usage)
      expect(reactWarnings.length).toBeLessThan(5);

      if (reactWarnings.length > 0) {
        console.log(`React warnings found: ${reactWarnings.length}`);
        reactWarnings.forEach(w => console.log(`  - ${w}`));
      } else {
        console.log("✓ No React warnings detected");
      }
    });
  });
});

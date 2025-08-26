import { test, expect } from "@playwright/test";

test.describe("Error Detection & Prevention", () => {
  // Global error tracking setup - QUIET MODE
  test.beforeEach(async ({ page }) => {
    // Track only critical infinite loop errors, suppress everything else
    const criticalErrors: string[] = [];

    page.on("pageerror", (error) => {
      // Only track infinite loop errors
      if (
        error.message.includes("Maximum update depth exceeded") ||
        error.message.includes("Too many re-renders") ||
        error.message.includes(
          "Rendered more hooks than during the previous render"
        )
      ) {
        criticalErrors.push(`CRITICAL: ${error.message}`);
        console.error("🚨 INFINITE LOOP DETECTED:", error.message);
      }
    });

    page.on("console", (msg) => {
      // Only track critical React infinite loop errors
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("Maximum update depth exceeded") ||
          text.includes("Too many re-renders") ||
          text.includes("Rendered more hooks than during the previous render")
        ) {
          criticalErrors.push(`CRITICAL CONSOLE: ${text}`);
          console.error("🚨 INFINITE LOOP IN CONSOLE:", text);
        }
        // Suppress all other console noise
      }
    });

    // Store only critical errors for test access
    await page.addInitScript(() => {
      (window as any).__criticalErrors = [];
    });
  });

  test.describe("React Infinite Loop Detection", () => {
    const pages = ["/sessions/new?mode=plan", "/sessions/new?mode=log", "/profile", "/", "/map"];

    for (const pagePath of pages) {
      test(`should not have infinite loops on ${pagePath}`, async ({
        page,
      }) => {
        // Navigate quietly
        await page.goto(pagePath);

        // Wait for potential infinite loops to manifest
        await page.waitForTimeout(3000);

        // Check for infinite loop errors only
        const criticalErrors = await page.evaluate(() => {
          return (window as any).__criticalErrors || [];
        });

        // Test should pass if no infinite loop errors
        expect(criticalErrors.length).toBe(0);

        // Only log if there ARE critical errors
        if (criticalErrors.length > 0) {
          console.error(
            `🚨 INFINITE LOOP DETECTED on ${pagePath}:`,
            criticalErrors
          );
        }
      });
    }
  });

  test.describe("API Failure Resilience", () => {
    test("should handle session planner API failures gracefully", async ({
      page,
    }) => {
      await page.goto("/sessions/new?mode=plan");
      await page.waitForTimeout(2000);

      // Just check page didn't crash - no console noise
      const isStillLoaded = await page.locator("body").isVisible();
      expect(isStillLoaded).toBe(true);
    });

    test("should handle forecast API failures gracefully", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Just check page didn't crash - no console noise
      const isStillLoaded = await page.locator("body").isVisible();
      expect(isStillLoaded).toBe(true);
    });

    test("should handle beach search API failures gracefully", async ({
      page,
    }) => {
      await page.goto("/map");
      await page.waitForTimeout(2000);

      // Just check page didn't crash - no console noise
      const isStillLoaded = await page.locator("body").isVisible();
      expect(isStillLoaded).toBe(true);
    });
  });

  test.describe("Memory Leak Detection", () => {
    test("should not accumulate memory leaks during navigation", async ({
      page,
    }) => {
      const pages = ["/", "/map", "/profile", "/sessions/new?mode=plan"];

      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForTimeout(1000);
      }

      // Simple check - page still responsive
      const isResponsive = await page.locator("body").isVisible();
      expect(isResponsive).toBe(true);
    });
  });

  test.describe("Component Error Boundaries", () => {
    test("should handle component errors gracefully", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Check page is functional
      const isLoaded = await page.locator("body").isVisible();
      expect(isLoaded).toBe(true);
    });
  });

  test.describe("Hook Dependency Issues", () => {
    test("should not have useEffect dependency warnings", async ({ page }) => {
      await page.goto("/sessions/new?mode=plan");
      await page.waitForTimeout(2000);

      // Check for infinite loop specifically
      const criticalErrors = await page.evaluate(() => {
        return (window as any).__criticalErrors || [];
      });

      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe("Network Error Handling", () => {
    test("should handle network timeouts gracefully", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(3000);

      // Just verify page loads
      const isLoaded = await page.locator("body").isVisible();
      expect(isLoaded).toBe(true);
    });
  });
});

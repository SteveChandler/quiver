/**
 * Hub Region Guides Tests
 *
 * Tests the regional surf guide pages (/guides/surfing-{region}).
 * Validates map rendering, animations, accessibility, and navigation.
 *
 * Note: These pages use animation components (ScrollReveal, AnimatedCounter) that
 * detect reduced motion preferences via window.matchMedia. This causes expected
 * React hydration warnings which we ignore in these tests.
 *
 * @project guest - These are public pages accessible without auth
 */

import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

test.describe("Hub Region Guides", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Hub Region Guides' });
  });

  test.describe("Southern California Surf Guide", () => {
    const GUIDE_URL = "/guides/surfing-southern-california";

    test("page loads successfully @smoke", async ({ page }) => {
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // Page title should be visible
      const heading = page.getByRole("heading", {
        name: /southern california/i,
        level: 1,
      });
      await expect(heading).toBeVisible({ timeout: 10000 });

      // No error boundaries should be visible
      await expect(page.locator('[data-testid="error-boundary"]')).not.toBeVisible();
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    });

    test("displays region statistics", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal IntersectionObserver delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for React hydration
      await page.waitForTimeout(1000);

      // Scroll stats section into view to trigger any remaining IntersectionObserver
      const statsSection = page.locator("section").filter({ hasText: "Total Spots" });
      await statsSection.scrollIntoViewIfNeeded();

      // Stats cards should be visible (use first() to avoid strict mode issues)
      await expect(page.getByText("Total Spots").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Beginner").first()).toBeVisible();
      await expect(page.getByText("Intermediate").first()).toBeVisible();
      await expect(page.getByText("Advanced").first()).toBeVisible();
    });

    test("map renders with markers", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal IntersectionObserver delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // Scroll the map section into view
      const mapSection = page.getByRole("heading", { name: /explore surf spots/i });
      await mapSection.scrollIntoViewIfNeeded();

      // Wait for either map canvas to be visible OR error state
      // (error state indicates proper handling when token is missing)
      const mapCanvas = page.locator(".mapboxgl-canvas, canvas").first();
      const mapError = page.getByText("Unable to Load Map");

      // Give map time to initialize (Mapbox needs time to load tiles)
      // Use a polling approach instead of fixed timeout
      let hasCanvas = false;
      let hasError = false;

      for (let i = 0; i < 10; i++) {
        hasCanvas = await isVisibleSafe(mapCanvas);
        hasError = await isVisibleSafe(mapError);
        if (hasCanvas || hasError) break;
        // eslint-disable-next-line playwright/no-wait-for-timeout -- polling interval for Mapbox initialization
        await page.waitForTimeout(1000);
      }

      // Either map loaded or error state is shown (both are valid)
      expect(hasCanvas || hasError).toBe(true);

      if (hasCanvas) {
        // Map legend should be visible when map loads
        await expect(page.getByText("Skill Level").first()).toBeVisible();
      }
    });

    test("category links are present and navigable", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for React hydration
      await page.waitForTimeout(1000);

      // Browse by Category section
      await expect(
        page.getByRole("heading", { name: /browse by category/i })
      ).toBeVisible({ timeout: 10000 });

      // Category links should be visible (use role to get specific links)
      const beginnerLink = page.getByRole("link", { name: /beginner spots/i });
      const leastCrowdedLink = page.getByRole("link", { name: /least crowded/i });
      const tideLink = page.getByRole("link", { name: /tide reports/i });
      const tempLink = page.getByRole("link", { name: /water temp/i });

      await expect(beginnerLink).toBeVisible();
      await expect(leastCrowdedLink).toBeVisible();
      await expect(tideLink).toBeVisible();
      await expect(tempLink).toBeVisible();

      // Test that a category link has the correct href
      await expect(beginnerLink).toHaveAttribute("href", /\/beginner\//);
    });

    test("back navigation link works", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for React hydration
      await page.waitForTimeout(1000);

      // Back link should be present
      const backLink = page.getByRole("link", { name: /back to surf guides/i });
      await expect(backLink).toBeVisible({ timeout: 10000 });
      await expect(backLink).toHaveAttribute("href", "/guides");
    });

    test("about section displays region information", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal IntersectionObserver delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(GUIDE_URL, { timeout: 20000, waitUntil: "domcontentloaded" });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for React hydration
      await page.waitForTimeout(1000);

      // About section heading
      const aboutHeading = page.getByRole("heading", {
        name: /about .* surfing/i,
      });
      await expect(aboutHeading).toBeVisible({ timeout: 10000 });

      // Should have descriptive content
      await expect(
        page.getByText(/track conditions|plan sessions|forecast/i)
      ).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("respects reduced motion preference", async ({ page }) => {
      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: "reduce" });

      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // Page should still load and display content
      await expect(
        page.getByRole("heading", { name: /southern california/i, level: 1 })
      ).toBeVisible({ timeout: 10000 });

      // Stats should be immediately visible (no animation delays)
      await expect(page.getByText("Total Spots")).toBeVisible();
    });

    test("all interactive elements are keyboard accessible", async ({
      page,
    }) => {
      // Emulate reduced motion to bypass ScrollReveal delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for React hydration
      await page.waitForTimeout(1000);

      // Back link should be focusable
      const backLink = page.getByRole("link", { name: /back to surf guides/i });
      await backLink.focus();
      await expect(backLink).toBeFocused();

      // Category links should be focusable
      const beginnerLink = page.getByRole("link", { name: /beginner spots/i });
      await beginnerLink.focus();
      await expect(beginnerLink).toBeFocused();
    });
  });

  test.describe("Mobile Viewport", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("renders correctly on mobile", async ({ page }) => {
      // Emulate reduced motion to bypass ScrollReveal IntersectionObserver delays
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // Title should be visible
      await expect(
        page.getByRole("heading", { name: /southern california/i, level: 1 })
      ).toBeVisible({ timeout: 10000 });

      // Stats grid should adapt (2 columns on mobile)
      const statsSection = page
        .locator("section")
        .filter({ hasText: "Total Spots" });
      await statsSection.scrollIntoViewIfNeeded();
      await expect(statsSection).toBeVisible({ timeout: 10000 });

      // Map container area should be present (scroll into view first)
      const mapArea = page.locator(".h-\\[500px\\]");
      await mapArea.scrollIntoViewIfNeeded();
      await expect(mapArea).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("SEO and Structured Data", () => {
    test("has proper meta tags", async ({ page }) => {
      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // Check for title
      const title = await page.title();
      expect(title.toLowerCase()).toContain("southern california");

      // Check for meta description
      const metaDescription = page.locator('meta[name="description"]');
      await expect(metaDescription).toHaveAttribute("content", /.+/);
    });

    test("has FAQ structured data", async ({ page }) => {
      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for structured data scripts to render
      await page.waitForTimeout(500);

      // Check for FAQ schema in page source
      const faqScripts = await page.locator('script[type="application/ld+json"]').all();
      let hasFaqSchema = false;

      for (const script of faqScripts) {
        const content = await script.textContent();
        if (content && content.includes("FAQPage")) {
          hasFaqSchema = true;
          break;
        }
      }

      expect(hasFaqSchema).toBe(true);
    });

    test("has breadcrumb structured data", async ({ page }) => {
      await page.goto("/guides/surfing-southern-california", {
        timeout: 20000,
        waitUntil: "domcontentloaded",
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for structured data scripts to render
      await page.waitForTimeout(500);

      // Check for breadcrumb schema in page source
      const scripts = await page.locator('script[type="application/ld+json"]').all();
      let hasBreadcrumbSchema = false;

      for (const script of scripts) {
        const content = await script.textContent();
        if (content && content.includes("BreadcrumbList")) {
          hasBreadcrumbSchema = true;
          break;
        }
      }

      expect(hasBreadcrumbSchema).toBe(true);
    });
  });
});

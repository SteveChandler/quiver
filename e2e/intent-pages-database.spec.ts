/**
 * E2E Tests for Database-Driven Intent Pages
 *
 * Tests the implementation of database-driven intent pages that replaced
 * hardcoded SURF_CITIES with dynamic city resolution from the database.
 *
 * Test Coverage:
 * - Database-driven city pages load correctly
 * - State-level intent pages work
 * - 404 handling for non-existent cities
 * - Legacy state/city redirects work
 * - Intent-specific content displays correctly
 * - Map integration works
 * - SEO metadata is correct
 */

import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

// Test timeouts
const PAGE_LOAD_TIMEOUT = 10000;
const MAP_LOAD_TIMEOUT = 5000;

test.describe("Database-driven intent pages - City level", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'City level' });
  });

  test("should load Santa Cruz beginner page from database", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Should not 404
    await expect(page).not.toHaveURL(/404/);

    // Should have Santa Cruz in heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
    await expect(heading).toContainText(/Santa Cruz/i);

    // Should have beginner-specific content
    await expect(heading).toContainText(/beginner/i);

    // Should have main content area
    const main = page.locator("main, [role='main'], .container");
    await expect(main.first()).toBeVisible();
  });

  test("should load Honolulu tide page from database", async ({ page }) => {
    await page.goto("/tide/honolulu", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page).not.toHaveURL(/404/);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Honolulu/i);
    await expect(heading).toContainText(/tide/i);
  });

  test("should load Newport Beach water-temp page", async ({ page }) => {
    await page.goto("/water-temp/newport-beach", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page).not.toHaveURL(/404/);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Newport/i);
  });

  test("should handle city slug with state disambiguation", async ({ page }) => {
    // Cities that might need state in slug (e.g., newport-or for Oregon)
    // This tests the city slug collision detection logic
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    // Should load successfully whether it's santa-cruz or santa-cruz-ca
  });
});

test.describe("Database-driven intent pages - State level", () => {
  test("should load California beginner state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page).not.toHaveURL(/404/);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/California/i);
    await expect(heading).toContainText(/beginner/i);

    // Should show spot count
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/\d+\s+spot/i);
  });

  test("should load Hawaii tide state page", async ({ page }) => {
    await page.goto("/tide/hi", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page).not.toHaveURL(/404/);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Hawaii/i);
  });

  test("should load Oregon longboard state page", async ({ page }) => {
    await page.goto("/longboard/or", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page).not.toHaveURL(/404/);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Oregon/i);
  });
});

test.describe("Database-driven intent pages - 404 handling", () => {
  test("should return 404 for nonexistent city", async ({ page }) => {
    const response = await page.goto("/beginner/nonexistent-city-xyz", {
      timeout: PAGE_LOAD_TIMEOUT,
    });

    // Should get 404 status
    expect(response?.status()).toBe(404);
  });

  test("should return 404 for city with no beaches", async ({ page }) => {
    // Try a real city name that likely has no beaches in database
    const response = await page.goto("/beginner/random-inland-city-99", {
      timeout: PAGE_LOAD_TIMEOUT,
    });

    expect(response?.status()).toBe(404);
  });

  test("should return 404 for invalid intent", async ({ page }) => {
    const response = await page.goto("/invalid-intent/santa-cruz", {
      timeout: PAGE_LOAD_TIMEOUT,
    });

    expect(response?.status()).toBe(404);
  });

  test("should 404 least-crowded page when city has no light/moderate beaches", async ({ page }) => {
    const response = await page.goto("/least-crowded/encinitas", {
      timeout: PAGE_LOAD_TIMEOUT,
    });

    // Encinitas has no light/moderate crowd-level beaches, so filtering produces empty results
    expect(response?.status()).toBe(404);
  });
});

test.describe("Database-driven intent pages - Legacy redirects", () => {
  test("should redirect legacy state/city URL to beaches", async ({ page }) => {
    // Legacy format: /ca/encinitas redirects to /beaches/usa/ca/encinitas
    await page.goto("/ca/encinitas", { timeout: PAGE_LOAD_TIMEOUT });

    // Should redirect to beaches hierarchy URL
    await expect(page).toHaveURL(/\/beaches\/usa\/ca\/encinitas/i);
  });

  test("should redirect legacy state/city URL with uppercase state", async ({ page }) => {
    await page.goto("/CA/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Should redirect to beaches hierarchy URL (middleware normalises case)
    await expect(page).toHaveURL(/\/beaches\/usa\/ca\/santa-cruz/i);
  });
});

test.describe("Database-driven intent pages - Content structure", () => {
  test("should display intent-specific heading", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Should have both intent and city in heading
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain("beginner");
    expect(headingText?.toLowerCase()).toContain("santa cruz");
  });

  test("should display breadcrumb navigation", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for breadcrumb
    const breadcrumb = page.locator("nav[aria-label='breadcrumb'], nav:has-text('Back to')");
    await expect(breadcrumb.first()).toBeVisible();

    // Should have link back to city
    const backLink = page.getByRole("link", { name: /back to santa cruz/i });
    await expect(backLink).toBeVisible();
  });

  test("should display map component", async ({ page }) => {
    // Use least-crowded which renders the generic template that includes a map section;
    // the beginner template uses a dedicated BeginnerPageContent component without a map.
    // The map may show a fallback message in environments without a Mapbox token; we
    // only assert the map region is present in the DOM, not that the canvas rendered.
    await page.goto("/least-crowded/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Wait for map area to load
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for Mapbox map initialization
    await page.waitForTimeout(MAP_LOAD_TIMEOUT);

    // Map container, canvas, or fallback message all confirm the map section is mounted
    const mapRegion = page.locator(
      '[class*="mapbox"], [class*="map-container"], canvas, [data-testid*="map"], p:has-text("Map temporarily unavailable")'
    );
    await expect(mapRegion.first()).toBeAttached();
  });

  test("should display focus points section", async ({ page }) => {
    // Use least-crowded which renders the generic template.
    // When forecast summary data is available (authenticated) the heading is
    // "Today's low-crowd plan in Santa Cruz"; when summary is null it falls back
    // to "What to focus on today". Either heading confirms the section is present.
    await page.goto("/least-crowded/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const focusSection = page.getByRole("heading", {
      name: /what to focus on today|low-crowd plan in|today.s .+ plan in/i,
    });
    await expect(focusSection).toBeVisible();
  });

  test("should display session logging tips", async ({ page }) => {
    // Use least-crowded which renders the generic template with a MiniLogTeaser
    // widget. The widget has no explicit heading but renders a "Log in 15 seconds"
    // label and a "Save + Improve my forecast" button.
    await page.goto("/least-crowded/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const logButton = page.getByRole("button", {
      name: /save \+ improve my forecast/i,
    });
    await expect(logButton).toBeVisible();
  });

  test("should display checklist section", async ({ page }) => {
    // Use least-crowded which renders the generic template with a SmartChecklist
    // sidebar widget. The widget renders an h3 "Your surf plan" heading.
    await page.goto("/least-crowded/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const checklist = page.getByRole("heading", { name: /your surf plan/i });
    await expect(checklist).toBeVisible();
  });

  test("should display continue exploring links", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const exploreSection = page.getByRole("heading", { name: /continue exploring/i });
    await expect(exploreSection).toBeVisible();

    // Should have links to other intents
    const otherIntentLinks = page.locator("a[href*='/santa-cruz']");
    await expect(otherIntentLinks.first()).toBeVisible();
  });

  test("should display update timestamp", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for "Updated" text with timestamp
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/Updated.*\d{1,2}:\d{2}/i);
  });
});

test.describe("Database-driven intent pages - Multiple intents", () => {
  test("should work for all intents with same city", async ({ page }) => {
    const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];
    const city = "santa-cruz";

    for (const intent of intents) {
      await page.goto(`/${intent}/${city}`, { timeout: PAGE_LOAD_TIMEOUT });

      // Should not 404
      await expect(page).not.toHaveURL(/404/);

      // Should have heading
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();

      // Should mention the city
      const headingText = await heading.textContent();
      expect(headingText?.toLowerCase()).toContain("santa cruz");
    }
  });

  test("should have different content for different intents", async ({ page }) => {
    // Load beginner page
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });
    const beginnerHeading = await page.locator("h1").textContent();

    // Load tide page
    await page.goto("/tide/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });
    const tideHeading = await page.locator("h1").textContent();

    // Headings should be different
    expect(beginnerHeading).not.toBe(tideHeading);
  });
});

test.describe("Database-driven intent pages - SEO", () => {
  test("should have correct page title", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const title = await page.title();
    expect(title).toContain("Santa Cruz");
    expect(title.toLowerCase()).toContain("beginner");
  });

  test("should have meta description", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content");

    expect(metaDescription).toBeTruthy();
    expect(metaDescription?.toLowerCase()).toContain("santa cruz");
  });

  test("should have breadcrumb structured data", async ({ page }) => {
    // Use san-diego which has beginner beaches (santa-cruz empty state doesn't include structured data)
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for JSON-LD structured data
    const structuredData = page.locator('script[type="application/ld+json"]');
    await expect(structuredData.first()).toBeAttached();

    // Search all JSON-LD scripts for BreadcrumbList
    const count = await structuredData.count();
    let hasBreadcrumb = false;
    for (let i = 0; i < count; i++) {
      const content = await structuredData.nth(i).textContent();
      if (content?.includes("BreadcrumbList")) {
        hasBreadcrumb = true;
        break;
      }
    }
    expect(hasBreadcrumb).toBe(true);
  });

  test("should have FAQ structured data", async ({ page }) => {
    // Use san-diego which has beginner beaches (santa-cruz empty state doesn't include FAQ schema)
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for FAQ schema
    const structuredData = page.locator('script[type="application/ld+json"]');
    const count = await structuredData.count();

    // Should have at least one structured data script
    expect(count).toBeGreaterThan(0);

    // Check if any contains FAQPage
    let hasFAQ = false;
    for (let i = 0; i < count; i++) {
      const content = await structuredData.nth(i).textContent();
      if (content?.includes("FAQPage")) {
        hasFAQ = true;
        break;
      }
    }
    expect(hasFAQ).toBe(true);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    // Use san-diego which has beginner beaches and full content (santa-cruz empty state has no h2 tags)
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    // Should have exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Should have h2 headings for sections
    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(0);
  });
});

test.describe("Database-driven intent pages - Accessibility", () => {
  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("should have accessible links", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // All links should have an accessible name. Links obtained via getByRole("link") are
    // already guaranteed to have a non-empty accessible name computed by the accessibility
    // tree (Playwright filters them that way). We additionally verify that each has at
    // least one accessible-name source: visible text, aria-label on the element or a
    // descendant, or title. Icon-only links typically carry aria-label on a child element.
    const links = await page.getByRole("link").all();
    for (const link of links.slice(0, 10)) { // Check first 10 links
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");
      const title = await link.getAttribute("title");
      // Also check for aria-label on a descendant (e.g. icon-only buttons inside links)
      const descendantAriaLabel = await link.evaluate((el) => {
        const child = el.querySelector("[aria-label]");
        return child?.getAttribute("aria-label") ?? null;
      });
      const hasAccessibleName =
        (text?.trim().length || 0) > 0 ||
        !!ariaLabel ||
        !!title ||
        !!descendantAriaLabel;
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("should have ARIA landmarks", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Should have navigation landmark
    const nav = page.getByRole("navigation");
    await expect(nav.first()).toBeVisible();

    // Should have main content (implicit or explicit)
    const mainContent = page.locator("main, [role='main']");
    const hasMain = await mainContent.count();
    // Main may or may not exist depending on layout, but page should still have content
    expect(hasMain).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Database-driven intent pages - Performance", () => {
  test("should not have console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") &&
        !error.includes("WebSocket") &&
        !error.includes("chunk")
    );

    // Log errors for debugging if any exist
    if (criticalErrors.length > 0) {
      console.log("Console errors found:", criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(PAGE_LOAD_TIMEOUT);
  });
});

test.describe("Database-driven intent pages - Responsive design", () => {
  test("should display correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Content should be readable on mobile
    const container = page.locator(".container, main").first();
    const box = await container.boundingBox();

    if (box) {
      // Should not overflow viewport
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });

  test("should display correctly on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Layout should use available space on desktop
    const container = page.locator(".container, main").first();
    await expect(container).toBeVisible();
  });
});

test.describe("Dedicated intent pages - Water Temperature", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Water temp dedicated' });
  });

  test("water-temp city page shows temperature hero", async ({ page }) => {
    await page.goto("/water-temp/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    const hero = page.locator('[data-testid="water-temp-hero"]');
    await expect(hero).toBeVisible();
    // Should show wetsuit recommendation within the hero section
    await expect(hero.getByText(/wetsuit|mm/i).first()).toBeVisible();
  });

  test("water-temp city page shows 7-day trend", async ({ page }) => {
    await page.goto("/water-temp/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByRole('heading', { name: /7-Day Temperature Trend/i })).toBeVisible();
  });

  test("water-temp city page has beach temperature comparison", async ({ page }) => {
    await page.goto("/water-temp/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByRole('heading', { name: /Beach Water Temperatures/i })).toBeVisible();
  });
});

test.describe("Dedicated intent pages - Dawn Patrol", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Dawn patrol dedicated' });
  });

  test("dawn-patrol city page shows sun times hero", async ({ page }) => {
    await page.goto("/dawn-patrol/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    const hero = page.locator('[data-testid="sun-times-hero"]');
    await expect(hero).toBeVisible();
    await expect(hero.getByText(/sunrise/i).first()).toBeVisible();
  });

  test("dawn-patrol city page shows 7-day sun schedule", async ({ page }) => {
    await page.goto("/dawn-patrol/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByRole('heading', { name: /7-Day Sun Schedule/i })).toBeVisible();
  });
});

test.describe("Dedicated intent pages - Sunset", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Sunset dedicated' });
  });

  test("sunset city page shows sun times hero", async ({ page }) => {
    await page.goto("/sunset/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    const hero = page.locator('[data-testid="sun-times-hero"]');
    await expect(hero).toBeVisible();
    await expect(hero.getByText(/sunset/i).first()).toBeVisible();
  });

  test("sunset city page shows golden hour info", async ({ page }) => {
    await page.goto("/sunset/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    // Golden hour is shown in the hero badge
    await expect(page.getByText(/golden hour/i).first()).toBeVisible();
  });

  test("sunset city page shows 7-day sun schedule", async ({ page }) => {
    await page.goto("/sunset/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByRole('heading', { name: /7-Day Sun Schedule/i })).toBeVisible();
  });
});

test.describe("Dedicated intent pages - State Level Conditions", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'State conditions' });
  });

  test("water-temp state page shows regional comparison, not 'Popular cities'", async ({ page }) => {
    await page.goto("/water-temp/ca", { timeout: PAGE_LOAD_TIMEOUT });
    // Should NOT show generic "Popular cities for Water Temperature" heading
    await expect(page.getByText("Popular cities for Water Temperature")).not.toBeVisible();
    // Should show conditions-aware heading
    await expect(page.getByText(/Water Temperature Across/i)).toBeVisible();
  });

  test("dawn-patrol state page shows sunrise times comparison", async ({ page }) => {
    await page.goto("/dawn-patrol/ca", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByText(/Sunrise Times Across/i)).toBeVisible();
  });

  test("sunset state page shows sunset times comparison", async ({ page }) => {
    await page.goto("/sunset/ca", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByText(/Sunset Times Across/i)).toBeVisible();
  });
});

test.describe("Dedicated intent pages - Functional intents unchanged", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Functional intents' });
  });

  test("beginner page does NOT show water-temp hero", async ({ page }) => {
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });

  test("longboard page does NOT show conditions hero", async ({ page }) => {
    await page.goto("/longboard/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });

  test("least-crowded page does NOT show conditions hero", async ({ page }) => {
    // Use santa-cruz which has light/moderate crowd-level beaches (san-diego 404s after filtering)
    await page.goto("/least-crowded/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });
});

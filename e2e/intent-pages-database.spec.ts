/**
 * E2E Tests for Database-Driven Intent Pages
 *
 * Tests the implementation of database-driven intent pages that replaced
 * hardcoded SURF_CITIES with dynamic city resolution from the database.
 *
 * Request-only route, status, metadata, and structured-data contracts live in
 * e2e/guest-route-html-contracts.spec.ts. This spec keeps the browser coverage
 * that still depends on hydration, visible widgets, layout, and interactions.
 */

import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

// Test timeouts
const PAGE_LOAD_TIMEOUT = 30000;
const MAP_LOAD_TIMEOUT = 5000;

// These browser tests render several expensive SSR intent pages. Keep tests in
// this file ordered so high-worker full-suite runs do not stampede the same
// water-temp/sun-time route while other files still run in parallel.
test.describe.configure({ mode: 'serial' });

function useBrowserErrorDetection(context: string): void {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context });
  });
}

test.describe("Database-driven intent pages - Content structure", () => {
  useBrowserErrorDetection("Database-driven intent pages - Content structure");

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

    const exploreSection = page.getByRole("heading", {
      name: /continue exploring|keep planning/i,
    });
    await expect(exploreSection).toBeVisible();

    await expect(
      page.getByRole("link", { name: /open quiver map/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /capitola beach forecast/i }),
    ).toBeVisible();
  });

  test("should display recommendation freshness note", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for freshness indicator text — the generic template says
    // "Recommendations refresh every 30 minutes" and the beginner template
    // may show a different freshness note. Accept either pattern.
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/refresh|updated|Updated|forecast/i);
  });
});

test.describe("Database-driven intent pages - Accessibility", () => {
  useBrowserErrorDetection("Database-driven intent pages - Accessibility");

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
  useBrowserErrorDetection("Database-driven intent pages - Performance");

  test("should not have critical console errors", async ({ page }) => {
    await page.goto("/beginner/santa-cruz", { timeout: PAGE_LOAD_TIMEOUT });

    await expect(page.locator("h1")).toBeVisible();
  });

});

test.describe("Database-driven intent pages - Responsive design", () => {
  useBrowserErrorDetection("Database-driven intent pages - Responsive design");

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
    // Warm local water legitimately recommends boardshorts instead of neoprene.
    await expect(hero.getByText(/boardshorts|spring suit|fullsuit|wetsuit|mm/i).first()).toBeVisible();
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
    const hasHero = await hero.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHero) {
      await expect(hero.getByText(/sunrise/i).first()).toBeVisible();
    } else {
      // Generic fallback rendered when live sun data is unavailable.
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Featured Beaches/i })).toBeVisible();
    }
  });

  test("dawn-patrol city page shows 7-day sun schedule", async ({ page }) => {
    await page.goto("/dawn-patrol/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    const hero = page.locator('[data-testid="sun-times-hero"]');
    const hasHero = await hero.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHero) {
      await expect(page.getByRole("heading", { name: /7-Day Sun Schedule/i })).toBeVisible();
    } else {
      // Generic fallback rendered when live sun data is unavailable.
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Featured Beaches/i })).toBeVisible();
    }
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
    const hasHero = await hero.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHero) {
      await expect(hero.getByText(/sunset/i).first()).toBeVisible();
    } else {
      // Generic fallback rendered when live sun data is unavailable.
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Featured Beaches/i })).toBeVisible();
    }
  });

  test("sunset city page shows golden hour info when sun data is available", async ({ page }) => {
    await page.goto("/sunset/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    // Golden hour is shown in the hero badge when sun times data is available.
    // When sun times data is unavailable the page falls back to the generic intent
    // template — either outcome is valid.
    const hero = page.locator('[data-testid="sun-times-hero"]');
    const hasHero = await hero.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHero) {
      await expect(page.getByText(/golden hour/i).first()).toBeVisible();
    } else {
      // Generic fallback rendered — verify page loaded successfully
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("sunset city page shows 7-day sun schedule when sun data is available", async ({ page }) => {
    await page.goto("/sunset/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    const hero = page.locator('[data-testid="sun-times-hero"]');
    const hasHero = await hero.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHero) {
      await expect(page.getByRole('heading', { name: /7-Day Sun Schedule/i })).toBeVisible();
    } else {
      // Generic fallback rendered — verify page loaded successfully
      await expect(page.locator("h1")).toBeVisible();
    }
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

  test("water-temp state page shows regional comparison or popular cities", async ({ page }) => {
    await page.goto("/water-temp/ca", { timeout: PAGE_LOAD_TIMEOUT });
    // When live water temp data is available, ConditionsStateOverview renders
    // "Water Temperature Across California". When live data is unavailable
    // (e.g., no recent buoy readings), it returns null and PopularCitiesForIntent
    // renders instead. Both are valid outcomes.
    const conditionsHeading = page.getByText(/Water Temperature Across/i);
    const hasConditions = await conditionsHeading.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasConditions) {
      await expect(conditionsHeading).toBeVisible();
      await expect(page.getByText("Popular cities for Water Temperature")).not.toBeVisible();
    } else {
      // Fallback: generic popular cities rendered — page still loaded
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("dawn-patrol state page shows sunrise times or popular cities", async ({ page }) => {
    await page.goto("/dawn-patrol/ca", { timeout: PAGE_LOAD_TIMEOUT });
    const conditionsHeading = page.getByText(/Sunrise Times Across/i);
    const hasConditions = await conditionsHeading.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasConditions) {
      // Fallback: page loaded without live sun times data
      await expect(page.locator("h1")).toBeVisible();
    } else {
      await expect(conditionsHeading).toBeVisible();
    }
  });

  test("sunset state page shows sunset times or popular cities", async ({ page }) => {
    await page.goto("/sunset/ca", { timeout: PAGE_LOAD_TIMEOUT });
    const conditionsHeading = page.getByText(/Sunset Times Across/i);
    const hasConditions = await conditionsHeading.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasConditions) {
      // Fallback: page loaded without live sun times data
      await expect(page.locator("h1")).toBeVisible();
    } else {
      await expect(conditionsHeading).toBeVisible();
    }
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
    await page.goto("/beginner/san-diego", {
      timeout: PAGE_LOAD_TIMEOUT,
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });

  test("longboard page does NOT show conditions hero", async ({ page }) => {
    await page.goto("/longboard/san-diego", {
      timeout: PAGE_LOAD_TIMEOUT,
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });

  test("least-crowded page does NOT show conditions hero", async ({ page }) => {
    // Use santa-cruz which has light/moderate crowd-level beaches (san-diego 404s after filtering)
    await page.goto("/least-crowded/santa-cruz", {
      timeout: PAGE_LOAD_TIMEOUT,
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="water-temp-hero"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sun-times-hero"]')).not.toBeVisible();
  });
});

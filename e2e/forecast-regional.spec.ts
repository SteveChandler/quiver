/**
 * E2E tests for Regional Forecast Pages
 *
 * Tests the detailed regional forecast pages at /forecast/[region]
 * (e.g., /forecast/san-diego, /forecast/southern-california)
 *
 * @project auth
 */

/* eslint-disable playwright/no-conditional-in-test -- Existing regional forecast checks branch around data-dependent sections that may or may not render. */

import { test, expect } from "@playwright/test";
import { waitForPageLoad, dismissOnboardingWizard } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";
import { TIMEOUTS } from "./fixtures/test-data";

test.describe("Regional Forecast Pages", () => {
  // Test with San Diego region as representative example
  const testRegion = "san-diego";
  const testRegionName = "San Diego";
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto(`/forecast/${testRegion}`);
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);
  });

  test("should load and display region name in title", async ({ page }) => {
    // Check hero heading contains region name
    const heading = page.getByRole("heading", {
      name: new RegExp(`${testRegionName}.*Surf Forecast`, "i"),
      level: 1,
    });
    await expect(heading).toBeVisible();

    // Check subtitle mentions 7-day outlook
    await expect(page.getByText(/7-day outlook.*Updated hourly/i)).toBeVisible();
  });

  test("should display breadcrumb navigation", async ({ page }) => {
    // Check for back link to forecast hub (first occurrence in nav)
    const backLink = page.locator('nav a[href="/forecast"]').first();
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText(/All Forecasts/i);
  });

  test("should display current date", async ({ page }) => {
    // Check that the date element is visible
    const dateElement = page.locator("time");
    await expect(dateElement).toBeVisible();

    // Verify it has a datetime attribute (ISO format)
    const datetime = await dateElement.getAttribute("datetime");
    expect(datetime).toBeTruthy();
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test("should display regional statistics", async ({ page }) => {
    // Check for beach count stat
    await expect(
      page.getByText(/beaches with data/i)
    ).toBeVisible();

    // Average score should be visible if data exists
    const scoreText = page.getByText(/Average Score/i);
    if (await scoreText.isVisible()) {
      // If score is shown, it should be a number/100
      await expect(page.getByText(/\/100/)).toBeVisible();
    }
  });

  test("should display Best Days section", async ({ page }) => {
    // Check section heading
    const heading = page.getByRole("heading", {
      name: new RegExp(`Best Days to Surf ${testRegionName}`, "i"),
      level: 2,
    });
    await expect(heading).toBeVisible();

    // Check for score badges (circular elements with scores)
    const scoreBadges = page.locator('[class*="rounded-full"][class*="font-bold"]').filter({
      hasText: /^\d+$/,
    });
    await expect(scoreBadges.first()).toBeVisible();
  });

  test("best day card should show detailed conditions", async ({ page }) => {
    // Wait for Best Days section to load
    await expect(
      page.getByRole("heading", {
        name: new RegExp(`Best Days to Surf`, "i"),
      })
    ).toBeVisible();

    // Check for "Best Day This Week" badge
    await expect(page.getByText(/Best Day This Week/i)).toBeVisible();

    // Check for wave height display (format: "X-Yft" or "Xft")
    await expect(page.getByText(/\d+(\.\d+)?(-\d+(\.\d+)?)?ft/).first()).toBeVisible();

    // Check for wind condition text in visible elements
    const windConditions = ["Offshore", "Light", "Onshore"];
    let windFound = false;
    for (const condition of windConditions) {
      const elements = page.getByText(condition, { exact: true });
      const count = await elements.count();
      if (count > 0) {
        windFound = true;
        break;
      }
    }
    expect(windFound).toBe(true);
  });

  test("should display Upcoming Swells section if swells exist", async ({ page }) => {
    // Swells may not always exist, so make this conditional
    const swellsSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Upcoming Swells/i }),
    }).first();

    if (await swellsSection.isVisible()) {
      // If swells section exists, check for swell details
      await expect(
        swellsSection.getByRole("heading", { name: /Upcoming Swells/i })
      ).toBeVisible();

      // Check for wave height indicators
      await expect(swellsSection.getByText(/\d+-\d+ft/).first()).toBeVisible();

      // Check for swell period
      await expect(swellsSection.getByText(/^\d+s$/).first()).toBeVisible();
    } else {
      // If no swells, check for empty state message
      const emptyMessage = page.getByText(/No significant swells/i);
      if (await emptyMessage.isVisible()) {
        await expect(emptyMessage).toBeVisible();
      }
    }
  });

  test("should display Beach Conditions Grid", async ({ page }) => {
    // Check section heading
    await expect(
      page.getByRole("heading", { name: /Beach Conditions/i, level: 2 })
    ).toBeVisible();

    // Check subtitle
    await expect(
      page.getByText(/Current conditions ranked by surf quality/i)
    ).toBeVisible();

    // On desktop, check for table headers
    const tableHeader = page.locator("table thead");
    if (await tableHeader.isVisible()) {
      await expect(page.getByRole("columnheader", { name: /Beach/i })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: /Score/i })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: /Wave Height/i })).toBeVisible();
    }

    // Check that at least one beach is listed
    const beachLinks = page.getByRole("link", { name: /Beach$/i });
    await expect(beachLinks.first()).toBeVisible();
  });

  test("beach condition row should link to beach detail", async ({ page }) => {
    // Wait for beach conditions to load
    await expect(
      page.getByRole("heading", { name: /Beach Conditions/i })
    ).toBeVisible();

    // Get first beach link. Beach detail pages use the
    // /[stateSlug]/[city]/[beachSlug] route — the legacy /beach/ prefix
    // was retired. Match the 2-letter state slug pattern.
    const firstBeachLink = page
      .locator('a[href^="/ca/"], a[href^="/fl/"], a[href^="/hi/"]')
      .first();

    await expect(firstBeachLink).toBeVisible();

    // Verify href format: /[stateSlug]/[city]/[beachSlug]
    const href = await firstBeachLink.getAttribute("href");
    expect(href).toMatch(/^\/[a-z]{2}\/[^/]+\/[^/]+/);
  });

  test("should display trend indicators", async ({ page }) => {
    // Wait for beach conditions
    await expect(
      page.getByRole("heading", { name: /Beach Conditions/i })
    ).toBeVisible();

    // Check for trend text (Improving, Steady, or Declining) - check count first
    const trendIndicators = ["Improving", "Steady", "Declining"];
    let trendFound = false;

    for (const trend of trendIndicators) {
      const elements = page.getByText(trend, { exact: true });
      const count = await elements.count();
      if (count > 0) {
        trendFound = true;
        break;
      }
    }

    expect(trendFound).toBe(true);
  });

  test("should display cross-links section", async ({ page }) => {
    // Check section heading
    await expect(
      page.getByRole("heading", { name: /Explore More/i, level: 2 })
    ).toBeVisible();

    // Check link to regional guide
    const guideLink = page.getByRole("link", {
      name: new RegExp(`${testRegionName}.*Surf Guide`, "i"),
    });
    await expect(guideLink).toBeVisible();

    // Check link back to forecast hub
    const hubLink = page.getByRole("link", {
      name: /Other Regional Forecasts/i,
    });
    await expect(hubLink).toBeVisible();
    await expect(hubLink).toHaveAttribute("href", "/forecast");
  });

  test("should display CTA section", async ({ page }) => {
    // Check CTA heading
    await expect(
      page.getByRole("heading", {
        name: new RegExp(`Unlock ${testRegionName} Insights`, "i"),
      })
    ).toBeVisible();

    // Check for sign up button
    const signUpButton = page.getByRole("link", { name: /Sign Up for Free/i });
    await expect(signUpButton).toBeVisible();
    await expect(signUpButton).toHaveAttribute("href", "/auth/sign-up");
  });

  test("should have proper JSON-LD structured data", async ({ page }) => {
    // Check for WebPage schema - get all JSON-LD scripts and find the WebPage one
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const count = await jsonLdScripts.count();
    expect(count).toBeGreaterThan(0);

    let webPageData = null;
    for (let i = 0; i < count; i++) {
      const content = await jsonLdScripts.nth(i).textContent();
      if (content) {
        const data = JSON.parse(content);
        if (data["@type"] === "WebPage") {
          webPageData = data;
          break;
        }
      }
    }

    expect(webPageData).toBeTruthy();
    expect(webPageData!["@context"]).toBe("https://schema.org");
    expect(webPageData!["@type"]).toBe("WebPage");
    expect(webPageData!.name).toContain(testRegionName);
    expect(webPageData!.breadcrumb).toBeTruthy();
    expect(webPageData!.breadcrumb["@type"]).toBe("BreadcrumbList");
  });

  test("should navigate to regional guide when clicking guide link", async ({
    page,
  }) => {
    const guideLink = page.getByRole("link", {
      name: new RegExp(`${testRegionName}.*Surf Guide.*→`, "i"),
    });

    await expect(guideLink).toHaveAttribute("href", /\/guides\/surfing-/);
    await guideLink.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/guides\/surfing-/, { timeout: 30000 }),
      guideLink.click(),
    ]);
    await waitForPageLoad(page);
  });

  test("should navigate back to forecast hub", async ({ page }) => {
    // Click the back link (first occurrence in nav)
    const backLink = page.locator('nav a[href="/forecast"]').first();
    await backLink.scrollIntoViewIfNeeded();
    await backLink.click();

    // Wait for client-side navigation to the hub page (16 regions = heavier load)
    await page.waitForURL(/\/forecast$/, { timeout: 30000 });
    await page.waitForLoadState("load");

    // Should be on forecast hub
    await expect(page).toHaveURL("/forecast");
    // Hub h1 is the dynamic regional call hero headline (post-redesign).
    // Use the stable id rather than a fixed text match.
    await expect(
      page.locator("h1#regional-call-hero-heading")
    ).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.reload();
    await waitForPageLoad(page);

    // Check that content is still visible
    await expect(
      page.getByRole("heading", {
        name: new RegExp(`${testRegionName}.*Surf Forecast`, "i"),
      })
    ).toBeVisible();

    // On mobile, beach conditions should use card view (not table).
    // Beach detail links use /[stateSlug]/[city]/[beachSlug] (legacy
    // /beach/ prefix was retired).
    const beachCards = page.locator('[class*="Card"]').filter({
      has: page.locator('a[href^="/ca/"], a[href^="/fl/"], a[href^="/hi/"]'),
    });

    if (await beachCards.first().isVisible()) {
      await expect(beachCards.first()).toBeVisible();
    }
  });
});

test.describe("Regional Forecast - Multiple Regions", () => {
  const regions = [
    { slug: "southern-california", name: "Southern California" },
    { slug: "orange-county", name: "Orange County" },
    { slug: "los-angeles", name: "Los Angeles" },
    { slug: "northern-california", name: "Northern California" },
    { slug: "puerto-rico", name: "Puerto Rico" },
  ];

  for (const region of regions) {
    test(`should load ${region.name} forecast page`, async ({ page }) => {
      const errorCapture = setupErrorDetection(page);
      await page.goto(`/forecast/${region.slug}`);
      await waitForPageLoad(page);
      await dismissOnboardingWizard(page);

      // Check that region name appears in heading (with increased timeout for slow regions)
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`${region.name}.*Surf Forecast`, "i"),
          level: 1,
        })
      ).toBeVisible({ timeout: TIMEOUTS.long });

      // Check that Best Days section exists
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`Best Days to Surf`, "i"),
        })
      ).toBeVisible({ timeout: TIMEOUTS.medium });

      // No errors during page load
      await assertNoErrors(page, errorCapture, {
        context: `${region.name} forecast page load`,
      });
    });
  }
});

test.describe("Regional Forecast - Error Handling", () => {
  test("should show 404 for invalid region", async ({ page }) => {
    await page.goto("/forecast/nonexistent-region");

    // Should show 404 page — custom 404 heading is "Caught inside."
    await expect(
      page.getByRole("heading", { name: /Caught inside/i })
    ).toBeVisible();
  });
});

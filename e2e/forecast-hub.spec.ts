/**
 * E2E tests for Forecast Hub Landing Page
 *
 * Tests the repositioned /forecast page: anonymous regional Oracle that
 * narrows to one region (via `?region=`, IP cookie, or default) instead of
 * listing all 17.
 *
 * @project auth
 */

import { test, expect } from "./fixtures/auth-fixture";
import { waitForPageLoad, dismissOnboardingWizard } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";
import { TIMEOUTS } from "./fixtures/test-data";

test.describe("Forecast Hub (Regional Oracle)", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test("loads and paints the default region on first byte", async ({ page }) => {
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    // Hero paints immediately (no ScrollReveal-induced empty void)
    const hero = page.getByTestId("regional-call-hero");
    await expect(hero).toBeVisible();

    // H1 is the computed regional call — contains the default region name
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const h1Text = (await h1.textContent()) ?? "";
    // Default is Southern California (largest user base) when no cookie
    expect(h1Text).toMatch(/Southern California|California|Hawaii|Oregon|Florida|San Diego|Orange County|Los Angeles|Santa Cruz|Ventura|Puerto Rico|New York|New Jersey|Outer Banks|Washington|Northern California|Baja/);
  });

  test("`?region=hawaii` drives hero copy and primary CTA href", async ({ page }) => {
    await page.goto("/forecast?region=hawaii");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/Hawaii/);

    const primaryCta = page.getByTestId("primary-cta");
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/forecast/hawaii");
  });

  test("`?region=southern-california` routes to the SoCal-specific page", async ({
    page,
  }) => {
    await page.goto("/forecast?region=southern-california");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const h1 = page.locator("h1");
    await expect(h1).toContainText(/Southern California/);

    const primaryCta = page.getByTestId("primary-cta");
    await expect(primaryCta).toHaveAttribute("href", "/forecast/southern-california");
  });

  test("anonymous visitor sees the signup CTA", async ({ page }) => {
    // Spec runs in the [auth] project, but this assertion is anon-only —
    // clear cookies so the authed-CTA variant doesn't render instead.
    await page.context().clearCookies();
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const signupCta = page.getByTestId("signup-cta");
    await expect(signupCta).toBeVisible();
    await expect(signupCta).toHaveAttribute("href", "/auth/sign-up");

    // The "authed" variant should NOT be present on this anonymous page
    const authedCta = page.getByTestId("authed-cta");
    await expect(authedCta).toHaveCount(0);
  });

  test("no sparkline decorations anywhere on the page", async ({ page }) => {
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    // Old card grid used WaveSparkline; new design has zero sparklines
    const sparklines = page.locator('[data-testid*="sparkline"], [aria-label*="sparkline" i]');
    await expect(sparklines).toHaveCount(0);
  });

  test("'Going elsewhere?' strip shows the OTHER regions (not the active one)", async ({
    page,
  }) => {
    await page.goto("/forecast?region=hawaii");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const strip = page.getByTestId("other-regions-strip");
    await expect(strip).toBeVisible();

    // Active region (Hawaii) must NOT appear as a chip
    const hawaiiChip = strip.locator('[data-testid="other-region-chip-hawaii"]');
    await expect(hawaiiChip).toHaveCount(0);

    // At least 4 other regions should be chipped
    const chips = strip.locator('[data-testid^="other-region-chip-"]');
    expect(await chips.count()).toBeGreaterThanOrEqual(4);
  });

  test("best windows section and seven-day outlook both render", async ({ page }) => {
    await page.goto("/forecast?region=southern-california");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const bestWindows = page.getByTestId("regional-best-surf-windows");
    await expect(bestWindows).toBeVisible();
    await expect(
      bestWindows.getByRole("heading", { name: /best windows this week/i })
    ).toBeVisible();

    const outlook = page.getByTestId("seven-day-outlook");
    await expect(outlook).toBeVisible();

    // Heading is always present regardless of data availability. Component
    // copy is "7-Day Region Outlook" — match the variable middle word.
    await expect(
      outlook.getByRole("heading", { name: /7-Day.*Outlook/i })
    ).toBeVisible();

    // Either day rows render OR the empty-state message renders. We assert
    // that at most 7 day rows exist (never more) — this works whether the
    // count is 0 (empty state) or N <= 7 (data present).
    const dayRows = outlook.locator('[data-testid^="outlook-day-"]');
    expect(await dayRows.count()).toBeLessThanOrEqual(7);
  });

  test("uses the wide desktop space for the beach leaderboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecast?region=san-diego");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const outlook = page.getByTestId("seven-day-outlook");
    const topSpots = page.getByTestId("forecast-top-spots-panel");
    await expect(outlook).toBeVisible();
    await expect(topSpots).toBeVisible();

    const outlookBox = await outlook.boundingBox();
    const topSpotsBox = await topSpots.boundingBox();

    expect(outlookBox).not.toBeNull();
    expect(topSpotsBox).not.toBeNull();
    expect(topSpotsBox!.x).toBeGreaterThan(
      outlookBox!.x + outlookBox!.width
    );
    expect(Math.abs(topSpotsBox!.y - outlookBox!.y)).toBeLessThan(80);
  });

  test("has SEO metadata and WebPage structured data (regression guard)", async ({
    page,
  }) => {
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    await expect(page).toHaveTitle(/Surf Forecast.*Quiver/i);

    const metaDescription = page.locator('meta[name="description"]');
    const description = await metaDescription.getAttribute("content");
    expect(description).toMatch(/forecast/i);

    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const scripts = await jsonLd.all();
    const parsedSchemas = await Promise.all(
      scripts.map(async (s) => (await s.textContent()) ?? "")
    );
    const webPageSchema = parsedSchemas
      .filter((c) => c.includes('"@type":"WebPage"'))
      .map((c) => JSON.parse(c))[0];

    expect(webPageSchema).toBeTruthy();
    expect(webPageSchema["@context"]).toBe("https://schema.org");
    expect(webPageSchema.url).toContain("/forecast");
  });

  test("navigates from primary CTA to the regional forecast page", async ({
    page,
  }) => {
    await page.goto("/forecast?region=florida");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const primaryCta = page.getByTestId("primary-cta");
    await expect(primaryCta).toBeVisible({ timeout: TIMEOUTS.medium });

    await primaryCta.click();
    await waitForPageLoad(page);

    await page.waitForURL((url) => url.pathname === "/forecast/florida", {
      timeout: TIMEOUTS.medium,
    });
    expect(page.url()).toContain("/forecast/florida");

    await assertNoErrors(page, errorCapture, {
      context: "Primary CTA navigation",
    });
  });

  test("is usable on mobile (390px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    // Hero + outlook + other-regions strip all visible, single column
    await expect(page.getByTestId("regional-call-hero")).toBeVisible();
    await expect(page.getByTestId("seven-day-outlook")).toBeVisible();
    await expect(page.getByTestId("other-regions-strip")).toBeVisible();

    // Exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("bottom CTA exists with region-aware copy (anonymous variant)", async ({
    page,
  }) => {
    // Anon-only assertion — see note on the signup CTA test above.
    await page.context().clearCookies();
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);

    const bottomCta = page.getByTestId("forecast-bottom-cta");
    await expect(bottomCta).toBeVisible();
    // Anon copy was rewritten — "regional call" is gone, but the home-beach
    // signup framing is the load-bearing assertion.
    await expect(bottomCta).toContainText(/home beach/i);
    await expect(bottomCta).toContainText(/sign up/i);

    const bottomLink = bottomCta.getByRole("link", { name: /home beach/i });
    await expect(bottomLink).toHaveAttribute("href", "/auth/sign-up");
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Test cleanup" });
  });
});

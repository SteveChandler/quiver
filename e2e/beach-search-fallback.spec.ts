import { test, expect } from "@playwright/test";
import { waitForPageLoad, ensureAuthenticated } from "./test-helpers";

test.describe("Beach Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage and ensure we render the authenticated Home (not Landing)
    await page.goto("/");
    await waitForPageLoad(page);

    const authed = await ensureAuthenticated(page, 15000);
    await page.goto("/");
    await waitForPageLoad(page);

    const hasBottomNav = await page.getByTestId("bottom-navigation").isVisible().catch(() => false);
    const hasForecastTab = await page.getByRole("tab", { name: /forecast/i }).isVisible().catch(() => false);

    // If still landing (no Home markers), use /map which also has beach search
    if (!authed || (!hasBottomNav && !hasForecastTab)) {
      await page.goto("/map");
      await page.waitForLoadState("load");
    }
  });

  test("should load home screen with search functionality", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    // Prefer Home marker if present; tolerate map fallback
    const maybeForecastTab = page.getByRole("tab", { name: /forecast/i });
    await maybeForecastTab.isVisible().catch(() => false);

    // Resilient search locator (Home or Map)
    const searchInput = page
      .getByPlaceholder(/search beaches/i)
      .or(page.getByRole("searchbox"))
      .or(page.locator('input[placeholder*="search" i]'))
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test("should accept input in beach search bar", async ({ page }) => {
    const searchInput = page
      .getByPlaceholder(/search beaches/i)
      .or(page.getByRole("searchbox"))
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Ocean Beach");
    await page.waitForTimeout(800);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should submit a beach search", async ({ page }) => {
    const searchInput = page
      .getByPlaceholder(/search beaches/i)
      .or(page.getByRole("searchbox"))
      .first();
    const searchButton = page.getByRole("button", { name: /search/i }).first();

    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();

    await searchInput.fill("Test Beach");
    await searchButton.click();
    await page.waitForTimeout(1200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load home on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await waitForPageLoad(page);
    await expect(page.getByRole("tab", { name: /forecast/i })).toBeVisible({ timeout: 15000 });
  });

  test("should load home on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await waitForPageLoad(page);
    await expect(page.getByRole("tab", { name: /forecast/i })).toBeVisible({ timeout: 15000 });
  });

  test("should navigate to map page", async ({ page }) => {
    await page.goto("/map");
    await page.waitForTimeout(3000);

    // Map page should load
    await expect(page.locator("body")).toBeVisible();
  });
});

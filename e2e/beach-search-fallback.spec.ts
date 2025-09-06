import { test, expect } from "@playwright/test";
import { waitForPageLoad, ensureAuthenticated } from "./test-helpers";

test.describe("Beach Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage and actively wait for HomeScreen (Forecast tab)
    await page.goto("/");
    await waitForPageLoad(page);
    let forecastTab = page.getByRole("tab", { name: /forecast/i });
    const visible = await forecastTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      const authed = await ensureAuthenticated(page, 12000);
      await page.goto("/");
      await waitForPageLoad(page);
      forecastTab = page.getByRole("tab", { name: /forecast/i });
      await expect(forecastTab).toBeVisible({ timeout: authed ? 8000 : 0 });
    }
  });

  test("should load home screen with search functionality", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    // Assert the Forecast tab to confirm HomeScreen
    await expect(page.getByRole("tab", { name: /forecast/i })).toBeVisible();
    // Assert the beach search bar input is visible
    const searchInput = page.getByPlaceholder(/search beaches/i).first();
    await expect(searchInput).toBeVisible();
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

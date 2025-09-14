import { test, expect } from "@playwright/test";
import { grantGeolocation } from "./utils/waits";

test.describe("Home - first-time mobile quick wins", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("grant geolocation → see nearby chips → tap chip shows forecast", async ({ page, context }) => {
    await page.goto("/", { waitUntil: "load" });

    // Grant mocked geolocation near Ocean Beach
    await grantGeolocation(page, 32.7503, -117.2534);

    // Expect chips to appear (label text from component)
    await expect(page.getByText("Nearest beaches")).toBeVisible();

    // Click the first chip if present
    const chips = page.locator('button:has-text("Beach")');
    // Fallback: click any chip-like button in the row
    const chipRow = page.locator('div:has-text("Nearest beaches")').locator("..");
    const firstChip = chipRow.locator("button").first();
    await firstChip.click();

    // Forecast tab content should render (uses data-testid)
    await expect(page.locator('[data-testid="forecast-tab"]')).toBeVisible();
  });
});



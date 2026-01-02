import { test, expect } from "@playwright/test";

test.describe("HI island-specific city pages (Waimea)", () => {
  test("redirects /hi/waimea to /hi/waimea-kauai", async ({ page }) => {
    await page.goto("/hi/waimea");
    await page.waitForURL(/\/hi\/waimea-kauai(?:\?|$)/, { timeout: 15_000 });
    expect(page.url()).toContain("/hi/waimea-kauai");
  });

  test("shows only Kauai Waimea beaches on /hi/waimea-kauai", async ({ page }) => {
    await page.goto("/hi/waimea-kauai");

    // Wait for the city map/list section to render
    await expect(
      page.getByRole("heading", { name: "Featured Beaches" })
    ).toBeVisible({
      timeout: 20_000,
    });

    // Kauai Waimea should include Pakala / Kekaha (Infinities)
    await expect(
      page.getByRole("heading", { name: /kekaha\s*\/\s*pakala/i })
    ).toBeVisible();

    // Big Island Waimea should NOT appear on the Kauai page
    await expect(page.getByText(/hapuna beach/i)).toHaveCount(0);
  });
});



import { test, expect } from "@playwright/test";

test("Beach page shows live cam above forecast and hides Coach Pick", async ({ page }) => {
  await page.goto("/beach/15c7337e-5258-4339-9dc3-c435c666926b");

  // Coach Pick absent
  await expect(page.getByText(/coach pick/i)).toHaveCount(0);

  // Order: Live Cam before Forecast & Tides (Accordion triggers are buttons)
  const liveCam = page.locator('button:has-text("Live Cam")').first();
  const forecast = page.locator('button:has-text("Forecast & Tides")').first();
  await expect(liveCam).toBeVisible();
  await expect(forecast).toBeVisible();
  const liveCamHandle = await liveCam.elementHandle();
  const forecastHandle = await forecast.elementHandle();
  const isBefore = await page.evaluate(([a, b]) =>
    Boolean((a as Element).compareDocumentPosition(b as Element) & Node.DOCUMENT_POSITION_FOLLOWING)
  , [liveCamHandle, forecastHandle]);
  expect(isBefore).toBeTruthy();

  // Player present (iframe or video) OR fallback link
  const player = page.locator("iframe, video");
  const fallback = page.getByRole("link", { name: /open camera/i });
  await expect(player.or(fallback)).toBeVisible();
});



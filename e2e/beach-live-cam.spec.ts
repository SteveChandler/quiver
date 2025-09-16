import { test, expect } from "@playwright/test";

test("Beach page shows live cam above forecast and hides Coach Pick", async ({ page }) => {
  await page.goto("/beach/15c7337e-5258-4339-9dc3-c435c666926b");

  // Coach Pick absent
  await expect(page.getByText(/coach pick/i)).toHaveCount(0);

  // Order: Live Cam before 5 Day Outlook (Accordion triggers are buttons)
  const accordion = page.locator('[data-testid="beach-accordion"]').first();
  const liveCamItem = accordion.locator('[data-testid="accordion-item-cams"]');
  const forecastItem = accordion.locator('[data-testid="accordion-item-forecast"]');
  const liveCam = liveCamItem.locator('button').first();
  const forecast = forecastItem.locator('button').first();
  await expect(liveCam).toBeVisible();
  await expect(forecast).toBeVisible();
  const isBefore = await page.evaluate(([a, b]) =>
    Boolean((a as Element).compareDocumentPosition(b as Element) & Node.DOCUMENT_POSITION_FOLLOWING)
  , [await liveCam.elementHandle(), await forecast.elementHandle()]);
  expect(isBefore).toBeTruthy();

  // Player present (iframe or video) OR fallback link
  // Expand Live Cam to ensure content is in the DOM
  await liveCam.click();
  const player = accordion.locator("iframe, video");
  const fallback = page.getByRole("link", { name: /open camera/i });
  await expect(player.or(fallback)).toBeVisible();
});



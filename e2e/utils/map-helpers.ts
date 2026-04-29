import type { Page } from "@playwright/test";

/**
 * Dismiss the search-first map entry overlay if present.
 *
 * /map ships a search-first overlay above the Mapbox view to convert anonymous
 * traffic that arrives with a specific spot in mind. Tests that interact
 * directly with the map UI need to dismiss it first.
 *
 * Tests can also bypass the overlay by navigating with `?search=...` (the
 * overlay auto-dismisses when the URL carries search intent).
 */
export async function dismissMapEntryOverlay(page: Page): Promise<void> {
  const browseButton = page.getByTestId("map-entry-overlay-browse");
  if (await browseButton.isVisible().catch(() => false)) {
    await browseButton.click();
    await page
      .getByTestId("map-entry-overlay")
      .waitFor({ state: "hidden", timeout: 2000 })
      .catch(() => {});
  }
}

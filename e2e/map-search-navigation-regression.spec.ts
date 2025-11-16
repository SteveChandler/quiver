import { test, expect } from "@playwright/test";
import { TEST_BEACHES, TIMEOUTS } from "./fixtures/test-data";
import { waitForPageLoad } from "./utils/test-helpers";

/**
 * Map Search & Navigation Regression Tests
 *
 * Ensures map-based discovery flows:
 * - Return usable search results for known beaches.
 * - Navigate cleanly from map search / markers to beach detail pages.
 * - Do not emit spatial fallback warnings in the browser console.
 *
 * @project auth
 */

test.describe("Map - Search & Navigation Regression", () => {
  test("map search should find a known beach and navigate to detail without spatial fallback", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto("/map");
    await waitForPageLoad(page);

    const searchInput = page.getByPlaceholder(/search/i).first();
    const hasSearch = await searchInput
      .isVisible({ timeout: TIMEOUTS.medium })
      .catch(() => false);
    expect(hasSearch).toBe(true);

    // Use a stable, environment-aware beach name from fixtures (e.g., Blacks)
    const targetBeachName = TEST_BEACHES.blacks.name;
    await searchInput.fill(targetBeachName);
    await page.waitForTimeout(1000);

    // Search results can use either old format (/beach/) or new hierarchical format (/state/city/beach)
    const resultLink = page
      .getByRole('link')
      .filter({ hasText: new RegExp(targetBeachName, "i") })
      .first();

    const hasResult = await resultLink
      .isVisible({ timeout: TIMEOUTS.long })
      .catch(() => false);
    expect(hasResult).toBe(true);

    await resultLink.click();
    await waitForPageLoad(page);

    // Should navigate to a beach detail page (supports both /beach/ and hierarchical /state/city/beach URLs)
    await expect(page).toHaveURL(/\/(beach\/|[a-z]{2}\/[^/]+\/)/, { timeout: TIMEOUTS.long });

    const detailHeading = page.getByRole("heading", {
      name: new RegExp(targetBeachName, "i"),
    });
    await expect(detailHeading).toBeVisible({ timeout: TIMEOUTS.long });

    const spatialFallbackMessages = consoleMessages.filter((text) =>
      text.includes(
        "Spatial function failed, falling back to client-side filtering"
      )
    );
    expect(spatialFallbackMessages.length).toBe(0);
  });

  test("map markers should be clickable and navigate to beach detail without spatial fallback", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto("/map");
    await waitForPageLoad(page);

    // Markers are rendered via Mapbox with data-testid="beach-marker"
    const markers = page.getByTestId("beach-marker");
    const markerCount = await markers.count();

    // This is a core discovery path; missing markers should fail, not skip
    expect(markerCount).toBeGreaterThan(0);

    const firstMarker = markers.first();
    await firstMarker.click();

    await waitForPageLoad(page);
    // Should navigate to a beach detail page (supports both /beach/ and hierarchical /state/city/beach URLs)
    await expect(page).toHaveURL(/\/(beach\/|[a-z]{2}\/[^/]+\/)/, { timeout: TIMEOUTS.long });

    const spatialFallbackMessages = consoleMessages.filter((text) =>
      text.includes(
        "Spatial function failed, falling back to client-side filtering"
      )
    );
    expect(spatialFallbackMessages.length).toBe(0);
  });
});



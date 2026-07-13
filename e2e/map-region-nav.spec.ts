import { test, expect } from "@playwright/test";
import { TIMEOUTS, VIEWPORTS } from "./fixtures/test-data";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import { dismissMapEntryOverlay } from "./utils/map-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Map toolbar filters", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Map toolbar filters" });
  });

  for (const viewport of [VIEWPORTS.desktop, { width: 390, height: 844 }]) {
    test(`shows filter controls without region shortcuts at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/map");
      await page.waitForLoadState("load");
      await dismissMapEntryOverlay(page);

      await expect(page.getByTestId("map-controls")).toHaveCount(1);
      await expect(
        page.getByRole("combobox", {
          name: "Search beaches, spots, or cities",
        }),
      ).toBeVisible({ timeout: TIMEOUTS.medium });

      await page.getByRole("button", { name: "Filters" }).click();

      await expect(
        page.getByRole("button", { name: "Beginner-friendly" }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Map regions" })).toHaveCount(0);
      await expect(page.getByTestId("map-region-pill-hawaii")).toHaveCount(0);
    });
  }
});

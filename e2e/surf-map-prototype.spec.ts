import { test, expect } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const ROUTE = "/surf-map-prototype";

test.describe("surf map prototype — brand reskin smoke", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  test("renders the route with the particle canvas", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("load");
    const canvas = page.getByTestId("surf-map-particles");
    await expect(canvas).toBeAttached();
  });

  test("reduced motion paints a static frame without scheduling rAF", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(ROUTE);
    await page.waitForLoadState("load");
    const canvas = page.getByTestId("surf-map-particles");
    await expect(canvas).toBeAttached();
    // The component stamps data-raf-scheduled="false" when reduced motion is on.
    await expect(canvas).toHaveAttribute("data-raf-scheduled", "false");
  });

  test("layer selection updates the aria-live announcer", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("load");
    const live = page.getByTestId("surf-map-live");
    // Default selected layer is "combined".
    await expect(live).toContainText("Combined layer active");
    // Switch to the Wind layer via its labelled control (desktop Layers panel).
    await page.getByRole("button", { name: /Wind/ }).first().click();
    await expect(live).toContainText("Wind layer active");
  });
});

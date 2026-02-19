import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

const BASE_URL = "/embed/surf-terminal/d-street";

test.describe("Surf Terminal Embed", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  test("renders 3 chart panes with dark theme", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    // Wait for charts to initialize (canvas elements from lightweight-charts)
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // Should have at least 3 canvas elements (one per chart pane, each creates 2 canvases)
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBeGreaterThanOrEqual(3);

    // Verify dark background on the visible root container (not hidden Next.js divs)
    const rootDiv = page.locator("div.font-mono").first();
    await expect(rootDiv).toHaveCSS("background-color", "rgb(26, 26, 46)");
  });

  test("shows beach name in header", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    // "D Street" should be visible in the header
    await expect(page.getByText("D Street")).toBeVisible({ timeout: 10000 });
  });

  test("shows Powered by Quiver watermark", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    const watermark = page.getByText("Powered by Quiver");
    await expect(watermark).toBeVisible({ timeout: 10000 });

    // Watermark should link to the beach page with UTM params
    const link = page.locator('a:has-text("Powered by Quiver")');
    await expect(link).toHaveAttribute("href", /utm_source=embed/);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("displays time range pills and allows switching", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    // All four time range pills should be visible (aria-label includes "Show X of data")
    await expect(page.getByRole("button", { name: /24H/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /3D/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /7D/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /12D/ })).toBeVisible();

    // Click a different range
    await page.getByRole("button", { name: /7D/ }).click();

    // 7D button should now have the active style (bg-[#00d4aa])
    await expect(page.getByRole("button", { name: /7D/ })).toHaveCSS(
      "background-color",
      "rgb(0, 212, 170)"
    );
  });

  test("shows pane labels", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    // Wait for chart initialization
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // Check pane labels
    await expect(page.getByText("WAVE HEIGHT (ft)")).toBeVisible();
    await expect(page.getByText("WIND (mph)")).toBeVisible();
    await expect(page.getByText("PERIOD (s)")).toBeVisible();
  });

  test("legend toggles are visible", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    await expect(page.getByRole("button", { name: /Waves/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Tide/i })).toBeVisible();
  });

  test("light theme renders with white background", async ({ page }) => {
    await page.goto(`${BASE_URL}?theme=light`);
    await page.waitForLoadState("load");

    // Wait for chart initialization
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // Verify light background on the visible root container
    const rootDiv = page.locator("div.font-mono").first();
    await expect(rootDiv).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("responsive layout at different viewports", async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto(`${BASE_URL}?theme=dark`);
    await page.waitForLoadState("load");

    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.locator("canvas").first().waitFor({ state: "visible" });

    // Desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.locator("canvas").first().waitFor({ state: "visible" });
  });
});

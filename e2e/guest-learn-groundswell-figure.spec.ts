import { test, expect } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const REUSED_FIGURE_PAGES = [
  {
    path: "/learn/swell-period-explained",
    figureText: /Groundswell\s*vs\s*Wind Swell/i,
    expectedText: /Swell period/i,
  },
  {
    path: "/learn/how-swell-direction-affects-surf",
    figureText: /Storm.*Shore/i,
    expectedText: /Distant storm energy/i,
  },
  {
    path: "/learn/how-swell-wraps-around-points",
    figureText: /Groundswell\s*vs\s*Wind Swell/i,
    expectedText: /Swell period/i,
  },
] as const;

test.describe("groundswell visual explainer", () => {
  let errors: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errors = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errors);
  });

  test("hero figure renders and the period dial updates readouts", async ({ page }) => {
    await page.goto("/learn/groundswell-vs-wind-swell");
    await page.waitForLoadState("load");

    const slider = page.getByRole("slider", { name: /swell period/i });
    await expect(slider).toBeVisible();
    const figure = page.locator("figure").filter({ has: slider });

    await slider.fill("6");
    await expect(figure.getByText("WIND SWELL", { exact: true })).toBeVisible();
    await slider.fill("16");
    await expect(figure.getByText("GROUNDSWELL", { exact: true })).toBeVisible();
    await expect(figure.getByText("Powerful & lined-up", { exact: true })).toBeVisible();
  });

  test("reduced-motion still shows an interactive slider", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const reducedErrors = setupErrorDetection(page);
    await page.goto("/learn/groundswell-vs-wind-swell");
    await page.waitForLoadState("load");
    await expect(page.getByRole("slider", { name: /swell period/i })).toBeVisible();
    await assertNoErrors(page, reducedErrors);
    await context.close();
  });

  test("embed route renders the figure + backlink", async ({ page }) => {
    await page.goto("/embed/learn/swell-period-morph");
    await page.waitForLoadState("load");
    await expect(page.getByRole("slider", { name: /swell period/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /check your beach/i })).toBeVisible();
  });

  test("reused figures render in swell education pages", async ({ page }) => {
    for (const { path, figureText, expectedText } of REUSED_FIGURE_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("load");

      const figure = page.locator("figure").filter({ hasText: figureText }).first();
      await expect(figure, `${path} should render the reused figure`).toBeVisible();
      await expect(
        page.locator("details").filter({ hasText: "Embed this figure" }).first(),
      ).toBeVisible();
      await expect(figure.getByText(expectedText)).toBeVisible();
    }
  });
});

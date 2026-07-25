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
  {
    path: "/learn/how-are-waves-measured",
    figureText: /One swell, three rulers/i,
    expectedText: /4.5–6.0 ft/i,
  },
  {
    path: "/learn/how-do-tides-work",
    figureText: /Ride the tide curve/i,
    expectedText: /Rising tide/i,
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

  test("wave-height and tide figures respond to their controls", async ({
    page,
  }) => {
    await page.goto("/learn/how-are-waves-measured");
    await page.waitForLoadState("load");

    const heightSlider = page.getByRole("slider", {
      name: /significant wave height/i,
    });
    await heightSlider.fill("4");
    await expect(page.getByText("6.0–8.0 ft", { exact: true })).toBeVisible();

    await page.goto("/learn/how-do-tides-work");
    await page.waitForLoadState("load");

    await page.getByRole("button", { name: /spring tide/i }).click();
    await page.getByRole("slider", { name: /hours since low tide/i }).fill("6.2");
    await expect(page.getByText("High tide", { exact: true })).toBeVisible();
    await expect(page.getByText("7.0 ft range", { exact: true })).toBeVisible();
  });

  test("new figures provide static reduced-motion fallbacks", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const reducedErrors = setupErrorDetection(page);

    await page.goto("/learn/how-are-waves-measured");
    await page.waitForLoadState("load");
    await expect(page.getByText("ONE SWELL / THREE RULERS")).toBeVisible();
    await expect(
      page.getByRole("slider", { name: /significant wave height/i }),
    ).toHaveCount(0);

    await page.goto("/learn/how-do-tides-work");
    await page.waitForLoadState("load");
    await expect(page.getByText("LOW → HIGH → LOW")).toBeVisible();
    await expect(
      page.getByRole("slider", { name: /hours since low tide/i }),
    ).toHaveCount(0);

    await assertNoErrors(page, reducedErrors);
    await context.close();
  });

  test("new figure posters render without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto("/learn/how-are-waves-measured");
    await expect(page.getByText("ONE SWELL / THREE RULERS")).toBeVisible();

    await page.goto("/learn/how-do-tides-work");
    await expect(page.getByText("LOW → HIGH → LOW")).toBeVisible();

    await context.close();
  });
});

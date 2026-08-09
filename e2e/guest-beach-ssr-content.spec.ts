import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from "./utils/error-detection";

const reviewedBeachPath =
  process.env.REVIEWED_BEACH_PATH || "/hi/honolulu/ala-moana-bowls";

test.describe("Guest beach server-rendered content", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }: { page: Page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }: { page: Page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "guest beach server-rendered content",
    });
  });

  test("omits the removed summary before and after hydration", async ({ page }) => {
    const response = await page.request.get(reviewedBeachPath);
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).not.toContain("Surf report snapshot");
    expect(html).not.toContain("current conditions and local guidance");
    expect(html).not.toContain("related surf guides");

    await page.goto(reviewedBeachPath, { waitUntil: "load" });
    await expect(page.getByText("Surf report snapshot")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: /related surf guides/i }),
    ).toHaveCount(0);
  });

  test("renders the selected forecast answer in initial HTML @requires-data", async ({ page }) => {
    const response = await page.request.get(reviewedBeachPath);
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('data-testid="public-forecast-answer"');
    expect(html).toMatch(/surf forecast/i);
    expect(html).toMatch(/Forecast valid at/i);
  });
});

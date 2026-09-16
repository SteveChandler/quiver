import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";
import { assertNoErrors, setupErrorDetection, type ErrorCapture } from "./utils/error-detection";

test.describe("Forecast decision journey", () => {
  let errors: ErrorCapture;
  test.beforeEach(async ({ page }) => {
    errors = setupErrorDetection(page);
    // Local visual inspection must not persist anonymous analytics to the shared backend.
    await page.route("**/api/events**", route => route.fulfill({ status: 200, json: { success: true } }));
  });
  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errors, { context: "Forecast decision journey" });
  });

  for (const width of [360, 768, 1440]) {
    test(`dated comparison, details, keyboard and back navigation at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto("/forecast", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      const cards = page.getByTestId("surf-window-card");
      await expect(cards).toHaveCount(5);
      const card = cards.first();
      await expect(card).not.toContainText(/ft ft/);
      await expect(card).not.toContainText(/looks worth it at|Best for/);
      await expect(card.getByText(/Forecast confidence:/)).toBeVisible();
      await expect(card.getByRole("complementary", { name: "Rip-current conditions" })).toBeVisible({ timeout: TIMEOUTS.long });
      const link = card.getByTestId("surf-window-web-cta");
      const href = new URL((await link.getAttribute("href"))!);
      const selectedWindow = href.searchParams.get("window")!;
      expect(selectedWindow).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await expect(card.locator("time")).toHaveAttribute("datetime", selectedWindow);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`list-${width}.png`) });
      await link.focus();
      await expect(link).toBeFocused();
      // Keep the exact generated path/query while directing local absolute links to this server.
      await page.route(`${href.origin}/**`, route => {
        const target = new URL(route.request().url());
        return route.continue({ url: `${new URL(testInfo.project.use.baseURL!).origin}${target.pathname}${target.search}` });
      });
      // Assigning the local origin preserves a real anchor navigation and browser history.
      await link.evaluate((element, local) => { (element as HTMLAnchorElement).href = local; }, `${new URL(testInfo.project.use.baseURL!).origin}${href.pathname}${href.search}`);
      await Promise.all([
        page.waitForURL(/window=/, { waitUntil: "domcontentloaded" }),
        page.keyboard.press("Enter"),
      ]);
      await expect(page).toHaveURL(/window=/);
      const answer = page.getByTestId("public-forecast-answer");
      await expect(answer).toContainText("Selected comparison window:");
      await expect(page.getByRole("tab", { name: "Conditions", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(/Selected day: \d{4}-/)).toBeVisible();
      await expect(answer.locator("details").first()).not.toHaveAttribute("open");
      await expect(answer.getByRole("complementary", { name: "Rip-current conditions" })).toBeVisible();
      await expect(page.getByRole("listbox", { name: "Forecast days - select a day to view details" })).toBeVisible();
      for (const day of await page.getByRole("listbox", { name: "Forecast days - select a day to view details" }).getByRole("button").all()) {
        expect(await day.evaluate(element => (element as HTMLElement).offsetWidth), "Day cards retain their readable mobile width").toBeGreaterThanOrEqual(88);
      }
      await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`spot-${width}.png`) });
      expect((await answer.boundingBox())!.x + (await answer.boundingBox())!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const advanced = page.locator("summary").filter({ hasText: "Advanced forecast · swell, wind, tide & hourly data" });
      await advanced.focus();
      await page.keyboard.press("Enter");
      await expect(advanced.locator("..")).toHaveAttribute("open");
      const dayButtons = page.getByRole("listbox", { name: "Forecast days - select a day to view details" }).getByRole("button");
      const nextDay = dayButtons.nth(1);
      await nextDay.click();
      await expect(page).toHaveURL(/date=/);
      await expect(nextDay).toHaveAttribute("aria-pressed", "true");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(nextDay).toHaveAttribute("aria-pressed", "true");
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/window=/);
      await expect(answer).toContainText("Selected comparison window:");
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/forecast$/);
    });
  }

  test("hero share control does not overlap its links on tablet or desktop", async ({ page }, testInfo) => {
    await page.goto("/forecast", { waitUntil: "domcontentloaded" });
    const hero = page.getByTestId("regional-call-hero");
    const share = hero.getByRole("button", { name: /^Share .*forecast$/ });
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(share).toBeVisible();
      const shareBox = (await share.boundingBox())!;
      for (const link of await hero.getByRole("link").all()) {
        const box = (await link.boundingBox())!;
        const overlapWidth = Math.min(shareBox.x + shareBox.width, box.x + box.width) - Math.max(shareBox.x, box.x);
        const overlapHeight = Math.min(shareBox.y + shareBox.height, box.y + box.height) - Math.max(shareBox.y, box.y);
        expect(Math.min(overlapWidth, overlapHeight), `Share overlaps ${await link.innerText()} at ${width}px`).toBeLessThanOrEqual(0);
      }
      await expect(share).toContainText("Share forecast");
      await hero.screenshot({ path: testInfo.outputPath(`hero-${width}.png`) });
    }
  });

  test("missing selected day stays unavailable instead of substituting a best day", async ({ page }) => {
    const response = await page.goto("/ca/encinitas/grandview?date=2099-01-01&tab=forecast", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Forecast unavailable for 2099-01-01. Choose another day above.")).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.getByRole("tab", { name: "Conditions", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("public-forecast-answer").locator("details").first()).not.toHaveAttribute("open");
    await expect(page.getByText("BEST DAY THIS WEEK", { exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.getByRole("link", { name: "Explore forecast", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Forecast", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/date=2099-01-01/);
  });

  test("camera hub handles catalog thumbnails without a route error", async ({ page }, testInfo) => {
    const response = await page.goto("/cams", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Live Surf Cams", exact: true })).toBeVisible();
    await expect(page.getByTestId("cams-zine-surface")).toBeVisible();
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath("cams.png") });
  });
});

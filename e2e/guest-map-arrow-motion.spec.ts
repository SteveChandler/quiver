import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors } from "./utils/error-detection";

test.use({ viewport: { width: 1400, height: 1000 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=metal"] } });

test("arrow bearings interpolate and continue from their visible angle when interrupted", async ({ page, baseURL }) => {
  const errors = setupErrorDetection(page);
  const localRateHeaders: Record<string, string> = ["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)
    ? { "x-forwarded-for": `198.19.${process.pid % 256}.1` } : {};
  await page.route("**/api/**", (route) => ["GET", "HEAD"].includes(route.request().method())
    ? route.continue({ headers: { ...route.request().headers(), ...localRateHeaders } })
    : route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
  await page.goto("/map?search=Osprey%20Point");
  const slider = page.getByRole("slider", { name: "Forecast time" });
  await expect(slider).toBeVisible({ timeout: 90000 });
  await page.locator('[data-testid="beach-marker"][data-beach-id="c3b42f85-e650-445f-89b1-1debe661652e"]').click();
  const card = page.locator('[data-conditions-callout="true"]');
  await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
  // Control the native animation clock so intermediate-frame assertions are deterministic.
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.matches("[data-callout-banner]")) animation.pause();
      return animation;
    };
  });
  await slider.fill("24");
  await expect.poll(() => card.locator("[data-callout-banner]").evaluateAll((arrows) => arrows.some((arrow) => arrow.getAnimations().length > 0))).toBe(true);
  const motion = await card.evaluate((element) => {
    const arrow = Array.from(element.querySelectorAll("[data-callout-banner]")).find((node) => node.getAnimations().length)!;
    const animation = arrow.getAnimations()[0];
    const angle = (): number => { const matrix = new DOMMatrix(getComputedStyle(arrow).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; };
    animation.currentTime = 0;
    const start = angle();
    animation.currentTime = 200;
    const middle = angle();
    animation.currentTime = 500;
    const end = angle();
    animation.currentTime = 200;
    return { kind: arrow.getAttribute("data-callout-banner"), start, middle, end };
  });
  const distance = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
  expect(distance(motion.start, motion.middle)).toBeGreaterThan(0.01);
  expect(distance(motion.middle, motion.end)).toBeGreaterThan(0.01);
  expect(distance(motion.start, motion.middle)).toBeLessThan(distance(motion.start, motion.end));
  const previousTime = await card.getAttribute("data-forecast-at");
  await slider.fill("30");
  await expect(card).not.toHaveAttribute("data-forecast-at", previousTime!);
  const interrupted = card.locator(`[data-callout-banner="${motion.kind}"]`);
  await expect.poll(() => interrupted.evaluate((arrow) => arrow.getAnimations().length)).toBe(1);
  const restartAngle = await interrupted.evaluate((arrow) => {
    const matrix = new DOMMatrix(getComputedStyle(arrow).transform);
    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  });
  expect(distance(restartAngle, motion.middle)).toBeLessThan(0.05);
  await card.evaluate((element) => element.querySelectorAll("[data-callout-banner]").forEach((arrow) => arrow.getAnimations().forEach((animation) => animation.finish())));
  await page.screenshot({ path: ".planning/evidence/map-polish/arrow-motion.png" });
  await assertNoErrors(page, errors);
});

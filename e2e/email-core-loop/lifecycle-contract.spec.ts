import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from "../utils/error-detection";

let errors: ErrorCapture;
test.beforeEach(async ({ page }) => { errors = setupErrorDetection(page); });
test.afterEach(async ({ page }) => { await assertNoErrors(page, errors); });

test("cron stays authenticated and disabled with no provider or database", async ({ request }) => {
  const denied = await request.get("/api/cron/email-lifecycle");
  expect(denied.status()).toBe(401);
  const allowed = await request.get("/api/cron/email-lifecycle", { headers: { Authorization: "Bearer lifecycle-local-cron-fixture" } });
  expect(allowed.status()).toBe(200); expect(await allowed.json()).toEqual({ status: "disabled" });
  const invalidMode = await request.get("/api/cron/email-lifecycle?mode=preview", { headers: { Authorization: "Bearer lifecycle-local-cron-fixture" } });
  expect(invalidMode.status()).toBe(400);
});

test("signed unsubscribe GET is readable and does not mutate preferences", async ({ page }) => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const token = createHmac("sha256", "lifecycle-local-unsubscribe-fixture").update(`unsubscribe-email:${userId}`).digest("hex").slice(0,32);
  const response = await page.goto(`/api/email/lifecycle/unsubscribe?user_id=${userId}&token=${token}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Stop Quiver lifecycle emails?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unsubscribe", exact: true })).toBeVisible();
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  // A GET succeeds with the local database offline; preference writes are tested against disposable SQL.
});

test("invalid unsubscribe tokens fail without claiming success", async ({ request }) => {
  const url = "/api/email/lifecycle/unsubscribe?user_id=11111111-1111-4111-8111-111111111111&token=wrong";
  expect((await request.get(url)).status()).toBe(400);
  const response = await request.post(url);
  expect(response.status()).toBe(400); expect(await response.text()).toBe("Invalid unsubscribe link");
});

test("offer jobs and claim API stay disabled or authenticated", async ({ request }) => {
  expect((await request.get("/api/cron/pro-offer-reconcile")).status()).toBe(401);
  const headers = { Authorization: "Bearer lifecycle-local-cron-fixture" };
  const response = await request.get("/api/cron/pro-offer-reconcile", { headers });
  expect(response.status()).toBe(200); expect(await response.json()).toEqual({ status: "disabled" });
  const retired = await request.get("/api/cron/earn-pro-evaluate", { headers });
  expect(retired.status()).toBe(200); expect(await retired.json()).toMatchObject({ status: "retired", granted: 0 });
  expect((await request.post("/api/offers/claim", { data: { code: "a".repeat(43) } })).status()).toBe(401);
  expect((await request.post("/api/admin/offers", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/admin/email/replies/sync")).status()).toBe(401);
  expect((await request.get("/api/offers/claim")).status()).toBe(405);
});

test("paused claim page explains terms and cannot submit at mobile and desktop widths", async ({ page }) => {
  // This UI contract runs with no database; unrelated page-view analytics is stubbed explicitly.
  await page.route("**/api/events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }));
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/offers/claim"); expect(response?.status()).toBe(200);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "A little more time in the water." })).toBeVisible();
    await expect(page.getByText(/historical completed sessions count/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Review my offer" })).toBeDisabled();
    await expect(page.getByLabel("Your offer code")).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: /^(Sign Up|Get Started)$/ })).toBeVisible();
    await page.screenshot({ path: `test-results/offer-claim-${width}.png`, fullPage: true });
  }
});

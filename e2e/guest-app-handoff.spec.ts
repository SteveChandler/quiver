import { expect, test } from "@playwright/test";

import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from "./utils/error-detection";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

test.use({ storageState: { cookies: [], origins: [] } });

async function mockTelemetry(page: Parameters<typeof setupErrorDetection>[0]) {
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe("App-first landing — desktop", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await mockTelemetry(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "App-first landing desktop",
    });
  });

  test("hero shows a visible H1 and the QR + email send-to-phone module @smoke", async ({
    page,
  }) => {
    await page.route("**/api/app-link-email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const response = await page.goto("/", {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState("load", { timeout: 15000 });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /know where to paddle out\. get quiver on your phone\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByTestId("app-handoff-qr").first()).toBeVisible();

    await page.getByLabel(/email/i).first().fill("surfer@example.com");
    await page.getByRole("button", { name: /send link/i }).first().click();
    await expect(page.getByText(/check your email/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("App-first landing — iPhone UA", () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });

  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await mockTelemetry(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "App-first landing iPhone UA",
    });
  });

  test("first viewport has a visible H1 and the App Store primary action @smoke", async ({
    page,
  }) => {
    const response = await page.goto("/", {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState("load", { timeout: 15000 });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /know where to paddle out\. get quiver on your phone\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /open app store/i }).first(),
    ).toBeVisible();
  });
});

test.describe("App-first landing — Android UA", () => {
  test.use({ userAgent: ANDROID_UA, viewport: { width: 412, height: 915 } });

  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await mockTelemetry(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "App-first landing Android UA",
    });
  });

  test("first viewport shows the Android waitlist primary action @smoke", async ({
    page,
  }) => {
    const response = await page.goto("/", {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState("load", { timeout: 15000 });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /know where to paddle out\. get quiver on your phone\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /join android waitlist/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("/app handoff route", () => {
  test("iPhone UA redirects toward the campaign-tagged App Store", async ({
    page,
  }) => {
    const response = await page.request.get("/app?source=qr", {
      headers: { "user-agent": IPHONE_UA },
      maxRedirects: 0,
    });

    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("apps.apple.com");
    expect(response.headers()["location"] ?? "").toContain("ct=app_first_v1");
  });

  test("desktop renders the handoff module @smoke", async ({ page }) => {
    const errorCapture = setupErrorDetection(page);
    await mockTelemetry(page);

    const response = await page.goto("/app", {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    await expect(
      page.getByRole("heading", { level: 1, name: /get quiver on your phone/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();

    await assertNoErrors(page, errorCapture, {
      context: "/app desktop handoff",
    });
  });
});

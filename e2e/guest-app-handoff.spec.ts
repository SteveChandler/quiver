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

test.describe("Field-guide landing — desktop", () => {
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

  test("hero shows the current H1 and download link @smoke", async ({
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
        name: /know where to paddle out before dawn\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId("field-guide-hero").getByRole("link", {
        name: "Get the app",
      }),
    ).toHaveAttribute(
      "href",
      "/download?source=landing_hero&placement=hero&platform=desktop",
    );
  });
});

test.describe("Field-guide landing — iPhone UA", () => {
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

  test("first viewport has a visible H1 and iPhone download path @smoke", async ({
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
        name: /know where to paddle out before dawn\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId("field-guide-hero").getByRole("link", {
        name: "Get the app",
      }),
    ).toHaveAttribute(
      "href",
      "/download?source=landing_hero&placement=hero&platform=ios",
    );
  });
});

test.describe("Field-guide landing — Android UA", () => {
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

  test("first viewport has a visible H1 and Android download path @smoke", async ({
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
        name: /know where to paddle out before dawn\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId("field-guide-hero").getByRole("link", {
        name: "Get the app",
      }),
    ).toHaveAttribute(
      "href",
      "/download?source=landing_hero&placement=hero&platform=android",
    );
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

  test("Android UA redirects to the guided beta page", async ({ page }) => {
    const response = await page.request.get("/app?source=qr", {
      headers: { "user-agent": ANDROID_UA },
      maxRedirects: 0,
    });

    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toBe("/android-beta");
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

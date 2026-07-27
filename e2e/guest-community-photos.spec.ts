import { expect, test } from "@playwright/test";

import {
  assertNoErrors,
  gotoWithErrorCheck,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Community photo public and admin boundaries", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "community photo boundary",
    });
  });

  test("publishes the contributor and moderation terms", async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, "/terms");

    await expect(
      page.getByRole("heading", { name: "4. User Content" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Spot Photo Rights and Publication" }),
    ).toBeVisible();
    await expect(page.getByText(/recover it before permanent deletion/i)).toBeVisible();
  });

  test("publishes photo processing and retention privacy details", async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture, "/privacy");

    await expect(page.getByText("Community Spot Photo Data")).toBeVisible();
    await expect(page.getByText(/strips EXIF metadata/i).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Community Photo Removal" }),
    ).toBeVisible();
  });

  test("keeps the moderation workspace behind admin authentication", async ({
    page,
  }) => {
    await page.goto("/admin/community-photos");
    await page.waitForLoadState("load");

    await expect(page).toHaveURL(
      /\/auth\/sign-in\?redirectTo=%2Fadmin|\/auth\/sign-in\?redirectTo=\/admin/,
    );
    await expect(
      page.getByRole("dialog", { name: /log in to quiver/i }),
    ).toBeVisible();
  });

  test("rejects guest access to the moderation queue API", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/admin/community-photos?status=all&limit=1",
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

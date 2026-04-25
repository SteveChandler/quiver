/**
 * Guest Smoke: /roadmap page
 *
 * Unauthenticated user can load the roadmap, see all three primary sections,
 * and hitting "+ Request" redirects to /auth instead of opening the dialog.
 *
 * @project guest
 */

import { test, expect } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Guest Smoke: /roadmap", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "/roadmap guest",
      // Guest visitors trigger expected 401s from auth-dependent APIs
      checkConsole: false,
    });
  });

  test("loads with three primary status sections", async ({ page }) => {
    await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: 15000 });

    await expect(
      page.getByRole("heading", { level: 1, name: "Roadmap" })
    ).toBeVisible({ timeout: 10000 });

    // Section headings render as "{title} (N)" — the count is a child span so
    // getByRole resolves the full accessible name. Prefix regex avoids coupling
    // to the item count while remaining deterministic.
    await expect(
      page.getByRole("heading", { level: 2, name: /^In Progress/ })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { level: 2, name: /^Under Consideration/ })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { level: 2, name: /^Shipped/ })
    ).toBeVisible({ timeout: 10000 });
  });

  test("+ Request button as anon redirects to /auth", async ({ page }) => {
    await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: 15000 });

    await page.getByRole("button", { name: "+ Request" }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });

  test("at least one shipped item card is rendered", async ({ page }) => {
    await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: 15000 });

    // Each shipped card contains a RoadmapStatusChip with exact text "Shipped".
    // The section h2 reads "Shipped (N)" — exact: true scopes this to chips only.
    const shippedChips = page.getByText("Shipped", { exact: true });
    await expect(shippedChips.first()).toBeVisible({ timeout: 10000 });
    expect(await shippedChips.count()).toBeGreaterThanOrEqual(1);
  });
});

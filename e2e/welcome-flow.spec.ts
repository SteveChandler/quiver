/**
 * E2E tests for the /welcome onboarding splash screen.
 *
 * Covers the animated splash sequence, the Get Started CTA, and the
 * auth method picker that slides in after the user taps Get Started.
 *
 * The page uses Framer Motion with timer-driven phase transitions:
 *   0.8 s  → orbit rings
 *   1.8 s  → wordmark + tagline
 *   2.6 s  → "Get Started" button
 *
 * Tests use generous timeouts (5 s) to accommodate the animation delays
 * without coupling to exact timer values.
 */

import { test, expect } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";

test.describe("Welcome Flow", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto("/welcome");
    await page.waitForLoadState("load");
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Welcome flow" });
  });

  test("renders splash animation and Get Started button", async ({ page }) => {
    // The wordmark fades in at ~1.8 s and the CTA at ~2.6 s.
    // Use a 5 s timeout so the animation has time to complete.
    await expect(
      page.getByRole("heading", { name: "Quiver", level: 1 })
    ).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Gets better every session.")).toBeVisible({
      timeout: 5000,
    });

    await expect(
      page.getByRole("button", { name: "Get Started" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows auth methods after tapping Get Started", async ({ page }) => {
    // Wait for the CTA button to appear before clicking it.
    const getStartedButton = page.getByRole("button", { name: "Get Started" });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });

    await getStartedButton.click();

    // Auth method picker animates in (~450 ms). Use a 5 s timeout to be safe.
    await expect(
      page.getByRole("button", { name: /continue with apple/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /continue with email/i })
    ).toBeVisible({ timeout: 5000 });

    // The "Log in" link is a <button> rendered inside a paragraph.
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("Email button navigates to sign-up page", async ({ page }) => {
    const getStartedButton = page.getByRole("button", { name: "Get Started" });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });
    await getStartedButton.click();

    const emailButton = page.getByRole("button", {
      name: /continue with email/i,
    });
    await expect(emailButton).toBeVisible({ timeout: 5000 });
    await emailButton.click();

    await page.waitForURL((url) => url.pathname.includes("/auth/sign-up"), {
      timeout: 10000,
    });
    expect(page.url()).toContain("/auth/sign-up");
  });

  test("Login link navigates to sign-in page", async ({ page }) => {
    const getStartedButton = page.getByRole("button", { name: "Get Started" });
    await expect(getStartedButton).toBeVisible({ timeout: 5000 });
    await getStartedButton.click();

    const loginButton = page.getByRole("button", { name: /log in/i });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    await page.waitForURL((url) => url.pathname.includes("/auth/sign-in"), {
      timeout: 10000,
    });
    expect(page.url()).toContain("/auth/sign-in");
  });
});

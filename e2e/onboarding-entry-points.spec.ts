/**
 * Onboarding Dialog Entry Points — Regression Smoke Test
 *
 * This spec guards the invariants set in plan vast-dancing-whale (2026-04-15)
 * which removed the OnboardingDialog's auto-open behaviour. After that change,
 * the dialog only opens via explicit paths:
 *
 *   1. Oracle home screen's "Set your home beach" ContextualCTA
 *      → handleSetHomeBeach calls useOnboardingStore().reset() + openDialog()
 *   2. `?showOnboarding=1` URL param (testing hook)
 *   3. /profile's SetHomeBreakCta → reopenOnboarding() + openDialog()
 *
 * If any of these regress silently — especially (1), which is now the primary
 * path for brand-new signups to set a home beach — new users will have no path
 * to onboarding and we'd only notice it via a home_beach_id activation
 * collapse weeks later. This spec turns a silent weeks-long failure into a
 * loud CI failure.
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";
import { ensureAuthenticated, waitForPageLoad } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from "./utils/error-detection";
import { isVisibleSafe } from "./utils/strict-helpers";

test.describe("Onboarding dialog entry points (regression smoke)", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await ensureAuthenticated(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "onboarding-entry-points",
    });
  });

  test("does NOT auto-open dialog on plain home screen load", async ({
    page,
  }) => {
    // The auto-open useEffect in onboarding-dialog.tsx was removed. A fresh
    // home screen visit — without ?showOnboarding=1 — must NOT pop the dialog,
    // even when the user has no home_beach_id set. This is the core
    // regression-prevention case: if a future refactor reintroduces auto-open,
    // brand-new signups will get ambushed again and bail in droves.
    await page.goto("/");
    await waitForPageLoad(page);

    // Give the old 500ms auto-open timer time to fire if it came back.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- deliberate: asserting a timer does NOT fire
    await page.waitForTimeout(1500);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeHidden();
  });

  test("home-screen CTA opens dialog in place (primary entry path)", async ({
    page,
  }) => {
    // This is the one that protects new signups. If handleSetHomeBeach ever
    // regresses (store import breaks, useOnboardingStore rename, dialog mount
    // broken) this test catches it before silent weeks-long attribution loss.
    await page.goto("/");
    await waitForPageLoad(page);

    const setHomeBeachBtn = page.getByRole("button", {
      name: /set your home beach/i,
    });
    const hasCta = await isVisibleSafe(setHomeBeachBtn, {
      timeout: TIMEOUTS.long,
    });

    // If the CTA isn't shown, the test user already has a home beach. Skip
    // with a clear message rather than silently passing — the ?showOnboarding=1
    // test below is the backstop for the dialog-render contract.
    if (!hasCta) {
      test.skip(
        true,
        "Test user has home_beach set — CTA not rendered. " +
          "ShowOnboarding URL-param test covers the dialog-render contract."
      );
      return;
    }

    await expect(setHomeBeachBtn).toBeEnabled();
    await setHomeBeachBtn.scrollIntoViewIfNeeded();
    await setHomeBeachBtn.click({ force: true });

    // Dialog opens — the NEW behavior (plan vast-dancing-whale).
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });

    // URL did NOT change to /profile?tab=preferences (the OLD behavior).
    // Allow trailing query string but disallow path changes.
    await expect(page).toHaveURL(/\/(\?.*)?$/);

    // Dialog opens at step 0 (HomeBeachStep). Step title is "Where do you surf?".
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });
  });

  test("?showOnboarding=1 URL param force-opens dialog (testing hook)", async ({
    page,
  }) => {
    // The URL-param path is the backstop test. It works regardless of the
    // test user's home_beach state, so it will always exercise the dialog
    // render + mount path. If this fails, the dialog itself is broken
    // (component crash, mount error) and the home-screen CTA would also fail.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });
  });
});

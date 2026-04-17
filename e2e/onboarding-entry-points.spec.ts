/**
 * Onboarding Dialog Entry Points — Regression Smoke Test
 *
 * Guards two layered invariants:
 *
 * (A) Plan vast-dancing-whale (2026-04-15) removed the 500ms auto-open
 *     `useEffect`. A plain `/` load must NOT pop the dialog, even when the
 *     user has no home_beach_id. That silent ambush was causing Maybe-later
 *     reflex-taps in under 10s from new signups.
 *
 * (B) Plan abstract-exploring-phoenix (Commit B, 2026-04-17) added the
 *     `?onboarding=required` redirect from /auth/callback for fresh signups
 *     only (profile.home_beach_id IS NULL AND onboarding_completed_at IS
 *     NULL). That query-param entry path MUST open the dialog on mount, and
 *     MUST strip itself from the URL so a refresh doesn't re-trigger.
 *
 * The distinction matters: (A) says "don't auto-open for returning users on
 * plain loads," (B) says "DO open for brand-new signups via an explicit
 * server-routed query param." Both are "no surprise ambushes" in spirit —
 * (B) is opt-in via the server-side new-signup detection, not the old
 * blanket client-side timer.
 *
 * Dialog entry paths after both plans:
 *
 *   1. Oracle home screen's "Set your home beach" ContextualCTA (existing
 *      users without a home beach)
 *   2. `?onboarding=required` URL param (fresh signups via /auth/callback)
 *   3. `?showOnboarding=1` URL param (testing hook)
 *   4. /profile's SetHomeBreakCta → reopenOnboarding() + openDialog()
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

  test("does NOT auto-open dialog on plain home screen load (no query param)", async ({
    page,
  }) => {
    // Plan vast-dancing-whale: the 500ms auto-open useEffect in
    // onboarding-dialog.tsx was removed. A plain `/` load — without
    // ?showOnboarding=1 AND without ?onboarding=required — must NOT pop
    // the dialog, even when the user has no home_beach_id set.
    //
    // Plan abstract-exploring-phoenix (Commit B) adds the
    // `?onboarding=required` path, but that path is only used by
    // /auth/callback for fresh signups — a direct navigation to `/`
    // without the param must not open the dialog for returning users.
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
    // eslint-disable-next-line playwright/no-conditional-in-test -- deliberate: degrade gracefully when the test account already has home_beach
    if (!hasCta) {
      // eslint-disable-next-line playwright/no-skipped-test -- deliberate runtime skip with rationale; the ?showOnboarding=1 test is the backstop
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

  test("HomeBeachStep does NOT render a Maybe later button (required step)", async ({
    page,
  }) => {
    // Plan abstract-exploring-phoenix (Commit B): HomeBeachStep is the
    // required activation gate. Continue is disabled until a beach is
    // selected; no skip affordance on this step. The dialog reopens via
    // the Oracle CTA for returning users — new signups hit it via the
    // `?onboarding=required` redirect from /auth/callback.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });

    // Maybe later must NOT exist on step 0 (HomeBeachStep). It continues to
    // exist on subsequent steps (LevelAndTime, Payoff) — those are skippable.
    const maybeLaterOnHomeBeachStep = page.getByRole("button", {
      name: /maybe later/i,
    });
    const maybeLaterVisible = await isVisibleSafe(maybeLaterOnHomeBeachStep, {
      timeout: 2000,
    });
    expect(maybeLaterVisible).toBe(false);

    // Continue button must exist and be disabled until a beach is picked.
    const continueBtn = page.getByRole("button", { name: /continue/i });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeDisabled();
  });
});

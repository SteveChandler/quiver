/**
 * Onboarding Smoke Tests
 *
 * Full-flow guard tests for the OnboardingDialog entry paths and end-to-end
 * step completion. These complement `e2e/onboarding-entry-points.spec.ts`
 * (pure entry-path invariants) and `e2e/onboarding-flow.spec.ts` (interaction
 * smoke) by walking fresh ephemeral users through the entire dialog and
 * verifying no stale-close race drops the Finish button.
 *
 * Guarded regressions:
 * - Plain `/` load auto-opening the dialog (plan vast-dancing-whale)
 * - `?onboarding=required` + `?showOnboarding=1` + Oracle CTA entry paths
 *   (plans abstract-exploring-phoenix / vast-dancing-whale)
 * - PayoffStep auto-save race dismissing the dialog before Finish is reachable
 *   (`project_onboarding_payoff_step_bug`)
 * - Optimistic-update regressions on RootNavigator-read query keys
 *   (`feedback_dont_optimistic_update_navigation_gate`)
 *
 * @project auth
 */

import { test, expect } from '@playwright/test';
import { TIMEOUTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';
import {
  cleanupEphemeralUser,
  completeOnboarding,
  signIn,
  signUpEphemeral,
  type EphemeralCredentials,
} from './helpers/onboarding-flow';

// Onboarding-smoke provisions its own ephemeral users; always start from a
// clean context so cookies from the shared auth state can't pollute tests.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Onboarding Smoke: entry paths', () => {
  let errorCapture: ErrorCapture;
  let ephemeral: EphemeralCredentials | null = null;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    ephemeral = await signUpEphemeral(page);
    await signIn(page, ephemeral);
  });

  test.afterEach(async ({ page }) => {
    try {
      // checkConsole: false — fresh ephemeral signups in dev emit known
      // console noise from AuthContext's welcome-email fetch-and-forget path
      // (the /api/internal/send-welcome-email endpoint races HMR in the local
      // dev server). This is not a product regression, and the test's UI
      // assertions are the real signal. Visible errors + network errors are
      // still enforced below.
      await assertNoErrors(page, errorCapture, {
        context: 'onboarding-smoke entry',
        checkConsole: false,
      });
    } finally {
      if (ephemeral) {
        await cleanupEphemeralUser(ephemeral.userId);
        ephemeral = null;
      }
    }
  });

  test('?onboarding=required opens the dialog on mount @smoke', async ({ page }) => {
    await page.goto('/?onboarding=required');
    await page.waitForLoadState('load');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Dialog strips the `onboarding` param after open (router.replace). Allow
    // other query params to survive; only assert the gate param is gone.
    await expect(page).toHaveURL(/\/(?!.*[?&]onboarding=required)/, {
      timeout: TIMEOUTS.long,
    });
  });

  test('?showOnboarding=1 force-opens the dialog @smoke', async ({ page }) => {
    await page.goto('/?showOnboarding=1&debugOnboarding=1');
    await page.waitForLoadState('load');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });
  });

  test('Oracle "Set your home beach" CTA opens the dialog in place @smoke', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Fresh signup has home_beach_id=NULL → Oracle renders the Set-home-beach
    // CTA. If a regression removes it, this test flags it before new-user
    // activation silently collapses.
    const setHomeBtn = page.getByRole('button', {
      name: /set your home beach/i,
    });
    const hasCta = await isVisibleSafe(setHomeBtn, { timeout: TIMEOUTS.long });

    if (!hasCta) {
      throw new Error(
        'Not implemented: Oracle "Set your home beach" CTA did not render for a ' +
          'fresh ephemeral signup. This is a regression in the Oracle CTA wiring ' +
          'or the home-screen render — see plan abstract-exploring-phoenix.'
      );
    }

    await setHomeBtn.scrollIntoViewIfNeeded();
    await setHomeBtn.click({ force: true });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Stayed on home (did not route to /profile?tab=preferences, the old
    // pre-vast-dancing-whale behavior).
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });

  test('plain `/` load does NOT auto-open the dialog @smoke', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // The old 500ms auto-open useEffect is gone (plan vast-dancing-whale).
    // Give the removed timer plenty of room to (not) fire.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- deliberate: asserting a timer does NOT fire
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeHidden();
  });
});

test.describe('Onboarding Smoke: full flow + navigation stability', () => {
  let errorCapture: ErrorCapture;
  let ephemeral: EphemeralCredentials | null = null;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    ephemeral = await signUpEphemeral(page);
    await signIn(page, ephemeral);
  });

  test.afterEach(async ({ page }) => {
    try {
      // See entry-paths describe block for the checkConsole rationale — ephemeral
      // signups race dev-server welcome-email fetch and emit harmless noise.
      await assertNoErrors(page, errorCapture, {
        context: 'onboarding-smoke full-flow',
        checkConsole: false,
      });
    } finally {
      if (ephemeral) {
        await cleanupEphemeralUser(ephemeral.userId);
        ephemeral = null;
      }
    }
  });

  test('full dialog walkthrough reaches Finish and commits @smoke', async ({
    page,
  }) => {
    // This is THE guard test for project_onboarding_payoff_step_bug: the
    // PayoffStep auto-save race that dismissed the dialog before the Finish
    // button was reachable. completeOnboarding() asserts Finish is visible +
    // enabled + clickable in sequence.
    await page.goto('/?showOnboarding=1&debugOnboarding=1');
    await page.waitForLoadState('load');

    await completeOnboarding(page);
  });

  test('post-Finish home renders without remounting mid-transition @smoke', async ({
    page,
  }) => {
    // Guards `feedback_dont_optimistic_update_navigation_gate`: if Finish
    // optimistically writes to a RootNavigator-read query key, the current
    // screen would unmount BEFORE the dialog closes, producing a visible
    // flicker. We assert the opposite: after Finish, the home content is
    // visible and stable — no intermediate guest/landing render.
    await page.goto('/?showOnboarding=1&debugOnboarding=1');
    await page.waitForLoadState('load');

    await completeOnboarding(page);

    // The user-avatar dropdown is an authed-only affordance that renders in
    // the header regardless of home-screen loading state — its continued
    // visibility after Finish proves the navigation gate didn't flip.
    const avatar = page.getByTestId('user-avatar-button');
    await expect(avatar).toBeVisible({ timeout: TIMEOUTS.long });

    // And the Log In button must NOT appear (would mean we flashed to guest).
    const loginBtn = page.getByRole('button', { name: /^log in$/i }).first();
    const flashedGuest = await isVisibleSafe(loginBtn, { timeout: 1_000 });
    expect(flashedGuest).toBe(false);
  });
});

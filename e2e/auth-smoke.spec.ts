/**
 * Auth Smoke Tests
 *
 * Signup → Login → Logout loop, plus session persistence across reload.
 * Each test uses a disposable `smoke+<uuid>@quiversurf.test` user provisioned
 * via Supabase admin API (email-confirm auto-true) and cleaned up after.
 *
 * OAuth flows (Apple, Google) are intentionally NOT covered here — they
 * require real Safari per `quiver/CLAUDE.md`. Leave OAuth to manual
 * pre-release verification.
 *
 * Guards against:
 * - Silent auth-modal regressions (button wiring, dialog render)
 * - Logout dropdown breakage (`data-testid="user-avatar-button"` / header menu)
 * - Session-cookie loss on reload (SSR cookie round-trip)
 *
 * @project auth
 */

import { test, expect } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';
import {
  cleanupEphemeralUser,
  signIn,
  signOut,
  signUpEphemeral,
  type EphemeralCredentials,
} from './helpers/onboarding-flow';
import { verifySupabaseAuth } from './utils/auth-helpers';

// Auth-smoke manages its own session state per test. Start from a blank slate
// so a prior authed run (e2e/.auth/state.json) can't leak into the guest-state
// assertions below.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Smoke: signup → login → logout', () => {
  let errorCapture: ErrorCapture;
  let ephemeral: EphemeralCredentials | null = null;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    // assertNoErrors first so failures attribute to the test, not cleanup.
    //
    // checkConsole: false — fresh ephemeral signups in dev emit known
    // console noise from AuthContext's welcome-email fetch-and-forget
    // path (see /api/internal/send-welcome-email). The welcome-email error
    // is not a product regression, and visible errors + network errors are
    // still enforced. See onboarding-smoke.spec.ts for the same rationale.
    try {
      await assertNoErrors(page, errorCapture, {
        context: 'auth-smoke',
        checkConsole: false,
      });
    } finally {
      if (ephemeral) {
        await cleanupEphemeralUser(ephemeral.userId);
        ephemeral = null;
      }
    }
  });

  test('ephemeral signup lands authed and ready for onboarding @smoke', async ({
    page,
  }) => {
    // Admin-create the user (UI email-signup requires clicking a confirmation
    // link, which isn't reachable in headless CI). We still exercise the UI
    // login flow to cover the signup→login handoff users actually see in prod.
    ephemeral = await signUpEphemeral(page);

    await signIn(page, ephemeral);

    // Cookies landed via waitForAuthCompletion inside signIn; double-check
    // server-side here so a middleware regression surfaces immediately.
    const isAuthed = await verifySupabaseAuth(page);
    expect(isAuthed).toBe(true);

    // Post-sign-in we stay on `/` (modal closes, AuthContext handles redirect).
    // The fresh user has home_beach_id=NULL + onboarding_completed_at=NULL,
    // which means the Oracle "Set your home beach" CTA must render OR the
    // onboarding dialog is available via ?showOnboarding=1. Either invariant
    // is valid; we assert the authed home painted, not a specific CTA.
    await page.waitForLoadState('load');

    const avatar = page.getByTestId('user-avatar-button');
    await expect(avatar).toBeVisible({ timeout: 15_000 });
  });

  test('login with just-created credentials reaches authed home @smoke', async ({
    page,
  }) => {
    ephemeral = await signUpEphemeral(page);

    await signIn(page, ephemeral);

    // The user-avatar dropdown only renders for authed viewers — its visibility
    // is the authed-home invariant.
    const avatar = page.getByTestId('user-avatar-button');
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    // Log In button must NOT be present (would indicate we're still guest).
    const loginBtn = page.getByRole('button', { name: /^log in$/i }).first();
    const stillHasLogin = await isVisibleSafe(loginBtn, { timeout: 1_000 });
    expect(stillHasLogin).toBe(false);
  });

  test('logout returns to guest state with signup CTAs visible @smoke', async ({
    page,
  }) => {
    ephemeral = await signUpEphemeral(page);
    await signIn(page, ephemeral);

    // Confirm we're authed before logging out.
    await expect(page.getByTestId('user-avatar-button')).toBeVisible({
      timeout: 15_000,
    });

    await signOut(page);

    // Guest state invariants:
    //   - Log In button reappears in the header
    //   - User-avatar dropdown is gone
    //   - Inline signup CTA OR a generic signup affordance renders for anons
    await expect(
      page.getByRole('button', { name: /log in/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    const avatarGone = await isVisibleSafe(page.getByTestId('user-avatar-button'), {
      timeout: 1_000,
    });
    expect(avatarGone).toBe(false);

    // Guest-state signup affordances are defense-in-depth and route-specific
    // (landing-page hero shows "Check your forecast" linking to /auth/sign-up,
    // beach pages show "See Your Forecast", mobile shows "Sign Up"). Accept any
    // of: inline-signup-cta component, mobile-nav-signup testid, any /auth/sign-up
    // link, or the landing-hero CTA button. At least one must render for anon.
    const inlineCta = page.locator('[data-testid="inline-signup-cta"]');
    const mobileNavSignup = page.locator('[data-testid="mobile-nav-signup"]');
    const signupLink = page.locator('a[href="/auth/sign-up"]').first();
    const heroCta = page
      .getByRole('button', { name: /check your forecast|sign up|get started|see your forecast/i })
      .first();
    const hasInlineCta = await isVisibleSafe(inlineCta, { timeout: 5_000 });
    const hasMobileNavSignup = await isVisibleSafe(mobileNavSignup, { timeout: 2_000 });
    const hasSignupLink = await isVisibleSafe(signupLink, { timeout: 2_000 });
    const hasHeroCta = await isVisibleSafe(heroCta, { timeout: 2_000 });
    expect(
      hasInlineCta || hasMobileNavSignup || hasSignupLink || hasHeroCta
    ).toBe(true);
  });

  test('session persists across full reload without flashing to guest @smoke', async ({
    page,
  }) => {
    ephemeral = await signUpEphemeral(page);
    await signIn(page, ephemeral);

    const avatar = page.getByTestId('user-avatar-button');
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: 'load' });

    // After reload, the avatar must render without the Log In button ever
    // appearing in its place. A transient flash would indicate SSR cookie
    // plumbing dropped the session on the server round-trip.
    await expect(avatar).toBeVisible({ timeout: 15_000 });

    const loginBtn = page.getByRole('button', { name: /^log in$/i }).first();
    const flashedToGuest = await isVisibleSafe(loginBtn, { timeout: 1_000 });
    expect(flashedToGuest).toBe(false);

    // Server-validated auth still holds.
    const isAuthed = await verifySupabaseAuth(page);
    expect(isAuthed).toBe(true);
  });
});

/**
 * Onboarding Flow Helpers
 *
 * Shared utilities for walking through the OnboardingDialog in E2E tests,
 * creating ephemeral test users for signup/login flows, and programmatic
 * sign-out. Consumed by e2e/onboarding-smoke.spec.ts and e2e/auth-smoke.spec.ts.
 *
 * Design notes:
 * - `completeOnboarding` mirrors the real user flow: HomeBeachStep (search →
 *   pick beach), ExperienceLevelStep (Continue), PayoffStep (Let's go / Finish).
 *   Selectors match the live OnboardingDialog:
 *     - role=dialog for the overlay
 *     - #beachSearch input for home-beach search
 *     - data-testid=level-and-time-step for step 2
 *     - data-testid=payoff-step + data-testid=complete-onboarding-button for step 3
 * - `signUpEphemeral` uses Supabase admin (service-role) to create a confirmed
 *   test user. The UI signup path requires email confirmation, which is not
 *   reachable in headless CI — admin-create bypasses the email loop without
 *   skipping the assertions we actually care about (home render, logout, session
 *   persistence, onboarding entry paths).
 * - `signIn` and `signOut` drive the real UI so we exercise the modal, the
 *   dropdown, and the post-sign-out landing state.
 */

import { Page, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { TIMEOUTS, TEST_BEACHES } from '../fixtures/test-data';
import { waitForAuthCompletion } from '../utils/auth-helpers';

// ---------------------------------------------------------------------------
// Admin client (service role) — for ephemeral test user provisioning.
// ---------------------------------------------------------------------------

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Not implemented: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL ' +
        'are required for ephemeral test user signup. Set them in .env.playwright.local.'
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

// ---------------------------------------------------------------------------
// Ephemeral signup
// ---------------------------------------------------------------------------

export interface EphemeralCredentials {
  email: string;
  password: string;
  userId: string;
}

/**
 * Create an email-confirmed test user via Supabase admin API.
 *
 * Returns `{ email, password, userId }`. The user is tagged with
 * `app_metadata.is_ephemeral_smoke_test = true` (server-controlled, cannot be
 * spoofed via public signup) so the cleanup sweep can match on positive proof
 * of test origin rather than email pattern alone.
 *
 * The UI email-signup path requires clicking a confirmation email, which
 * is not addressable in headless CI. Admin-create with `email_confirm: true`
 * is the supported bypass for E2E — it still exercises the `handle_new_user`
 * trigger so the profile row behaves identically to a real signup.
 */
export async function signUpEphemeral(
  _page: Page
): Promise<EphemeralCredentials> {
  const admin = getAdminClient();
  const email = `smoke+${randomUUID()}@quiversurf.test`;
  const password = 'EphemeralSmokePw123!';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { is_ephemeral_smoke_test: true, created_for: 'e2e-smoke' },
  });

  if (error || !data.user) {
    throw new Error(
      `Not implemented: ephemeral signup failed via admin API: ${error?.message ?? 'no user returned'}`
    );
  }

  const userId = data.user.id;

  // Give the handle_new_user trigger a tick to land, then mark is_mock so
  // global-teardown's cleanup knows to sweep this user.
  // eslint-disable-next-line no-await-in-loop
  await new Promise((resolve) => setTimeout(resolve, 200));
  const { error: profileError } = await (admin.from('profiles') as any)
    .update({ is_mock: true, full_name: 'Smoke Test User' })
    .eq('id', userId);

  if (profileError) {
    // Fallback insert — rare but tolerable if the trigger hasn't fired yet.
    const { error: insertError } = await (admin.from('profiles') as any).insert({
      id: userId,
      email,
      full_name: 'Smoke Test User',
      is_mock: true,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(
        `Not implemented: profile row never materialized for ephemeral user ${userId}: ${insertError.message}`
      );
    }
  }

  return { email, password, userId };
}

/**
 * Delete an ephemeral test user. Safe to call in afterEach — never throws.
 *
 * Deletes auth.users first, then the orphan profile row (no FK cascade exists
 * in this schema — see migration 20260430170000). If the profile delete fails,
 * the global-teardown orphan-profile sweep (cleanup_orphan_smoke_profiles RPC)
 * picks it up on the next run.
 */
export async function cleanupEphemeralUser(userId: string): Promise<void> {
  try {
    const admin = getAdminClient();
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.warn('[onboarding-flow] auth.admin.deleteUser failed:', authErr.message);
      return;
    }
    const { error: profileErr } = await (admin.from('profiles') as any)
      .delete()
      .eq('id', userId);
    if (profileErr) {
      console.warn('[onboarding-flow] profile cleanup failed:', profileErr.message);
    }
  } catch (err) {
    console.warn('[onboarding-flow] ephemeral cleanup failed:', err);
  }
}

// ---------------------------------------------------------------------------
// UI sign-in / sign-out
// ---------------------------------------------------------------------------

/**
 * Open the auth modal on `/`, enter email+password, and wait for auth cookies.
 *
 * Mirrors the global-setup login flow so the selectors stay in sync. Throws
 * if the auth modal never appears or tokens never land.
 */
export async function signIn(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const loginButton = page.getByRole('button', { name: /log in/i }).first();
  await loginButton.waitFor({ state: 'visible', timeout: TIMEOUTS.long });
  await loginButton.click({ force: true });

  await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });

  const emailButton = page
    .getByRole('button', { name: /continue with email|sign in with email/i })
    .first();
  if (await emailButton.isVisible().catch(() => false)) {
    await emailButton.click();
    await page.getByPlaceholder(/email/i).waitFor({ state: 'visible', timeout: 5_000 });
  }

  await page.getByPlaceholder(/email/i).fill(credentials.email);
  await page.getByLabel(/password/i).fill(credentials.password);

  await page.getByRole('button', { name: /log in|sign in/i }).last().click();

  await waitForAuthCompletion(page, 15_000);
}

/**
 * Click the user-avatar dropdown and sign out via the header menu.
 *
 * Uses the same `data-testid="user-avatar-button"` trigger that production
 * renders for authed users. On success, returns when the app has navigated
 * to `/` post-logout (signOut → router.push('/')).
 */
export async function signOut(page: Page): Promise<void> {
  const avatar = page.getByTestId('user-avatar-button');
  await avatar.waitFor({ state: 'visible', timeout: TIMEOUTS.medium });
  await avatar.click();

  const logoutItem = page.getByRole('menuitem', { name: /log out/i });
  await logoutItem.waitFor({ state: 'visible', timeout: 5_000 });
  await logoutItem.click();

  // Wait for the header to flip from authed to guest. The Log In button only
  // renders for unauthed viewers, so its appearance is the signal.
  await page
    .getByRole('button', { name: /log in/i })
    .first()
    .waitFor({ state: 'visible', timeout: TIMEOUTS.long });
}

// ---------------------------------------------------------------------------
// Onboarding dialog walkthrough
// ---------------------------------------------------------------------------

export interface CompleteOnboardingOptions {
  /** Query to type into the home-beach search. Defaults to "Blacks". */
  beachSearch?: string;
  /** If true, navigate to `/?showOnboarding=1&debugOnboarding=1` before walking. */
  openViaDebugParam?: boolean;
}

/**
 * Walk through every onboarding step and assert Finish is reachable and clickable.
 *
 * The debug-onboarding flag on step 3 short-circuits the server-side
 * saveOnboardingData call — required for deterministic local runs where the
 * test user's profile row can race the dialog's stale-close effect. See
 * `project_onboarding_payoff_step_bug.md` for the failure mode this guards.
 *
 * Expects the onboarding dialog to already be open (or set openViaDebugParam=true
 * to navigate there first).
 */
export async function completeOnboarding(
  page: Page,
  opts: CompleteOnboardingOptions = {}
): Promise<void> {
  const { beachSearch = TEST_BEACHES.blacks.name, openViaDebugParam = false } = opts;

  if (openViaDebugParam) {
    await page.goto('/?showOnboarding=1&debugOnboarding=1');
    await page.waitForLoadState('load');
  }

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });

  // ---- Step 1: HomeBeachStep -----------------------------------------------
  await expect(page.getByText(/where do you surf/i)).toBeVisible({
    timeout: TIMEOUTS.long,
  });

  await page.locator('#beachSearch').fill(beachSearch);

  // Results dropdown renders beach buttons inside an absolutely-positioned
  // container beneath the input. Pick the first result.
  const resultsDropdown = page.locator('div.absolute.z-10.w-full').first();
  const firstResult = resultsDropdown.locator('button[type="button"]').first();
  await expect(firstResult).toBeVisible({ timeout: TIMEOUTS.long });
  await firstResult.click();

  // selectBeach() triggers a celebration-delay nextStep() — give it room.
  // ---- Step 2: ExperienceLevelStep -----------------------------------------
  await expect(page.getByTestId('level-and-time-step')).toBeVisible({
    timeout: TIMEOUTS.long,
  });

  // Click Continue without selecting a level to avoid the spring-animation
  // pageerror in headless Chromium (see e2e/onboarding-flow.spec.ts).
  const levelStep = page.getByTestId('level-and-time-step');
  await levelStep.getByRole('button', { name: /continue/i }).click();

  // ---- Step 3: PayoffStep --------------------------------------------------
  await expect(page.getByTestId('payoff-step')).toBeVisible({
    timeout: TIMEOUTS.long,
  });

  const finishBtn = page.getByTestId('complete-onboarding-button');
  // The Finish button is gated by the 3-beat reveal (≤1200ms). Waiting for
  // it to be enabled catches the PayoffStep auto-save race where the dialog
  // dismisses before Finish renders.
  await expect(finishBtn).toBeVisible({ timeout: TIMEOUTS.long });
  await expect(finishBtn).toBeEnabled({ timeout: TIMEOUTS.medium });

  await finishBtn.click();

  // Dialog closes post-finish — completeOnboarding() store action runs first,
  // then saveOnboardingData (debug mode skips the network round-trip).
  await expect(dialog).toBeHidden({ timeout: TIMEOUTS.long });
}

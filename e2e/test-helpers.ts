import { Page } from '@playwright/test';

/**
 * Onboarding state to persist across localStorage.clear() calls in tests.
 * This prevents the onboarding modal from appearing in tests that aren't testing onboarding.
 */
const ONBOARDING_STATE = {
  state: {
    currentStep: 0,
    data: {},
    isCompleted: true,
  },
  version: 0,
};

/**
 * Set onboarding as completed in localStorage.
 * Use this to prevent the onboarding modal from appearing in tests.
 */
export async function setOnboardingCompleted(page: Page) {
  await page.evaluate((state) => {
    localStorage.setItem('quiver-onboarding', JSON.stringify(state));
    localStorage.setItem('onboarding_dismissed', 'true');
  }, ONBOARDING_STATE);
}

/**
 * Clear localStorage while preserving onboarding state.
 * Use this instead of localStorage.clear() in tests that don't test onboarding.
 */
export async function clearLocalStorageExceptOnboarding(page: Page) {
  await page.evaluate((state) => {
    localStorage.clear();
    sessionStorage.clear();
    // Restore onboarding state
    localStorage.setItem('quiver-onboarding', JSON.stringify(state));
    localStorage.setItem('onboarding_dismissed', 'true');
  }, ONBOARDING_STATE);
}

/**
 * Dismiss onboarding modal if it appears.
 * Use this in test cleanup or when the modal interferes with tests.
 */
export async function dismissOnboardingModal(page: Page) {
  const modal = page.getByRole('dialog').filter({ hasText: /welcome|onboarding/i });
  const isVisible = await modal.isVisible().catch(() => false);

  if (isVisible) {
    // Try to close by clicking outside or pressing escape
    await page.keyboard.press('Escape').catch(() => {});

    // If that doesn't work, set the state
    await setOnboardingCompleted(page);
    await page.reload();
  }
}

/**
 * Wait for page to load and dismiss onboarding if present.
 * Use this as a safe page.goto() wrapper for authenticated tests.
 */
export async function gotoWithoutOnboarding(page: Page, url: string) {
  await page.goto(url);
  await dismissOnboardingModal(page);
}

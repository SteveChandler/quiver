import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { loginViaUI } from './utils/auth';
import { waitForNetworkIdle, waitForURLContains } from './utils/waits';

test.describe('Session Wizard', () => {
  test('plan mode shell renders for authenticated user', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();
  });

  test('log mode shell renders for authenticated user', async ({ page }) => {
    await page.goto('/sessions/new?mode=log', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();
  });

  test('log session end-to-end workflow succeeds and redirects to profile', async ({ page, request }) => {
    // Navigate to log session; authenticate if redirected
    await page.goto('/sessions/new?mode=log', { waitUntil: 'domcontentloaded' });
    if (/\/auth\/sign-in/.test(page.url())) {
      await loginViaUI(page, { redirectTo: '/sessions/new?mode=log' });
    }

    // Ensure the wizard form is visible
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();

    // Use a deterministic beach name without relying on API data
    const beachName = "Ocean Beach";

    // Fill Location
    const beachInput = page.locator('[data-testid="beach-search-input"]');
    await beachInput.fill(beachName);
   

    // Advance from the location step immediately after selecting the beach
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForNetworkIdle(page);

    // Set Date to today (allowed in log mode)
    const today = new Date().toISOString().split('T')[0];
    await page.locator('[data-testid="session-date-input"]').fill(today);

    // Advance steps until the final "Log Session" button is present
    // The wizard uses a Next button until the last step shows "Log Session".
    // Click Next up to 6 times (max steps) guarded by presence.
    for (let i = 0; i < 6; i++) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      const logBtn = page.getByRole('button', { name: 'Log Session' });
      if (await logBtn.isVisible().catch(() => false)) break;
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await waitForNetworkIdle(page);
      } else {
        break;
      }
    }

    // Click "Log Session"
    const logBtn = page.getByRole('button', { name: 'Log Session' });
    await expect(logBtn).toBeEnabled();
    await logBtn.click();

    // Expect success overlay text and redirect to profile
    await expect(page.getByText('Session Logged!', { exact: false })).toBeVisible({ timeout: 10_000 });
    await waitForURLContains(page, /\/profile$/);
  });

  test('plan session end-to-end workflow succeeds and redirects to profile', async ({ page }) => {
    // Navigate to plan session; authenticate if redirected
    await page.goto('/sessions/new?mode=plan', { waitUntil: 'domcontentloaded' });
    if (/\/auth\/sign-in/.test(page.url())) {
      await loginViaUI(page, { redirectTo: '/sessions/new?mode=plan' });
    }

    // Ensure the wizard form is visible
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();

    // Use a deterministic beach name without relying on API data
    const beachName = "Ocean Beach";

    // Fill Location
    const beachInput = page.locator('[data-testid="beach-search-input"]');
    await beachInput.fill(beachName);

    // Advance from the location step immediately after selecting the beach
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForNetworkIdle(page);

    // Set Date to tomorrow (required in plan mode)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await page.locator('[data-testid="session-date-input"]').fill(tomorrow);

    // Set Time (required in plan mode)
    await page.locator('[data-testid="session-time-input"]').fill('10:00');

    // Advance steps until the final "Plan Session" button is present
    // The wizard uses a Next button until the last step shows "Plan Session".
    // Click Next up to 6 times (max steps) guarded by presence.
    for (let i = 0; i < 6; i++) {
      const nextBtn = page.getByRole('button', { name: 'Next' });
      const planBtn = page.getByRole('button', { name: 'Plan Session' });
      if (await planBtn.isVisible().catch(() => false)) break;
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await waitForNetworkIdle(page);
      } else {
        break;
      }
    }

    // Click "Plan Session"
    const planBtn = page.getByRole('button', { name: 'Plan Session' });
    await expect(planBtn).toBeEnabled();
    await planBtn.click();

    // Expect success overlay text and redirect to profile
    await expect(page.getByText('Session Planned!', { exact: false })).toBeVisible({ timeout: 10_000 });
    await waitForURLContains(page, /\/profile$/);
  });
});


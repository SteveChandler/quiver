import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { loginViaUI } from './utils/auth';
import { waitForNetworkIdle, waitForURLContains } from './utils/waits';

test.describe('Session Wizard', () => {
  const isDev = (process.env.BASE_URL || '').includes('dev.quiversurf.app');
  test('plan mode shell renders for authenticated user', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();
  });

  test('log mode shell renders for authenticated user', async ({ page }) => {
    await page.goto('/sessions/new?mode=log', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();
  });

  // Run on dev now that mock-user RLS is allowed

  test.skip(isDev, 'Skipping log session flow on dev due to environment restrictions.');

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
    // Confirm selection if dropdown appears
    const suggestion = page.getByRole('option', { name: new RegExp(beachName, 'i') });
    if (await suggestion.isVisible().catch(() => false)) {
      await suggestion.click();
    }
   

    // Advance from the location step immediately after selecting the beach
    await page.getByRole('button', { name: 'Next' }).click();
    await waitForNetworkIdle(page);

    // Set Date to today (allowed in log mode)
    const today = new Date().toISOString().split('T')[0];
    await page.locator('[data-testid="session-date-input"]').fill(today);
    // Set a default time if present for logged sessions
    const timeInput = page.locator('[data-testid="session-time-input"]');
    if (await timeInput.isVisible().catch(() => false)) {
      await timeInput.fill('09:00');
    }

    // Fill minimal required conditions/ratings if the fields appear
    const overallRating = page.locator('[data-testid="overall-rating-input"]');
    if (await overallRating.isVisible().catch(() => false)) {
      await overallRating.fill('4');
    }
    const waveQuality = page.locator('[data-testid="wave-quality-input"]');
    if (await waveQuality.isVisible().catch(() => false)) {
      await waveQuality.fill('4');
    }
    const crowdLevel = page.locator('[data-testid="crowd-level-input"]');
    if (await crowdLevel.isVisible().catch(() => false)) {
      await crowdLevel.fill('3');
    }
    const parkingEase = page.locator('[data-testid="parking-ease-input"]');
    if (await parkingEase.isVisible().catch(() => false)) {
      await parkingEase.fill('4');
    }

    // Equip: Select a board if a selector is present
    const boardSelect = page.locator('[data-testid="board-select"]');
    if (await boardSelect.isVisible().catch(() => false)) {
      await boardSelect.click();
      const firstOption = page.getByRole('option').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
      }
    }

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

    // If still on wizard, try clicking Next until disabled then attempt submit again
    if (/\/sessions\/new\?mode=log/.test(page.url())) {
      for (let i = 0; i < 3; i++) {
        const nextBtn = page.getByRole('button', { name: 'Next' });
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await waitForNetworkIdle(page);
        }
      }
      const logBtn2 = page.getByRole('button', { name: 'Log Session' });
      if (await logBtn2.isVisible().catch(() => false)) {
        await logBtn2.click();
      }
    }
    await waitForURLContains(page, /\/profile$/);
  });

  // Run on dev now that mock-user RLS is allowed

  test.skip(isDev, 'Skipping plan session flow on dev due to environment restrictions.');

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

    // If still on wizard, advance/fallback submit
    if (/\/sessions\/new\?mode=plan/.test(page.url())) {
      for (let i = 0; i < 3; i++) {
        const nextBtn = page.getByRole('button', { name: 'Next' });
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await waitForNetworkIdle(page);
        }
      }
      const planBtn2 = page.getByRole('button', { name: 'Plan Session' });
      if (await planBtn2.isVisible().catch(() => false)) {
        await planBtn2.click();
      }
    }
    await waitForURLContains(page, /\/profile$/);
  });
});


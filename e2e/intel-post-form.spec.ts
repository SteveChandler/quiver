import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';

// Prefer a stable slug that exists in dev; allow override via env
const BEACH_SLUG = process.env.TEST_BEACH_SLUG || 'la-jolla-shores';

test.describe('@intel - Post Form (Beach)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, { redirectTo: `/beach/${BEACH_SLUG}?section=intel` });
  });

  test('opens Add Intel form, shows fields, toggles conditions, then cancel', async ({ page }) => {
    await page.goto(`/beach/${BEACH_SLUG}?section=intel`, { waitUntil: 'load' });

    // Expand "Local Intel" accordion if needed
    // Open accordion only if collapsed to avoid accidental close
    // Ensure content has loaded
    // Confirm we are on the beach page
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30000 });

    const intelCollapsed = page.getByRole('button', { name: /local intel/i, expanded: false });
    if (await intelCollapsed.isVisible().catch(() => false)) {
      await intelCollapsed.click();
    }

    // Open Add Intel dialog
    // Wait for Add Intel button to appear inside the section
    const skeletons = page.locator('[data-testid="loading-skeleton"]');
    if (await skeletons.first().isVisible().catch(() => false)) {
      await expect(skeletons).toHaveCount(0, { timeout: 30000 });
    }

    const addIntel = page.getByTestId('add-intel').first();
    await expect(addIntel).toBeVisible({ timeout: 20000 });
    await addIntel.click();

    // Dialog should appear with title "Share Intel"
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByRole('heading', { name: /share intel/i })).toBeVisible();

    // Core fields visible
    await expect(dialog.getByText(/intel type/i)).toBeVisible();
    await expect(dialog.getByLabel(/title/i)).toBeVisible();
    await expect(dialog.getByLabel(/description/i)).toBeVisible();

    // BeachIntelSection passes initialLocation, so location should be captured
    const locationCaptured = dialog.getByText(/location captured/i);
    if (await locationCaptured.isVisible().catch(() => false)) {
      await expect(locationCaptured).toBeVisible();
    } else {
      // Fallback: allow Get Location button if initialLocation not provided
      const getLocation = dialog.getByRole('button', { name: /get location|try again/i });
      await expect(getLocation).toBeVisible();
    }

    // Change intel type to Conditions and expect the conditions section to appear
    const intelType = dialog.getByRole('combobox').first();
    await expect(intelType).toBeVisible();
    await intelType.click();
    await page.getByRole('option', { name: /conditions/i }).click();
    await expect(dialog.getByText(/current surf conditions/i)).toBeVisible({ timeout: 10000 });

    // Close without submitting
    const cancel = dialog.getByRole('button', { name: /cancel/i });
    await cancel.click();
    await expect(dialog).toBeHidden({ timeout: 20000 });
  });
});

/**
 * Implicit Preference Privacy Controls E2E Tests
 *
 * Tests privacy controls for implicit tracking feature:
 * - Opt in/out toggle
 * - Clear browsing data functionality
 * - Settings persistence
 *
 * STATUS: All tests marked test.fixme() because the "Preferences" tab
 * and implicit tracking privacy controls do not exist in the current
 * profile page. The profile page has 5 tabs: Journal+, Quiver, Beaches,
 * Comments, Profile — none of which include the privacy toggle UI that
 * these tests expect. Re-implement when the privacy controls feature is
 * built into the profile page.
 *
 * @project auth
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import { createClient } from '@supabase/supabase-js';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

test.describe('Implicit Preference Privacy Controls', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await ensureAuthenticated(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Implicit Preference Privacy' });
  });

  /**
   * Helper function to navigate to profile preferences
   */
  async function navigateToPreferences(page: any) {
    await page.goto('/profile');
    await waitForPageLoad(page);

    // Click on Preferences tab if it exists
    const preferencesTab = page.getByRole('tab', { name: /preferences/i });
    const tabExists = await isVisibleSafe(preferencesTab);

    if (tabExists) {
      await preferencesTab.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
      await page.waitForTimeout(500);
    }
  }

  // All tests below are marked test.fixme() because the "Preferences" tab
  // does not exist in the current profile page implementation. The profile
  // tabs are: Journal+, Quiver, Beaches, Comments, Profile. The privacy
  // controls (tracking toggle, clear data button) were never built or
  // were removed. Re-enable when the feature is implemented.

  test.fixme('can opt out of implicit tracking', async ({ page }) => {
    // Preferences tab and privacy toggle do not exist in current profile page.
    await navigateToPreferences(page);

    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    const isCurrentlyEnabled = await trackingToggle.getAttribute('data-state');

    if (isCurrentlyEnabled === 'checked') {
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'unchecked');
    } else {
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'checked');
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'unchecked');
    }

    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    await page.reload();
    await waitForPageLoad(page);

    const preferencesTab = page.getByRole('tab', { name: /preferences/i });
    const tabExists = await isVisibleSafe(preferencesTab);
    if (tabExists) {
      await preferencesTab.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
      await page.waitForTimeout(500);
    }

    const toggleAfterReload = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();
    await expect(toggleAfterReload).toHaveAttribute('data-state', 'unchecked');
  });

  test.fixme('can opt back in to implicit tracking', async ({ page }) => {
    // Preferences tab and privacy toggle do not exist in current profile page.
    await navigateToPreferences(page);

    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    const currentState = await trackingToggle.getAttribute('data-state');
    if (currentState === 'checked') {
      await trackingToggle.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for toggle state transition
      await page.waitForTimeout(300);
    }

    await trackingToggle.click();
    await expect(trackingToggle).toHaveAttribute('data-state', 'checked');

    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    await page.reload();
    await waitForPageLoad(page);

    const preferencesTab = page.getByRole('tab', { name: /preferences/i });
    const tabExists = await isVisibleSafe(preferencesTab);
    if (tabExists) {
      await preferencesTab.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
      await page.waitForTimeout(500);
    }

    const toggleAfterReload = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();
    await expect(toggleAfterReload).toHaveAttribute('data-state', 'checked');
  });

  test.fixme('can clear browsing data when tracking is disabled', async ({ page }) => {
    // Preferences tab, privacy toggle, and clear data button do not exist.
    await navigateToPreferences(page);

    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    const currentState = await trackingToggle.getAttribute('data-state');
    if (currentState === 'checked') {
      await trackingToggle.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for toggle state transition
      await page.waitForTimeout(500);
    }

    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for UI state update after save
    await page.waitForTimeout(500);

    const clearButton = page.getByRole('button', { name: /clear browsing data/i });
    await expect(clearButton).toBeVisible({ timeout: 5000 });
    await clearButton.click();
    await expect(page.getByText(/browsing data cleared/i)).toBeVisible({ timeout: 5000 });
  });

  test.fixme('clear browsing data button is hidden when tracking is enabled', async ({ page }) => {
    // Preferences tab and privacy controls do not exist.
    await navigateToPreferences(page);

    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    const currentState = await trackingToggle.getAttribute('data-state');
    if (currentState !== 'checked') {
      await trackingToggle.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for toggle state transition
      await page.waitForTimeout(300);
    }

    const clearButton = page.getByRole('button', { name: /clear browsing data/i });
    const isVisible = await isVisibleSafe(clearButton);
    expect(isVisible).toBe(false);
  });

  test.fixme('privacy toggle has correct label and description', async ({ page }) => {
    // Preferences tab and privacy controls do not exist.
    await navigateToPreferences(page);

    const label = page.getByText(/improve recommendations with my activity/i);
    await expect(label).toBeVisible({ timeout: 10000 });

    const description = page.getByText(/uses your browsing behavior to personalize surf spot recommendations/i);
    await expect(description).toBeVisible();
  });

  test.fixme('mobile viewport displays privacy controls correctly', async ({ page }) => {
    // Preferences tab and privacy controls do not exist.
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToPreferences(page);

    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    const boundingBox = await trackingToggle.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(40);
    }

    await trackingToggle.click();
    const newState = await trackingToggle.getAttribute('data-state');
    expect(newState).toBeTruthy();
  });

  test.fixme('privacy section has shield icon and proper heading', async ({ page }) => {
    // Preferences tab and privacy controls do not exist.
    await navigateToPreferences(page);

    const privacyHeading = page.getByRole('heading', { name: /privacy/i }).or(
      page.locator('h3:has-text("Privacy")')
    );

    const headingExists = await isVisibleSafe(privacyHeading);
    const h3Heading = await isVisibleSafe(page.locator('h3:has-text("Privacy")'));

    expect(headingExists || h3Heading).toBe(true);

    const shieldIcon = page.locator('svg').filter({
      has: page.locator('path, circle')
    }).first();

    const iconExists = await isVisibleSafe(shieldIcon);
    if (!iconExists) {
      console.log('Note: Shield icon not found, but Privacy section exists');
    }
  });

  test.fixme('form validation allows saving without changing privacy settings', async ({ page }) => {
    // Preferences tab and privacy controls do not exist.
    await navigateToPreferences(page);

    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });
  });
});

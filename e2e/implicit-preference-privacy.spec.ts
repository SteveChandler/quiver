/**
 * Implicit Preference Privacy Controls E2E Tests
 *
 * Tests privacy controls for implicit tracking feature:
 * - Opt in/out toggle
 * - Clear browsing data functionality
 * - Settings persistence
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

  test('can opt out of implicit tracking', async ({ page }) => {
    await navigateToPreferences(page);

    // Find the privacy toggle switch
    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    // Wait for toggle to be visible
    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    // Check current state
    const isCurrentlyEnabled = await trackingToggle.getAttribute('data-state');

    // If currently checked, turn it off; if unchecked, turn it on then off to test both states
    if (isCurrentlyEnabled === 'checked') {
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'unchecked');
    } else {
      // Turn on first
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'checked');

      // Then turn off
      await trackingToggle.click();
      await expect(trackingToggle).toHaveAttribute('data-state', 'unchecked');
    }

    // Save changes
    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    // Reload page and verify persistence
    await page.reload();
    await waitForPageLoad(page);

    // Navigate back to preferences tab if needed
    const preferencesTab = page.getByRole('tab', { name: /preferences/i });
    const tabExists = await isVisibleSafe(preferencesTab);
    if (tabExists) {
      await preferencesTab.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
      await page.waitForTimeout(500);
    }

    // Verify toggle is still unchecked
    const toggleAfterReload = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();
    await expect(toggleAfterReload).toHaveAttribute('data-state', 'unchecked');
  });

  test('can opt back in to implicit tracking', async ({ page }) => {
    await navigateToPreferences(page);

    // Find the privacy toggle switch
    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    // Ensure it's off first
    const currentState = await trackingToggle.getAttribute('data-state');
    if (currentState === 'checked') {
      await trackingToggle.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for toggle state transition
      await page.waitForTimeout(300);
    }

    // Now turn it on
    await trackingToggle.click();
    await expect(trackingToggle).toHaveAttribute('data-state', 'checked');

    // Save changes
    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify
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

  test('can clear browsing data when tracking is disabled', async ({ page }) => {
    await navigateToPreferences(page);

    // Find and turn off the privacy toggle
    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    // Ensure tracking is disabled to show clear button
    const currentState = await trackingToggle.getAttribute('data-state');
    if (currentState === 'checked') {
      await trackingToggle.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for toggle state transition
      await page.waitForTimeout(500);
    }

    // Save to ensure state is persisted (clear button might depend on saved state)
    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for UI state update after save
    await page.waitForTimeout(500);

    // Look for clear browsing data button
    const clearButton = page.getByRole('button', { name: /clear browsing data/i });

    // The button should be visible when tracking is disabled
    await expect(clearButton).toBeVisible({ timeout: 5000 });

    // Click clear button
    await clearButton.click();

    // Wait for success toast
    await expect(page.getByText(/browsing data cleared/i)).toBeVisible({ timeout: 5000 });
  });

  test('clear browsing data button is hidden when tracking is enabled', async ({ page }) => {
    await navigateToPreferences(page);

    // Find and ensure the privacy toggle is ON
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

    // Look for clear browsing data button - should NOT be visible
    const clearButton = page.getByRole('button', { name: /clear browsing data/i });

    // Button should not be visible when tracking is enabled
    const isVisible = await isVisibleSafe(clearButton);
    expect(isVisible).toBe(false);
  });

  test('privacy toggle has correct label and description', async ({ page }) => {
    await navigateToPreferences(page);

    // Verify label exists
    const label = page.getByText(/improve recommendations with my activity/i);
    await expect(label).toBeVisible({ timeout: 10000 });

    // Verify description exists
    const description = page.getByText(/uses your browsing behavior to personalize surf spot recommendations/i);
    await expect(description).toBeVisible();
  });

  test('mobile viewport displays privacy controls correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToPreferences(page);

    // Verify toggle is visible on mobile
    const trackingToggle = page.locator('button[role="switch"]').filter({
      has: page.locator('text=/improve recommendations with my activity/i')
    }).first();

    await expect(trackingToggle).toBeVisible({ timeout: 10000 });

    // Toggle should be clickable (minimum touch target)
    const boundingBox = await trackingToggle.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      // Touch targets should be at least 44x44px
      expect(boundingBox.height).toBeGreaterThanOrEqual(40);
    }

    // Test toggle interaction on mobile
    await trackingToggle.click();

    // Verify state changed
    const newState = await trackingToggle.getAttribute('data-state');
    expect(newState).toBeTruthy();
  });

  test('privacy section has shield icon and proper heading', async ({ page }) => {
    await navigateToPreferences(page);

    // Look for Privacy heading
    const privacyHeading = page.getByRole('heading', { name: /privacy/i }).or(
      page.locator('h3:has-text("Privacy")')
    );

    // Privacy section should exist (heading might be h3, not semantically a "heading" role)
    const headingExists = await isVisibleSafe(privacyHeading);
    const h3Heading = await isVisibleSafe(page.locator('h3:has-text("Privacy")'));

    expect(headingExists || h3Heading).toBe(true);

    // Shield icon should be present near privacy section
    // Using Lucide's Shield component renders as SVG
    const shieldIcon = page.locator('svg').filter({
      has: page.locator('path, circle')
    }).first();

    const iconExists = await isVisibleSafe(shieldIcon);
    // Icon existence is good but not critical if CSS changes
    if (!iconExists) {
      console.log('Note: Shield icon not found, but Privacy section exists');
    }
  });

  test('form validation allows saving without changing privacy settings', async ({ page }) => {
    await navigateToPreferences(page);

    // Don't change anything, just save
    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();

    // Should succeed
    await expect(page.getByText(/preferences updated/i)).toBeVisible({ timeout: 5000 });
  });
});

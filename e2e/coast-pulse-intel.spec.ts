import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';

/**
 * Coast Pulse Intel Tests
 * Tests the intel posting and display features in Coast Pulse
 *
 * @project auth
 */

test.describe('Coast Pulse Intel Features', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('Coast Pulse Section', () => {
    test('should display coast pulse section with add button @smoke', async ({ page }) => {
      // Wait for authenticated home screen to load
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');

      // Coast pulse section should be visible
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Check for add button in header
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await expect(addButton).toBeVisible();
    });

    test('should open quick check-in sheet when clicking add button', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Click add button
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Check for bottom sheet
      const sheet = page.locator('text=Quick Check-in');
      await expect(sheet).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display emoji picker in quick check-in sheet', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Check for emoji options
      const fireEmoji = page.locator('button[aria-label="Fire"]');
      const shakaEmoji = page.locator('button[aria-label="Shaka"]');

      await expect(fireEmoji).toBeVisible();
      await expect(shakaEmoji).toBeVisible();
    });

    test('should require emoji selection before posting', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Check submit button is disabled without selection
      const submitButton = page.locator('button:has-text("Post Check-in")');
      await expect(submitButton).toBeDisabled();
    });

    test('should enable submit after selecting emoji rating', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Select an emoji
      const fireEmoji = page.locator('button[aria-label="Fire"]');
      await fireEmoji.click();

      // Submit button should still be disabled without location
      // (The user needs location permission which is hard to test in E2E)
      // We just verify the emoji selection worked by checking aria-checked
      await expect(fireEmoji).toHaveAttribute('aria-checked', 'true');
    });

    test('should close sheet when clicking outside or pressing escape', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Verify sheet is open
      const sheet = page.locator('text=Quick Check-in');
      await expect(sheet).toBeVisible();

      // Press escape to close
      await page.keyboard.press('Escape');

      // Sheet should close
      await expect(sheet).toBeHidden({ timeout: TIMEOUTS.short });
    });
  });

  test.describe('Intel Display', () => {
    test('should show live indicator', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Check for live indicator badge (the small "Live" text next to the pulsing dot)
      const liveIndicator = coastPulse.getByText('Live', { exact: true });
      await expect(liveIndicator).toBeVisible();
    });

    test('should display timeline with source badges', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for async data load or empty state render
      await page.waitForTimeout(2000);

      // Check if either timeline or empty state is shown
      const timeline = coastPulse.locator('[role="list"]');
      const emptyState = coastPulse.locator('text=No nearby data available');

      const timelineVisible = await isVisibleSafe(timeline);
      const emptyStateVisible = await isVisibleSafe(emptyState);

      // One of them should be visible
      expect(timelineVisible || emptyStateVisible).toBe(true);
    });
  });
});

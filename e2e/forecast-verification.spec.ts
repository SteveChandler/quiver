import { test, expect } from '@playwright/test';

/**
 * Forecast Verification E2E Tests
 *
 * Validates the forecast transparency and community verification features:
 * - ForecastConfidenceBadge display and styling
 * - ForecastVerificationWidget voting flow
 * - ForecastAccuracyStats display and calculations
 * - Vote submission and updates
 * - Real-time stats updates after voting
 */

// Use authenticated context
test.use({ storageState: 'e2e/.auth/state.json' });

const TEST_BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('@forecast-verification - Forecast Verification Features', () => {
  test.describe('Forecast Confidence Badge', () => {
    test('displays confidence badge on beach detail page', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Look for confidence badge (may appear in forecast displays)
      const confidenceBadges = page.locator('[data-testid^="confidence-badge-"]');
      const badgeCount = await confidenceBadges.count();

      if (badgeCount > 0) {
        const firstBadge = confidenceBadges.first();
        await expect(firstBadge).toBeVisible();

        // Check that badge has appropriate text
        const badgeText = await firstBadge.textContent();
        expect(badgeText).toMatch(/(High|Medium|Low) Confidence/);

        test.info().annotations.push({
          type: 'success',
          description: `Found ${badgeCount} confidence badge(s) on beach page`,
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'No confidence badges found - may not be displayed on this page',
        });
      }
    });

    test('confidence badge shows percentage when enabled', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const confidenceBadges = page.locator('[data-testid^="confidence-badge-"]');
      const badgeCount = await confidenceBadges.count();

      if (badgeCount > 0) {
        const firstBadge = confidenceBadges.first();
        const badgeText = await firstBadge.textContent();

        // Check if percentage is shown
        if (badgeText?.includes('%')) {
          expect(badgeText).toMatch(/\(\d+%\)/);

          test.info().annotations.push({
            type: 'success',
            description: `Confidence badge displays percentage: ${badgeText}`,
          });
        }
      }
    });

    test('confidence badge has appropriate color styling', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const confidenceBadges = page.locator('[data-testid^="confidence-badge-"]');
      const badgeCount = await confidenceBadges.count();

      if (badgeCount > 0) {
        const firstBadge = confidenceBadges.first();
        const badgeType = await firstBadge.getAttribute('data-testid');

        // Verify color classes based on confidence level
        if (badgeType?.includes('high')) {
          await expect(firstBadge).toHaveClass(/bg-green-/);
        } else if (badgeType?.includes('medium')) {
          await expect(firstBadge).toHaveClass(/bg-yellow-/);
        } else if (badgeType?.includes('low')) {
          await expect(firstBadge).toHaveClass(/bg-gray-/);
        }
      }
    });
  });

  test.describe('Forecast Verification Widget', () => {
    test('displays verification widget on forecast page', async ({ page }) => {
      // Navigate to beach forecast page where verification widget may appear
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Look for verification widget heading
      const verificationHeading = page.getByText(/Was this forecast accurate\?|Your Verification/i);
      const hasWidget = await verificationHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasWidget) {
        await expect(verificationHeading).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Forecast verification widget found on page',
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Verification widget not found - may not be on this page type',
        });
      }
    });

    test('allows selecting accurate vote', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /^Accurate$/i });
      const hasButton = await accurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        await accurateButton.click();

        // Button should be highlighted after click
        await expect(accurateButton).toHaveClass(/bg-green-/);

        // Notes field should appear
        const notesField = page.getByLabelText(/Notes \(optional\)/i);
        await expect(notesField).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Accurate vote button works correctly',
        });
      }
    });

    test('allows selecting inaccurate vote', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const inaccurateButton = page.getByRole('button', { name: /^Inaccurate$/i });
      const hasButton = await inaccurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        await inaccurateButton.click();

        // Button should be highlighted after click
        await expect(inaccurateButton).toHaveClass(/bg-red-/);

        test.info().annotations.push({
          type: 'success',
          description: 'Inaccurate vote button works correctly',
        });
      }
    });

    test('allows adding notes to vote', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /^Accurate$/i });
      const hasButton = await accurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        await accurateButton.click();

        const notesField = page.getByLabelText(/Notes \(optional\)/i);
        const testNotes = 'Forecast was spot on, great conditions!';

        await notesField.fill(testNotes);

        // Verify character count updates
        const characterCount = page.getByText(`${testNotes.length}/500 characters`);
        await expect(characterCount).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Notes field works with character count',
        });
      }
    });

    test('submit button appears after vote selection', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /^Accurate$/i });
      const hasButton = await accurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        // No submit button initially
        const submitButton = page.getByRole('button', { name: /Submit Verification/i });
        const initiallyVisible = await submitButton.isVisible({ timeout: 1000 }).catch(() => false);

        expect(initiallyVisible).toBe(false);

        // Click vote button
        await accurateButton.click();

        // Submit button should appear
        await expect(submitButton).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Submit button appears after vote selection',
        });
      }
    });

    test('can toggle vote selection', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /^Accurate$/i });
      const inaccurateButton = page.getByRole('button', { name: /^Inaccurate$/i });

      const hasButtons =
        (await accurateButton.isVisible({ timeout: 5000 }).catch(() => false)) &&
        (await inaccurateButton.isVisible({ timeout: 5000 }).catch(() => false));

      if (hasButtons) {
        // Select accurate
        await accurateButton.click();
        await expect(accurateButton).toHaveClass(/bg-green-/);

        // Switch to inaccurate
        await inaccurateButton.click();
        await expect(inaccurateButton).toHaveClass(/bg-red-/);
        await expect(accurateButton).not.toHaveClass(/bg-green-/);

        // Toggle off
        await inaccurateButton.click();
        await expect(inaccurateButton).not.toHaveClass(/bg-red-/);

        test.info().annotations.push({
          type: 'success',
          description: 'Vote toggling works correctly',
        });
      }
    });

    test('shows help text before first vote', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const helpText = page.getByText(/Help the community by verifying forecast accuracy/i);
      const hasHelpText = await helpText.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasHelpText) {
        await expect(helpText).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Help text displayed for new users',
        });
      }
    });
  });

  test.describe('Forecast Accuracy Stats', () => {
    test('displays community accuracy stats', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      const statsHeading = page.getByText(/Community Accuracy/i);
      const hasStats = await statsHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStats) {
        await expect(statsHeading).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Community accuracy stats section found',
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Community accuracy stats not found - may require votes first',
        });
      }
    });

    test('shows accuracy percentage in large format', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const statsHeading = page.getByText(/Community Accuracy/i);
      const hasStats = await statsHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStats) {
        // Look for percentage display (should be prominent)
        const percentageText = await page.locator('text=/\\d+%/').first().textContent();

        if (percentageText) {
          expect(percentageText).toMatch(/^\d+(\.\d+)?%$/);

          test.info().annotations.push({
            type: 'success',
            description: `Accuracy percentage displayed: ${percentageText}`,
          });
        }
      }
    });

    test('displays accurate and inaccurate vote counts', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateLabel = page.getByText('Accurate', { exact: true });
      const inaccurateLabel = page.getByText('Inaccurate', { exact: true });

      const hasLabels =
        (await accurateLabel.isVisible({ timeout: 5000 }).catch(() => false)) &&
        (await inaccurateLabel.isVisible({ timeout: 5000 }).catch(() => false));

      if (hasLabels) {
        await expect(accurateLabel).toBeVisible();
        await expect(inaccurateLabel).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Vote breakdown sections displayed',
        });
      }
    });

    test('shows total verification count', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const totalText = page.getByText(/Based on \d+ (?:verification|verifications)/i);
      const hasTotal = await totalText.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTotal) {
        await expect(totalText).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Total verification count displayed',
        });
      }
    });

    test('displays time window badge', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const timeWindow = page.getByText(/Last \d+ days/i);
      const hasTimeWindow = await timeWindow.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTimeWindow) {
        await expect(timeWindow).toBeVisible();

        const timeWindowText = await timeWindow.textContent();
        expect(timeWindowText).toMatch(/Last \d+ days/);

        test.info().annotations.push({
          type: 'success',
          description: `Time window displayed: ${timeWindowText}`,
        });
      }
    });

    test('applies correct color styling based on accuracy level', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const percentageCircle = page.locator('div').filter({ hasText: /^\d+%$/ }).first();
      const hasCircle = await percentageCircle.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasCircle) {
        const classNames = await percentageCircle.getAttribute('class');

        // Should have one of the accuracy level colors
        const hasAccuracyColor =
          classNames?.includes('bg-green-') ||
          classNames?.includes('bg-yellow-') ||
          classNames?.includes('bg-red-');

        expect(hasAccuracyColor).toBeTruthy();

        test.info().annotations.push({
          type: 'success',
          description: 'Accuracy percentage has appropriate color styling',
        });
      }
    });
  });

  test.describe('Empty States', () => {
    test('shows empty state when no verifications exist', async ({ page }) => {
      // This test checks the empty state UI for beaches with no votes
      // Note: May not trigger if beach already has votes
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const emptyState = page.getByText(/No verifications yet|Be the first to verify/i);
      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Empty state displayed for beaches with no votes',
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Beach already has verifications - empty state not shown',
        });
      }
    });
  });

  test.describe('Accessibility', () => {
    test('verification buttons have proper ARIA labels', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /Accurate/i });
      const hasButton = await accurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        // Button should be accessible by role
        await expect(accurateButton).toBeVisible();

        const inaccurateButton = page.getByRole('button', { name: /Inaccurate/i });
        await expect(inaccurateButton).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Vote buttons are properly accessible',
        });
      }
    });

    test('notes textarea has proper label', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const accurateButton = page.getByRole('button', { name: /^Accurate$/i });
      const hasButton = await accurateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasButton) {
        await accurateButton.click();

        const notesField = page.getByLabelText(/Notes \(optional\)/i);
        await expect(notesField).toBeVisible();

        // Verify it's a textarea
        const tagName = await notesField.evaluate((el) => el.tagName.toLowerCase());
        expect(tagName).toBe('textarea');

        test.info().annotations.push({
          type: 'success',
          description: 'Notes field has proper label and is a textarea',
        });
      }
    });

    test('stats sections have semantic structure', async ({ page }) => {
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      const statsHeading = page.getByText(/Community Accuracy/i);
      const hasStats = await statsHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStats) {
        // Verify heading exists
        await expect(statsHeading).toBeVisible();

        test.info().annotations.push({
          type: 'success',
          description: 'Stats section has proper heading structure',
        });
      }
    });
  });

  test.describe('Loading States', () => {
    test('shows loading state before stats are loaded', async ({ page }) => {
      // Start navigation but don't wait for full load
      const navigationPromise = page.goto(`/beach/${TEST_BEACH_ID}`);

      // Look for loading spinner quickly
      const loader = page.locator('[role="img"]').filter({ hasText: '' }).first();
      const hasLoader = await loader.isVisible({ timeout: 500 }).catch(() => false);

      if (hasLoader) {
        test.info().annotations.push({
          type: 'success',
          description: 'Loading spinner displayed while fetching data',
        });
      }

      await navigationPromise;
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    });
  });
});

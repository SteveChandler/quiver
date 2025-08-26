import { test, expect } from '@playwright/test';

test.describe('Session Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the session wizard page
    await page.goto('/sessions/new?mode=plan');
  });

  test.describe('Wizard Navigation', () => {
    test('should display initial wizard state correctly', async ({ page }) => {
      // Check page title and step indicator
      await expect(page.getByRole('heading', { name: /plan session/i })).toBeVisible();
      await expect(page.getByText('Step 1 of 6')).toBeVisible();
      
      // Check first step content
      await expect(page.getByRole('heading', { name: /location/i })).toBeVisible();
      await expect(page.getByText('Choose where you\'ll be surfing')).toBeVisible();
      
      // Check navigation buttons state
      await expect(page.getByRole('button', { name: /back/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    test('should navigate through wizard steps correctly', async ({ page }) => {
      // Fill location step
      await page.getByTestId('beach-input').fill('Malibu');
      await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
      
      // Navigate to next step
      await page.getByRole('button', { name: /next/i }).click();
      
      // Check second step
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
      await expect(page.getByRole('heading', { name: /when/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      
      // Fill date and time
      await page.getByTestId('date-input').fill('2024-12-25');
      await page.getByTestId('time-input').fill('06:00');
      
      // Continue to next step
      await page.getByRole('button', { name: /next/i }).click();
      await expect(page.getByText('Step 3 of 6')).toBeVisible();
    });

    test('should allow going back to previous steps', async ({ page }) => {
      // Navigate forward first
      await page.getByTestId('beach-input').fill('Venice Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-25');
      await page.getByTestId('time-input').fill('07:00');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Now go back
      await page.getByRole('button', { name: /back/i }).click();
      
      // Should be on datetime step
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
      await expect(page.getByTestId('date-input')).toHaveValue('2024-12-25');
      
      // Go back again
      await page.getByRole('button', { name: /back/i }).click();
      
      // Should be on location step
      await expect(page.getByText('Step 1 of 6')).toBeVisible();
      await expect(page.getByTestId('beach-input')).toHaveValue('Venice Beach');
    });

    test('should validate required fields before allowing navigation', async ({ page }) => {
      // Next button should be disabled initially
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
      
      // Fill partial data
      await page.getByTestId('beach-input').fill('Santa Monica');
      await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
      
      // Navigate and check validation on datetime step
      await page.getByRole('button', { name: /next/i }).click();
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
      
      // Fill only date (should still be disabled for plan mode)
      await page.getByTestId('date-input').fill('2024-12-25');
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
      
      // Fill time (should enable next)
      await page.getByTestId('time-input').fill('08:00');
      await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
    });
  });

  test.describe('Progress Tracking', () => {
    test('should show correct progress throughout the wizard', async ({ page }) => {
      // Initial progress
      await expect(page.getByTestId('progress-fill')).toBeVisible();
      await expect(page.getByText('0 of 6 steps completed')).toBeVisible();
      
      // Complete first step
      await page.getByTestId('beach-input').fill('Huntington Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Progress should update
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
      
      // Complete second step
      await page.getByTestId('date-input').fill('2024-12-30');
      await page.getByTestId('time-input').fill('09:00');
      await page.getByRole('button', { name: /next/i }).click();
      
      await expect(page.getByText('Step 3 of 6')).toBeVisible();
    });

    test('should allow clicking on completed steps to navigate', async ({ page }) => {
      // Progress through a few steps first
      await page.getByTestId('beach-input').fill('Manhattan Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-28');
      await page.getByTestId('time-input').fill('10:00');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Now click on a previous step indicator
      await page.getByTestId('step-indicator-0').click();
      
      // Should navigate back to first step
      await expect(page.getByText('Step 1 of 6')).toBeVisible();
      await expect(page.getByTestId('beach-input')).toHaveValue('Manhattan Beach');
    });
  });

  test.describe('Form Persistence', () => {
    test('should save and restore form data', async ({ page }) => {
      // Fill out some form data
      await page.getByTestId('beach-input').fill('El Segundo Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-29');
      await page.getByTestId('time-input').fill('11:00');
      
      // Wait for autosave
      await page.waitForTimeout(2000);
      
      // Refresh the page
      await page.reload();
      
      // Data should be restored (assuming localStorage persistence works)
      // Note: This might need authentication context in real tests
      await expect(page.getByTestId('beach-input')).toHaveValue('El Segundo Beach');
    });

    test('should show autosave status', async ({ page }) => {
      // Make a change and look for autosave indicators
      await page.getByTestId('beach-input').fill('Redondo Beach');
      
      // Should eventually show saved status
      // Note: This is timing-dependent and might need adjustment
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Guidance and Hints', () => {
    test('should show helpful hints for incomplete steps', async ({ page }) => {
      // Should show hints initially when step is incomplete
      await expect(page.getByTestId('guidance-hint')).toBeVisible();
      await expect(page.getByText('Select a beach from the dropdown')).toBeVisible();
    });

    test('should hide hints when step is completed', async ({ page }) => {
      // Fill the step
      await page.getByTestId('beach-input').fill('Newport Beach');
      
      // Hints should be hidden or updated
      await expect(page.getByTestId('guidance-hint')).not.toBeVisible();
    });
  });

  test.describe('Wizard Completion', () => {
    test('should complete planning wizard successfully', async ({ page }) => {
      // Fill out all required steps
      await page.getByTestId('beach-input').fill('Laguna Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-31');
      await page.getByTestId('time-input').fill('12:00');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Skip through remaining optional steps
      await page.getByRole('button', { name: /next/i }).click(); // Optimal times
      await page.getByRole('button', { name: /next/i }).click(); // Gear
      await page.getByRole('button', { name: /next/i }).click(); // Goals
      
      // Should reach final step
      await expect(page.getByText('Step 6 of 6')).toBeVisible();
      await expect(page.getByRole('button', { name: /plan session/i })).toBeVisible();
      
      // Should show completion celebration
      await expect(page.getByTestId('completion-celebration')).toBeVisible();
    });

    test('should show different completion for log mode', async ({ page }) => {
      // Navigate to log mode
      await page.goto('/sessions/new?mode=log');
      
      await expect(page.getByRole('heading', { name: /log session/i })).toBeVisible();
      
      // Complete required steps for logging
      await page.getByTestId('beach-input').fill('Crystal Cove');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-20');
      
      // Navigate through log-specific steps
      await page.getByRole('button', { name: /next/i }).click();
      
      // Skip through remaining steps to completion
      // Note: Log mode has different steps than plan mode
      while (await page.getByRole('button', { name: /next/i }).isVisible()) {
        await page.getByRole('button', { name: /next/i }).click();
      }
      
      // Should show log session completion
      await expect(page.getByRole('button', { name: /log session/i })).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to complete the wizard
      await page.getByTestId('beach-input').fill('Test Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await page.getByTestId('date-input').fill('2024-12-25');
      await page.getByTestId('time-input').fill('06:00');
      
      // Navigate to final step and try to submit
      while (await page.getByRole('button', { name: /next/i }).isVisible()) {
        await page.getByRole('button', { name: /next/i }).click();
      }
      
      await page.getByRole('button', { name: /plan session/i }).click();
      
      // Should show error message
      await expect(page.getByText(/failed to create session/i)).toBeVisible({ timeout: 10000 });
    });

    test('should validate form data before submission', async ({ page }) => {
      // Try to navigate without filling required fields
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
      
      // Fill invalid data
      await page.getByTestId('beach-input').fill(''); // Empty beach
      await expect(page.getByRole('button', { name: /next/i })).toBeDisabled();
      
      // Fill valid data
      await page.getByTestId('beach-input').fill('Valid Beach');
      await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible via keyboard navigation', async ({ page }) => {
      // Tab through the interface
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('beach-input')).toBeFocused();
      
      // Fill and navigate
      await page.keyboard.type('Keyboard Beach');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Click next
      
      // Should advance to next step
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
    });

    test('should announce step changes to screen readers', async ({ page }) => {
      // Check for ARIA live regions
      await expect(page.getByTestId('progress-announcement')).toHaveAttribute('aria-live', 'polite');
      
      // Navigate and check announcements
      await page.getByTestId('beach-input').fill('Accessible Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Progress announcement should update
      await expect(page.getByTestId('progress-announcement')).toContainText('Step 2 of 6');
    });

    test('should support reduced motion preferences', async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      
      // The wizard should still function but with reduced animations
      await page.getByTestId('beach-input').fill('Low Motion Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      // Should still navigate successfully
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should hide bottom navigation on wizard pages', async ({ page }) => {
      // Wait for authentication to complete and wizard to load
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /plan session/i })).toBeVisible();
      
      // Bottom navigation should not be visible on session wizard
      await expect(page.getByTestId('bottom-navigation')).not.toBeVisible();
      
      // Wizard footer should be visible and clickable
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      
      // Fill form to enable next button
      await page.getByTestId('beach-input').fill('Test Beach');
      await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
      
      // Click next button should work (not covered by bottom nav)
      await page.getByRole('button', { name: /next/i }).click();
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
      
      // Back button should also be visible and clickable
      await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /back/i })).toBeEnabled();
    });

    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Should still display correctly
      await expect(page.getByRole('heading', { name: /plan session/i })).toBeVisible();
      await expect(page.getByTestId('beach-input')).toBeVisible();
      
      // Navigation should work
      await page.getByTestId('beach-input').fill('Mobile Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
    });

    test('should adapt to tablet size', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Should show step labels on larger screens
      await expect(page.getByText('Step 1')).toBeVisible();
      
      // Functionality should be preserved
      await page.getByTestId('beach-input').fill('Tablet Beach');
      await page.getByRole('button', { name: /next/i }).click();
      
      await expect(page.getByText('Step 2 of 6')).toBeVisible();
    });
  });
});
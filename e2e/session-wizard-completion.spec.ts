import { test, expect } from '@playwright/test';

test.describe('Session Wizard Completion Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the session wizard page
    await page.goto('/sessions/new?mode=plan');
    
    // Wait for authentication to complete
    await page.waitForLoadState('networkidle');
  });

  test('should complete plan session wizard without User ID mismatch error', async ({ page }) => {
    // Wait for the wizard to load
    await expect(page.getByRole('heading', { name: /plan session/i })).toBeVisible();
    
    // Fill location step
    await page.getByTestId('beach-input').fill('Test Beach for Completion');
    await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
    await page.getByRole('button', { name: /next/i }).click();
    
    // Fill date and time
    await expect(page.getByText('Step 2 of 6')).toBeVisible();
    await page.getByTestId('date-input').fill('2024-12-25');
    await page.getByTestId('time-input').fill('06:00');
    await page.getByRole('button', { name: /next/i }).click();
    
    // Skip through optional steps to reach completion
    let stepCount = 3;
    while (await page.getByRole('button', { name: /next/i }).isVisible() && stepCount <= 6) {
      await page.getByRole('button', { name: /next/i }).click();
      stepCount++;
      
      // Safety check to prevent infinite loop
      if (stepCount > 10) break;
    }
    
    // Should be on the final step
    await expect(page.getByText('Step 6 of 6')).toBeVisible();
    await expect(page.getByRole('button', { name: /plan session/i })).toBeVisible();
    
    // Click the Plan Session button
    await page.getByRole('button', { name: /plan session/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/creating session/i)).toBeVisible();
    
    // Wait for completion (should redirect to profile)
    await page.waitForURL('/profile', { timeout: 10000 });
    
    // Should be on profile page
    await expect(page).toHaveURL('/profile');
    
    // Should show success message
    await expect(page.getByText(/session planned successfully/i)).toBeVisible();
  });

  test('should complete log session wizard without User ID mismatch error', async ({ page }) => {
    // Navigate to log mode
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');
    
    // Wait for the wizard to load
    await expect(page.getByRole('heading', { name: /log session/i })).toBeVisible();
    
    // Fill location step
    await page.getByTestId('beach-input').fill('Test Beach for Log Completion');
    await expect(page.getByRole('button', { name: /next/i })).toBeEnabled();
    await page.getByRole('button', { name: /next/i }).click();
    
    // Fill date (time is optional for log mode)
    await expect(page.getByText('Step 2 of')).toBeVisible();
    await page.getByTestId('date-input').fill('2024-12-20');
    await page.getByRole('button', { name: /next/i }).click();
    
    // Skip through remaining steps to completion
    let stepCount = 3;
    while (await page.getByRole('button', { name: /next/i }).isVisible() && stepCount <= 6) {
      await page.getByRole('button', { name: /next/i }).click();
      stepCount++;
      
      // Safety check to prevent infinite loop
      if (stepCount > 10) break;
    }
    
    // Should reach final step
    await expect(page.getByRole('button', { name: /log session/i })).toBeVisible();
    
    // Click the Log Session button
    await page.getByRole('button', { name: /log session/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/creating session/i)).toBeVisible();
    
    // Wait for completion (should redirect to profile)
    await page.waitForURL('/profile', { timeout: 10000 });
    
    // Should be on profile page
    await expect(page).toHaveURL('/profile');
    
    // Should show success message
    await expect(page.getByText(/session logged successfully/i)).toBeVisible();
  });

  test('should handle session creation errors gracefully', async ({ page }) => {
    // Mock a network failure
    await page.route('**/api/**', route => route.abort());
    
    // Complete the wizard
    await expect(page.getByRole('heading', { name: /plan session/i })).toBeVisible();
    
    // Fill required fields
    await page.getByTestId('beach-input').fill('Test Beach');
    await page.getByRole('button', { name: /next/i }).click();
    
    await page.getByTestId('date-input').fill('2024-12-25');
    await page.getByTestId('time-input').fill('06:00');
    
    // Skip to final step
    while (await page.getByRole('button', { name: /next/i }).isVisible()) {
      await page.getByRole('button', { name: /next/i }).click();
    }
    
    // Try to complete the session
    await page.getByRole('button', { name: /plan session/i }).click();
    
    // Should show error message (not User ID mismatch)
    await expect(page.getByText(/failed to create session/i)).toBeVisible({ timeout: 10000 });
    
    // Should NOT show "User ID mismatch" error
    await expect(page.getByText(/user id mismatch/i)).not.toBeVisible();
  });
});
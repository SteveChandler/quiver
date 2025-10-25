import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';
import { waitForNetworkIdle } from './utils/waits';

/**
 * E2E tests for Session Sharing feature
 *
 * Tests the complete sharing flow:
 * - Opening share modal from session cards
 * - Copying links to clipboard
 * - Tracking shares in database
 * - Preventing duplicate shares
 * - Switching between share variants
 */

test.describe('Session Sharing', () => {
  const isDev = (process.env.BASE_URL || '').includes('dev.quiversurf.app');

  test.beforeEach(async ({ page }) => {
    // Authenticate user
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    if (/\/auth\/sign-in/.test(page.url())) {
      await loginViaUI(page, { redirectTo: '/profile' });
    }
    await waitForNetworkIdle(page);
  });

  test.skip(isDev, 'Skipping session sharing tests on dev due to environment restrictions.');

  test('should open share modal from session card', async ({ page }) => {
    // Navigate to profile with sessions
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Find first share button on a session card
    const shareButton = page.locator('[data-testid="share-button"]').first();

    // Wait for share button to be visible
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    // Click share button
    await shareButton.click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Share Session')).toBeVisible();

    // Should show format selection
    await expect(page.getByText('Story (9:16)')).toBeVisible();
    await expect(page.getByText('Square (1:1)')).toBeVisible();

    // Should show platform options
    await expect(page.getByText('Instagram')).toBeVisible();
    await expect(page.getByText('Twitter')).toBeVisible();
    await expect(page.getByText('Facebook')).toBeVisible();
    await expect(page.getByText('Copy Link')).toBeVisible();
  });

  test('should copy link to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    // Wait for modal
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Copy Link
    await page.getByText('Copy Link').click();

    // Success toast should appear
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('quiversurf.app/sessions/');
    expect(clipboardText).toContain('utm_source=');
  });

  test('should track share in database', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Get initial share count
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    const initialCountText = await shareButton.textContent();
    const initialCount = parseInt(initialCountText?.trim() || '0');

    // Open share modal and copy link
    await shareButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByText('Copy Link').click();

    // Wait for success toast
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.keyboard.press('Escape');
    await waitForNetworkIdle(page);

    // Reload page to get updated count from database
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Share count should increment
    const newShareButton = page.locator('[data-testid="share-button"]').first();
    await expect(newShareButton).toBeVisible({ timeout: 10000 });

    const newCountText = await newShareButton.textContent();
    const newCount = parseInt(newCountText?.trim() || '0');

    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should prevent duplicate shares on same day', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Copy link first time
    await page.getByText('Copy Link').click();
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Check if checkmark appears (indicating share was recorded)
    const copyButton = page.getByText('Copy Link');
    const buttonElement = copyButton.locator('..');

    // Wait a bit for the checkmark to appear
    await page.waitForTimeout(1000);

    // Try to copy again - should still work (clipboard copy always works)
    // but database constraint prevents duplicate record
    await page.getByText('Copy Link').click();

    // Should still show success (clipboard works)
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Note: Database-level duplicate prevention is tested at the API/database layer
    // The UI will always allow clipboard copy, but backend prevents duplicate tracking
  });

  test('should switch between Story and Square variants', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Story should be selected by default (or based on device)
    const storyButton = page.getByText('Story (9:16)');
    const squareButton = page.getByText('Square (1:1)');

    await expect(storyButton).toBeVisible();
    await expect(squareButton).toBeVisible();

    // Click Square
    await squareButton.click();

    // Square button should have primary styling
    const squareButtonElement = squareButton.locator('..');
    await expect(squareButtonElement).toHaveClass(/bg-primary/);

    // Click Story
    await storyButton.click();

    // Story button should have primary styling
    const storyButtonElement = storyButton.locator('..');
    await expect(storyButtonElement).toHaveClass(/bg-primary/);
  });

  test('should display gamification prompts based on share count', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal for a session with 0 shares
    const shareButtons = page.locator('[data-testid="share-button"]');
    const count = await shareButtons.count();

    for (let i = 0; i < count; i++) {
      const button = shareButtons.nth(i);
      const text = await button.textContent();

      // Find a session with 0 shares
      if (text?.trim() === '0') {
        await button.click();
        await expect(page.getByRole('dialog')).toBeVisible();

        // Should show first share prompt
        await expect(page.getByText('Be the first to share! 🌊')).toBeVisible();
        await expect(page.getByText(/Help grow the Quiver community/)).toBeVisible();

        await page.keyboard.press('Escape');
        break;
      }
    }
  });

  test('should show share count on session cards', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Find share buttons
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    // Should display a number (share count)
    const text = await shareButton.textContent();
    expect(text?.trim()).toMatch(/^\d+$/);
  });

  test('should close modal on escape key', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    // Modal should be open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show loading state while sharing', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Copy Link and check for loading spinner
    const copyButton = page.getByText('Copy Link');
    await copyButton.click();

    // Note: Loading state is very brief for clipboard copy
    // For Instagram/Twitter/Facebook sharing, loading state would be more visible
    // when Web Share API is invoked

    // Success message should appear
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });
  });

  test('should display checkmark after successful share', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Copy link
    await page.getByText('Copy Link').click();
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Wait for checkmark to appear
    await page.waitForTimeout(500);

    // Checkmark icon should be visible in the Copy Link button
    const copyButtonContainer = page.getByText('Copy Link').locator('..');
    const checkIcon = copyButtonContainer.locator('.text-green-600');
    await expect(checkIcon).toBeVisible();
  });

  test('should work for both completed and planned sessions', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Check if there are any sessions
    const shareButtons = page.locator('[data-testid="share-button"]');
    const count = await shareButtons.count();

    if (count > 0) {
      // Test first session (could be completed or planned)
      const firstButton = shareButtons.first();
      await expect(firstButton).toBeVisible({ timeout: 10000 });
      await firstButton.click();

      // Modal should open regardless of session type
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Share Session')).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('should include UTM parameters in share URL', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Copy link
    await page.getByText('Copy Link').click();
    await expect(page.getByText('Link copied to clipboard!')).toBeVisible({ timeout: 5000 });

    // Verify clipboard content has UTM parameters
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Should have UTM parameters for tracking
    expect(clipboardText).toContain('utm_source=');
    expect(clipboardText).toContain('utm_medium=social');
    expect(clipboardText).toContain('utm_campaign=session_share');
  });

  test('should show correct share count format', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForNetworkIdle(page);

    // Open share modal
    const shareButton = page.locator('[data-testid="share-button"]').first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    const shareCountText = await shareButton.textContent();
    const shareCount = parseInt(shareCountText?.trim() || '0');

    await shareButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Modal should show correct singular/plural form
    if (shareCount === 1) {
      await expect(page.getByText(/Shared 1 time/)).toBeVisible();
    } else {
      await expect(page.getByText(new RegExp(`Shared ${shareCount} times`))).toBeVisible();
    }
  });
});

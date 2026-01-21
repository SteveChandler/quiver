/**
 * E2E Tests: Session Logging Flow
 *
 * Tests the session logging flow from email links.
 * This is a core part of the email core loop feature.
 *
 * Flow:
 * 1. User receives heads-up alert email with "Log Session" link
 * 2. User clicks link -> Session logging page loads with beach info
 * 3. User selects a rating (Skip, Good, Fired!)
 * 4. Optional: User adds notes
 * 5. Session is logged -> Success message shown
 *
 * Requirements:
 * - EMAIL_TOKEN_SECRET must be set in .env.playwright to match the server
 * - Dev server must be running from this worktree (not main)
 *
 * @project guest
 */

import { test, expect, type Page } from '@playwright/test';
import {
  generateTestEmailToken,
  isEmailTokenTestingAvailable,
} from '../utils/email-token-helpers';

/**
 * Check if the session log route is available
 * (requires dev server running from this worktree)
 */
async function isSessionLogRouteAvailable(page: Page): Promise<boolean> {
  // Navigate to the route and check if we get the expected content
  const response = await page.goto('/session/log?token=check&beach_id=check&window_start=check');
  const status = response?.status();

  // If we get 404, the route is not available (wrong worktree)
  if (status === 404) {
    return false;
  }

  // Check if page has the expected content (either "How was it?" or "Missing Info")
  const pageContent = await page.content();
  return pageContent.includes('How was it?') || pageContent.includes('Missing Info');
}

const TEST_USER_ID = 'e2e-session-log-user-12345';
const TEST_BEACH_ID = 'test-beach-123';
const TEST_BEACH_NAME = 'Huntington Beach';
const TEST_WINDOW_START = '2026-01-20T07:00:00Z';
const TEST_SCORE = '85';

/**
 * Generate a log_session token for testing
 */
async function generateLogSessionToken(userId: string = TEST_USER_ID): Promise<string> {
  return generateTestEmailToken({ user_id: userId, purpose: 'log_session' });
}

/**
 * Build the session log URL with all parameters
 */
function buildSessionLogUrl(params: {
  token: string;
  beachId?: string;
  beachName?: string;
  windowStart?: string;
  score?: string;
}): string {
  const url = new URL('/session/log', 'http://localhost:3000');
  url.searchParams.set('token', params.token);
  if (params.beachId) url.searchParams.set('beach_id', params.beachId);
  if (params.beachName) url.searchParams.set('beach_name', params.beachName);
  if (params.windowStart) url.searchParams.set('window_start', params.windowStart);
  if (params.score) url.searchParams.set('score', params.score);
  return url.pathname + url.search;
}

test.describe('Session Logging', () => {
  // All session logging tests require:
  // 1. EMAIL_TOKEN_SECRET to be configured
  // 2. Dev server running from this worktree (not main)
  test.beforeEach(async ({ page }) => {
    if (!isEmailTokenTestingAvailable()) {
      test.skip(true, 'EMAIL_TOKEN_SECRET not configured - skipping tests that need valid tokens');
    }

    // Check if the route is available (dev server must be running from this worktree)
    const routeAvailable = await isSessionLogRouteAvailable(page);
    if (!routeAvailable) {
      test.skip(true, 'Session log route not available - dev server must run from email-core-loop worktree');
    }
  });

  test.describe('Page loads correctly', () => {
    test('should display beach name and rating options', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
        score: TEST_SCORE,
      });

      await page.goto(url);

      // Verify page title
      await expect(page.locator('h1')).toContainText('How was it?');

      // Verify beach name is displayed
      await expect(page.locator('body')).toContainText(TEST_BEACH_NAME);

      // Verify all 3 rating buttons are visible
      await expect(page.getByText('Skipped it')).toBeVisible();
      await expect(page.getByText('Good sesh')).toBeVisible();
      await expect(page.getByText('Fired!')).toBeVisible();

      // Verify emojis are present
      await expect(page.locator('text=👎')).toBeVisible();
      await expect(page.locator('text=👍')).toBeVisible();
      await expect(page.locator('text=🔥')).toBeVisible();
    });

    test('should display notes textarea', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Verify notes section exists
      await expect(page.getByText('Notes (optional)')).toBeVisible();
      await expect(page.locator('textarea')).toBeVisible();
      await expect(page.locator('textarea')).toHaveAttribute('placeholder', 'How were the waves? Crowd? Conditions?');
    });

    test('should show Save button (disabled initially)', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Save button should be visible but disabled until rating is selected
      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeDisabled();
    });
  });

  test.describe('Rating session as "skip"', () => {
    test('should successfully log a skipped session', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Click the skip button (👎)
      await page.getByText('Skipped it').click();

      // Save button should now be enabled
      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();

      // Click save
      await saveButton.click();

      // Verify success state
      await expect(page.locator('h1')).toContainText('Logged!');
      await expect(page.locator('body')).toContainText('Thanks for the feedback');
    });
  });

  test.describe('Rating session as "good"', () => {
    test('should successfully log a good session', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Click the good button (👍)
      await page.getByText('Good sesh').click();

      // Save button should now be enabled
      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();

      // Click save
      await saveButton.click();

      // Verify success state
      await expect(page.locator('h1')).toContainText('Logged!');
      await expect(page.locator('body')).toContainText('Thanks for the feedback');
    });
  });

  test.describe('Rating session as "fired"', () => {
    test('should successfully log a fired session', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Click the fired button (🔥)
      await page.getByText('Fired!').click();

      // Save button should now be enabled
      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();

      // Click save
      await saveButton.click();

      // Verify success state
      await expect(page.locator('h1')).toContainText('Logged!');
      await expect(page.locator('body')).toContainText('Thanks for the feedback');
    });
  });

  test.describe('Adding notes with rating', () => {
    test('should successfully log session with notes', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
        score: TEST_SCORE,
      });

      await page.goto(url);

      // Select a rating
      await page.getByText('Good sesh').click();

      // Add notes
      const notesTextarea = page.locator('textarea');
      await notesTextarea.fill('Clean waves, light crowd, glassy conditions!');

      // Click save
      const saveButton = page.getByRole('button', { name: 'Save' });
      await saveButton.click();

      // Verify success state
      await expect(page.locator('h1')).toContainText('Logged!');
      await expect(page.locator('body')).toContainText('Thanks for the feedback');
    });
  });

  test.describe('Success state', () => {
    test('should show Open Quiver link after successful log', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Rate and save
      await page.getByText('Good sesh').click();
      await page.getByRole('button', { name: 'Save' }).click();

      // Verify Open Quiver link
      const openAppLink = page.getByRole('link', { name: 'Open Quiver' });
      await expect(openAppLink).toBeVisible();
      await expect(openAppLink).toHaveAttribute('href', '/');
    });

    test('success page should have green styling', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Rate and save
      await page.getByText('Fired!').click();
      await page.getByRole('button', { name: 'Save' }).click();

      // Wait for success state
      await expect(page.locator('h1')).toContainText('Logged!');

      // Check for green background (success state)
      const body = page.locator('body');
      const bodyStyle = await body.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // The success page uses #f0fdf4 (green-50)
      // RGB: 240, 253, 244
      expect(bodyStyle).toMatch(/rgb\(240,\s*253,\s*244\)|#f0fdf4/i);
    });
  });

  test.describe('Invalid token handling', () => {
    test('should show error for invalid token after submitting', async ({ page }) => {
      const url = buildSessionLogUrl({
        token: 'invalid_token_here',
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Wait for page to hydrate
      await page.waitForLoadState('networkidle');

      // Rate and try to save
      await page.getByText('Good sesh').click();
      await page.getByRole('button', { name: 'Save' }).click();

      // Should show error message (with longer timeout for server action)
      await expect(page.locator('body')).toContainText('Invalid or expired', { timeout: 10000 });
    });

    test('should show error for malformed JWT token after submitting', async ({ page }) => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsInB1cnBvc2UiOiJsb2dfc2Vzc2lvbiJ9.invalid_signature';
      const url = buildSessionLogUrl({
        token: fakeToken,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Wait for page to hydrate
      await page.waitForLoadState('networkidle');

      // Rate and try to save
      await page.getByText('Good sesh').click();
      await page.getByRole('button', { name: 'Save' }).click();

      // Should show error message (with longer timeout for server action)
      await expect(page.locator('body')).toContainText('Invalid or expired', { timeout: 10000 });
    });
  });

  test.describe('Wrong purpose token handling', () => {
    test('should reject token with wrong purpose', async ({ page }) => {
      // Generate a token with prefs purpose instead of log_session
      const token = await generateTestEmailToken({
        user_id: TEST_USER_ID,
        purpose: 'prefs',
      });

      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Rate and try to save
      await page.getByText('Good sesh').click();
      await page.getByRole('button', { name: 'Save' }).click();

      // Should show invalid token error since purpose doesn't match
      await expect(page.locator('body')).toContainText('Invalid or expired');
    });
  });

  test.describe('Missing parameters handling', () => {
    test('should show error when beach_id is missing', async ({ page }) => {
      const token = await generateLogSessionToken();
      // Build URL without beach_id
      await page.goto(`/session/log?token=${token}&beach_name=${TEST_BEACH_NAME}&window_start=${TEST_WINDOW_START}`);

      // Wait for hydration
      await page.waitForLoadState('networkidle');

      // Should show missing info error
      await expect(page.locator('h1')).toContainText('Missing Info');
      await expect(page.locator('body')).toContainText('Please use the link from your email');
    });

    test('should show error when window_start is missing', async ({ page }) => {
      const token = await generateLogSessionToken();
      // Build URL without window_start
      await page.goto(`/session/log?token=${token}&beach_id=${TEST_BEACH_ID}&beach_name=${TEST_BEACH_NAME}`);

      // Wait for hydration
      await page.waitForLoadState('networkidle');

      // Should show missing info error
      await expect(page.locator('h1')).toContainText('Missing Info');
      await expect(page.locator('body')).toContainText('Please use the link from your email');
    });

    test('should show error when token is missing', async ({ page }) => {
      // Build URL without token - need valid beach_id and window_start
      await page.goto(`/session/log?beach_id=${TEST_BEACH_ID}&beach_name=${TEST_BEACH_NAME}&window_start=${TEST_WINDOW_START}`);

      // Wait for hydration
      await page.waitForLoadState('networkidle');

      // Should show missing info error
      await expect(page.locator('h1')).toContainText('Missing Info');
      await expect(page.locator('body')).toContainText('Please use the link from your email');
    });

    test('error page should have red styling when params are missing', async ({ page }) => {
      const token = await generateLogSessionToken();
      // Missing beach_id should trigger the error state
      await page.goto(`/session/log?token=${token}&beach_name=${TEST_BEACH_NAME}&window_start=${TEST_WINDOW_START}`);

      // Wait for hydration
      await page.waitForLoadState('networkidle');

      // Verify we're on the error page first
      await expect(page.locator('h1')).toContainText('Missing Info');

      // Check for red background (error state)
      const body = page.locator('body');
      const bodyStyle = await body.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // The error page uses #fef2f2 (red-50)
      // RGB: 254, 242, 242
      expect(bodyStyle).toMatch(/rgb\(254,\s*242,\s*242\)|#fef2f2/i);
    });
  });

  test.describe('Rating selection UI', () => {
    test('should highlight selected rating button', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // Click the Good sesh button
      const goodButton = page.getByText('Good sesh').locator('..');
      await goodButton.click();

      // The button should have the selected styling (border-blue-500 and bg-blue-50)
      await expect(goodButton).toHaveClass(/border-blue-500/);
      await expect(goodButton).toHaveClass(/bg-blue-50/);
    });

    test('should allow changing rating before save', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      await page.goto(url);

      // First select skip
      const skipButton = page.getByText('Skipped it').locator('..');
      await skipButton.click();
      await expect(skipButton).toHaveClass(/border-blue-500/);

      // Then change to fired
      const firedButton = page.getByText('Fired!').locator('..');
      await firedButton.click();
      await expect(firedButton).toHaveClass(/border-blue-500/);

      // Skip should no longer be selected
      await expect(skipButton).not.toHaveClass(/border-blue-500/);
    });
  });

  test.describe('Mobile responsiveness', () => {
    test('should be mobile responsive', async ({ page }) => {
      const token = await generateLogSessionToken();
      const url = buildSessionLogUrl({
        token,
        beachId: TEST_BEACH_ID,
        beachName: TEST_BEACH_NAME,
        windowStart: TEST_WINDOW_START,
      });

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(url);

      // All rating buttons should be visible
      await expect(page.getByText('Skipped it')).toBeVisible();
      await expect(page.getByText('Good sesh')).toBeVisible();
      await expect(page.getByText('Fired!')).toBeVisible();

      // Content should fit within viewport
      const container = page.locator('.max-w-md');
      const box = await container.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(375);
    });
  });

  test.describe('Default beach name', () => {
    test('should show default text when beach_name is missing', async ({ page }) => {
      const token = await generateLogSessionToken();
      // Build URL without beach_name
      const url = `/session/log?token=${token}&beach_id=${TEST_BEACH_ID}&window_start=${TEST_WINDOW_START}`;

      await page.goto(url);

      // Should show default "your session" text
      await expect(page.locator('body')).toContainText('your session');
    });
  });
});

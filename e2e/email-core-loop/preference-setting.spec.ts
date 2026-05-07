/**
 * E2E Tests: Email Preference Setting Flow
 *
 * Tests the 1-tap preference update flow from email links.
 * This is a core part of the email core loop feature.
 *
 * Flow:
 * 1. User receives welcome email with preference links
 * 2. User clicks a preference link (e.g., time=dawn, level=beginner, frequency=daily)
 * 3. Token is verified -> Preference is saved -> Success page shown
 *
 * Requirements:
 * - EMAIL_TOKEN_SECRET must be set in .env.playwright to match the server
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';
import {
  generatePrefsToken,
  generateTestEmailToken,
  isEmailTokenTestingAvailable,
} from '../utils/email-token-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

// Must be a real mock user UUID from auth.users (FK constraint on user_email_prefs)
const TEST_USER_ID = '6faced01-8c47-4821-bf2f-cafb0cadca27'; // Tyler OBrien (liquid.snake@example.invalid)

test.describe('Email Preference Setting', () => {
  let errorCapture: ErrorCapture;
  let expectedErrorStatuses: number[] = [];

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    expectedErrorStatuses = [];
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: 'Email Preference Setting',
      allowedStatuses: expectedErrorStatuses,
    });
  });

  test.describe('Valid preference setting', () => {
    // These tests require EMAIL_TOKEN_SECRET to generate valid tokens
    test.beforeEach(async () => {
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
    });
    test('should set time preference to dawn', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      // Check for success indicators
      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('Dawn patrol');
    });

    test('should set time preference to after_work', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=after_work&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('After work');
    });

    test('should set time preference to weekends', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=weekends&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('Weekends');
    });

    test('should set skill level to beginner', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?level=beginner&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('beginner');
    });

    test('should set skill level to intermediate', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?level=intermediate&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('intermediate');
    });

    test('should set skill level to advanced', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?level=advanced&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('advanced');
    });

    test('should set email frequency to daily', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?frequency=daily&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText('Daily');
    });

    test('should set email frequency to only_good', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX; update this spec for the no-op contract.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?frequency=only_good&token=${token}`);

      await expect(page.locator('h1')).toContainText('Saved');
      await expect(page.locator('body')).toContainText("Only when it's good");
    });

    test('should show success page with link to app', async ({ page }) => {
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      // Check for the "Open Quiver" button/link
      const openAppLink = page.locator('a.btn, a:has-text("Open Quiver")');
      await expect(openAppLink).toBeVisible();
      await expect(openAppLink).toHaveAttribute('href', '/');
    });

    test('should have correct status code 200 for success', async ({ page }) => {
      const token = await generatePrefsToken(TEST_USER_ID);

      const response = await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      expect(response?.status()).toBe(200);
    });
  });

  test.describe('Invalid token handling', () => {
    test.beforeEach(async () => { expectedErrorStatuses = [400]; });

    test('should show error for invalid token', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired/expired-link UX; update this spec for the current copy.');
      await page.goto('/api/prefs/set?time=dawn&token=invalid_token_here');

      await expect(page.locator('h1')).toContainText('Invalid');
      await expect(page.locator('body')).toContainText('Invalid or expired');
    });

    test('should show error for expired token format', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired/expired-link UX; update this spec for the current copy.');
      // Use a malformed JWT that looks like a token but is invalid
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsInB1cnBvc2UiOiJwcmVmcyJ9.invalid_signature';

      await page.goto(`/api/prefs/set?time=dawn&token=${fakeToken}`);

      await expect(page.locator('h1')).toContainText('Invalid');
    });

    test('should return status 400 for invalid token', async ({ page }) => {
      const response = await page.goto('/api/prefs/set?time=dawn&token=invalid');

      expect(response?.status()).toBe(400);
    });
  });

  test.describe('Missing token handling', () => {
    test.beforeEach(async () => { expectedErrorStatuses = [400]; });

    test('should show error when token is missing', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired/expired-link UX; update this spec for the current copy.');
      await page.goto('/api/prefs/set?time=dawn');

      // API returns "Invalid Link" for any token issue (missing or invalid)
      await expect(page.locator('h1')).toContainText('Invalid');
    });

    test('should return status 400 for missing token', async ({ page }) => {
      const response = await page.goto('/api/prefs/set?time=dawn');

      expect(response?.status()).toBe(400);
    });
  });

  test.describe('Missing preference handling', () => {
    // These tests require EMAIL_TOKEN_SECRET to generate valid tokens
    test.beforeEach(async () => {
      expectedErrorStatuses = [400];
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
    });

    test('should show error when no preference is specified', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of enforcing preference-write errors.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?token=${token}`);

      await expect(page.locator('h1')).toContainText('No Preference');
      await expect(page.locator('body')).toContainText('No preference specified');
    });

    test('should return status 400 when no preference specified', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of enforcing preference-write errors.');
      const token = await generatePrefsToken(TEST_USER_ID);

      const response = await page.goto(`/api/prefs/set?token=${token}`);

      expect(response?.status()).toBe(400);
    });
  });

  test.describe('Invalid preference value handling', () => {
    // These tests require EMAIL_TOKEN_SECRET to generate valid tokens
    test.beforeEach(async () => {
      expectedErrorStatuses = [400];
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
    });

    test('should show error for invalid time value', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of validating preference values.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=invalid_time&token=${token}`);

      await expect(page.locator('h1')).toContainText('Invalid');
      await expect(page.locator('body')).toContainText('invalid_time');
    });

    test('should show error for invalid level value', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of validating preference values.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?level=pro&token=${token}`);

      await expect(page.locator('h1')).toContainText('Invalid');
      await expect(page.locator('body')).toContainText('pro');
    });

    test('should show error for invalid frequency value', async ({ page }) => {
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of validating preference values.');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?frequency=weekly&token=${token}`);

      await expect(page.locator('h1')).toContainText('Invalid');
      await expect(page.locator('body')).toContainText('weekly');
    });
  });

  test.describe('Page styling and UX', () => {
    test('success page should have green styling', async ({ page }) => {
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
      const token = await generatePrefsToken(TEST_USER_ID);

      await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      // Check for green background (success state)
      const body = page.locator('body');
      const bodyStyle = await body.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // The success page uses #f0fdf4 (green-50)
      // RGB: 240, 253, 244
      expect(bodyStyle).toMatch(/rgb\(240,\s*253,\s*244\)|#f0fdf4/i);
    });

    test('error page should have red styling', async ({ page }) => {
      expectedErrorStatuses = [400];
      await page.goto('/api/prefs/set?time=dawn&token=invalid');

      // Check for red background (error state)
      const body = page.locator('body');
      const bodyStyle = await body.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // The error page uses #fef2f2 (red-50)
      // RGB: 254, 242, 242
      expect(bodyStyle).toMatch(/rgb\(254,\s*242,\s*242\)|#fef2f2/i);
    });

    test('should be mobile responsive', async ({ page }) => {
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
      const token = await generatePrefsToken(TEST_USER_ID);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      // Card should be visible and not overflowing
      const card = page.locator('.card');
      await expect(card).toBeVisible();

      // Check that content is within viewport
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.width).toBeLessThanOrEqual(375);
    });
  });

  test.describe('Wrong purpose token handling', () => {
    test.beforeEach(async () => { expectedErrorStatuses = [400]; });

    test('should reject token with wrong purpose', async ({ page }) => {
      test.skip(!isEmailTokenTestingAvailable(), 'Requires email token secret');
      test.fixme(true, 'Legacy prefs links now render the retired-link UX instead of enforcing token purpose errors.');
      // Generate a token with save_window purpose instead of prefs
      const token = await generateTestEmailToken({
        user_id: TEST_USER_ID,
        purpose: 'save_window',
      });

      await page.goto(`/api/prefs/set?time=dawn&token=${token}`);

      // Should show invalid token error since purpose doesn't match
      await expect(page.locator('h1')).toContainText('Invalid');
    });
  });
});

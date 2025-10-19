import { test, expect } from '@playwright/test';

// Auth Gate tests for preview-then-prompt flow
// Tests run in guest mode (unauthenticated) to validate auth wall behavior

const TEST_BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('Auth Gate - Basic Rendering', () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage to reset dismissal tracking
    await context.clearCookies();
  });

  test('auth gate does not appear immediately on map page load', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Dialog should NOT be visible immediately
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // Page content should render normally
    const mapView = page.locator('[class*="map"]').first();
    await expect(mapView).toBeVisible({ timeout: 10000 });
  });

  test('auth gate does not appear immediately on beach detail page', async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Dialog should NOT be visible immediately
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // Page content should render (SEO-friendly)
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('auth gate does NOT appear on landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait longer than the delay to ensure it doesn't appear
    await page.waitForTimeout(7000);

    // Dialog should never appear on landing page
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Auth Gate - Timing Behavior', () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage to reset dismissal tracking
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('modal appears after 5 second delay on map page', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Dialog should NOT be visible immediately
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // Wait for the 5 second delay + buffer
    await page.waitForTimeout(5500);

    // Dialog should now be visible
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // Check dialog title
    const title = page.getByText(/keep exploring with quiver/i);
    await expect(title).toBeVisible();
  });

  test('modal appears after 5 second delay on beach detail page', async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // Wait for delay
    await page.waitForTimeout(5500);

    // Dialog should appear
    await expect(dialog).toBeVisible({ timeout: 2000 });
  });

  test('modal can be dismissed by pressing Escape', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    
    // Wait for modal to appear
    await page.waitForTimeout(5500);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press('Escape');

    // Dialog should be hidden
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('localStorage tracks dismissal time', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    
    // Wait for modal to appear
    await page.waitForTimeout(5500);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Dismiss modal
    await page.keyboard.press('Escape');

    // Check localStorage has dismissal timestamp
    const dismissalTime = await page.evaluate(() => {
      return localStorage.getItem('auth_gate_dismissed');
    });

    expect(dismissalTime).toBeTruthy();
    expect(parseInt(dismissalTime || '0')).toBeGreaterThan(Date.now() - 5000);
  });

  test('modal reappears after 30 seconds of continued browsing', async ({ page }) => {
    test.slow(); // This test takes longer due to 30s wait

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    
    // Wait for modal to appear
    await page.waitForTimeout(5500);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Dismiss modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Wait for 30 seconds
    await page.waitForTimeout(30000);

    // Navigate to another page to trigger re-check
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
    
    // Wait for initial delay on new page
    await page.waitForTimeout(5500);

    // Modal should reappear
    await expect(dialog).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Auth Gate - Modal Content', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('displays correct title and description', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check title
    const title = page.getByText(/keep exploring with quiver/i);
    await expect(title).toBeVisible();

    // Check description mentions key features
    const description = page.getByText(/log in or sign up.*maps.*sessions.*community/i);
    await expect(description).toBeVisible();
  });

  test('shows Google OAuth and Email Magic Link options', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check for Google OAuth button
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await expect(googleButton).toBeVisible();

    // Check for Email option
    const emailButton = page.getByRole('button', { name: /sign in with email/i });
    await expect(emailButton).toBeVisible();

    // Check for "or" separator
    await expect(page.getByText(/^or$/i)).toBeVisible();
  });

  test('displays return URL message with current path', async ({ page }) => {
    await page.goto('/map?search=ocean', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should show return URL message
    const returnMessage = page.getByText(/return to.*\/map/i);
    await expect(returnMessage).toBeVisible();
  });
});

test.describe('Auth Gate - Authentication Flows', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('email input shows after clicking sign in with email', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click "Sign in with Email"
    const emailButton = page.getByRole('button', { name: /sign in with email/i });
    await emailButton.click();

    // Email input should appear
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeVisible({ timeout: 2000 });

    // Send Magic Link button should be visible
    const sendButton = page.getByRole('button', { name: /send magic link/i });
    await expect(sendButton).toBeVisible();
  });

  test('back button returns to auth options from email input', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    // Click "Sign in with Email"
    const emailButton = page.getByRole('button', { name: /sign in with email/i });
    await emailButton.click();

    // Email input should be visible
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeVisible();

    // Click back button
    const backButton = page.getByRole('button', { name: /back to sign in options/i });
    await backButton.click();

    // Should show Google button again
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await expect(googleButton).toBeVisible({ timeout: 2000 });
  });

  test('email validation requires @ symbol', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    // Navigate to email input
    const emailButton = page.getByRole('button', { name: /sign in with email/i });
    await emailButton.click();

    const emailInput = page.getByLabel(/email address/i);
    const sendButton = page.getByRole('button', { name: /send magic link/i });

    // Try invalid email (no @)
    await emailInput.fill('invalidemail');
    
    // Send button should be disabled or not work
    const isDisabled = await sendButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Try valid email
    await emailInput.fill('test@example.com');
    
    // Send button should be enabled
    await expect(sendButton).toBeEnabled();
  });
});

test.describe('Auth Gate - Return URL Preservation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('preserves beach detail URL with slug', async ({ page }) => {
    const beachUrl = `/beach/${TEST_BEACH_ID}`;
    await page.goto(beachUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check that return URL mentions the beach path
    const returnMessage = page.getByText(new RegExp(`/beach/${TEST_BEACH_ID}`, 'i'));
    await expect(returnMessage).toBeVisible();
  });

  test('preserves map URL with search query params', async ({ page }) => {
    await page.goto('/map?search=oceanbeach', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check that return URL is preserved (shown in message)
    const returnMessage = page.getByText(/\/map.*search/i);
    await expect(returnMessage).toBeVisible();
  });
});

test.describe('Auth Gate - Guest Flow Integration', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('closable modal allows continued browsing when dismissed', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Dismiss modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // User should be able to continue interacting with map
    const mapContainer = page.locator('[class*="map"]').first();
    await expect(mapContainer).toBeVisible();

    // Can navigate away
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/');
  });
});


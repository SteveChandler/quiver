import { test, expect } from '@playwright/test';

test.describe('SessionWizard Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth and sign in
    await page.goto('/auth/sign-in');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should display SessionWizard on /plan-session route', async ({ page }) => {
    // Navigate to plan session page
    await page.goto('/plan-session');
    await page.waitForLoadState('load');

    // Check for wizard-specific elements that wouldn't exist in the old form
    const wizardContainer = page.locator('[data-testid="session-wizard"]');
    await expect(wizardContainer).toBeVisible();

    // Check for step navigation (5 steps)
    const stepButtons = page.locator('[data-testid^="step-button-"]');
    await expect(stepButtons).toHaveCount(5);

    // Check for progress bar
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Verify we're on step 1 (DateTime step)
    const activeStep = page.locator('[data-testid="step-button-0"][data-active="true"]');
    await expect(activeStep).toBeVisible();

    // Check for step title
    const stepTitle = page.locator('text=When do you want to surf?');
    await expect(stepTitle).toBeVisible();
  });

  test('should display SessionWizard on /log-session route', async ({ page }) => {
    // Navigate to log session page
    await page.goto('/log-session');
    await page.waitForLoadState('load');

    // Check for wizard-specific elements
    const wizardContainer = page.locator('[data-testid="session-wizard"]');
    await expect(wizardContainer).toBeVisible();

    // Check for step navigation (5 steps for log mode)
    const stepButtons = page.locator('[data-testid^="step-button-"]');
    await expect(stepButtons).toHaveCount(5);

    // Check for progress bar
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Verify we're on step 1
    const activeStep = page.locator('[data-testid="step-button-0"][data-active="true"]');
    await expect(activeStep).toBeVisible();

    // Check for appropriate step title for log mode
    const stepTitle = page.locator('text=When did you surf?');
    await expect(stepTitle).toBeVisible();
  });

  test('should navigate between wizard steps with smooth transitions', async ({ page }) => {
    await page.goto('/plan-session');
    await page.waitForLoadState('load');

    // Fill out first step (DateTime)
    await page.click('input[name="date"]');
    await page.fill('input[name="date"]', '2024-12-25');
    await page.click('input[name="time"]');
    await page.fill('input[name="time"]', '08:00');

    // Click Next to go to step 2
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Wait for transition animation and verify we're on step 2
    await page.waitForTimeout(500); // Allow for transition animation
    const step2Active = page.locator('[data-testid="step-button-1"][data-active="true"]');
    await expect(step2Active).toBeVisible();

    // Check for Location step content
    const locationTitle = page.locator('text=Where do you want to surf?');
    await expect(locationTitle).toBeVisible();

    // Test navigation back to step 1
    const step1Button = page.locator('[data-testid="step-button-0"]');
    await step1Button.click();

    // Verify we're back on step 1
    await page.waitForTimeout(500);
    const step1Active = page.locator('[data-testid="step-button-0"][data-active="true"]');
    await expect(step1Active).toBeVisible();
  });

  test('should show progress bar animation', async ({ page }) => {
    await page.goto('/plan-session');
    await page.waitForLoadState('load');

    // Check initial progress (should be 0% for step 1)
    const progressFill = page.locator('[data-testid="progress-fill"]');
    await expect(progressFill).toHaveCSS('width', '0px');

    // Navigate to step 2 and check progress increases
    await page.click('input[name="date"]');
    await page.fill('input[name="date"]', '2024-12-25');
    await page.click('input[name="time"]');
    await page.fill('input[name="time"]', '08:00');
    await page.click('button:has-text("Next")');

    // Wait for animation and check progress increased
    await page.waitForTimeout(1000);
    const progressAfterStep2 = await progressFill.boundingBox();
    expect(progressAfterStep2?.width).toBeGreaterThan(0);
  });

  test('should show auto-save indicator', async ({ page }) => {
    await page.goto('/plan-session');
    await page.waitForLoadState('load');

    // Fill out a field to trigger auto-save
    await page.click('input[name="date"]');
    await page.fill('input[name="date"]', '2024-12-25');

    // Wait for auto-save delay (2 seconds) plus animation
    await page.waitForTimeout(3000);

    // Check for auto-save indicator
    const autoSaveIndicator = page.locator('[data-testid="auto-save-indicator"]');
    await expect(autoSaveIndicator).toBeVisible();
    await expect(autoSaveIndicator).toHaveText(/saved|saving/i);
  });

  test('should show form validation with animation', async ({ page }) => {
    await page.goto('/plan-session');
    await page.waitForLoadState('load');

    // Try to proceed without filling required fields
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Check for validation error with animation
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toBeVisible();

    // Verify error animation (shake effect) - check for CSS animation
    await expect(errorMessage).toHaveCSS('animation-duration', /0\.[0-9]+s/);
  });

  test('should show completion celebration', async ({ page }) => {
    await page.goto('/plan-session');
    await page.waitForLoadState('networkidle');

    // Fill out all required steps quickly
    // Step 1: DateTime
    await page.fill('input[name="date"]', '2024-12-25');
    await page.fill('input[name="time"]', '08:00');
    await page.click('button:has-text("Next")');

    // Step 2: Location  
    await page.waitForTimeout(500);
    await page.click('button[data-testid="location-search"]');
    await page.fill('input[placeholder*="beach"]', 'La Jolla Shores');
    await page.waitForTimeout(1000);
    await page.click('text=La Jolla Shores');
    await page.click('button:has-text("Next")');

    // Step 3: Equipment
    await page.waitForTimeout(500);
    await page.click('select[name="board"]');
    await page.selectOption('select[name="board"]', 'longboard');
    await page.click('button:has-text("Next")');

    // Step 4: Goals (for plan mode)
    await page.waitForTimeout(500);
    await page.fill('textarea[name="goals"]', 'Practice pop-ups and improve balance');
    await page.click('button:has-text("Next")');

    // Step 5: Review and Submit
    await page.waitForTimeout(500);
    await page.click('button:has-text("Save Session")');

    // Check for completion celebration animation
    const celebrationOverlay = page.locator('[data-testid="completion-celebration"]');
    await expect(celebrationOverlay).toBeVisible({ timeout: 5000 });

    // Check for success message and animation
    const successMessage = page.locator('text=Session Saved Successfully!');
    await expect(successMessage).toBeVisible();

    // Verify animation elements
    const checkIcon = page.locator('[data-testid="success-checkmark"]');
    await expect(checkIcon).toBeVisible();
  });
});
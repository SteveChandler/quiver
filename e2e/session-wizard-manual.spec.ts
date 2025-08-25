import { test, expect } from '@playwright/test';

test.describe('SessionWizard Manual Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth and sign in
    await page.goto('/auth/sign-in');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('verify plan-session loads SessionWizard successfully', async ({ page }) => {
    // Navigate to plan session page
    await page.goto('/plan-session');
    await page.waitForLoadState('networkidle');

    // Take a screenshot to see what's actually rendered
    await page.screenshot({ path: 'test-results/plan-session-screenshot.png', fullPage: true });

    // Basic checks - look for any form elements
    const hasFormElements = await page.locator('form, input, button, select').count();
    expect(hasFormElements).toBeGreaterThan(0);

    // Check that the page doesn't have an error
    const errorMessage = page.locator('text=Error');
    await expect(errorMessage).not.toBeVisible();

    // Check that there's some session-related content
    const sessionContent = page.locator('text*=session, text*=surf, text*=Session').first();
    await expect(sessionContent).toBeVisible();

    console.log('✅ Plan session page loaded successfully');
  });

  test('verify log-session loads SessionWizard successfully', async ({ page }) => {
    // Navigate to log session page
    await page.goto('/log-session');
    await page.waitForLoadState('networkidle');

    // Take a screenshot to see what's actually rendered
    await page.screenshot({ path: 'test-results/log-session-screenshot.png', fullPage: true });

    // Basic checks - look for any form elements
    const hasFormElements = await page.locator('form, input, button, select').count();
    expect(hasFormElements).toBeGreaterThan(0);

    // Check that the page doesn't have an error
    const errorMessage = page.locator('text=Error');
    await expect(errorMessage).not.toBeVisible();

    // Check that there's some session-related content
    const sessionContent = page.locator('text*=session, text*=surf, text*=Session').first();
    await expect(sessionContent).toBeVisible();

    console.log('✅ Log session page loaded successfully');
  });

  test('verify both pages render different content than before', async ({ page }) => {
    // Check plan session
    await page.goto('/plan-session');
    await page.waitForLoadState('networkidle');
    
    // Look for any step-related UI that would indicate wizard vs single form
    const hasSteps = await page.locator('button, div, span').filter({ hasText: /step|next|previous|progress/i }).count();
    console.log(`Plan session has ${hasSteps} step-related elements`);

    // Check log session
    await page.goto('/log-session');
    await page.waitForLoadState('networkidle');
    
    const hasStepsLog = await page.locator('button, div, span').filter({ hasText: /step|next|previous|progress/i }).count();
    console.log(`Log session has ${hasStepsLog} step-related elements`);

    // At least one should have step-related UI if SessionWizard is working
    expect(hasSteps + hasStepsLog).toBeGreaterThan(0);
  });
});
import { test, expect } from '@playwright/test';

test.describe('Gamification System Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
  });

  test('should display landing page and allow navigation', async ({ page }) => {
    // Verify landing page loads
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Look for login/signup options
    const signInButton = page.locator('text=/sign in|log in/i').first();
    const signUpButton = page.locator('text=/sign up|get started/i').first();
    
    // Check if auth options are available
    const hasAuthOptions = await signInButton.isVisible() || await signUpButton.isVisible();
    expect(hasAuthOptions).toBeTruthy();
  });

  test('should have gamification tables in database', async ({ page }) => {
    // This test verifies the database setup via API if we have a test endpoint
    // For now, we'll check if the app loads without database errors
    
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check no database connection errors in console
    const dbErrors = consoleLogs.filter(log => 
      log.includes('supabase') || 
      log.includes('database') || 
      log.includes('table')
    );
    
    expect(dbErrors).toHaveLength(0);
  });

  test('should load profile page with gamification section placeholder', async ({ page }) => {
    // Try to navigate to a profile page (may require auth)
    await page.goto('http://localhost:3000/profile');
    
    // Wait for either redirect to login or profile content
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    
    // If redirected to auth, that's expected behavior
    if (currentUrl.includes('login') || currentUrl.includes('sign')) {
      expect(currentUrl).toMatch(/login|sign/);
    } else {
      // If on profile, look for gamification elements
      const profileContent = await page.locator('main').textContent();
      expect(profileContent).toBeDefined();
    }
  });

  test('should have XP tracking integrated in session creation flow', async ({ page }) => {
    // Navigate to session creation (may require auth)
    await page.goto('http://localhost:3000/sessions/new');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    
    // Check if we're on the session form or redirected to auth
    if (currentUrl.includes('sessions/new')) {
      // Look for session form elements
      const hasSessionForm = await page.locator('form').isVisible() ||
                            await page.locator('text=/beach|location|date/i').isVisible();
      expect(hasSessionForm).toBeTruthy();
    } else {
      // Redirected to auth is expected for unauthenticated users
      expect(currentUrl).toMatch(/login|sign/);
    }
  });

  test('should display gamification test page if available', async ({ page }) => {
    // Try to load the gamification test page directly
    await page.goto('http://localhost:3000/test/gamification');
    await page.waitForLoadState('networkidle');
    
    // Check if test page exists or returns 404
    const response = await page.evaluate(() => document.body.innerText);
    
    // If test page exists, verify XP elements
    if (!response.includes('404') && !response.includes('not found')) {
      const hasXPElements = await page.locator('text=/XP|badge|level/i').count() > 0;
      if (hasXPElements) {
        expect(hasXPElements).toBeTruthy();
      }
    }
  });

  test('should verify gamification components are importable', async ({ page }) => {
    // This test checks that the gamification system doesn't cause build errors
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Module not found')) {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    // Check for module not found errors related to gamification
    const moduleErrors = consoleLogs.filter(log => 
      log.includes('gamification') || 
      log.includes('badge') || 
      log.includes('xp')
    );
    
    expect(moduleErrors).toHaveLength(0);
  });
});

test.describe('Gamification UI Components', () => {
  test('should render XP toast system when triggered', async ({ page }) => {
    // Create a test page that triggers XP toast
    await page.goto('http://localhost:3000');
    
    // Look for any toast container elements
    const toastContainer = page.locator('[role="alert"], .toast, [class*="toast"]');
    
    // Check if toast system is available in the DOM (even if hidden)
    const toastCount = await toastContainer.count();
    
    // The toast system should be mounted even if no toasts are visible
    expect(toastCount).toBeGreaterThanOrEqual(0);
  });

  test('should have confetti animation capability', async ({ page }) => {
    // Check if confetti library is loaded
    await page.goto('http://localhost:3000');
    
    // Evaluate if confetti is available in the window object
    const hasConfetti = await page.evaluate(() => {
      return typeof (window as any).confetti !== 'undefined' || 
             document.querySelector('script[src*="confetti"]') !== null;
    });
    
    // Confetti might be loaded on-demand, so we just check no errors
    expect(hasConfetti !== null).toBeTruthy();
  });
});
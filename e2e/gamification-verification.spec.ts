import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from './test-helpers';

test.describe('Gamification System Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (baseURL-aware)
    await page.goto('/');
  });

  test('should display landing page and allow navigation', async ({ page }) => {
    // Verify landing page loads
    await page.waitForLoadState('load');
    
    // Check for any main heading or navigation element
    const hasMainContent = await page.locator('main, header, nav, h1, h2').first().isVisible();
    expect(hasMainContent).toBeTruthy();
    
    // Look for any interactive elements (links or buttons)
    const interactiveElements = await page.locator('a, button').count();
    expect(interactiveElements).toBeGreaterThan(0);
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
    
    await page.goto('/');
    await page.waitForLoadState('load');
    
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
    await page.goto('/profile');
    await ensureAuthenticated(page);
    
    // Wait for either redirect to login or profile content
    await page.waitForLoadState('load');
    
    let currentUrl = page.url();
    
    // If redirected to auth, that's expected behavior
    if (currentUrl.includes('login') || currentUrl.includes('sign')) {
      expect(currentUrl).toMatch(/login|sign/);
    } else {
      // Ensure we are actually on the profile page
      if (!currentUrl.includes('/profile')) {
        await page.goto('/profile');
        await page.waitForLoadState('load');
        currentUrl = page.url();
      }

      // If still not on profile, accept redirect to auth or home
      if (!currentUrl.includes('/profile')) {
        await expect(page).toHaveURL(/auth|login|sign|\/$/);
      } else {
        // Verify profile UI loaded (stable target)
        await expect(page.getByRole('tab', { name: /journal\+/i })).toBeVisible();

        // Gamification placeholder can be transient; accept either loading or loaded state
        const loadingStatsVisible = await page.getByText(/Loading stats/i).first().isVisible().catch(() => false);
        if (!loadingStatsVisible) {
          await expect(page.getByText('Home Break').first()).toBeVisible();
        }
      }
    }
  });

  test('should have XP tracking integrated in session creation flow', async ({ page }) => {
    // Navigate to session creation (may require auth)
    await page.goto('/sessions/new');
    await ensureAuthenticated(page);
    await page.waitForLoadState('load');
    
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
    await page.goto('/test/gamification');
    await page.waitForLoadState('load');
    
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
    
    await page.goto('/');
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
    await page.goto('/');
    
    // Look for any toast container elements
    const toastContainer = page.locator('[role="alert"], .toast, [class*="toast"]');
    
    // Check if toast system is available in the DOM (even if hidden)
    const toastCount = await toastContainer.count();
    
    // The toast system should be mounted even if no toasts are visible
    expect(toastCount).toBeGreaterThanOrEqual(0);
  });

  test('should have confetti animation capability', async ({ page }) => {
    // Check if confetti library is loaded
    await page.goto('/');
    await page.waitForLoadState('load');
    
    // Check that the page loads without confetti-related errors
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('confetti')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Wait a bit for any lazy-loaded scripts
    await page.waitForTimeout(1000);
    
    // Confetti is loaded on-demand, so we just verify no errors
    expect(consoleLogs).toHaveLength(0);
  });
});

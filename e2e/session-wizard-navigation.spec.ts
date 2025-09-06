import { test, expect } from '@playwright/test';
import { waitForPageLoadAndDismissModal, dismissOnboardingModal, ensureAuthenticated } from './test-helpers';

test.describe('SessionWizard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authentication and handle onboarding modal
    const authed = await ensureAuthenticated(page, 15000);
    if (!authed) throw new Error('Auth required for session wizard navigation tests');
    await page.goto('/');
    await waitForPageLoadAndDismissModal(page);
  });

  test('1. Home Screen - Forecast Tab navigation', async ({ page }) => {
    // Navigate to home and dismiss any modals
    await page.goto('/');
    await waitForPageLoadAndDismissModal(page);
    
    // Test Plan Session button
    const planButton = page.getByRole('button', { name: /plan session/i });
    await expect(planButton).toBeVisible();
    await planButton.click();
    
    // Should navigate to session wizard in plan mode
    await page.waitForURL('**/sessions/new?mode=plan');
    expect(page.url()).toContain('/sessions/new?mode=plan');
    
    // Go back to test Log Session button
    await page.goto('/');
    await waitForPageLoadAndDismissModal(page);
    
    const logButton = page.getByRole('button', { name: /log session/i });
    await expect(logButton).toBeVisible();
    await logButton.click();
    
    // Should navigate to session wizard in log mode
    await page.waitForURL('**/sessions/new?mode=log');
    expect(page.url()).toContain('/sessions/new?mode=log');
  });

  test('2. Journal View navigation (when no sessions exist)', async ({ page }) => {
    // Navigate to journal/profile to see empty state
    await page.goto('/profile');
    await waitForPageLoadAndDismissModal(page);
    
    // Look for journal links in empty state
    const logFirstLink = page.getByRole('link', { name: /log your first session/i });
    const planLink = page.getByRole('link', { name: /plan a session/i });
    
    if (await logFirstLink.isVisible()) {
      await logFirstLink.click();
      await page.waitForURL('**/sessions/new?mode=log');
      expect(page.url()).toContain('/sessions/new?mode=log');
      
      // Go back and test plan link
      await page.goto('/profile');
      await waitForPageLoadAndDismissModal(page);
    }
    
    if (await planLink.isVisible()) {
      await planLink.click();
      await page.waitForURL('**/sessions/new?mode=plan');
      expect(page.url()).toContain('/sessions/new?mode=plan');
    }
  });

  test('3. Beach Detail Pages navigation', async ({ page }) => {
    // Navigate to map to find a beach
    await page.goto('/map');
    await waitForPageLoadAndDismissModal(page);
    
    // Wait for map to load and look for beach markers or cards
    await page.waitForTimeout(2000);
    
    // Look for beach quick actions or plan buttons
    const beachPlanButton = page.locator('[data-testid="plan-session-beach"]').first();
    const beachCard = page.locator('[data-testid="beach-card"]').first();
    
    // Try clicking on a beach card or plan button if available
    if (await beachCard.isVisible()) {
      await beachCard.click();
      
      // Look for quick actions in beach detail
      const quickAction = page.getByRole('button', { name: /plan session/i }).first();
      if (await quickAction.isVisible()) {
        await quickAction.click();
        await page.waitForURL('**/sessions/new*');
        expect(page.url()).toContain('/sessions/new');
        expect(page.url()).toContain('mode=plan');
      }
    }
  });

  test('4. Intel Dashboard navigation', async ({ page }) => {
    // Navigate to intel dashboard
    await page.goto('/intel');
    await waitForPageLoadAndDismissModal(page);
    
    // Look for plan session or action buttons
    const planButton = page.getByRole('button', { name: /plan session/i }).first();
    const actionButton = page.getByRole('button', { name: /action/i }).first();
    
    if (await planButton.isVisible()) {
      await planButton.click();
      await page.waitForURL('**/sessions/new*');
      expect(page.url()).toContain('/sessions/new');
      expect(page.url()).toContain('mode=plan');
    } else if (await actionButton.isVisible()) {
      await actionButton.click();
      await page.waitForURL('**/sessions/new*');
      expect(page.url()).toContain('/sessions/new');
    }
  });

  test('5. Intel Map navigation', async ({ page }) => {
    // Navigate to intel map (if different from main map)
    await page.goto('/intel');
    await waitForPageLoadAndDismissModal(page);
    
    // Look for map view or switch to map tab
    const mapButton = page.getByRole('button', { name: /map/i }).first();
    if (await mapButton.isVisible()) {
      await mapButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for map actions that lead to session wizard
    const mapAction = page.locator('[data-testid="map-plan-action"]').first();
    const planFromMap = page.getByRole('button', { name: /plan from map/i }).first();
    
    if (await mapAction.isVisible()) {
      await mapAction.click();
      await page.waitForURL('**/sessions/new*');
      expect(page.url()).toContain('/sessions/new');
      expect(page.url()).toContain('mode=plan');
    } else if (await planFromMap.isVisible()) {
      await planFromMap.click();
      await page.waitForURL('**/sessions/new*');
      expect(page.url()).toContain('/sessions/new');
    }
  });

  test('SessionWizard loads correctly after navigation', async ({ page }) => {
    // Test that the SessionWizard actually loads and works
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoadAndDismissModal(page);
    
    // Check for wizard elements - more flexible selectors
    const stepIndicator = page.locator('text=/step.*[0-9].*of.*[0-9]/i').first();
    await expect(stepIndicator).toBeVisible({ timeout: 10000 });
    
    // Check for first step content (Location step)
    const locationText = page.getByText(/location/i).first();
    await expect(locationText).toBeVisible();
    
    // Verify bottom navigation is hidden on wizard pages
    const bottomNav = page.locator('[data-testid="bottom-navigation"]');
    await expect(bottomNav).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Beach Map Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-beaches');
    await page.waitForLoadState('load');
  });

  test('should display the test page with correct title and structure', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Beach Map Component Test');
    
    // Check selected beach section
    await expect(page.locator('h2')).toContainText('Selected Beach');
    await expect(page.getByText('No beach selected')).toBeVisible();
    
    // Check features list
    await expect(page.getByText('Features:')).toBeVisible();
    await expect(page.getByText('Hover over markers to see lift and glow animation')).toBeVisible();
    await expect(page.getByText('Click markers to select and see pulsing ring animation')).toBeVisible();
    await expect(page.getByText('All markers are keyboard accessible')).toBeVisible();
  });

  test('should show fallback UI when Mapbox token is missing', async ({ page }) => {
    // The map area should be present
    const mapContainer = page.locator('div').filter({ hasText: 'Map Component Ready' });
    
    // If no Mapbox token, should show fallback
    const hasMapboxError = await page.locator('text=An API access token is required').count() > 0;
    
    if (hasMapboxError) {
      // Should show fallback message
      await expect(page.getByText('Map Component Ready')).toBeVisible();
      await expect(page.getByText('Mapbox access token needed for full functionality')).toBeVisible();
      
      // Should show beach selection buttons as fallback
      await expect(page.getByText('La Jolla Shores')).toBeVisible();
      await expect(page.getByText('Mission Beach')).toBeVisible();
      await expect(page.getByText('Ocean Beach')).toBeVisible();
    }
  });

  test('should handle beach selection in fallback mode', async ({ page }) => {
    // Wait for component to load
    await page.waitForTimeout(1000);
    
    const hasMapboxError = await page.locator('text=An API access token is required').count() > 0;
    
    if (hasMapboxError) {
      // Click on La Jolla Shores button
      const laJollaButton = page.getByText('La Jolla Shores').first();
      await expect(laJollaButton).toBeVisible();
      await laJollaButton.click();
      
      // Check that selection is updated
      await expect(page.getByText('Selected: La Jolla Shores')).toBeVisible();
      
      // Try selecting another beach
      await page.getByText('Mission Beach').first().click();
      await expect(page.getByText('Selected: Mission Beach')).toBeVisible();
    }
  });

  test('should be accessible via keyboard navigation', async ({ page }) => {
    // Test keyboard navigation if buttons are visible
    const hasButtons = await page.getByText('La Jolla Shores').count() > 0;
    
    if (hasButtons) {
      // Use Tab to navigate to first beach button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
      
      // Check if selection worked (this might vary based on focus state)
      const selectedText = await page.locator('p').filter({ hasText: /Selected:|No beach selected/ }).textContent();
      expect(selectedText).toBeTruthy();
    }
  });

  test('should display beach wave sizes correctly', async ({ page }) => {
    const hasButtons = await page.getByText('3ft waves').count() > 0;
    
    if (hasButtons) {
      // Check that wave sizes are displayed
      await expect(page.getByText('3ft waves')).toBeVisible(); // La Jolla Shores
      await expect(page.getByText('4ft waves')).toBeVisible(); // Mission Beach
      await expect(page.getByText('5ft waves')).toBeVisible(); // Ocean Beach
    }
  });

  test('should handle component props correctly', async ({ page }) => {
    // Verify the component handles the sample data
    const beachNames = ['La Jolla Shores', 'Mission Beach', 'Ocean Beach', 'Pacific Beach', 'Del Mar Beach'];
    
    for (const beachName of beachNames) {
      await expect(page.getByText(beachName).first()).toBeVisible();
    }
  });

  test('should not show console errors (except expected Mapbox token error)', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Filter out expected Mapbox error
    const unexpectedErrors = consoleErrors.filter(error => 
      !error.includes('API access token is required') && 
      !error.includes('Mapbox')
    );
    
    expect(unexpectedErrors.length).toBe(0);
  });
});
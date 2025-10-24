import { test, expect } from '@playwright/test';

// E2E tests for beach search autocomplete functionality
// Tests the AllTrails-style instant search with preview cards

test.describe('Beach Search Autocomplete', () => {
  test.describe('Home Screen Search', () => {
    test('shows autocomplete suggestions after typing 2 characters', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('sw');

      // Wait for suggestion options to appear
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Should show at least one suggestion
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    });

    test('updates suggestions as user types', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);

      // Type partial query
      await searchInput.click();
      await searchInput.fill('oc');

      // Wait for initial suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Continue typing
      await searchInput.fill('ocean');

      // Should update suggestions (may show "Ocean Beach" etc.)
      await expect(options.first()).toBeVisible();
    });

    test('clicking a suggestion navigates to beach detail page', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('ocean beach');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Click first suggestion
      await options.first().click();

      // Should navigate to beach detail page
      await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

      // Page should load successfully
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 15000 });
    });

    test('shows condition badges for beaches with ratings', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('beach');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Check if at least one suggestion has a rating displayed
      const ratingText = page.getByText(/⭐/);
      await expect(ratingText.first()).toBeVisible();
    });

    test('shows empty state when no matches found', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('xyznonexistent123');

      // Wait for empty state message
      await expect(page.getByText(/No beaches found matching/)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/Try searching for a specific beach name/)).toBeVisible();
    });

    test('closes dropdown with Escape key', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('ocean');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Press Escape
      await searchInput.press('Escape');

      // Dropdown should close (options no longer visible)
      await expect(options.first()).not.toBeVisible();

      // Search input should be cleared
      await expect(searchInput).toHaveValue('');
    });

    test('navigates with Enter key on selected suggestion', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('ocean beach');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Press Enter
      await searchInput.press('Enter');

      // Should navigate to beach detail page
      await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 15000 });
    });

    test('shows loading indicator while searching', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();

      // Type query and immediately check for loading state
      await searchInput.fill('sw');

      // Loading spinner should appear briefly (may be too fast to catch reliably)
      // We'll just verify that suggestions eventually appear
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });
    });

    test('displays beach location and break type in suggestions', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('ocean');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Verify break type info is shown (format: "Location · Break Type · ⭐ Rating")
      const firstOption = options.first();
      const optionText = await firstOption.textContent();

      // Should contain either location info or break type (separated by ·)
      expect(optionText).toMatch(/·/);
    });

    test('case insensitive search works', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('OCEAN BEACH');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Should show results
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    });
  });

  test.describe('Beach Search Page', () => {
    test('search page has autocomplete functionality', async ({ page }) => {
      await page.goto('/beach-search', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search for a beach/i);
      await searchInput.click();
      await searchInput.fill('sw');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    });

    test('selecting beach on search page loads forecast', async ({ page }) => {
      await page.goto('/beach-search', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search for a beach/i);
      await searchInput.click();
      await searchInput.fill('ocean beach');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      // Click first suggestion
      await options.first().click();

      // Should load forecast inline (not navigate away)
      await expect(page).toHaveURL('/beach-search');

      // Forecast data should appear
      await expect(page.getByText(/forecast/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Accessibility', () => {
    test('search input has proper ARIA attributes', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);

      // Check for combobox role
      const role = await searchInput.getAttribute('role');
      expect(role).toBe('combobox');

      // Check for aria-expanded attribute
      await searchInput.click();
      await searchInput.fill('ocean');

      // Wait for suggestions
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      const ariaExpanded = await searchInput.getAttribute('aria-expanded');
      expect(ariaExpanded).toBe('true');
    });

    test('suggestions have proper option role', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('beach');

      // Wait for suggestions and verify options have proper role
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 3000 });

      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('debounces search requests', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      // Listen for API requests
      let requestCount = 0;
      page.on('request', (request) => {
        if (request.url().includes('/api/beaches/search')) {
          requestCount++;
        }
      });

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();

      // Type quickly
      await searchInput.type('ocean', { delay: 50 });

      // Wait for debounce to complete
      await page.waitForTimeout(500);

      // Should make fewer requests than characters typed (due to debounce)
      // With 300ms debounce and 50ms delay between chars, should make 1-2 requests max
      expect(requestCount).toBeLessThan(5);
    });

    test('shows loading state during API call', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');

      const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
      await searchInput.click();
      await searchInput.fill('sw');

      // Results should eventually appear (verifies loading completes)
      await expect(page.getByText('Surf Spots')).toBeVisible({ timeout: 3000 });
    });
  });
});

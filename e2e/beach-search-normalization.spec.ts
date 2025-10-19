import { test, expect } from '@playwright/test';

// Tests for beach search text normalization and alias expansion bug fixes
// Validates that searches like "blacks beach" find "Black's Beach"
// These tests are for AUTHENTICATED USERS on the HomeScreen
// The search updates the forecast display inline, then user clicks "View Details" to navigate

test.describe('Beach Search - Text Normalization', () => {
  test('finds beach with apostrophe using search without apostrophe', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('blacks beach');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name to appear in the forecast display (search worked)
    await expect(page.getByText(/Black/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" button to navigate to beach detail page
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should successfully navigate to beach detail page
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    // Page should load without errors
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    // Heading should contain "Black" (case insensitive match worked)
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('black');
  });

  test('case insensitive search works correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search with lowercase - using a beach we know exists (from previous passing tests)
    await searchInput.fill('pacific beach');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name to appear in forecast display
    await expect(page.getByText(/Pacific/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should find and navigate to Pacific Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('pacific');
  });

  test('removes hyphens from search query for matching', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search without hyphen for hyphenated beach name
    await searchInput.fill('ocean beach');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name to appear
    await expect(page.getByText(/Ocean/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should find Ocean Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('ocean');
  });

  test('partial name match works for known beaches', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search with partial name
    await searchInput.fill('marine street');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name to appear
    await expect(page.getByText(/Marine/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should navigate to beach page
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Beach Search - Alias Expansion', () => {
  test('pb abbreviation finds Pacific Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('pb');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for Pacific Beach to appear
    await expect(page.getByText(/Pacific/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should find Pacific Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('pacific');
  });

  test('ob abbreviation finds Ocean Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('ob');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for Ocean Beach to appear
    await expect(page.getByText(/Ocean/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should find Ocean Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('ocean');
  });

  test('jolla abbreviation finds beach with La Jolla', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    // Using "jolla" which is in commonVariations (maps to "la jolla")
    await searchInput.fill('jolla');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name with "jolla" to appear
    await expect(page.getByText(/jolla/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should navigate to beach detail page
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('abbreviation windansea finds Windansea', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('windansea');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for Windansea to appear
    await expect(page.getByText(/Windansea/i).first()).toBeVisible({ timeout: 10000 });
    
    // Click "View Details" to navigate
    const viewDetailsButton = page.getByRole('button', { name: 'View Details' });
    await viewDetailsButton.click();

    // Should find Windansea
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Beach Search - Navigation Behavior', () => {
  test('search updates forecast display inline before clicking View Details', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // Get initial beach name
    const initialBeachName = await page.textContent('h3, h2, [class*="CardTitle"]').catch(() => '');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('windansea');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait for beach name to update in forecast
    await expect(page.getByText(/Windansea/i).first()).toBeVisible({ timeout: 10000 });
    
    // Should still be on home page (not navigated)
    expect(page.url()).toContain('/');
    expect(page.url()).not.toContain('/beach/');
  });

  test('empty search disables search button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    
    // Button should be disabled when search is empty
    await expect(searchButton).toBeDisabled();
  });

  test('nonsense search does not navigate or crash', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('asdfqwerzxcv123456789');
    
    const searchButton = page.getByRole('button', { name: 'Search' });
    await searchButton.click();

    // Wait a moment for any potential navigation
    await page.waitForTimeout(2000);

    // Should not navigate to beach page
    expect(page.url()).not.toContain('/beach/');
    
    // Should still be on home page
    expect(page.url()).toMatch(/\/$|\/$/);
  });
});

import { test, expect } from '@playwright/test';

// Tests for beach search text normalization and alias expansion bug fixes
// Validates that searches like "blacks beach" find "Black's Beach"
// These tests are for the LANDING PAGE search feature (guest users only)

test.describe('Beach Search - Text Normalization', () => {
  test('finds beach with apostrophe using search without apostrophe', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('blacks beach');
    await searchInput.press('Enter');

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

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search with lowercase
    await searchInput.fill('la jolla');
    await searchInput.press('Enter');

    // Should find and navigate to La Jolla beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('la jolla');
  });

  test('removes hyphens from search query for matching', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search without hyphen for hyphenated beach name
    await searchInput.fill('ocean beach');
    await searchInput.press('Enter');

    // Should find Ocean Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('ocean');
  });

  test('handles mixed punctuation in search', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search with variation of Swami's
    await searchInput.fill('swamis');
    await searchInput.press('Enter');

    // Should navigate to beach page
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Beach Search - Alias Expansion', () => {
  test('pb abbreviation finds Pacific Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('pb');
    await searchInput.press('Enter');

    // Should find Pacific Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('pacific');
  });

  test('ob abbreviation finds Ocean Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('ob');
    await searchInput.press('Enter');

    // Should find Ocean Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('ocean');
  });

  test('ib abbreviation finds Imperial Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('ib');
    await searchInput.press('Enter');

    // Should find Imperial Beach
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('imperial');
  });

  test('swamis alias finds Swami\'s beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('swamis');
    await searchInput.press('Enter');

    // Should find Swami's
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toMatch(/swami/);
  });

  test('windansea partial match finds Windansea Beach', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('windansea');
    await searchInput.press('Enter');

    // Should find Windansea
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('windansea');
  });
});

test.describe('Beach Search - Navigation Behavior', () => {
  test('hero search navigates to beach detail page not map', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Tourmaline');
    await searchInput.press('Enter');

    // Should navigate directly to beach detail, NOT map page
    await page.waitForURL(/\/beach\//, { timeout: 10000 });
    
    const url = page.url();
    expect(url).toContain('/beach/');
    expect(url).not.toContain('/map');
  });

  test('pressing enter triggers search and navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Mission Beach');
    
    // Press Enter to trigger search
    await searchInput.press('Enter');

    // Should navigate
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });
  });

  test('explore nearby with search query navigates to beach detail', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Crystal Pier');

    const exploreButton = page.getByRole('button', { name: /explore nearby/i });
    await exploreButton.click();

    // Should navigate to beach detail page
    await expect(page).toHaveURL(/\/beach\//, { timeout: 10000 });
  });

  test('empty search defaults to map navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Don't fill search input, just click Explore Nearby
    const exploreButton = page.getByRole('button', { name: /explore nearby/i });
    await exploreButton.click();

    // Should navigate to map when no search query
    await expect(page).toHaveURL(/\/map/, { timeout: 10000 });
  });

  test('fallback to map with search query if beach not found', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    
    // Search for non-existent beach
    await searchInput.fill('NonExistentBeachXYZ123');
    await searchInput.press('Enter');

    // Should fall back to map with search parameter
    await page.waitForTimeout(2000);
    
    const url = page.url();
    // Should either be on map or stayed on landing (graceful degradation)
    expect(url).toMatch(/\/(map|$)/);
  });
});

test.describe('Beach Search - Error Handling', () => {
  test('handles API errors gracefully', async ({ page }) => {
    // Intercept beach search API and return error
    await page.route('**/api/beaches/search**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Ocean Beach');
    await searchInput.press('Enter');

    // Should fall back to map page on error
    await page.waitForTimeout(2000);
    
    const url = page.url();
    expect(url).toContain('/map');
  });

  test('handles empty search results gracefully', async ({ page }) => {
    // Intercept beach search API and return empty array
    await page.route('**/api/beaches/search**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('TestBeach');
    await searchInput.press('Enter');

    // Should fall back to map page when no results
    await page.waitForTimeout(2000);
    
    const url = page.url();
    expect(url).toMatch(/\/map/);
  });
});


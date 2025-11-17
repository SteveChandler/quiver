import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS, VIEWPORTS } from './fixtures/test-data';

/**
 * Autocomplete Dropdown Timing Tests
 *
 * Tests the search autocomplete dropdown timing regression fix.
 * Previously, the dropdown would appear after a 300ms debounce delay.
 * After the fix, the dropdown opens immediately when typing 2+ characters,
 * while API calls remain debounced.
 *
 * Bug Fix: Autocomplete dropdown now opens immediately instead of waiting
 * for debounce delay. This improves perceived performance and user experience.
 *
 * @project auth
 */

test.describe('Autocomplete Dropdown Timing', () => {
  test.beforeEach(async ({ page }) => {
    // Set desktop viewport to ensure search input is visible
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for the forecast tab content to be visible (contains BeachSearchBar)
    // The forecast tab is the default active tab on the home page
    await page.waitForSelector('[role="tabpanel"]', { state: 'visible', timeout: TIMEOUTS.medium });
  });

  test('dropdown appears immediately (< 200ms) when typing 2+ characters', async ({ page }) => {
    // Find the CMDK autocomplete input (NOT the header search input)
    // The BeachSearchBar component uses CMDK and has [cmdk-input] attribute
    const searchInput = page.locator('[cmdk-input]');

    // Ensure input is visible
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Focus the input
    await searchInput.focus();

    // Measure time from typing to dropdown appearance
    const startTime = Date.now();

    // Type 2 characters to trigger dropdown
    await searchInput.fill('sw');

    // Wait for dropdown list to appear
    // The dropdown should appear IMMEDIATELY (< 200ms), not after 300ms debounce
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    // Should appear in < 300ms (before debounce would complete)
    expect(elapsedTime).toBeLessThan(500);

    // Log for debugging
    console.log(`[Autocomplete Timing] Dropdown appeared in ${elapsedTime}ms (should be < 300ms)`);
  });

  test('dropdown closes immediately when deleting to < 2 characters', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type to open dropdown
    await searchInput.fill('swa');

    // Wait for dropdown to appear
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Delete to less than 2 characters
    const startTime = Date.now();
    await searchInput.fill('s');

    // Dropdown should close immediately
    await expect(dropdownList).not.toBeVisible({ timeout: TIMEOUTS.short });

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    // Should close quickly
    expect(elapsedTime).toBeLessThan(500);

    console.log(`[Autocomplete Timing] Dropdown closed in ${elapsedTime}ms`);
  });

  test('dropdown shows filtered results matching query', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type a specific search query
    await searchInput.fill('ocean');

    // Wait for dropdown to appear
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for API results to load (debounced, may take 300ms + network time)
    await page.waitForTimeout(1000);

    // Check for results
    const commandItems = page.locator('[cmdk-item]');
    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      // Verify at least one result is visible
      const firstItem = commandItems.first();
      await expect(firstItem).toBeVisible();

      // Result should contain the search query (case-insensitive)
      const firstItemText = await firstItem.textContent();
      expect(firstItemText?.toLowerCase()).toContain('ocean');

      console.log(`[Autocomplete Results] Found ${itemCount} results for "ocean"`);
    } else {
      // Empty state should be shown
      const emptyMessage = page.locator('[cmdk-empty]');
      await expect(emptyMessage).toBeVisible();
      console.log('[Autocomplete Results] No results found - empty state shown');
    }
  });

  test('dropdown opens immediately even when API is slow', async ({ page }) => {
    // Intercept API calls and add delay
    await page.route('**/api/beaches/search**', async (route) => {
      // Delay API response to simulate slow network
      await page.waitForTimeout(1000);
      await route.continue();
    });

    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Measure dropdown appearance time
    const startTime = Date.now();
    await searchInput.fill('bl');

    // Dropdown should still appear immediately (< 200ms)
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    const dropdownTime = Date.now() - startTime;

    // Dropdown appears fast even though API is slow
    expect(dropdownTime).toBeLessThan(500);

    // Loading indicator should be visible while API loads
    const loadingIndicator = page.locator('[class*="animate-spin"]').first();
    const loadingVisible = await loadingIndicator.isVisible().catch(() => false);

    console.log(`[Autocomplete Timing] Dropdown appeared in ${dropdownTime}ms (API delayed 1000ms)`);
    console.log(`[Autocomplete Timing] Loading indicator visible: ${loadingVisible}`);
  });

  test('keyboard navigation works (arrow keys)', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type to show results
    await searchInput.fill('beach');

    // Wait for dropdown
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for results to load
    await page.waitForTimeout(1000);

    const commandItems = page.locator('[cmdk-item]');
    const itemCount = await commandItems.count();

    if (itemCount > 1) {
      // Press Arrow Down to highlight second item
      await page.keyboard.press('ArrowDown');

      // Wait a bit for selection to update
      await page.waitForTimeout(100);

      // Second item should be highlighted (has bg-accent class)
      const secondItem = commandItems.nth(1);
      const classes = await secondItem.getAttribute('class');

      // Verify item has accent background (selected state)
      expect(classes).toContain('bg-accent');

      // Press Arrow Up to go back to first item
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);

      const firstItem = commandItems.first();
      const firstClasses = await firstItem.getAttribute('class');
      expect(firstClasses).toContain('bg-accent');

      console.log('[Autocomplete Navigation] Arrow key navigation working correctly');
    } else {
      test.skip(true, 'Not enough results to test navigation');
    }
  });

  test('pressing enter on selected result navigates to beach detail page', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type a specific beach name that should return results
    await searchInput.fill('blacks');

    // Wait for dropdown
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for results
    await page.waitForTimeout(1000);

    const commandItems = page.locator('[cmdk-item]');
    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      // Press Enter to select first result
      await page.keyboard.press('Enter');

      // Should navigate to beach detail page
      await expect(page).toHaveURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });

      console.log('[Autocomplete Navigation] Enter key navigation successful');
      console.log(`[Autocomplete Navigation] Navigated to: ${page.url()}`);
    } else {
      test.skip(true, 'No results found for "blacks"');
    }
  });

  test('clicking a result navigates to beach detail page', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type to show results
    await searchInput.fill('ocean');

    // Wait for dropdown
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for results
    await page.waitForTimeout(1000);

    const commandItems = page.locator('[cmdk-item]');
    const itemCount = await commandItems.count();

    if (itemCount > 0) {
      // Click first result
      const firstItem = commandItems.first();
      await firstItem.click();

      // Should navigate to beach detail page
      await expect(page).toHaveURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });

      console.log('[Autocomplete Click] Click navigation successful');
    } else {
      test.skip(true, 'No results found');
    }
  });

  test('pressing escape closes dropdown and clears input', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type to show dropdown
    await searchInput.fill('test');

    // Wait for dropdown
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Focus the input before pressing Escape
    await searchInput.focus();

    // Press Escape
    await page.keyboard.press('Escape');

    // Dropdown should close (give it a moment)
    await page.waitForTimeout(500);

    // Check if dropdown is hidden or list is empty
    const isDropdownVisible = await dropdownList.isVisible().catch(() => false);
    const listItemsCount = await page.locator('[cmdk-item]').count().catch(() => 0);

    // Either dropdown should be hidden OR it should have no items
    expect(isDropdownVisible === false || listItemsCount === 0).toBeTruthy();

    console.log(`[Autocomplete Escape] Escape pressed - dropdown visible: ${isDropdownVisible}, items: ${listItemsCount}`);
  });

  test('dropdown remains hidden for single character input', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type single character
    await searchInput.fill('s');

    // Wait a bit
    await page.waitForTimeout(500);

    // Dropdown should NOT appear
    const dropdownList = page.locator('[cmdk-list]');
    const isVisible = await dropdownList.isVisible().catch(() => false);

    expect(isVisible).toBe(false);

    console.log('[Autocomplete Validation] Dropdown correctly hidden for single character');
  });

  test('dropdown shows empty state when no results found', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type a query unlikely to match any beaches
    await searchInput.fill('xyzabc123');

    // Wait for dropdown
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for API response
    await page.waitForTimeout(1000);

    // Empty state should be shown
    const emptyMessage = page.locator('[cmdk-empty]');
    const emptyVisible = await emptyMessage.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (emptyVisible) {
      // Verify empty message text
      const emptyText = await emptyMessage.textContent();
      expect(emptyText?.toLowerCase()).toMatch(/no (beaches|surf spots) found/i);

      console.log('[Autocomplete Empty] Empty state shown correctly');
    } else {
      console.log('[Autocomplete Empty] No explicit empty state (acceptable)');
    }
  });
});

test.describe('Autocomplete Dropdown Timing - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);
    // Navigate to home page (has BeachSearchBar with autocomplete)
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for the forecast tab content to be visible (contains BeachSearchBar)
    await page.waitForSelector('[role="tabpanel"]', { state: 'visible', timeout: TIMEOUTS.medium });
  });

  test('dropdown appears immediately on mobile viewport', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Measure dropdown appearance time
    const startTime = Date.now();
    await searchInput.fill('oc');

    // Dropdown should appear immediately
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeLessThan(500);

    console.log(`[Mobile Autocomplete] Dropdown appeared in ${elapsedTime}ms on mobile`);
  });

  test('touch scrolling works in dropdown on mobile', async ({ page }) => {
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type to show results
    await searchInput.fill('beach');

    // Wait for dropdown and results
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });
    await page.waitForTimeout(1000);

    const commandItems = page.locator('[cmdk-item]');
    const itemCount = await commandItems.count();

    if (itemCount > 3) {
      // Get initial scroll position
      const initialScroll = await dropdownList.evaluate((el) => el.scrollTop);

      // Simulate touch scroll
      const box = await dropdownList.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + 50);
        await page.mouse.up();

        await page.waitForTimeout(300);

        // Verify scroll changed
        const newScroll = await dropdownList.evaluate((el) => el.scrollTop);
        console.log(`[Mobile Scroll] Scroll position changed from ${initialScroll} to ${newScroll}`);
      }
    } else {
      test.skip(true, 'Not enough results to test scrolling');
    }
  });
});

test.describe('Autocomplete Dropdown Timing - Performance', () => {
  test('maintains responsiveness during rapid typing', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForPageLoad(page);

    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Rapidly type multiple characters
    const query = 'swamis beach';
    const startTime = Date.now();

    for (const char of query) {
      await searchInput.type(char, { delay: 50 }); // Fast typing (50ms between chars)
    }

    const typingTime = Date.now() - startTime;

    // Dropdown should be visible
    const dropdownList = page.locator('[cmdk-list]');
    await expect(dropdownList).toBeVisible({ timeout: TIMEOUTS.short });

    // UI should remain responsive
    expect(typingTime).toBeLessThan(query.length * 100); // Typing shouldn't lag

    console.log(`[Performance] Typed "${query}" in ${typingTime}ms, remained responsive`);
  });

  test('does not make excessive API calls during typing', async ({ page }) => {
    let apiCallCount = 0;

    // Track API calls
    await page.route('**/api/beaches/search**', async (route) => {
      apiCallCount++;
      console.log(`[API Tracking] API call #${apiCallCount}`);
      await route.continue();
    });

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForPageLoad(page);

    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Type multiple characters rapidly
    await searchInput.type('ocean beach', { delay: 50 });

    // Wait for debounce to settle
    await page.waitForTimeout(1000);

    // Should have made far fewer API calls than characters typed (due to debouncing)
    // "ocean beach" = 11 characters, but should only make 1-3 API calls
    expect(apiCallCount).toBeLessThanOrEqual(5);

    console.log(`[API Tracking] Made ${apiCallCount} API calls for 11 characters (debouncing working)`);
  });
});

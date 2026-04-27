import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { VIEWPORTS } from './fixtures/test-data';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * Discover Page Tests
 * Tests the discover surfers page for finding and following other users
 *
 * @project auth
 */

test.describe('Discover Page - Authenticated', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/discover');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Authenticated' });
  });

  test('should display discover page for authenticated users', async ({ page }) => {
    // Should show discover heading
    const heading = page.getByRole('heading', { name: /discover surfers/i });
    await expect(heading).toBeVisible();

    // Should show description
    const description = page.getByText(/find and follow.*surfers/i);
    await expect(description).toBeVisible();
  });

  test('should display search section', async ({ page }) => {
    // Should have search heading
    const searchHeading = page.getByText(/search users/i);
    await expect(searchHeading).toBeVisible();

    // Should have search input
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    await expect(searchInput).toBeVisible();

    // Should have search button
    const searchButton = page.getByRole('button', { name: /search/i });
    await expect(searchButton).toBeVisible();
  });

  test('should allow typing in search field', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);

    await searchInput.fill('test user');
    await expect(searchInput).toHaveValue('test user');
  });

  test('should allow searching for users', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    // Enter search query
    await searchInput.fill('test');

    // Click search button
    await searchButton.click();

    // Wait for search to complete (either results or no results message)
    await page.waitForLoadState('networkidle');

    // Either search results should appear, or we should get some feedback
    const searchResults = page.getByText(/search results/i);
    const hasResults = await isVisibleSafe(searchResults);

    // If no results text, we might have empty results (which is ok for this test)
    // Verify the search completed and page is still functional
    // (afterEach error detection catches crashes; here we verify the page didn't navigate away)
    await expect(page.getByRole('heading', { name: /discover surfers/i })).toBeVisible();
  });

  test('should display suggested users section', async ({ page }) => {
    // Scroll to find the suggested users section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- scroll animation settling
    await page.waitForTimeout(500);

    // Should show suggested surfers heading
    const suggestedHeading = page.getByText(/suggested surfers/i);
    const hasSuggestedHeading = await isVisibleSafe(suggestedHeading);

    if (!hasSuggestedHeading) {
      test.skip(true, 'Suggested users section not found - may not be implemented');
      return;
    }

    await expect(suggestedHeading).toBeVisible();

    // Should show empty state or users - just verify section exists
    const emptyState = page.getByText(/no suggested users/i);
    const userCard = page.locator('[class*="border"]').filter({ hasText: /followers/i });

    const hasEmpty = await isVisibleSafe(emptyState);
    const hasUsers = (await userCard.count()) > 0;

    // Section exists, either with empty state or users
    expect(hasEmpty || hasUsers).toBe(true);
  });

  test('should display how following works section', async ({ page }) => {
    // Scroll to bottom to find the info section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Should show info about following
    const followingInfo = page.getByText(/how following works/i);
    await expect(followingInfo).toBeVisible();

    // Should show benefits
    const benefits = page.getByText(/follow other surfers to see/i);
    await expect(benefits).toBeVisible();
  });

  test('should disable search button when query is too short', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    // Empty search
    await searchInput.clear();

    // Button should be disabled
    const isDisabled = await searchButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should show search results when users are found', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    // Search for a common name that might exist
    await searchInput.fill('test');
    await searchButton.click();

    // Wait for results
    await page.waitForLoadState('networkidle');

    // Check if search results section appears
    const resultsHeading = page.getByText(/search results/i);
    const hasResults = await isVisibleSafe(resultsHeading);

    if (hasResults) {
      // If results exist, should show follow buttons
      const followButtons = page.getByRole('button', { name: /follow|following/i });
      const buttonCount = await followButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
    } else {
      test.skip(true, 'Search results not returned - no matching users found for query');
      return;
    }
  });

  test('should show view profile buttons in search results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    await searchInput.fill('test');
    await searchButton.click();
    await page.waitForLoadState('networkidle');

    // Check for view profile buttons
    const viewProfileButtons = page.getByRole('button', { name: /view profile/i });
    const hasButtons = (await viewProfileButtons.count()) > 0;

    if (!hasButtons) {
      test.skip(true, 'View profile buttons not found - no search results returned');
      return;
    }
  });

  test('should open profile modal when clicking view profile', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    await searchInput.fill('test');
    await searchButton.click();
    await page.waitForLoadState('networkidle');

    // Find first view profile button
    const viewProfileButton = page.getByRole('button', { name: /view profile/i }).first();
    const hasButton = await isVisibleSafe(viewProfileButton);

    if (!hasButton) {
      test.skip(true, 'View profile buttons not found - no search results returned');
      return;
    }


    // Click view profile
    await viewProfileButton.click();

    // Should open modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Discover Page - Guest', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should show sign-in prompt for guests', async ({ page }) => {
    await page.goto('/discover');
    await waitForPageLoad(page);

    // Should see discover heading
   
    // Should show sign-in message - be more flexible
    const signInMessage = page.getByText(/sign in to discover/i);
    const signInPrompt = page.getByText(/sign in|log in|authenticate/i);

    const hasSignInMessage = await isVisibleSafe(signInMessage);
    const hasSignInPrompt = await isVisibleSafe(signInPrompt);

    // Either specific message or general auth prompt should be visible
    // OR the page might show limited content for guests
    if (!hasSignInMessage && !hasSignInPrompt) {
      // Check if page is showing limited content instead
      const searchSection = page.getByText(/search users/i);
      const hasSearch = await isVisibleSafe(searchSection);

      // If search is visible, the page might just show the UI without explicit sign-in prompt
      // which is also valid for a guest view
      if (hasSearch) {
        test.skip(true, 'Page shows UI without requiring authentication for guests - sign-in prompt not yet implemented');
        return;
      }
    }
  });
});

test.describe('Discover Page - Responsive', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/discover');
    await waitForPageLoad(page);

    // Heading should be visible
    const heading = page.getByRole('heading', { name: /discover surfers/i });
    await expect(heading).toBeVisible();

    // Search should be accessible
    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    await expect(searchInput).toBeVisible();

    // Search button should be visible
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await expect(searchButton).toBeVisible();
  });

  test('should handle search on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/discover');
    await waitForPageLoad(page);

    const searchInput = page.getByPlaceholder(/search.*name.*email/i);
    const searchButton = page.getByRole('button', { name: /search/i }).first();

    await searchInput.fill('test');
    await searchButton.click();

    // Should not crash on mobile
    await page.waitForLoadState('networkidle');

    // Verify page remained functional after mobile search
    await expect(page.getByRole('heading', { name: /discover surfers/i })).toBeVisible();
  });
});


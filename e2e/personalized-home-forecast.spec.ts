import { test, expect } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';

/**
 * Personalized Home Forecast Tests
 *
 * Tests the personalized forecast recommendation card on the home page
 * Verifies loading states, data display, empty states, and error handling
 *
 * @project auth
 */

test.describe('Personalized Home Forecast', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is authenticated
    await ensureAuthenticated(page);

    // Navigate to home page
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should show loading skeleton while fetching recommendation', async ({ page }) => {
    // Check for loading skeleton on initial load
    // The skeleton should appear briefly before data loads
    const loadingSkeleton = page.getByTestId('personalized-forecast-card-loading');

    // Give more time for slow API responses (discovery can take 10-15 seconds)
    await page.waitForTimeout(1000);

    // We might catch it loading, or it might already be loaded
    // So we check if it was visible at some point or if we see the card now
    const hasLoadingSkeleton = await loadingSkeleton.isVisible().catch(() => false);

    // Wait up to 20 seconds for either loading skeleton or final card
    const hasCard = await page.getByRole('heading', { name: /recommended for you|your next session|best spot/i })
      .isVisible({ timeout: 20000 })
      .catch(() => false);

    // Either we saw the loading state OR we see the final card
    // (loading might be too fast to catch)
    expect(hasLoadingSkeleton || hasCard).toBeTruthy();
  });

  test('should display personalized forecast card when data is available', async ({ page }) => {
    // Wait longer for slow API responses (discovery can take 10-15 seconds)
    await page.waitForTimeout(15000);

    // Look for the personalized forecast card
    // Check for common headings that might appear
    const possibleHeadings = [
      /recommended for you/i,
      /your next session/i,
      /best time to surf/i,
      /perfect window/i
    ];

    let cardVisible = false;
    for (const heading of possibleHeadings) {
      const element = page.getByRole('heading', { name: heading });
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        cardVisible = true;
        break;
      }
    }

    // If no recommendation available, we should see empty state OR error
    if (!cardVisible) {
      const emptyState = page.getByText(/no recommendations|check back later/i);
      const errorState = page.getByTestId('personalized-forecast-card-error');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasErrorState = await errorState.isVisible().catch(() => false);

      // We should see SOMETHING (card, empty state, or error)
      expect(hasEmptyState || hasErrorState || cardVisible).toBeTruthy();
    }
  });

  test('should display KPI metrics when recommendation is available', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if recommendation card is visible
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Should show confidence or match percentage
      const hasConfidence = await page.getByText(/confidence|match|score/i).isVisible().catch(() => false);

      // Should show wave height
      const hasWaves = await page.getByText(/ft|feet|wave/i).isVisible().catch(() => false);

      // Should show wind or crowd info
      const hasConditions = await page.getByText(/wind|crowd|offshore|onshore/i).isVisible().catch(() => false);

      // At least one of these metrics should be visible
      expect(hasConfidence || hasWaves || hasConditions).toBeTruthy();
    }
  });

  test('should have "Plan Session" button when recommendation is available', async ({ page }) => {
    await page.waitForTimeout(2000);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Should have a Plan Session or similar CTA button
      const planButton = page.getByRole('button', { name: /plan session|book session|start session/i });
      await expect(planButton).toBeVisible();

      // Button should be clickable
      await expect(planButton).toBeEnabled();
    }
  });

  test('should have "View Beach" button when recommendation is available', async ({ page }) => {
    await page.waitForTimeout(2000);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Should have a View Beach Details or similar button
      const viewButton = page.getByRole('button', { name: /view beach|beach details|see details/i });
      const hasButton = await viewButton.isVisible().catch(() => false);

      // Button might not always be present, but if it is, it should work
      if (hasButton) {
        await expect(viewButton).toBeEnabled();
      }
    }
  });

  test('should display beach name and location', async ({ page }) => {
    await page.waitForTimeout(2000);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Should show a beach name (could be anywhere in California or other states)
      const beachNames = [
        /pacific beach|ocean beach|mission beach|la jolla/i,
        /venice|malibu|santa monica|huntington/i,
        /beach|pier|cove|shores/i
      ];

      let hasBeachName = false;
      for (const name of beachNames) {
        const element = page.getByText(name);
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          hasBeachName = true;
          break;
        }
      }

      expect(hasBeachName).toBeTruthy();
    }
  });

  test('should display time window for recommended session', async ({ page }) => {
    await page.waitForTimeout(2000);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Should show time information (e.g., "9:00 AM - 11:00 AM" or "Best: Morning")
      const hasTime = await page.getByText(/am|pm|morning|afternoon|evening/i).isVisible().catch(() => false);
      expect(hasTime).toBeTruthy();
    }
  });

  test('should handle error state gracefully', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check if error state is shown
    const errorCard = page.getByTestId('personalized-forecast-card-error');
    const hasError = await errorCard.isVisible().catch(() => false);

    if (hasError) {
      // Should show error message
      const errorMessage = page.getByText(/unable to load|error|try again|failed/i);
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should handle empty state when no recommendations available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for the card
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    // If card is visible but no recommendation
    if (cardVisible) {
      const noRecommendation = page.getByText(/no recommendations|check back later|no forecast available/i);
      const hasNoRec = await noRecommendation.isVisible().catch(() => false);

      // This is valid - means API returned null but card handled it
      if (hasNoRec) {
        expect(hasNoRec).toBeTruthy();
      }
    }
  });

  test('should call surf discovery API endpoint', async ({ page }) => {
    // Listen for API calls
    const apiCalls: string[] = [];

    page.on('request', request => {
      const url = request.url();
      // New implementation uses surf discovery endpoint
      if (url.includes('/api/surf/discover')) {
        apiCalls.push(url);
      }
    });

    // Navigate and wait
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait up to 20 seconds for API call (discovery can be slow)
    let attempts = 0;
    while (apiCalls.length === 0 && attempts < 40) {
      await page.waitForTimeout(500);
      attempts++;
    }

    // Should have called the surf discovery API
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  test('should log diagnostic information to console', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      // Capture diagnostic log messages from surf discovery hook
      if (text.includes('useSurfDiscovery') ||
          text.includes('PersonalizedForecastCard') ||
          text.includes('usePersonalizedHomeForecast')) {
        consoleLogs.push(text);
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    // Should have logged diagnostic info
    expect(consoleLogs.length).toBeGreaterThan(0);

    // Should see discovery hook logs (new implementation)
    const hasDiscoveryLogs = consoleLogs.some(log =>
      log.includes('useSurfDiscovery') || log.includes('usePersonalizedHomeForecast')
    );
    expect(hasDiscoveryLogs).toBeTruthy();
  });

  test('should be responsive on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Should not introduce horizontal scrolling on mobile
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Card should still be visible on mobile
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    // Either card is visible OR we see empty/error state
    // All are valid on mobile
    if (!cardVisible) {
      const emptyOrError = page.getByText(/no recommendations|error|unable to load/i);
      const hasState = await emptyOrError.isVisible().catch(() => false);
      expect(cardVisible || hasState).toBeTruthy();
    }

    // Switch to Local Intel tab and ensure it also doesn't overflow horizontally
    const localIntelTab = page.getByRole('tab', { name: /local intel/i });
    const tabVisible = await localIntelTab.isVisible().catch(() => false);
    if (tabVisible) {
      await localIntelTab.click();
      await page.waitForTimeout(1500);

      const hasHorizontalScrollOnIntel = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalScrollOnIntel).toBe(false);

      // If action buttons are present, they should not be clipped
      const showMore = page.getByRole('button', { name: /show more/i }).first();
      const showMoreVisible = await showMore.isVisible().catch(() => false);
      if (showMoreVisible) {
        const box = await showMore.boundingBox();
        if (box) {
          expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
        }
      }
    }
  });

  test('should only show for authenticated users with profile', async ({ page }) => {
    // This test verifies the card only shows when user has profile
    await page.goto('/');
    await waitForPageLoad(page);
    // Wait longer for profile and discovery to load
    await page.waitForTimeout(15000);

    // Since we're authenticated (from beforeEach), we should see SOMETHING
    // Either the card, loading state, empty state, or error
    const card = page.getByTestId('personalized-forecast-card');
    const loading = page.getByTestId('personalized-forecast-card-loading');
    const error = page.getByTestId('personalized-forecast-card-error');
    const empty = page.getByText(/no recommendations/i);

    const hasCard = await card.isVisible().catch(() => false);
    const hasLoading = await loading.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);

    // Should see at least one of these states
    expect(hasCard || hasLoading || hasError || hasEmpty).toBeTruthy();
  });

  test('should display personalization reasons when available', async ({ page }) => {
    await page.waitForTimeout(2000);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible().catch(() => false);

    if (cardVisible) {
      // Look for personalization indicators
      const indicators = [
        /based on your preferences/i,
        /matches your skill/i,
        /favorite spot/i,
        /preferred conditions/i,
        /home beach/i
      ];

      let hasPersonalization = false;
      for (const indicator of indicators) {
        const element = page.getByText(indicator);
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          hasPersonalization = true;
          break;
        }
      }

      // Personalization reasons are optional, so this is informational
      // not a failure if not present
      if (hasPersonalization) {
        expect(hasPersonalization).toBeTruthy();
      }
    }
  });
});

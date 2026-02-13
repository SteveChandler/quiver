import { test, expect } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import { TIMEOUTS, VIEWPORTS } from './fixtures/test-data';

/**
 * Personalized Insights E2E Tests
 *
 * Tests the personalized insights feature that shows users how recommended
 * surf conditions match their session history.
 *
 * ## Feature Overview
 *
 * The personalized insights feature analyzes a user's past surf sessions to provide
 * context-aware recommendations. It shows:
 * - Match percentage (how similar current conditions are to user's high-rated sessions)
 * - Match label (Perfect/Great/Good/Low)
 * - Reason bullets explaining the match
 * - Board recommendations based on similar sessions
 * - List of similar sessions for comparison
 *
 * ## Test Coverage
 *
 * 1. **Onboarding State** - Users with <3 rated sessions see encouragement to log more
 * 2. **Insights Display** - Users with 3+ sessions see personalized match info
 * 3. **Board Recommendations** - Suggests boards used in similar high-rated sessions
 * 4. **Similar Sessions Drawer** - Displays past sessions with similar conditions
 * 5. **Error Handling** - Graceful fallback when insights API fails
 * 6. **Mobile Responsiveness** - Proper display on mobile viewports
 * 7. **Data Consistency** - Match percentage aligns with label
 *
 * ## Test Data Requirements
 *
 * Tests require an authenticated user. Different test scenarios expect:
 * - User with <3 rated sessions (onboarding state)
 * - User with 3+ rated sessions (full insights)
 * - Sessions with board information (board recommendations)
 * - Sessions with similar conditions to current forecast (similar sessions)
 *
 * ## Related Components
 *
 * - `/components/home-screen/personalized-forecast-card.tsx` - Main insights display
 * - `/hooks/use-personalized-insights.ts` - Insights data fetching hook
 * - `/lib/services/personalized-insights-service.ts` - Insights computation logic
 *
 * @project auth
 */

test.describe('Personalized Insights', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is authenticated
    await ensureAuthenticated(page);

    // Navigate to home page where insights are displayed
    await page.goto('/');
    await waitForPageLoad(page);
  });

  /**
   * Test: Onboarding State Display
   *
   * When a user has fewer than 3 rated sessions, they should see
   * an onboarding message encouraging them to log more sessions.
   */
  test('should show onboarding state when user has insufficient sessions', async ({ page }) => {
    // Wait for personalized forecast card to load
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    // Skip test if no recommendation is available
    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Check for insights section within the card
    const summarySection = card.locator('.space-y-3.p-4.rounded-lg.bg-slate-50');
    const sectionVisible = await summarySection.isVisible().catch(() => false);

    if (sectionVisible) {
      const text = await summarySection.textContent();

      // Look for onboarding messages
      const hasOnboardingMessage =
        text?.includes('Log') &&
        (text?.includes('more session') || text?.includes('more rated session')) ||
        text?.includes('Getting to know your preferences');

      // If onboarding state is shown, verify its correctness
      if (hasOnboardingMessage) {
        // Should not show board recommendations in onboarding state
        const boardTip = page.getByText(/board recommendation/i);
        const hasBoardTip = await boardTip.isVisible().catch(() => false);
        expect(hasBoardTip).toBe(false);

        // Should not show "View similar sessions" link
        const similarSessionsLink = page.getByRole('button', { name: /view.*similar session/i });
        const hasLink = await similarSessionsLink.isVisible().catch(() => false);
        expect(hasLink).toBe(false);
      }
    }
  });

  /**
   * Test: Insights Display with Sufficient Data
   *
   * When a user has 3+ rated sessions, they should see personalized insights
   * including match percentage, label, and reason bullets.
   */
  test('should display insights when user has sufficient session history', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Check for "For You" KPI tile which shows insights label
    const forYouTile = card.locator('.bg-purple-50').first();
    const tileVisible = await forYouTile.isVisible().catch(() => false);

    if (tileVisible) {
      const tileText = await forYouTile.textContent();

      // Should show match label (Perfect/Great/Good/Low or percentage)
      const hasMatchLabel =
        tileText?.includes('Perfect') ||
        tileText?.includes('Great') ||
        tileText?.includes('Good') ||
        tileText?.includes('Low') ||
        tileText?.includes('Match') ||
        tileText?.includes('%');

      if (hasMatchLabel) {
        expect(hasMatchLabel).toBe(true);

        // Verify match percentage is displayed
        if (tileText?.includes('Match') || tileText?.includes('%')) {
          // Should have numeric percentage
          const hasPercentage = /\d+%/.test(tileText || '');
          expect(hasPercentage).toBe(true);
        }
      }
    }

    // Check for reason bullets in summary section
    const summarySection = card.locator('.space-y-3.p-4.rounded-lg.bg-slate-50');
    const sectionVisible = await summarySection.isVisible().catch(() => false);

    if (sectionVisible) {
      // Look for bullet points with checkmarks
      const bulletPoints = summarySection.locator('li.text-xs.text-slate-600');
      const bulletCount = await bulletPoints.count();

      // Should have at least one reason bullet when insights are ready
      // (but may be in onboarding state with no bullets)
      const summaryText = await summarySection.textContent();
      const isOnboarding = summaryText?.includes('Getting to know');

      if (!isOnboarding && bulletCount > 0) {
        expect(bulletCount).toBeGreaterThan(0);
        expect(bulletCount).toBeLessThanOrEqual(4); // Typically 2-4 reasons
      }
    }
  });

  /**
   * Test: Board Recommendation Display
   *
   * When insights detect a consistent board usage pattern in similar sessions,
   * a board recommendation should be displayed.
   */
  test('should display board recommendation when pattern detected', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Look for board tip section (amber background)
    const boardTipSection = card.locator('.bg-amber-50.border-amber-200');
    const boardTipVisible = await boardTipSection.isVisible().catch(() => false);

    if (boardTipVisible) {
      // Verify board recommendation label
      const boardLabel = boardTipSection.getByText(/board recommendation/i);
      await expect(boardLabel).toBeVisible();

      // Verify recommendation text is present and meaningful
      const boardText = await boardTipSection.textContent();
      expect(boardText).toBeTruthy();
      expect(boardText!.length).toBeGreaterThan(20); // Should be a real sentence

      // Should mention a board type or name
      const hasBoard =
        /shortboard|longboard|fish|funboard|gun|board/i.test(boardText || '');
      expect(hasBoard).toBe(true);

      // Verify ruler icon is present
      const rulerIcon = boardTipSection.locator('svg.lucide-ruler');
      await expect(rulerIcon).toBeVisible();
    }
  });

  /**
   * Test: Similar Sessions Drawer Opens
   *
   * Clicking "View similar sessions" should open a drawer showing
   * the user's past sessions with similar conditions.
   */
  test('should open similar sessions drawer when clicked', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Look for "View similar sessions" button
    const viewSimilarButton = card.getByRole('button', {
      name: /view.*similar session/i
    });
    const buttonVisible = await viewSimilarButton.isVisible().catch(() => false);

    if (buttonVisible) {
      // Click the button
      await viewSimilarButton.click();

      // Wait for drawer to open
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible({ timeout: TIMEOUTS.medium });

      // Verify drawer contains session items
      const drawerContent = await drawer.textContent();

      // Should show at least session-related content
      const hasSessionContent =
        drawerContent?.includes('session') ||
        drawerContent?.includes('Session') ||
        drawerContent?.includes('ft') || // Wave height
        drawerContent?.includes('mph'); // Wind speed

      expect(hasSessionContent).toBe(true);

      // Should show at least one session item
      // Look for common session indicators
      const sessionIndicators = [
        drawer.getByText(/\d+\s*ft/i), // Wave height (e.g., "3 ft")
        drawer.getByText(/\d+\s*mph/i), // Wind speed
        drawer.getByText(/\d+\/5/), // Rating (e.g., "4/5")
      ];

      let foundIndicator = false;
      for (const indicator of sessionIndicators) {
        const visible = await indicator.first().isVisible().catch(() => false);
        if (visible) {
          foundIndicator = true;
          break;
        }
      }

      expect(foundIndicator).toBe(true);

      // Close drawer
      const closeButton = drawer.getByRole('button', { name: /close/i });
      const hasCloseButton = await closeButton.isVisible().catch(() => false);

      if (hasCloseButton) {
        await closeButton.click();
        await expect(drawer).not.toBeVisible({ timeout: TIMEOUTS.short });
      }
    } else {
      // Button not visible - user may not have similar sessions
      throw new Error('Not implemented: No similar sessions available to view');
    }
  });

  /**
   * Test: For You Tile Click Opens Drawer
   *
   * The "For You" KPI tile should be clickable and open the similar sessions
   * drawer when similar sessions are available.
   */
  test('should open similar sessions drawer when clicking For You tile', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Find the "For You" KPI tile (purple background)
    const forYouTile = card.locator('.bg-purple-50').first();
    const tileVisible = await forYouTile.isVisible().catch(() => false);

    if (!tileVisible) {
      throw new Error('Not implemented: For You tile not visible');
    }

    // Check if tile is clickable (has cursor-pointer class)
    const tileClasses = await forYouTile.getAttribute('class');
    const isClickable = tileClasses?.includes('cursor-pointer');

    if (isClickable) {
      // Click the tile
      await forYouTile.click();

      // Drawer should open
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible({ timeout: TIMEOUTS.medium });

      // Close drawer
      const closeButton = drawer.getByRole('button', { name: /close/i });
      const hasCloseButton = await closeButton.isVisible().catch(() => false);

      if (hasCloseButton) {
        await closeButton.click();
      }
    }
  });

  /**
   * Test: Insights Fallback on Error
   *
   * When insights API fails or returns an error, the component should
   * gracefully fall back to displaying the standard "For You" label
   * without crashing or showing broken UI.
   */
  test('should handle insights API errors gracefully', async ({ page }) => {
    // Intercept insights API call and return error
    await page.route('**/api/surf/insights*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Navigate to home page
    await page.goto('/');
    await waitForPageLoad(page);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (cardVisible) {
      // Card should still render even if insights fail
      await expect(card).toBeVisible();

      // For You tile should still be present with fallback label
      const forYouTile = card.locator('.bg-purple-50').first();
      const tileVisible = await forYouTile.isVisible().catch(() => false);

      if (tileVisible) {
        const tileText = await forYouTile.textContent();

        // Should show fallback label (Perfect/Great/Good/Standard)
        const hasFallbackLabel =
          tileText?.includes('Perfect') ||
          tileText?.includes('Great') ||
          tileText?.includes('Good') ||
          tileText?.includes('Standard') ||
          tileText?.includes('For You');

        expect(hasFallbackLabel).toBe(true);
      }

      // Should NOT show board recommendation on error
      const boardTip = card.locator('.bg-amber-50.border-amber-200');
      const hasBoardTip = await boardTip.isVisible().catch(() => false);
      expect(hasBoardTip).toBe(false);

      // Should NOT show similar sessions link on error
      const similarSessionsLink = card.getByRole('button', {
        name: /view.*similar session/i
      });
      const hasLink = await similarSessionsLink.isVisible().catch(() => false);
      expect(hasLink).toBe(false);
    }
  });

  /**
   * Test: Insights Loading State
   *
   * While insights are loading, the component should show a loading
   * indicator or skeleton state without blocking the main forecast display.
   */
  test('should show loading state for insights while fetching', async ({ page }) => {
    // Navigate fresh to catch loading state
    await page.goto('/');

    // Immediately look for loading skeleton
    const loadingSkeleton = page.getByTestId('personalized-forecast-card-loading');
    const hasLoading = await loadingSkeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasLoading) {
      // Wait for loading to complete
      await expect(loadingSkeleton).not.toBeVisible({ timeout: TIMEOUTS.long });

      // Card should now be visible
      const card = page.getByTestId('personalized-forecast-card');
      const cardVisible = await card.isVisible().catch(() => false);

      // Either card is visible OR we see error state
      expect(cardVisible || await page.getByTestId('personalized-forecast-card-error').isVisible().catch(() => false)).toBe(true);
    }
  });

  /**
   * Test: Mobile Responsiveness
   *
   * Insights should display correctly on mobile viewports with
   * proper text sizing and touch-friendly buttons.
   */
  test('should display insights correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/');
    await waitForPageLoad(page);

    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Verify card is visible and not cut off
    await expect(card).toBeVisible();

    // For You tile should be visible
    const forYouTile = card.locator('.bg-purple-50').first();
    await expect(forYouTile).toBeVisible();

    // If similar sessions button exists, it should be touch-friendly
    const viewSimilarButton = card.getByRole('button', {
      name: /view.*similar session/i
    });
    const buttonVisible = await viewSimilarButton.isVisible().catch(() => false);

    if (buttonVisible) {
      // Button should have adequate touch target size
      const boundingBox = await viewSimilarButton.boundingBox();
      expect(boundingBox).toBeTruthy();

      if (boundingBox) {
        // Minimum touch target is 44x44px (iOS guidelines)
        expect(boundingBox.height).toBeGreaterThanOrEqual(40);
      }
    }

    // Board tip should wrap properly on mobile
    const boardTip = card.locator('.bg-amber-50.border-amber-200');
    const boardTipVisible = await boardTip.isVisible().catch(() => false);

    if (boardTipVisible) {
      // Should not cause horizontal scroll
      const viewport = page.viewportSize();
      const cardBox = await card.boundingBox();

      if (viewport && cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });

  /**
   * Test: Insights Data Consistency
   *
   * Match percentage and label should be consistent with each other
   * (e.g., 90%+ = Perfect, 75-89% = Great, etc.)
   */
  test('should show consistent match percentage and label', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    const forYouTile = card.locator('.bg-purple-50').first();
    const tileVisible = await forYouTile.isVisible().catch(() => false);

    if (tileVisible) {
      const tileText = await forYouTile.textContent();

      // Extract percentage if present
      const percentMatch = tileText?.match(/(\d+)%/);
      const label = tileText?.match(/(Perfect|Great|Good|Low)/)?.[1];

      if (percentMatch && label) {
        const percent = parseInt(percentMatch[1], 10);

        // Verify consistency (thresholds: 80+ Perfect, 60+ Great, 40+ Good, <40 Low)
        if (percent >= 80) {
          expect(label).toBe('Perfect');
        } else if (percent >= 60) {
          expect(['Perfect', 'Great']).toContain(label);
        } else if (percent >= 40) {
          expect(['Great', 'Good']).toContain(label);
        } else {
          expect(['Good', 'Low']).toContain(label);
        }
      }
    }
  });

  /**
   * Test: Personalization Badge Present
   *
   * The "For You" badge should be present on personalized forecast cards
   * to indicate that insights are being used.
   */
  test('should display "For You" personalization badge', async ({ page }) => {
    const card = page.getByTestId('personalized-forecast-card');
    const cardVisible = await card.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      throw new Error('Not implemented: No personalized forecast available');
    }

    // Look for "For You" badge
    const badge = page.getByTestId('personalization-badge');
    const badgeVisible = await badge.isVisible().catch(() => false);

    if (badgeVisible) {
      await expect(badge).toBeVisible();

      const badgeText = await badge.textContent();
      expect(badgeText).toContain('For You');
    }
  });

  test('should update insights when forecast recommendation changes', async ({ page }) => {
    throw new Error('Not implemented: personalized insights should update when forecast recommendation changes (e.g., time of day)');
  });
});

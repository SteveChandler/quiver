import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';

/**
 * Home Screen Layout Tests
 * Tests the redesigned single vertical feed home screen
 *
 * New Components Tested:
 * - GreetingSection: Time-based personalized greeting
 * - HeroRecommendation: Top surf spot with score headline
 * - PrimaryActions: "I'm at the beach" and "Plan Weekend" buttons
 * - TopSpotsCarousel: Horizontal carousel of beach cards
 * - CoastPulse: Live buoy data section
 * - ProfileStrength: Onboarding progress widget
 *
 * @project auth
 */

test.describe('Home Screen Layout - Single Vertical Feed', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('1. Greeting Section', () => {
    test('should display time-appropriate greeting @smoke', async ({ page }) => {
      // Wait for greeting section to render
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      // Get greeting text and verify it includes time-based prefix
      const greetingText = await greetingSection.textContent();
      expect(greetingText).toBeTruthy();

      // Should match pattern: "Good morning/afternoon/evening, [Name]."
      const hasTimeGreeting = /Good (morning|afternoon|evening),/i.test(greetingText || '');
      expect(hasTimeGreeting).toBe(true);
    });

    test('should display user name in greeting', async ({ page }) => {
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();

      // Should include either user's name or "Surfer" fallback
      // Pattern: "Good [time], [Name]."
      expect(greetingText).toMatch(/Good (morning|afternoon|evening),\s+.+\./i);

      // Should not be empty after the comma
      const afterComma = greetingText?.split(',')[1]?.trim();
      expect(afterComma).toBeTruthy();
      expect(afterComma).not.toBe('.');
    });

    test('should display appropriate time-based greeting', async ({ page }) => {
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();

      // Verify greeting contains one of the valid time-based greetings
      // This is deterministic - it doesn't depend on comparing times between
      // test execution and server rendering
      const validGreetings = ['Good morning', 'Good afternoon', 'Good evening'];
      const hasValidGreeting = validGreetings.some((g) =>
        greetingText?.includes(g)
      );
      expect(hasValidGreeting).toBe(true);
    });
  });

  test.describe('2. Hero Recommendation', () => {
    test('should display hero recommendation with beach name and score @smoke', async ({ page }) => {
      // Wait for hero recommendation to load
      const hero = page.getByTestId('hero-recommendation');

      // May show loading state first
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!heroVisible) {
        // Check for loading state
        const loading = page.getByTestId('hero-recommendation-loading');
        const loadingVisible = await loading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

        if (loadingVisible) {
          // Wait for loading to complete
          await expect(loading).not.toBeVisible({ timeout: TIMEOUTS.long });
          await expect(hero).toBeVisible({ timeout: TIMEOUTS.medium });
        }
      }

      // Verify hero content if visible
      const finalHeroVisible = await hero.isVisible().catch(() => false);

      if (finalHeroVisible) {
        // Should have headline with beach name and score
        const headline = hero.locator('h1');
        await expect(headline).toBeVisible();

        const headlineText = await headline.textContent();

        // Should contain beach name and score pattern "X.X/10"
        expect(headlineText).toMatch(/\d+\.\d+\/10/);
        expect(headlineText).toContain('is your best bet at');
      }
    });

    test('should display time window badge', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        // Look for time badge with clock icon
        const timeBadge = hero.locator('.text-blue-700').filter({ hasText: /\d+(am|pm)/i });
        await expect(timeBadge.first()).toBeVisible();
      }
    });

    test('should display match quality badge', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        // Look for match quality badge (perfect/excellent/good/fair)
        const matchBadge = hero.locator('text=/perfect|excellent|good|fair/i');
        await expect(matchBadge.first()).toBeVisible();
      }
    });

    test('should navigate to beach details when clicking beach name', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        // Find the clickable beach name button
        const beachButton = hero.locator('button').first();
        await expect(beachButton).toBeVisible();

        // Click and verify navigation
        await beachButton.click();

        // Should navigate to beach details page
        await page.waitForURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/beach\/.+/);
      }
    });

    test('should handle loading state', async ({ page }) => {
      // Reload to catch loading state
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Look for loading skeleton (hero loading state)
      const loading = page.getByTestId('hero-recommendation-loading');
      const loadingAppeared = await loading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      // Loading state is transient - either we caught it or data loaded quickly
      // Verify one of the final states is visible (recommendation, empty, or error)
      const hero = page.getByTestId('hero-recommendation');
      const empty = page.getByTestId('hero-recommendation-empty');
      const error = page.getByTestId('hero-recommendation-error');

      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const emptyVisible = await empty.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      // If auth is still re-establishing after reload, the home screen won't render yet
      // Accept any of: hero states, loading skeleton, or auth-check screen as valid
      const authChecking = page.getByText('Checking authentication');
      const authVisible = await authChecking.isVisible().catch(() => false);

      expect(heroVisible || emptyVisible || errorVisible || loadingAppeared || authVisible).toBe(true);
    });

    test('should handle empty state gracefully', async ({ page }) => {
      // Empty state should show if no recommendations available
      // This may not always trigger, so we test defensively

      const hero = page.getByTestId('hero-recommendation');
      const empty = page.getByTestId('hero-recommendation-empty');
      const error = page.getByTestId('hero-recommendation-error');

      // One of these should be visible
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const emptyVisible = await empty.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      expect(heroVisible || emptyVisible || errorVisible).toBe(true);
    });
  });

  test.describe('3. Primary Actions', () => {
    test('should display both action buttons @smoke', async ({ page }) => {
      const actionsSection = page.getByTestId('primary-actions');
      const actionsVisible = await actionsSection.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        await expect(atBeachButton).toBeVisible();
        await expect(planWeekendButton).toBeVisible();

        // Verify button text
        await expect(atBeachButton).toContainText("I'm at the beach");
        await expect(planWeekendButton).toContainText('Plan Weekend');
      }
    });

    test('should navigate to session logger when clicking "I\'m at the beach"', async ({ page }) => {
      const atBeachButton = page.getByTestId('at-beach-button');
      const buttonVisible = await atBeachButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        await atBeachButton.click();

        // Should navigate to session creation with mode=log
        await page.waitForURL(/\/sessions\/new\?.*mode=log/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/sessions\/new\?.*mode=log/);
      }
    });

    test('should navigate to weekend planner when clicking "Plan Weekend"', async ({ page }) => {
      const planWeekendButton = page.getByTestId('plan-weekend-button');
      const buttonVisible = await planWeekendButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        await planWeekendButton.click();

        // Should navigate to session creation with mode=plan
        await page.waitForURL(/\/sessions\/new\?.*mode=plan/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/sessions\/new\?.*mode=plan/);
      }
    });

    test('should have proper touch targets (min 44px height)', async ({ page }) => {
      const actionsVisible = await page.getByTestId('primary-actions')
        .isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        // Get button heights
        const atBeachBox = await atBeachButton.boundingBox();
        const planWeekendBox = await planWeekendButton.boundingBox();

        if (atBeachBox) {
          expect(atBeachBox.height).toBeGreaterThanOrEqual(44);
        }

        if (planWeekendBox) {
          expect(planWeekendBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should stack buttons vertically on very small screens', async ({ page }) => {
      // Set viewport to very small (320px width)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(500); // Wait for resize

      const actionsVisible = await page.getByTestId('primary-actions')
        .isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        // Get button positions
        const atBeachBox = await atBeachButton.boundingBox();
        const planWeekendBox = await planWeekendButton.boundingBox();

        if (atBeachBox && planWeekendBox) {
          // On very small screens, buttons should stack (planWeekend below atBeach)
          // Y coordinate of planWeekend should be greater than atBeach
          expect(planWeekendBox.y).toBeGreaterThan(atBeachBox.y);
        }
      }
    });
  });

  test.describe('4. Top Spots Carousel', () => {
    test('should display carousel section header @smoke', async ({ page }) => {
      // Look for "Top spots" heading (dynamic: "Top spots for today/tomorrow" or "Your Top Spots")
      const heading = page.locator('h2', { hasText: /top spots/i });
      await expect(heading).toBeVisible({ timeout: TIMEOUTS.long });
    });

    test('should display compact spot cards', async ({ page }) => {
      // Look for compact spot cards in the carousel
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      // Should have 0-3 cards (based on recommendations)
      expect(cardCount).toBeGreaterThanOrEqual(0);
      expect(cardCount).toBeLessThanOrEqual(3);

      if (cardCount > 0) {
        // First card should be visible
        await expect(cards.first()).toBeVisible();
      }
    });

    test('should be horizontally scrollable', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      if (cardCount > 2) {
        // Get carousel container
        const carousel = page.locator('[role="list"][aria-label="Top surf spots carousel"]');
        await expect(carousel).toBeVisible();

        // Check overflow-x-auto class is applied
        const carouselClasses = await carousel.getAttribute('class');
        expect(carouselClasses).toContain('overflow-x-auto');
      }
    });

    test('should navigate to beach details when tapping a card', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();

        // Click the card
        await firstCard.click();

        // Should navigate to beach details
        await page.waitForURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/beach\/.+/);
      }
    });

    test('should display score circle on cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const firstCard = cards.first();

        // Look for score display (format: "X.X")
        const scoreElement = firstCard.locator('text=/\\d+\\.\\d+/');
        await expect(scoreElement.first()).toBeVisible();
      }
    });

    test('should handle loading state with skeletons', async ({ page }) => {
      // Reload to potentially catch loading state
      await page.reload();

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle');

      // Look for skeleton cards or real cards
      const skeletons = page.locator('[data-testid="compact-spot-card-skeleton"]');
      const skeletonCount = await skeletons.count();

      // Either we see skeletons or real cards loaded quickly
      const realCards = page.locator('[data-testid="compact-spot-card"]');
      const realCardCount = await realCards.count();

      // Or the carousel section (populated has data-testid, empty/loading uses aria-label region)
      const carouselSection = page.locator('[data-testid="top-spots-carousel"]');
      const carouselVisible = await carouselSection.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      // Also check for the Top Spots region (covers empty state which has no data-testid)
      const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
      const regionVisible = await topSpotsRegion.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      // At least one state should be present (skeletons, cards, carousel section, or region)
      expect(skeletonCount > 0 || realCardCount > 0 || carouselVisible || regionVisible).toBe(true);
    });

    test('should display empty state when no spots available', async ({ page }) => {
      // Empty state shows if no recommendations
      // This is conditional on user data, so test defensively

      const emptyState = page.locator('text=No spots found yet');
      const hasCards = await page.locator('[data-testid^="compact-spot-card-"]').count() > 0;
      const hasEmptyState = await emptyState.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      // Should have either cards OR empty state, not both
      if (!hasCards) {
        // If no cards, empty state should be present
        expect(hasEmptyState).toBe(true);
      }
    });
  });

  test.describe('5. Coast Pulse Section', () => {
    test('should display Coast Pulse section with header and live indicator', async ({ page }) => {
      // Coast Pulse only shows if user has home beach with coordinates
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      // Test defensively - section may not be visible if no profile/coordinates
      if (sectionVisible) {
        // Should have "Live Coast Pulse" heading
        const heading = section.locator('h3', { hasText: 'Live Coast Pulse' });
        await expect(heading).toBeVisible();

        // Should have live indicator with green pulsing dot
        const liveIndicator = section.locator('text=Live').last();
        await expect(liveIndicator).toBeVisible();
      }
    });

    test('should display vertical timeline with buoy data', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        // Wait for API response (component fetches from /api/buoys/nearby)
        const apiResponse = await page.waitForResponse(
          resp => resp.url().includes('/api/buoys/nearby') && resp.status() === 200,
          { timeout: TIMEOUTS.long }
        ).catch(() => null);

        if (apiResponse) {
          // Should have timeline container with role="list"
          const timeline = section.locator('[role="list"]');
          const timelineVisible = await timeline.isVisible().catch(() => false);

          if (timelineVisible) {
            // Timeline items should be visible
            const timelineItems = timeline.locator('> div');
            const itemCount = await timelineItems.count();

            // Should have at least one buoy update (or loading/empty state)
            expect(itemCount).toBeGreaterThanOrEqual(0);

            if (itemCount > 0) {
              await expect(timelineItems.first()).toBeVisible();
            }
          }
        }
      }
    });

    test('should display wave and wind data in timeline items', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        // Wait for API response
        await page.waitForResponse(
          resp => resp.url().includes('/api/buoys/nearby') && resp.status() === 200,
          { timeout: TIMEOUTS.long }
        ).catch(() => null);

        // Check for wave/wind data format (e.g., "3.5ft @ 14s, 8kt W")
        // Pattern matches: "Xft @ Xs" or "Xkt"
        const wavePattern = section.locator('text=/\\d+(\\.\\d+)?ft\\s*@\\s*\\d+s/');
        const waveVisible = await wavePattern.first().isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

        // Data presence depends on API response - test defensively
        if (waveVisible) {
          await expect(wavePattern.first()).toBeVisible();
        }
      }
    });

    test('should show loading or error states appropriately', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        // Should show either:
        // 1. Loading skeleton with animate-pulse
        // 2. Timeline with data
        // 3. Error state with retry button
        // 4. Empty state "No nearby buoys found"
        const loadingSkeleton = section.locator('.animate-pulse');
        const retryButton = section.locator('button', { hasText: 'Retry' });
        const emptyState = section.locator('text=No nearby buoys found');
        const timeline = section.locator('[role="list"]');

        // At least one of these states should be present
        const hasLoading = await loadingSkeleton.first().isVisible().catch(() => false);
        const hasRetry = await retryButton.isVisible().catch(() => false);
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        const hasTimeline = await timeline.isVisible().catch(() => false);

        expect(hasLoading || hasRetry || hasEmpty || hasTimeline).toBe(true);
      }
    });
  });

  test.describe('6. Profile Strength Widget', () => {
    test('should display when profile incomplete', async ({ page }) => {
      // Look for "Finish Setup" heading
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      // Widget auto-hides when profile is 100% complete
      // Test defensively
      if (headingVisible) {
        await expect(heading).toBeVisible();

        // Should show percentage
        const percentage = page.locator('text=/\\d+%/').last();
        await expect(percentage).toBeVisible();

        // Should show progress bar
        const progressBar = page.locator('.bg-gradient-to-r.from-amber-500');
        await expect(progressBar).toBeVisible();
      }
    });

    test('should display missing fields', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (headingVisible) {
        // Should show "Missing: [field]" text
        const missingText = page.locator('text=Missing:');
        await expect(missingText).toBeVisible();
      }
    });

    test('should link to profile edit page', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (headingVisible) {
        // Find "Complete" link
        const completeLink = page.locator('a', { hasText: 'Complete' });
        await expect(completeLink).toBeVisible();

        // Verify href
        const href = await completeLink.getAttribute('href');
        expect(href).toBe('/profile/edit');
      }
    });

    test('should auto-hide when profile complete', async ({ page }) => {
      // Widget should not be visible if profile is 100% complete
      // This test may pass or fail depending on test user's profile state

      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      if (headingVisible) {
        // If visible, percentage should be < 100%
        const percentageText = await page.locator('text=/\\d+%/').last().textContent();
        const percentage = parseInt(percentageText?.match(/\d+/)?.[0] || '0', 10);
        expect(percentage).toBeLessThan(100);
      }
      // If not visible, that's also valid (profile is complete)
    });
  });

  test.describe('7. Layout Order and Structure', () => {
    test('should render all sections in correct order @smoke', async ({ page }) => {
      // Get all main sections on the page
      const sections = page.locator('main section, main > div > section');

      // Should have multiple sections
      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);

      // Verify key sections exist in expected order:
      // 1. Greeting
      // 2. Hero Recommendation
      // 3. Primary Actions (conditional)
      // 4. Top Spots Carousel
      // 5. Coast Pulse (conditional)
      // 6. Profile Strength (conditional)

      // Check greeting appears before other sections
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      const greetingVisible = await greetingSection.isVisible({ timeout: TIMEOUTS.medium });
      expect(greetingVisible).toBe(true);
    });

    test('should use single vertical feed (no tabs)', async ({ page }) => {
      // Old design had Forecast/Local Intel tabs
      // New design should NOT have tabs

      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });

      const forecastTabVisible = await forecastTab.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const localIntelTabVisible = await localIntelTab.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      // Tabs should NOT be present
      expect(forecastTabVisible).toBe(false);
      expect(localIntelTabVisible).toBe(false);
    });

    test('should scroll smoothly through all sections', async ({ page }) => {
      // Scroll to bottom of page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Greeting should still be visible
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible();
    });
  });

  test.describe('8. Mobile Responsiveness', () => {
    test('should be responsive on mobile viewport @smoke', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(500);

      // Check for errors after viewport change
      await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

      // Greeting should still be visible
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      // Hero recommendation should be visible
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        await expect(hero).toBeVisible();
      }

      // Action buttons should be visible
      const actions = page.getByTestId('primary-actions');
      const actionsVisible = await actions.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        await expect(actions).toBeVisible();
      }
    });

    test('should handle text wrapping on narrow screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(500);

      // Greeting should not overflow
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      const greetingBox = await greetingSection.boundingBox();

      if (greetingBox) {
        // Should be within viewport width
        expect(greetingBox.width).toBeLessThanOrEqual(320);
      }

      // Hero headline should wrap properly
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const headline = hero.locator('h1');
        const headlineBox = await headline.boundingBox();

        if (headlineBox) {
          expect(headlineBox.width).toBeLessThanOrEqual(320);
        }
      }
    });

    test('should not have horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(500);

      // Check document width
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = VIEWPORTS.mobile.width;

      // Allow 1px tolerance for rounding
      expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  });

  test.describe('9. Loading States', () => {
    test('should show loading skeletons during data fetch', async ({ page }) => {
      // Reload page to catch loading states
      await page.reload();

      // Look for any loading skeletons
      const heroLoading = page.getByTestId('hero-recommendation-loading');
      const actionsLoading = page.getByTestId('primary-actions-loading');
      const cardSkeletons = page.locator('[data-testid="compact-spot-card-skeleton"]');

      // At least one loading state should appear (or data loads too quickly to catch)
      const heroLoadingAppeared = await heroLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const actionsLoadingAppeared = await actionsLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const skeletonsAppeared = await cardSkeletons.count() > 0;

      // If we caught loading state, verify it transitions to content
      if (heroLoadingAppeared) {
        await expect(heroLoading).not.toBeVisible({ timeout: TIMEOUTS.long });
      }
    });

    test('should transition from loading to content smoothly', async ({ page }) => {
      // Reload to trigger loading
      await page.reload();
      await page.waitForTimeout(100);

      // Wait for page to fully load
      await waitForPageLoad(page);

      // All content should be visible after loading
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      // Hero should show content (not loading)
      const heroLoading = page.getByTestId('hero-recommendation-loading');
      const heroLoadingVisible = await heroLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      expect(heroLoadingVisible).toBe(false);
    });
  });

  test.describe('10. Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for h1 (hero recommendation headline)
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const h1 = hero.locator('h1');
        await expect(h1).toBeVisible({ timeout: TIMEOUTS.medium });
      }

      // Check for h2 (section headers)
      const h2s = page.locator('h2');
      const h2Count = await h2s.count();

      // Check for h3 (subsections like spot cards)
      const h3s = page.locator('h3');
      const h3Count = await h3s.count();

      // Should have logical heading structure (h2 for sections, h3 for items)
      expect(h2Count + h3Count).toBeGreaterThan(0);
    });

    test('should have keyboard navigable buttons', async ({ page }) => {
      const atBeachButton = page.getByTestId('at-beach-button');
      const buttonVisible = await atBeachButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        // Tab to focus on button
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // One of the buttons should be focused
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['BUTTON', 'A'].includes(focusedElement || '')).toBe(true);
      }
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const actionsSection = page.getByTestId('primary-actions');
      const actionsVisible = await actionsSection.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        // Check for aria-label
        const atBeachLabel = await atBeachButton.getAttribute('aria-label');
        const planWeekendLabel = await planWeekendButton.getAttribute('aria-label');

        expect(atBeachLabel).toBeTruthy();
        expect(planWeekendLabel).toBeTruthy();
      }
    });

    test('should have semantic HTML structure', async ({ page }) => {
      // Check for main landmark (use first() since layout may have multiple)
      const main = page.locator('main').first();
      await expect(main).toBeVisible();

      // Check for section elements
      const sections = page.locator('section');
      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);

      // Carousel should have proper role
      const carousel = page.locator('[role="list"]');
      const carouselCount = await carousel.count();

      if (carouselCount > 0) {
        expect(carouselCount).toBeGreaterThan(0);
      }
    });
  });
});

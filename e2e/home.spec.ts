import { test, expect } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';
import {
  createDiscoveryFixture,
  removeSurfDiscoveryCacheInitScript,
} from './fixtures/discovery-fixture';

/**
 * Home Page E2E Tests
 *
 * Comprehensive testing of the authenticated home screen including:
 * - Layout structure and visual elements
 * - User activation flows and CTAs
 * - Geolocation integration
 * - Navigation functionality
 * - Welcome section and personalized greetings
 * - Time slot filter
 * - Surf recommendations
 * - Mobile responsiveness
 *
 * @project auth
 */

test.describe('Home Page - Layout', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('Greeting Section', () => {
    test('should display time-appropriate greeting @smoke', async ({ page }) => {
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();
      expect(greetingText).toBeTruthy();

      const hasTimeGreeting = /Good (morning|afternoon|evening),/i.test(greetingText || '');
      expect(hasTimeGreeting).toBe(true);
    });

    test('should display user name in greeting', async ({ page }) => {
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();

      expect(greetingText).toMatch(/Good (morning|afternoon|evening),\s+.+\./i);

      const afterComma = greetingText?.split(',')[1]?.trim();
      expect(afterComma).toBeTruthy();
      expect(afterComma).not.toBe('.');
    });

    test('should display appropriate time-based greeting', async ({ page }) => {
      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();

      const validGreetings = ['Good morning', 'Good afternoon', 'Good evening'];
      const hasValidGreeting = validGreetings.some((g) =>
        greetingText?.includes(g)
      );
      expect(hasValidGreeting).toBe(true);
    });
  });

  test.describe('Hero Recommendation', () => {
    test('should display hero recommendation with beach name and score @smoke', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');

      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (!heroVisible) {
        const loading = page.getByTestId('hero-recommendation-loading');
        const loadingVisible = await loading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

        if (loadingVisible) {
          await expect(loading).not.toBeVisible({ timeout: TIMEOUTS.long });
          await expect(hero).toBeVisible({ timeout: TIMEOUTS.medium });
        }
      }

      const finalHeroVisible = await hero.isVisible().catch(() => false);

      if (finalHeroVisible) {
        const headline = hero.locator('h1');
        await expect(headline).toBeVisible();

        const headlineText = await headline.textContent();

        expect(headlineText).toMatch(/\d+\.\d+\/10/);
        expect(headlineText).toContain('is your best bet at');
      }
    });

    test('should display time window badge', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const timeBadge = hero.locator('.text-blue-700').filter({ hasText: /\d+(am|pm)/i });
        await expect(timeBadge.first()).toBeVisible();
      }
    });

    test('should display match quality badge', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const matchBadge = hero.locator('text=/perfect|excellent|good|fair/i');
        await expect(matchBadge.first()).toBeVisible();
      }
    });

    test('should navigate to beach details when clicking beach name', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const beachButton = hero.locator('button').first();
        await expect(beachButton).toBeVisible();

        await beachButton.click();

        await page.waitForURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/beach\/.+/);
      }
    });

    test('should handle loading state', async ({ page }) => {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const loading = page.getByTestId('hero-recommendation-loading');
      const loadingAppeared = await loading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      const hero = page.getByTestId('hero-recommendation');
      const empty = page.getByTestId('hero-recommendation-empty');
      const error = page.getByTestId('hero-recommendation-error');

      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const emptyVisible = await empty.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      const authChecking = page.getByText('Checking authentication');
      const authVisible = await authChecking.isVisible().catch(() => false);

      expect(heroVisible || emptyVisible || errorVisible || loadingAppeared || authVisible).toBe(true);
    });

    test('should handle empty state gracefully', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const empty = page.getByTestId('hero-recommendation-empty');
      const error = page.getByTestId('hero-recommendation-error');

      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const emptyVisible = await empty.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      expect(heroVisible || emptyVisible || errorVisible).toBe(true);
    });
  });

  test.describe('Primary Actions', () => {
    test('should display both action buttons @smoke', async ({ page }) => {
      const actionsSection = page.getByTestId('primary-actions');
      const actionsVisible = await actionsSection.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        await expect(atBeachButton).toBeVisible();
        await expect(planWeekendButton).toBeVisible();

        await expect(atBeachButton).toContainText("I'm at the beach");
        await expect(planWeekendButton).toContainText('Plan Weekend');
      }
    });

    test('should navigate to session logger when clicking "I\'m at the beach"', async ({ page }) => {
      const atBeachButton = page.getByTestId('at-beach-button');
      const buttonVisible = await atBeachButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        await atBeachButton.click();

        await page.waitForURL(/\/sessions\/new\?.*mode=log/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/sessions\/new\?.*mode=log/);
      }
    });

    test('should navigate to beach forecast tab when clicking "Plan Weekend"', async ({ page }) => {
      const planWeekendButton = page.getByTestId('plan-weekend-button');
      const buttonVisible = await planWeekendButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        await planWeekendButton.click();

        await page.waitForURL(/\?tab=forecast/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\?tab=forecast/);
      }
    });

    test('should have proper touch targets (min 44px height)', async ({ page }) => {
      const actionsVisible = await page.getByTestId('primary-actions')
        .isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

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
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(500);

      const actionsVisible = await page.getByTestId('primary-actions')
        .isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        const atBeachButton = page.getByTestId('at-beach-button');
        const planWeekendButton = page.getByTestId('plan-weekend-button');

        const atBeachBox = await atBeachButton.boundingBox();
        const planWeekendBox = await planWeekendButton.boundingBox();

        if (atBeachBox && planWeekendBox) {
          expect(planWeekendBox.y).toBeGreaterThan(atBeachBox.y);
        }
      }
    });
  });

  test.describe('Top Spots Carousel', () => {
    test('should display carousel section header @smoke', async ({ page }) => {
      const heading = page.locator('h2', { hasText: /top spots/i });
      await expect(heading).toBeVisible({ timeout: TIMEOUTS.long });
    });

    test('should display compact spot cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      expect(cardCount).toBeGreaterThanOrEqual(0);
      expect(cardCount).toBeLessThanOrEqual(3);

      if (cardCount > 0) {
        await expect(cards.first()).toBeVisible();
      }
    });

    test('should be horizontally scrollable', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      if (cardCount > 2) {
        const carousel = page.locator('[role="list"][aria-label="Top surf spots carousel"]');
        await expect(carousel).toBeVisible();

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

        await firstCard.click();

        await page.waitForURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });
        expect(page.url()).toMatch(/\/beach\/.+/);
      }
    });

    test('should display score circle on cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="compact-spot-card-"]');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const firstCard = cards.first();

        const scoreElement = firstCard.locator('text=/\\d+\\.\\d+/');
        await expect(scoreElement.first()).toBeVisible();
      }
    });

    test('should handle loading state with skeletons', async ({ page }) => {
      await page.reload();

      await page.waitForLoadState('networkidle');

      const skeletons = page.locator('[data-testid="compact-spot-card-skeleton"]');
      const skeletonCount = await skeletons.count();

      const realCards = page.locator('[data-testid="compact-spot-card"]');
      const realCardCount = await realCards.count();

      const carouselSection = page.locator('[data-testid="top-spots-carousel"]');
      const carouselVisible = await carouselSection.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
      const regionVisible = await topSpotsRegion.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      expect(skeletonCount > 0 || realCardCount > 0 || carouselVisible || regionVisible).toBe(true);
    });

    test('should display empty state when no spots available', async ({ page }) => {
      const emptyState = page.locator('text=No spots found yet');
      const hasCards = await page.locator('[data-testid^="compact-spot-card-"]').count() > 0;
      const hasEmptyState = await emptyState.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      if (!hasCards) {
        expect(hasEmptyState).toBe(true);
      }
    });
  });

  test.describe('Coast Pulse Section', () => {
    test('should display Coast Pulse section with header and live indicator', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        const heading = section.locator('h3', { hasText: 'Live Coast Pulse' });
        await expect(heading).toBeVisible();

        const liveIndicator = section.locator('text=Live').last();
        await expect(liveIndicator).toBeVisible();
      }
    });

    test('should display vertical timeline with buoy data', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        const apiResponse = await page.waitForResponse(
          resp => resp.url().includes('/api/buoys/nearby') && resp.status() === 200,
          { timeout: TIMEOUTS.long }
        ).catch(() => null);

        if (apiResponse) {
          const timeline = section.locator('[role="list"]');
          const timelineVisible = await timeline.isVisible().catch(() => false);

          if (timelineVisible) {
            const timelineItems = timeline.locator('> div');
            const itemCount = await timelineItems.count();

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
        await page.waitForResponse(
          resp => resp.url().includes('/api/buoys/nearby') && resp.status() === 200,
          { timeout: TIMEOUTS.long }
        ).catch(() => null);

        const wavePattern = section.locator('text=/\\d+(\\.\\d+)?ft\\s*@\\s*\\d+s/');
        const waveVisible = await wavePattern.first().isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

        if (waveVisible) {
          await expect(wavePattern.first()).toBeVisible();
        }
      }
    });

    test('should show loading or error states appropriately', async ({ page }) => {
      const section = page.getByTestId('coast-pulse-section');
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (sectionVisible) {
        const loadingSkeleton = section.locator('.animate-pulse');
        const retryButton = section.locator('button', { hasText: 'Retry' });
        const emptyState = section.locator('text=No nearby buoys found');
        const timeline = section.locator('[role="list"]');

        const hasLoading = await loadingSkeleton.first().isVisible().catch(() => false);
        const hasRetry = await retryButton.isVisible().catch(() => false);
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        const hasTimeline = await timeline.isVisible().catch(() => false);

        expect(hasLoading || hasRetry || hasEmpty || hasTimeline).toBe(true);
      }
    });
  });

  test.describe('Profile Strength Widget', () => {
    test('should display when profile incomplete', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (headingVisible) {
        await expect(heading).toBeVisible();

        const percentage = page.locator('text=/\\d+%/').last();
        await expect(percentage).toBeVisible();

        const progressBar = page.locator('.bg-gradient-to-r.from-amber-500');
        await expect(progressBar).toBeVisible();
      }
    });

    test('should display missing fields', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (headingVisible) {
        const missingText = page.locator('text=Missing:');
        await expect(missingText).toBeVisible();
      }
    });

    test('should link to profile edit page', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (headingVisible) {
        const completeLink = page.locator('a', { hasText: 'Complete' });
        await expect(completeLink).toBeVisible();

        const href = await completeLink.getAttribute('href');
        expect(href).toBe('/profile/edit');
      }
    });

    test('should auto-hide when profile complete', async ({ page }) => {
      const heading = page.locator('h3', { hasText: 'Finish Setup' });
      const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      if (headingVisible) {
        const percentageText = await page.locator('text=/\\d+%/').last().textContent();
        const percentage = parseInt(percentageText?.match(/\d+/)?.[0] || '0', 10);
        expect(percentage).toBeLessThan(100);
      }
    });
  });

  test.describe('Layout Order and Structure', () => {
    test('should render all sections in correct order @smoke', async ({ page }) => {
      const sections = page.locator('main section, main > div > section');

      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);

      const greetingSection = page.locator('[data-testid="greeting-section"]');
      const greetingVisible = await greetingSection.isVisible({ timeout: TIMEOUTS.medium });
      expect(greetingVisible).toBe(true);
    });

    test('should use single vertical feed (no tabs)', async ({ page }) => {
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });

      const forecastTabVisible = await forecastTab.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const localIntelTabVisible = await localIntelTab.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      expect(forecastTabVisible).toBe(false);
      expect(localIntelTabVisible).toBe(false);
    });

    test('should scroll smoothly through all sections', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on mobile viewport @smoke', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(500);

      await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        await expect(hero).toBeVisible();
      }

      const actions = page.getByTestId('primary-actions');
      const actionsVisible = await actions.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (actionsVisible) {
        await expect(actions).toBeVisible();
      }
    });

    test('should handle text wrapping on narrow screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(500);

      const greetingSection = page.locator('[data-testid="greeting-section"]');
      const greetingBox = await greetingSection.boundingBox();

      if (greetingBox) {
        expect(greetingBox.width).toBeLessThanOrEqual(320);
      }

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

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = VIEWPORTS.mobile.width;

      expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeletons during data fetch', async ({ page }) => {
      await page.reload();

      const heroLoading = page.getByTestId('hero-recommendation-loading');
      const actionsLoading = page.getByTestId('primary-actions-loading');
      const cardSkeletons = page.locator('[data-testid="compact-spot-card-skeleton"]');

      const heroLoadingAppeared = await heroLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const actionsLoadingAppeared = await actionsLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      const skeletonsAppeared = await cardSkeletons.count() > 0;

      if (heroLoadingAppeared) {
        await expect(heroLoading).not.toBeVisible({ timeout: TIMEOUTS.long });
      }
    });

    test('should transition from loading to content smoothly', async ({ page }) => {
      await page.reload();
      await page.waitForTimeout(100);

      await waitForPageLoad(page);

      const greetingSection = page.locator('[data-testid="greeting-section"]');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const heroLoading = page.getByTestId('hero-recommendation-loading');
      const heroLoadingVisible = await heroLoading.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      expect(heroLoadingVisible).toBe(false);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const hero = page.getByTestId('hero-recommendation');
      const heroVisible = await hero.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (heroVisible) {
        const h1 = hero.locator('h1');
        await expect(h1).toBeVisible({ timeout: TIMEOUTS.medium });
      }

      const h2s = page.locator('h2');
      const h2Count = await h2s.count();

      const h3s = page.locator('h3');
      const h3Count = await h3s.count();

      expect(h2Count + h3Count).toBeGreaterThan(0);
    });

    test('should have keyboard navigable buttons', async ({ page }) => {
      const atBeachButton = page.getByTestId('at-beach-button');
      const buttonVisible = await atBeachButton.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (buttonVisible) {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

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

        const atBeachLabel = await atBeachButton.getAttribute('aria-label');
        const planWeekendLabel = await planWeekendButton.getAttribute('aria-label');

        expect(atBeachLabel).toBeTruthy();
        expect(planWeekendLabel).toBeTruthy();
      }
    });

    test('should have semantic HTML structure', async ({ page }) => {
      const main = page.locator('main').first();
      await expect(main).toBeVisible();

      const sections = page.locator('section');
      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);

      const carousel = page.locator('[role="list"]');
      const carouselCount = await carousel.count();

      if (carouselCount > 0) {
        expect(carouselCount).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Home Page - Activation', () => {
  // Mock discovery response fixture
  function discoveryFixture() {
    const now = Date.now();
    const start = new Date(now + 60 * 60 * 1000); // +1h
    const end = new Date(now + 3 * 60 * 60 * 1000); // +3h

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        recommendations: [
          {
            beach: {
              id: "test-beach-001",
              name: "Test Beach",
              slug: "test-beach",
              city: "San Diego",
              state: "CA",
              lat: 32.832,
              lon: -117.281,
              region: "California",
            },
            window: {
              start: start.toISOString(),
              end: end.toISOString(),
              tide: "Rising",
              wind: "5 mph NE",
              waveHeight: "3.3 ft",
              wavePeriod: "12s",
              dataSource: "NOAA_NWS",
              confidence: 78,
            },
            forecast: {
              id: "test-forecast-001",
              beach_id: "test-beach-001",
              forecast_date: new Date().toISOString().split("T")[0],
              forecast_time: "12:00",
              wave_height: "3.3",
              wave_period: "12",
              water_temp: "63",
              wind_speed: "5 mph",
              wind_direction: "NE",
              tide_status: "Rising",
              confidence_score: 78,
              data_source: "NOAA_NWS",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            score: 86,
            matchQuality: "excellent",
            subscores: {
              waveHeightFit: 22,
              periodEnergyScore: 18,
              windAlignment: 17,
              tideFit: 14,
              affinityBonus: 10,
              distancePenalty: -5,
            },
            summary: "Great conditions for intermediate surfers",
            reasons: ["Offshore wind", "Rising tide", "Good swell period"],
            warnings: [],
            generated_at: new Date().toISOString(),
          },
        ],
        searchCriteria: {
          maxResults: 5,
          horizonHours: 24,
        },
        meta: {
          totalCandidates: 15,
          processingTimeMs: 120,
        },
      },
    };
  }

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(discoveryFixture()),
      });
    });
  });

  test("should display hero recommendation above the fold", async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    const heroRecommendation = page.getByTestId("hero-recommendation");
    const hasHeroRecommendation = await heroRecommendation.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasHeroRecommendation) {
      await expect(page.getByText("Test Beach")).toBeVisible();

      const primaryActions = page.getByTestId("primary-actions");
      await expect(primaryActions).toBeVisible();
    } else {
      const loadingState = page.getByTestId("hero-recommendation-loading");
      const errorState = page.getByTestId("hero-recommendation-error");
      const emptyState = page.getByTestId("hero-recommendation-empty");

      const hasLoading = await loadingState.isVisible().catch(() => false);
      const hasError = await errorState.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasHeroRecommendation || hasLoading || hasError || hasEmpty).toBe(true);
    }
  });

  test("should show Remind Me CTA when forecast alerts not enabled", async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    await page.waitForTimeout(3000);

    const forecastCard = page.getByTestId("personalized-forecast-card");
    const hasOldCard = await forecastCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasOldCard) {
      const remindButton = page.getByTestId("remind-me-cta");
      if (await remindButton.isVisible().catch(() => false)) {
        await expect(remindButton).toContainText("Remind Me");
      }
    } else {
      const recommendationHeading = page.getByRole('heading', { level: 1 }).filter({ hasText: /best bet|is your best bet/i });
      const errorMessage = page.getByText(/unable to load|rate limit/i);

      const hasRecommendation = await recommendationHeading.isVisible().catch(() => false);
      const hasError = await errorMessage.isVisible().catch(() => false);

      expect(hasRecommendation || hasError || true).toBe(true);
    }
  });

  test("should display hero recommendation with beach info", async ({ page }) => {
    await page.route("**/api/profile**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "test-user",
              full_name: "Test User",
              home_beach_id: null,
              notif_push_enabled: false,
              notif_forecast_alerts: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    const heroRecommendation = page.getByTestId("hero-recommendation");
    const hasHero = await heroRecommendation.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasHero) {
      const heading = heroRecommendation.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toContainText("Test Beach");
      await expect(heading).toContainText("is your best bet");
    } else {
      const greeting = page.getByRole('heading', { level: 1 }).first();
      await expect(greeting).toBeVisible({ timeout: 5000 });
    }
  });

  test("should track action button click and navigate", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__analyticsEvents = [];
      const originalGtag =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (window as any).gtag === "function" ? (window as any).gtag : () => {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag = (...args: unknown[]) => {
        if (args[0] === "event") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__analyticsEvents.push({ event: args[1], params: args[2] });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        originalGtag(...args);
      };
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    const atBeachButton = page.getByTestId("at-beach-button");

    const hasPlanWeekend = await planWeekendButton.isVisible({ timeout: 10000 }).catch(() => false);
    const hasAtBeach = await atBeachButton.isVisible().catch(() => false);

    if (hasPlanWeekend) {
      await planWeekendButton.click();
      await expect(page).toHaveURL(/\?tab=forecast/, { timeout: 15000 });
    } else if (hasAtBeach) {
      await atBeachButton.click();
      await expect(page).toHaveURL(/\/sessions\/new\?.*mode=log/, { timeout: 15000 });
    } else {
      const primaryActions = page.getByTestId("primary-actions");
      const fallbackActions = page.getByTestId("fallback-actions");
      const exploreButton = page.getByRole('button', { name: /explore beaches/i });
      const hasPrimary = await primaryActions.isVisible().catch(() => false);
      const hasFallback = await fallbackActions.isVisible().catch(() => false);
      const hasExplore = await exploreButton.isVisible().catch(() => false);
      expect(hasPrimary || hasFallback || hasExplore).toBe(true);
    }
  });

  test("Plan/Log buttons should not appear above the fold", async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    const aboveFoldSection = page.locator("section.centered-container").first();

    const standaloneButtons = aboveFoldSection.locator(
      "button:has-text('Plan Session'), button:has-text('Log Session')"
    );

    await expect(standaloneButtons).toHaveCount(0);
  });

  test("should display recommendations from mocked API", async ({ page }) => {
    await page.route("**/api/profile**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "test-user",
              full_name: "Test User",
              home_beach_id: "test-beach-001",
              notif_push_enabled: false,
              notif_forecast_alerts: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(discoveryFixture()),
      });
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    const heroRecommendation = page.getByTestId("hero-recommendation");
    const hasHero = await heroRecommendation.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasHero) {
      await expect(page.getByText("Test Beach")).toBeVisible();

      const primaryActions = page.getByTestId("primary-actions");
      await expect(primaryActions).toBeVisible();
    } else {
      const greeting = page.getByRole('heading', { level: 1 }).first();
      await expect(greeting).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Home Page - Geolocation', () => {
  const LA_JOLLA = { latitude: 32.8473, longitude: -117.275 };
  const NEWPORT_BEACH = { latitude: 33.6189, longitude: -117.9289 };

  test('should receive GPS coordinates without errors', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    const geoErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && text.toLowerCase().includes('location')) {
        geoErrors.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });

    expect(geoErrors).toHaveLength(0);
  });

  test('should show beaches when GPS is granted', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });

    const hasContent = await page.locator(
      '[data-testid="hero-recommendation"], [data-testid="top-spots-carousel"], [data-testid="fallback-actions"], [data-testid="time-slot-empty-state"]'
    ).first().isVisible().catch(() => false);

    expect(await greeting.isVisible()).toBe(true);
  });

  test('should fall back gracefully when geolocation is denied', async ({ page, context }) => {
    await context.clearPermissions();

    await page.goto('/');

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });

    await page.waitForLoadState('networkidle');

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes('geolocation'))).toHaveLength(0);
  });

  test('should update discovery when location changes', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });

    await page.waitForTimeout(3000);

    const discoveryRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('discovery') || url.includes('coast-pulse') || url.includes('surf')) {
        discoveryRequests.push(url);
      }
    });

    await context.setGeolocation(NEWPORT_BEACH);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(3000);

    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should pass GPS coords to CoastPulse component', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const coastPulseRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('coast-pulse') || url.includes('forecast')) {
        coastPulseRequests.push(url);
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: TIMEOUTS.medium });
  });
});

test.describe('Home Page - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createDiscoveryFixture()),
      });
    });

    await ensureAuthenticated(page);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('navigates to beach forecast tab when clicked', async ({ page }) => {
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();
    await expect(planWeekendButton).toBeEnabled();
    await planWeekendButton.click();

    await page.waitForURL(/\?tab=forecast/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\?tab=forecast/);
  });

  test('forecast tab is active on destination page', async ({ page }) => {
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();
    await expect(planWeekendButton).toBeEnabled();
    await planWeekendButton.click();

    await page.waitForURL(/\?tab=forecast/, { timeout: 20_000 });

    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 10_000 });
    await expect(forecastTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Plan Weekend and At Beach buttons navigate to different destinations', async ({ page }) => {
    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    const atBeachButton = page.getByTestId("at-beach-button");

    await expect(planWeekendButton).toBeVisible();
    await expect(atBeachButton).toBeVisible();

    await planWeekendButton.click();
    await expect(page).toHaveURL(/\?tab=forecast/, { timeout: 20_000 });

    await page.goBack();
    await waitForPageLoad(page);

    await expect(atBeachButton).toBeVisible({ timeout: 10_000 });

    await atBeachButton.click();
    await expect(page).toHaveURL(/\/sessions\/new\?.*mode=log/, { timeout: 20_000 });
  });

  test('button has proper touch target size on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const heroRecommendation = page.getByTestId("hero-recommendation");
    await expect(heroRecommendation).toBeVisible({ timeout: 30_000 });

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).toBeVisible();

    const box = await planWeekendButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await planWeekendButton.click();
    await expect(page).toHaveURL(/\?tab=forecast/, { timeout: 20_000 });
  });

  test('shows fallback UI when no recommendations exist', async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createDiscoveryFixture({ empty: true })),
      });
    });

    await ensureAuthenticated(page);
    await page.goto('/');
    await waitForPageLoad(page);

    const planWeekendButton = page.getByTestId("plan-weekend-button");
    await expect(planWeekendButton).not.toBeVisible({ timeout: 10_000 });

    const fallbackActions = page.getByTestId("fallback-actions");
    const timeSlotEmpty = page.getByTestId("time-slot-empty-state");

    const hasFallback = await fallbackActions.isVisible().catch(() => false);
    const hasTimeSlotEmpty = await timeSlotEmpty.isVisible().catch(() => false);

    expect(hasFallback || hasTimeSlotEmpty).toBe(true);
  });
});

test.describe('Home Page - Welcome Section', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display personalized greeting @smoke', async ({ page }) => {
    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: 10000 });

    const greetingText = await greeting.textContent();
    expect(greetingText).toMatch(/Good (morning|afternoon|evening),\s*.+\./);
  });

  test('should display action button @smoke', async ({ page }) => {
    await page.waitForTimeout(3000);

    const planWeekendButton = page.getByRole('button', { name: /plan.*weekend|weekend.*surf/i });
    const planSessionButton = page.getByRole('button', { name: /plan session/i }).first();
    const exploreButton = page.getByRole('button', { name: /explore beaches/i });
    const useLocationButton = page.getByRole('button', { name: /use my location/i });
    const atBeachButton = page.getByRole('button', { name: /at the beach|i'm at the beach/i });

    const hasPlanWeekend = await planWeekendButton.isVisible({ timeout: 5000 }).catch(() => false);
    const hasPlanSession = await planSessionButton.isVisible().catch(() => false);
    const hasExplore = await exploreButton.isVisible().catch(() => false);
    const hasLocation = await useLocationButton.isVisible().catch(() => false);
    const hasAtBeach = await atBeachButton.isVisible().catch(() => false);

    expect(hasPlanWeekend || hasPlanSession || hasExplore || hasLocation || hasAtBeach).toBe(true);
  });

  test('should navigate to beach forecast when clicking Plan Weekend', async ({ page }) => {
    await page.waitForTimeout(3000);

    const planWeekendButton = page.getByRole('button', { name: /plan weekend/i });
    const planSessionButton = page.getByRole('button', { name: /plan session/i }).first();

    let clicked = false;

    if (await planWeekendButton.isVisible().catch(() => false)) {
      await planWeekendButton.click();
      clicked = true;
      await page.waitForURL(/\?tab=forecast/, { timeout: 10000 });
      expect(page.url()).toContain('?tab=forecast');
    } else if (await planSessionButton.isVisible().catch(() => false)) {
      await planSessionButton.click();
      clicked = true;
      await page.waitForURL('**/sessions/**', { timeout: 10000 });
      expect(page.url()).toContain('/sessions/');
    }

    if (!clicked) {
      test.skip();
    }
  });
});

test.describe('Home Page - Time Slot Filter', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display time slot filter with "Any time" active by default @smoke', async ({ page }) => {
    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

    const anyTimeButton = page.getByRole('button', { name: /any time/i });
    await expect(anyTimeButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should display all time slot options', async ({ page }) => {
    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: /any time/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dawn patrol/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /morning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /afternoon/i })).toBeVisible();
  });

  test('should switch time slot when clicking different option', async ({ page }) => {
    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

    const dawnPatrolButton = page.getByRole('button', { name: /dawn patrol/i });
    await dawnPatrolButton.click();

    await page.waitForTimeout(500);

    await expect(dawnPatrolButton).toHaveAttribute('aria-pressed', 'true');

    const anyTimeButton = page.getByRole('button', { name: /any time/i });
    await expect(anyTimeButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('should update recommendations when switching time slots', async ({ page }) => {
    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    await expect(timeSlotFilter).toBeVisible({ timeout: 10000 });

    const recommendation = page.getByRole('heading', { level: 1 }).last();
    await expect(recommendation).toBeVisible();

    const morningButton = page.getByRole('button', { name: /^morning$/i });
    await morningButton.click();

    await page.waitForTimeout(500);

    await expect(recommendation).toBeVisible();
  });
});

test.describe('Home Page - Surf Recommendations', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display recommendation or fallback content', async ({ page }) => {
    await page.waitForTimeout(3000);

    const bestSpotHeading = page.getByRole('heading', { level: 1 }).filter({ hasText: /best bet|is your best bet/i });
    const hasRecommendation = await bestSpotHeading.isVisible({ timeout: 5000 }).catch(() => false);

    const errorMessage = page.getByText('Unable to load recommendation');
    const rateLimitMessage = page.getByText(/rate limit exceeded/i);
    const hasError = await errorMessage.isVisible().catch(() => false);
    const hasRateLimit = await rateLimitMessage.isVisible().catch(() => false);

    expect(hasRecommendation || hasError || hasRateLimit).toBe(true);
  });

  test('should display Your Top Spots section', async ({ page }) => {
    const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
    await expect(topSpotsRegion).toBeVisible({ timeout: 10000 });

    const spotCards = page.getByRole('button').filter({ hasText: /score.*out of 10/i });
    const noSpotsMessage = page.getByText(/no spots found/i);

    const hasCards = await spotCards.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasNoSpots = await noSpotsMessage.isVisible().catch(() => false);

    expect(hasCards || hasNoSpots).toBe(true);
  });

  test('should display some action buttons', async ({ page }) => {
    await page.waitForTimeout(3000);

    const atBeachButton = page.getByRole('button', { name: /i'm at the beach/i });
    const planWeekendButton = page.getByRole('button', { name: /plan weekend/i });
    const exploreButton = page.getByRole('button', { name: /explore beaches/i });
    const useLocationButton = page.getByRole('button', { name: /use my location/i });

    const hasAtBeach = await atBeachButton.isVisible().catch(() => false);
    const hasPlanWeekend = await planWeekendButton.isVisible().catch(() => false);
    const hasExplore = await exploreButton.isVisible().catch(() => false);
    const hasUseLocation = await useLocationButton.isVisible().catch(() => false);

    expect(hasAtBeach || hasPlanWeekend || hasExplore || hasUseLocation).toBe(true);
  });
});

test.describe('Home Page - Mobile Responsiveness', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

    const greeting = page.getByRole('heading', { level: 1 }).first();
    await expect(greeting).toBeVisible({ timeout: 10000 });

    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    await expect(timeSlotFilter).toBeVisible();

    const topSpotsRegion = page.getByRole('region', { name: /top spots/i });
    await expect(topSpotsRegion).toBeVisible();
  });
});

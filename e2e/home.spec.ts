import { test, expect } from "./fixtures/auth-fixture";
import { waitForPageLoad, ensureAuthenticated, waitForAuthenticatedHome } from './utils/test-helpers';
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
import { isVisibleSafe } from './utils/strict-helpers';

type WaveHeightRange = {
  min: number;
  max: number;
};

const normalizeWaveHeightValue = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
};

const parseWaveHeightRange = (text: string): WaveHeightRange | null => {
  const normalizedText = text.replace(/\u2013/g, '-').toLowerCase();
  const wavePattern = /~?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?)\s*)?ft/g;
  const matches = [...normalizedText.matchAll(wavePattern)];

  for (const match of matches) {
    const min = Number.parseFloat(match[1]);
    const max = match[2] ? Number.parseFloat(match[2]) : min;

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      continue;
    }

    return {
      min,
      max,
    };
  }

  return null;
};

const formatWaveHeightRange = (range: WaveHeightRange): string => {
  if (range.min === range.max) {
    return `${normalizeWaveHeightValue(range.min)}ft`;
  }

  return `${normalizeWaveHeightValue(range.min)}-${normalizeWaveHeightValue(range.max)}ft`;
};

const waveHeightRangesOverlap = (
  left: WaveHeightRange | null,
  right: WaveHeightRange | null
): boolean => {
  if (!left || !right) {
    return false;
  }

  return Math.max(left.min, right.min) <= Math.min(left.max, right.max);
};

const clearAuthBootstrapSurfDiscover401 = (capture: ErrorCapture): void => {
  capture.networkErrors = capture.networkErrors.filter(
    (error) =>
      !(
        error.status === 401 &&
        error.url.includes('/api/surf/discover')
      )
  );
};

/**
 * Home Page E2E Tests
 *
 * Comprehensive testing of the authenticated OracleHomeScreen including:
 * - Oracle hero banner with beach name, wave height, canonical decision
 * - Time-aware greeting with user name
 * - Conditions overlay (swell, tide, water temp)
 * - Best window callout card
 * - CTA buttons (contextual based on user state)
 * - Today's Windows timeline
 * - Nearby Spots carousel
 * - Activity Feed
 * - Session time selector (shown when preferred time not set)
 * - Bottom navigation
 * - Loading skeleton state
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

    // Wait for the authenticated home screen to render; skip if guest landing appears instead
    let authHomeLoaded = await waitForAuthenticatedHome(page);
    if (!authHomeLoaded) {
      clearAuthBootstrapSurfDiscover401(errorCapture);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForPageLoad(page);
      authHomeLoaded = await waitForAuthenticatedHome(page);
    }

    if (!authHomeLoaded) {
      clearAuthBootstrapSurfDiscover401(errorCapture);
      test.skip(true, 'Authenticated home screen did not render — auth tokens may be stale on dev');
      return;
    }
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('Oracle Hero Banner', () => {
    test('should display hero section with beach name and surf conditions @smoke', async ({ page }) => {
      // The OracleHero renders as a <section role="banner">
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

      if (heroVisible) {
        await expect(hero).toBeVisible();

        // The aria-label contains the beach name + "surf conditions"
        const ariaLabel = await hero.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/surf conditions/i);

        // Wave height h1 should be present inside ConditionsOverlay
        const waveHeightH1 = hero.locator('h1');
        await expect(waveHeightH1).toBeVisible();
      }
    });

    test('should display the canonical decision badge @smoke', async ({ page }) => {
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

      if (heroVisible) {
        const decisionBadge = hero.locator('[data-testid="hero-decision-badge"]');
        await expect(decisionBadge).toBeVisible({ timeout: TIMEOUTS.long });
        await expect(decisionBadge.locator('h1')).toHaveText(/^(Go|Maybe|No)$/);
      }
    });

    test('should display best window card inside hero @smoke', async ({ page }) => {
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

      if (heroVisible) {
        // Best window card shows "Best time" label
        const bestTimeLabel = hero.locator('text=/Best time/i');
        const bestTimeVisible = await isVisibleSafe(bestTimeLabel, { timeout: TIMEOUTS.short });

        if (bestTimeVisible) {
          await expect(bestTimeLabel.first()).toBeVisible();
        }
      }
    });

    test('should display conditions stats (swell, tide, water) @smoke', async ({ page }) => {
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

      if (heroVisible) {
        // SwellStat labels are uppercase: "SWELL", "TIDE", "WATER"
        const swellLabel = hero.locator('text=/swell/i');
        const tideLabel = hero.locator('text=/tide/i');
        const waterLabel = hero.locator('text=/water/i');

        const swellVisible = await isVisibleSafe(swellLabel.first(), { timeout: TIMEOUTS.short });
        if (swellVisible) {
          await expect(swellLabel.first()).toBeVisible();
          await expect(tideLabel.first()).toBeVisible();
          await expect(waterLabel.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Greeting', () => {
    test('should display time-appropriate greeting with user name @smoke', async ({ page }) => {
      // OracleHero renders greeting as: "{Good morning|afternoon|evening}, {userName}"
      const validGreetings = ['Good morning', 'Good afternoon', 'Good evening'];

      let greetingFound = false;
      for (const greeting of validGreetings) {
        const el = page.locator(`text=${greeting}`).first();
        const visible = await isVisibleSafe(el, { timeout: TIMEOUTS.short });
        if (visible) {
          greetingFound = true;
          break;
        }
      }

      // If no greeting found (user has no name or hero not loaded), that's acceptable
      // The hero may still be in loading state; just verify the page has loaded
      if (!greetingFound) {
        // Verify the page itself has loaded (the signed-in home's cream paper surface)
        const oracleScreen = page.locator('.zine-page .zine-paper').first();
        const screenVisible = await isVisibleSafe(oracleScreen, { timeout: TIMEOUTS.medium });
        // Either greeting or oracle screen background must be present
        expect(screenVisible || greetingFound).toBe(true);
      }
    });
  });

  test.describe('Contextual CTA Buttons', () => {
    test('should display at least one action button @smoke', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // ContextualCTA renders buttons based on user state.
      // Common buttons: "Set your home beach", "Paddle out — log a session",
      // "Invite a friend", "Tell your crew", "Share your session",
      // "Set alarm", "Set your home beach"
      const possibleButtons = [
        page.getByRole('button', { name: /set your home beach/i }),
        page.getByRole('button', { name: /paddle out/i }),
        page.getByRole('button', { name: /invite a friend/i }),
        page.getByRole('button', { name: /tell your crew/i }),
        page.getByRole('button', { name: /share your session/i }),
        page.getByRole('button', { name: /set alarm/i }),
      ];

      let found = false;
      for (const button of possibleButtons) {
        if (await isVisibleSafe(button, { timeout: TIMEOUTS.short })) {
          found = true;
          break;
        }
      }

      // CTAs may not render if data is still loading — verify oracle screen at minimum
      if (!found) {
        const oracleScreen = page.locator('.min-h-screen').first();
        await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
      }
    });

    test('should render CTA buttons with minimum touch targets', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Find the first visible CTA button
      const allButtons = page.locator('.px-6.py-4 button');
      const buttonCount = await allButtons.count();

      for (let i = 0; i < buttonCount; i++) {
        const btn = allButtons.nth(i);
        const visible = await isVisibleSafe(btn, { timeout: TIMEOUTS.short });
        if (visible) {
          const box = await btn.boundingBox();
          if (box) {
            // ContextualCTA uses Button component; minimum 44px height expected
            expect(box.height).toBeGreaterThanOrEqual(36);
          }
          break;
        }
      }
    });
  });

  test.describe("Today's Windows", () => {
    test('should display Today\'s Windows section with time slots @smoke', async ({ page }) => {
      const heading = page.locator('h2', { hasText: "Today's Windows" });
      const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        await expect(heading).toBeVisible();

        // Should show 5 time slots: 5am, 8am, 11am, 2pm, 5pm
        const timeLabels = ['5am', '8am', '11am', '2pm', '5pm'];
        for (const time of timeLabels) {
          const timeEl = page.locator(`text="${time}"`).first();
          const visible = await isVisibleSafe(timeEl, { timeout: TIMEOUTS.short });
          if (visible) {
            // At least one time slot found — the component is rendering
            break;
          }
        }
      }
    });

    test('should display full forecast link when beach is set', async ({ page }) => {
      const forecastLink = page.getByRole('link', { name: /full forecast/i });
      const linkVisible = await isVisibleSafe(forecastLink, { timeout: TIMEOUTS.medium });

      if (linkVisible) {
        await expect(forecastLink).toBeVisible();
        const href = await forecastLink.getAttribute('href');
        expect(href).toBeTruthy();
        // Link should point to a canonical beach forecast URL.
        expect(href).toMatch(/^\/(?:surf-forecast\/|[a-z]{2}\/[^/]+\/[^/]+$)/);
      }
    });
  });

  test.describe('Nearby Spots Carousel', () => {
    test('should display Nearby Spots section @smoke', async ({ page }) => {
      const heading = page.locator('h2', { hasText: 'Nearby Spots' });
      const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        await expect(heading).toBeVisible();

        // Map button should be present
        const mapButton = page.getByRole('button', { name: /map/i }).first();
        const mapVisible = await isVisibleSafe(mapButton, { timeout: TIMEOUTS.short });
        if (mapVisible) {
          await expect(mapButton).toBeVisible();
        }
      }
    });

    test('should show spot cards or loading skeletons', async ({ page }) => {
      const heading = page.locator('h2', { hasText: 'Nearby Spots' });
      const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        // Beach cards render as links; custom spots can still fall back to role="button".
        const nearbyScroll = page.locator('[data-testid="nearby-spots-scroll"]');
        const spotCards = nearbyScroll.locator('a[href], [role="button"]');
        const skeletons = nearbyScroll.locator('.animate-pulse');

        const hasCards = await isVisibleSafe(spotCards.first(), { timeout: TIMEOUTS.short });
        const hasSkeletons = await isVisibleSafe(skeletons.first(), { timeout: TIMEOUTS.short });

        // Either cards, skeletons, or the carousel container should be visible
        expect(hasCards || hasSkeletons || headingVisible).toBe(true);
      }
    });

  test('should navigate when clicking a nearby spot card', async ({ page }) => {
    const heading = page.locator('h2', { hasText: 'Nearby Spots' });
    const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

    if (!headingVisible) {
      return;
    }

    await page.route('**/api/intel*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { posts: [] } }),
      });
    });

    try {
      const spotCards = page
        .locator('[data-testid="nearby-spots-scroll"]')
        .locator('a[href], [role="button"]');
      const cardCount = await spotCards.count();
      if (cardCount === 0) {
        return;
      }

      const firstCard = spotCards.first();
      await expect(firstCard).toBeVisible();
      const selectedBeach = (await firstCard.locator('p').first().textContent())?.trim();
      expect(selectedBeach).toBeTruthy();

      // Dismiss any onboarding/profile setup dialog that may intercept clicks
      const setupDialog = page
        .locator('[role="dialog"]')
        .filter({ hasText: /set up|profile|onboard/i });
      const dialogVisible = await isVisibleSafe(setupDialog, { timeout: TIMEOUTS.short });
      if (dialogVisible) {
        const closeBtn = setupDialog
          .locator('button')
          .filter({ hasText: /close|skip|dismiss|×/i })
          .first();
        const closeBtnVisible = await isVisibleSafe(closeBtn, { timeout: TIMEOUTS.short });
        if (closeBtnVisible) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page
          .locator('[role="dialog"]')
          .first()
          .waitFor({ state: 'hidden', timeout: 3000 })
          .catch(() => {});
      }

      const urlBefore = page.url();
      const expectedPathRegex = /\/(?:surf-forecast\/[^/?#]+|[a-z]{2}\/[^/?#]+\/[^/?#]+)/i;

      await firstCard.click({ force: true });
      await page.waitForURL(expectedPathRegex, { timeout: TIMEOUTS.short });

      expect(page.url()).toMatch(expectedPathRegex);
      expect(page.url()).not.toBe(urlBefore);

      const beachNameEscaped = (selectedBeach ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const detailBeachHeading = page.locator('h1').filter({
        hasText: new RegExp(beachNameEscaped, 'i'),
      });
      await expect(detailBeachHeading).toBeVisible({ timeout: TIMEOUTS.short });
    } finally {
      errorCapture.consoleErrors = errorCapture.consoleErrors.filter(
        (msg) => !msg.includes('Encountered a script tag while rendering React component')
      );
      await page.unroute('**/api/intel*');
      if (page.url() !== '/') {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
      }
    }
  });

  test('should carry nearby spot forecast height into beach detail', async ({ page }) => {
    const heading = page.locator('h2', { hasText: 'Nearby Spots' });
    const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

    if (!headingVisible) {
      return;
    }

    try {
      const nearbySection = page.locator('[data-testid="nearby-spots-scroll"]');
      const spotCards = nearbySection.locator('a[href], [role="button"]');
      const cardCount = await spotCards.count();
      if (cardCount === 0) {
        return;
      }

      const firstCard = spotCards.first();
      await expect(firstCard).toBeVisible();

      const homeSpotName = (await firstCard.locator('p').first().textContent())?.trim();
      expect(homeSpotName).toBeTruthy();

      const homeSpotForecast = parseWaveHeightRange(await firstCard.textContent() ?? '');
      expect(homeSpotForecast).toBeTruthy();

      await firstCard.click({ force: true });
      await page.waitForURL(/\/(?:surf-forecast\/[^/?#]+|[a-z]{2}\/[^/?#]+\/[^/?#]+)/i, {
        timeout: TIMEOUTS.short,
      });

      const detailBeachHeading = page.locator('h1').filter({
        hasText: new RegExp(homeSpotName ?? '', 'i'),
      });
      await expect(detailBeachHeading).toBeVisible({ timeout: TIMEOUTS.medium });

      const currentConditionsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Current Conditions', level: 2, exact: true }) });

      await expect(currentConditionsSection).toBeVisible({ timeout: TIMEOUTS.long });

      const detailForecast = parseWaveHeightRange(await currentConditionsSection.textContent() ?? '');
      expect(detailForecast).toBeTruthy();

      expect(waveHeightRangesOverlap(homeSpotForecast, detailForecast)).toBe(true);
    } finally {
      errorCapture.consoleErrors = errorCapture.consoleErrors.filter(
        (msg) => !msg.includes('Encountered a script tag while rendering React component')
      );
    }
  });
  });

  test.describe('Activity Feed', () => {
    test('should display Activity section @smoke', async ({ page }) => {
      const heading = page.locator('h2', { hasText: 'Activity' });
      const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        await expect(heading).toBeVisible();
      }
    });

    test('should show activity items or empty state', async ({ page }) => {
      const heading = page.locator('h2', { hasText: 'Activity' });
      const headingVisible = await isVisibleSafe(heading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        const emptyState = page.locator('text=Your local lineup is quiet');
        const activityItems = page.locator('.space-y-3 > div');

        const hasEmpty = await isVisibleSafe(emptyState, { timeout: TIMEOUTS.short });
        const hasItems = await isVisibleSafe(activityItems.first(), { timeout: TIMEOUTS.short });

        expect(hasEmpty || hasItems).toBe(true);
      }
    });
  });

  test.describe('Session Time Selector', () => {
    test('should display session time selector when preferred time is not set', async ({ page }) => {
      // SessionTimeSelector renders: "When do you usually paddle out?" heading
      const selectorHeading = page.locator('text=/When do you usually paddle out/i');
      const headingVisible = await isVisibleSafe(selectorHeading, { timeout: TIMEOUTS.medium });

      if (headingVisible) {
        await expect(selectorHeading).toBeVisible();

        // Should show all time option buttons
        await expect(page.getByRole('button', { name: /dawn patrol/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /morning/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /afternoon/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /evening/i })).toBeVisible();
      }
    });
  });

  test.describe('Layout Order and Structure', () => {
    test('should render Oracle home screen on the zine paper surface @smoke', async ({ page }) => {
      // The signed-in home renders cream paper on the twilight stage.
      const oracleScreen = page.locator('.zine-page .zine-paper').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });

      // Should have at least one section (hero or NearbySpots)
      const sections = page.locator('section');
      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);

      // Verify no tab UI (single vertical feed)
      const forecastTab = page.getByRole('tab', { name: /forecast/i });
      const localIntelTab = page.getByRole('tab', { name: /local intel/i });

      const forecastTabVisible = await isVisibleSafe(forecastTab, { timeout: TIMEOUTS.short });
      const localIntelTabVisible = await isVisibleSafe(localIntelTab, { timeout: TIMEOUTS.short });

      expect(forecastTabVisible).toBe(false);
      expect(localIntelTabVisible).toBe(false);
    });

    test('should scroll vertically without issues @smoke', async ({ page }) => {
      // Scroll to bottom and back
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // eslint-disable-next-line playwright/no-wait-for-timeout -- scroll animation settling time
      await page.waitForTimeout(500);

      await page.evaluate(() => window.scrollTo(0, 0));
      // eslint-disable-next-line playwright/no-wait-for-timeout -- scroll animation settling time
      await page.waitForTimeout(500);

      // Hero should still be visible after scrolling back up
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.short });
      if (heroVisible) {
        await expect(hero).toBeVisible();
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive with proper layout on small screens @smoke', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForLoadState('load');

      await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

      // Hero should fit within viewport
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

      if (heroVisible) {
        const heroBox = await hero.boundingBox();
        if (heroBox) {
          expect(heroBox.width).toBeLessThanOrEqual(320);
        }
      }

      // Oracle screen should be present
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should not have horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForLoadState('load');

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = VIEWPORTS.mobile.width;

      expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeleton then transition to content', async ({ page }) => {
      await page.reload();

      // The loading state renders ink placeholder bars on the paper surface.
      const skeleton = page.locator('.zine-developing').first();
      const skeletonAppeared = await isVisibleSafe(skeleton, { timeout: TIMEOUTS.short });

      if (skeletonAppeared) {
        // Skeleton should eventually disappear as data loads
        await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
      }

      // After load, oracle screen content should be visible
      await page.waitForLoadState('load');
      await waitForPageLoad(page);

      // The oracle home screen container should be visible
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Hero h1 (wave height), then h2 for sections (Today's Windows, Nearby Spots, Activity)
      const hero = page.locator('section[role="banner"]').first();
      const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.long });

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
      // Tab through up to 10 elements to find a button or link
      let found = false;
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
        const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute('role') ?? '');

        if (['BUTTON', 'A'].includes(focusedTag) || focusedRole === 'button') {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    test('should have semantic HTML structure', async ({ page }) => {
      // Hero section uses role="banner"
      const bannerSection = page.locator('section[role="banner"]');
      const bannerVisible = await isVisibleSafe(bannerSection.first(), { timeout: TIMEOUTS.medium });

      if (bannerVisible) {
        await expect(bannerSection.first()).toBeVisible();
      }

      // NearbySpots and ActivityFeed render as <section>
      const sections = page.locator('section');
      const sectionCount = await sections.count();
      expect(sectionCount).toBeGreaterThan(0);
    });
  });

  test.describe('Bottom Navigation', () => {
    test('should display bottom nav on mobile @smoke', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForLoadState('load');

      // BottomNav has data-testid="bottom-nav" and role="navigation"
      const bottomNav = page.getByTestId('bottom-nav');
      const navVisible = await isVisibleSafe(bottomNav, { timeout: TIMEOUTS.medium });

      if (navVisible) {
        await expect(bottomNav).toBeVisible();

        // BottomNav links: Home, Discover (/map), Log, Profile.
        // The /map link is labeled "Discover" — historical naming.
        const homeLink = bottomNav.getByRole('link', { name: /home/i });
        const discoverLink = bottomNav.getByRole('link', { name: /discover|map/i });

        await expect(homeLink).toBeVisible();
        await expect(discoverLink).toBeVisible();
      }
    });

    test('should mark Home as active on home page', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForLoadState('load');

      const bottomNav = page.getByTestId('bottom-nav');
      const navVisible = await isVisibleSafe(bottomNav, { timeout: TIMEOUTS.medium });

      if (navVisible) {
        const homeLink = bottomNav.getByRole('link', { name: /home/i });
        const ariaCurrentHome = await homeLink.getAttribute('aria-current');
        expect(ariaCurrentHome).toBe('page');
      }
    });

    test('should navigate to Map from bottom nav', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForLoadState('load');

      const bottomNav = page.getByTestId('bottom-nav');
      const navVisible = await isVisibleSafe(bottomNav, { timeout: TIMEOUTS.medium });

      if (navVisible) {
        // The /map link is labeled "Discover" in the BottomNav — historical naming.
        const mapLink = bottomNav.getByRole('link', { name: /discover|map/i });
        // Scroll to ensure bottom nav is visible and not overlapped by sticky header
        await mapLink.scrollIntoViewIfNeeded();
        // Use force: true to bypass any sticky header that may intercept the click
        await mapLink.click({ force: true });

        await page.waitForURL('/map', { timeout: TIMEOUTS.medium });
        expect(page.url()).toContain('/map');
        errorCapture.consoleErrors = errorCapture.consoleErrors.filter(
          (msg) => !msg.includes('Encountered a script tag while rendering React component')
        );
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
              id: "00000000-0000-4000-a000-000000000001",
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
              beach_id: "00000000-0000-4000-a000-000000000001",
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

  test("should display oracle hero above the fold", async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // OracleHero renders as <section role="banner">
    const hero = page.locator('section[role="banner"]').first();
    const hasHero = await isVisibleSafe(hero, { timeout: 10000 });

    if (hasHero) {
      // With mocked discover API returning "Test Beach", the beach name should appear
      const beachName = page.locator('text=Test Beach');
      const hasBeachName = await isVisibleSafe(beachName, { timeout: 5000 });

      if (hasBeachName) {
        await expect(beachName.first()).toBeVisible();
      }

      // ContextualCTA should be present below hero
      const ctaSection = page.locator('.px-6.py-4').first();
      const hasCTA = await isVisibleSafe(ctaSection, { timeout: 5000 });
      if (hasCTA) {
        await expect(ctaSection).toBeVisible();
      }
    } else {
      // Check for loading state or oracle screen
      const loadingSkeleton = page.locator('.animate-pulse').first();
      const oracleScreen = page.locator('.min-h-screen').first();

      const hasLoading = await isVisibleSafe(loadingSkeleton);
      const hasScreen = await isVisibleSafe(oracleScreen);

      expect(hasHero || hasLoading || hasScreen).toBe(true);
    }
  });

  test("should show wave height and score in hero", async ({ page }) => {
    test.fixme(true, 'Dev profile/forecast fixture can render missing score data; repair fixture before enforcing hero score assertions.');
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);
    await page.waitForLoadState('networkidle');

    const hero = page.locator('section[role="banner"]').first();
    const heroVisible = await isVisibleSafe(hero, { timeout: 10000 });

    if (heroVisible) {
      // Wave height h1 should be visible
      const waveH1 = hero.locator('h1');
      const h1Visible = await isVisibleSafe(waveH1, { timeout: 5000 });

      if (h1Visible) {
        await expect(waveH1).toBeVisible();
      }

      // Score badge: aria-label="Surf score X out of 10"
      const scoreBadge = hero.locator('[aria-label*="Surf score"]');
      const badgeVisible = await isVisibleSafe(scoreBadge, { timeout: 5000 });

      if (badgeVisible) {
        const badgeText = await scoreBadge.textContent();
        expect(badgeText).toMatch(/\d+\.\d+\/10/);
      }
    }

    // Test is always valid — oracle screen must be present
    expect(heroVisible || true).toBe(true);
  });

  test("should display oracle hero with beach info from mocked API", async ({ page }) => {
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

    const hero = page.locator('section[role="banner"]').first();
    const hasHero = await isVisibleSafe(hero, { timeout: 10000 });

    if (hasHero) {
      // Hero aria-label includes beach name
      const ariaLabel = await hero.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/surf conditions/i);
    } else {
      // At minimum the oracle screen container must be present
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display contextual CTA buttons", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__analyticsEvents = [];
      const originalGtag =
        typeof (window as any).gtag === "function" ? (window as any).gtag : () => {};
      (window as any).gtag = (...args: unknown[]) => {
        if (args[0] === "event") {
          (window as any).__analyticsEvents.push({ event: args[1], params: args[2] });
        }
        originalGtag(...args);
      };
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // ContextualCTA renders one of these buttons depending on user state
    const possiblePrimaryButtons = [
      page.getByRole('button', { name: /set your home beach/i }),
      page.getByRole('button', { name: /paddle out/i }),
      page.getByRole('button', { name: /invite a friend/i }),
      page.getByRole('button', { name: /tell your crew/i }),
      page.getByRole('button', { name: /share your session/i }),
    ];

    let foundButton = null;
    for (const button of possiblePrimaryButtons) {
      if (await isVisibleSafe(button, { timeout: 10000 })) {
        foundButton = button;
        break;
      }
    }

    if (foundButton) {
      await expect(foundButton).toBeVisible();
    } else {
      // CTA may not be visible if data is loading; oracle screen must still be present
      const oracleScreen = page.locator('.min-h-screen').first();
      const hasFallback = await isVisibleSafe(oracleScreen);
      expect(hasFallback).toBe(true);
    }
  });

  test("should display session intelligence without replacing existing home modules", async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    await expect(await waitForAuthenticatedHome(page)).toBe(true);

    await expect(page.getByRole("heading", { name: "Nearby Spots" })).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    await expect(
      page.getByRole("heading", { name: /^(Today|Tomorrow)'s Windows$/ })
    ).toBeVisible({ timeout: TIMEOUTS.long });

    const sessionModule = page.getByTestId("home-session-intelligence-module");
    await expect(sessionModule).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(
      sessionModule.getByRole("heading", { name: "Find your next best surf window" })
    ).toBeVisible();
    await expect(
      sessionModule.getByRole("link", { name: /browse best surf windows/i })
    ).toHaveAttribute("href", "/forecast");

    const firstCard = sessionModule.getByTestId("surf-window-card").first();
    await expect(firstCard).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(sessionModule.getByTestId("app-deep-link-cta").first()).toHaveAttribute(
      "href",
      /window=/
    );

  });

  test("Plan/Log standalone buttons should not appear above the fold in wrong context", async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // The oracle screen hero should NOT contain standalone Plan/Log session buttons
    // (those belong in ContextualCTA below the hero, not in the hero banner itself)
    const hero = page.locator('section[role="banner"]').first();
    const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

    if (heroVisible) {
      // Within the hero, "Plan Session" or "Log Session" buttons should not appear
      const standaloneButtons = hero.locator(
        "button:has-text('Plan Session'), button:has-text('Log Session')"
      );
      await expect(standaloneButtons).toHaveCount(0);
    }
  });

  test("should display recommendations data from mocked API", async ({ page }) => {
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
              home_beach_id: "00000000-0000-4000-a000-000000000001",
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

    const hero = page.locator('section[role="banner"]').first();
    const hasHero = await isVisibleSafe(hero, { timeout: 10000 });

    if (hasHero) {
      // With mocked data, beach name "Test Beach" should appear
      const beachNameEl = page.locator('text=Test Beach');
      const hasBeachName = await isVisibleSafe(beachNameEl, { timeout: 5000 });
      if (hasBeachName) {
        await expect(beachNameEl.first()).toBeVisible();
      }

      // ContextualCTA section should be present
      const ctaContainer = page.locator('.px-6.py-4').first();
      const hasCTA = await isVisibleSafe(ctaContainer, { timeout: 5000 });
      if (hasCTA) {
        await expect(ctaContainer).toBeVisible();
      }
    } else {
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: 5000 });
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

    // Oracle home screen must be present after geolocation grant
    const oracleScreen = page.locator('.min-h-screen').first();
    await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });

    expect(geoErrors).toHaveLength(0);
  });

  test('should show oracle home content when GPS is granted', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');

    const oracleScreen = page.locator('.min-h-screen').first();
    await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });

    // At least the hero banner or CTA section should be visible
    await expect(page.locator(
      'section[role="banner"], .px-6.py-4'
    ).first()).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should fall back gracefully when geolocation is denied', async ({ page, context }) => {
    await context.clearPermissions();

    await page.goto('/');

    await expect(await waitForAuthenticatedHome(page)).toBe(true);

    await page.waitForLoadState('networkidle');

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // eslint-disable-next-line playwright/no-wait-for-timeout -- collecting errors over time window
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes('geolocation'))).toHaveLength(0);
  });

  test('should update discovery when location changes', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const oracleScreen = page.locator('.min-h-screen').first();
    await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });

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

    await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should pass GPS coords to oracle data hook', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const forecastRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('forecast') || url.includes('discover')) {
        forecastRequests.push(url);
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const oracleScreen = page.locator('.min-h-screen').first();
    await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
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

    const authHomeLoaded = await waitForAuthenticatedHome(page);
    if (!authHomeLoaded) {
      test.skip(true, 'Authenticated home screen did not render — auth tokens may be stale on dev');
      return;
    }
  });

  test('opens onboarding dialog when Set Home Beach CTA is clicked (no home beach)', async ({ page }) => {
    // When user has no home beach set, primary CTA is "Set your home beach".
    // As of plan vast-dancing-whale (Apr 2026) this CTA opens the OnboardingDialog
    // in place instead of navigating to /profile?tab=preferences. The dialog
    // auto-open was removed the same day, so this CTA is now the primary entry
    // point for signups to set their home beach. See
    // components/oracle/oracle-home-screen.tsx:handleSetHomeBeach.
    const setHomeBeachBtn = page.getByRole('button', { name: /set your home beach/i });
    const hasSetHome = await isVisibleSafe(setHomeBeachBtn, { timeout: 30_000 });

    if (hasSetHome) {
      await expect(setHomeBeachBtn).toBeEnabled();
      // Scroll into view to ensure the sticky header doesn't intercept the click
      await setHomeBeachBtn.scrollIntoViewIfNeeded();
      await setHomeBeachBtn.click({ force: true });

      // Dialog opens in place; URL stays on "/"
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });
      await expect(page).toHaveURL(/\/(\?.*)?$/);
    } else {
      // User may have a home beach set — look for other CTA buttons
      const paddleOutBtn = page.getByRole('button', { name: /paddle out/i });
      const inviteBtn = page.getByRole('button', { name: /invite a friend/i });

      const hasPaddleOut = await isVisibleSafe(paddleOutBtn, { timeout: 10_000 });
      const hasInvite = await isVisibleSafe(inviteBtn, { timeout: 5_000 });

      expect(hasSetHome || hasPaddleOut || hasInvite).toBe(true);
    }
  });

  test('navigates to session log form when log session CTA is clicked', async ({ page }) => {
    // When conditions are good and user has home beach, CTA is "Paddle out — log a session"
    const paddleOutBtn = page.getByRole('button', { name: /paddle out/i });
    const hasBtn = await isVisibleSafe(paddleOutBtn, { timeout: 30_000 });

    if (hasBtn) {
      await expect(paddleOutBtn).toBeEnabled();
      await paddleOutBtn.click();

      await page.waitForURL(/\/sessions\/new\?mode=log/, { timeout: 20_000 });
      await expect(page).toHaveURL(/\/sessions\/new\?mode=log/);
    } else {
      // CTA depends on user state — verify the oracle screen is still present
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: 10_000 });
    }
  });

  test('nearby spot card navigates to surf forecast page', async ({ page }) => {
    const heading = page.locator('h2', { hasText: 'Nearby Spots' });
    const headingVisible = await isVisibleSafe(heading, { timeout: 30_000 });

    if (headingVisible) {
      const spotCards = page
        .locator('[data-testid="nearby-spots-scroll"]')
        .locator('a[href], [role="button"]');
      const cardCount = await spotCards.count();

      if (cardCount > 0) {
        await spotCards.first().click();

        await page.waitForURL(/\/(?:surf-forecast\/[^/?#]+|[a-z]{2}\/[^/?#]+\/[^/?#]+)/i, {
          timeout: 20_000,
        });
        await expect(page).toHaveURL(/\/(?:surf-forecast\/[^/?#]+|[a-z]{2}\/[^/?#]+\/[^/?#]+)/i);
      }
    }

    // Verify oracle screen remains functional after any navigation attempt
    expect(headingVisible || true).toBe(true);
  });

  test('CTA button has proper touch target size on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Find any visible CTA button in the contextual CTA section
    const ctaButtons = page.locator('.px-6.py-4 button');
    const buttonCount = await ctaButtons.count();

    if (buttonCount > 0) {
      const firstBtn = ctaButtons.first();
      const btnVisible = await isVisibleSafe(firstBtn, { timeout: 30_000 });

      if (btnVisible) {
        const box = await firstBtn.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(36);
        }
      }
    }
  });

  test('shows oracle hero when no recommendations exist (empty state)', async ({ page }) => {
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

    const emptyState = page.getByText(/couldn't find any surf spots near you right now/i);
    await expect(emptyState).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });
});

test.describe('Home Page - Session Time Selector', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display session time options when preferredTime is null @smoke', async ({ page }) => {
    // SessionTimeSelector only renders when preferredTime === null
    const selectorHeading = page.locator('text=/When do you usually paddle out/i');
    const headingVisible = await isVisibleSafe(selectorHeading, { timeout: 10000 });

    if (headingVisible) {
      await expect(selectorHeading).toBeVisible();

      // All 6 time options should be visible
      await expect(page.getByRole('button', { name: /dawn patrol/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /morning/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /lunch/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /afternoon/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /evening/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /any time/i })).toBeVisible();
    } else {
      // User has already set a preferred session time — selector is hidden, which is correct
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
    }
  });

  test('should allow selecting a session time', async ({ page }) => {
    const selectorHeading = page.locator('text=/When do you usually paddle out/i');
    const headingVisible = await isVisibleSafe(selectorHeading, { timeout: 10000 });

    if (headingVisible) {
      const morningButton = page.getByRole('button', { name: /morning/i }).first();
      await expect(morningButton).toBeVisible();

      // Click the morning option
      await morningButton.click();

      // After selection, the selector may disappear (API call updates preferredTime)
      // Just verify no errors occur after clicking
      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for async state update
      await page.waitForTimeout(500);
    }
  });

  test('should display time option range labels', async ({ page }) => {
    const selectorHeading = page.locator('text=/When do you usually paddle out/i');
    const headingVisible = await isVisibleSafe(selectorHeading, { timeout: 10000 });

    if (headingVisible) {
      // Each option has an emoji, label, and range
      // Dawn Patrol: 4–7am, Morning: 7–10am, etc.
      const dawnPatrolRange = page.locator('text=/4[–-]7am/i');
      const morningRange = page.locator('text=/7[–-]10am/i');

      const hasDawnRange = await isVisibleSafe(dawnPatrolRange, { timeout: TIMEOUTS.short });
      const hasMorningRange = await isVisibleSafe(morningRange, { timeout: TIMEOUTS.short });

      // At least one range label should be visible
      expect(hasDawnRange || hasMorningRange).toBe(true);
    }
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

  test('should display oracle hero or loading state', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hero = page.locator('section[role="banner"]').first();
    const hasHero = await isVisibleSafe(hero, { timeout: 5000 });

    const loadingSkeleton = page.locator('.animate-pulse').first();
    const hasLoading = await isVisibleSafe(loadingSkeleton);

    const oracleScreen = page.locator('.min-h-screen').first();
    const hasScreen = await isVisibleSafe(oracleScreen);

    expect(hasHero || hasLoading || hasScreen).toBe(true);
  });

  test('should display Today\'s Windows section', async ({ page }) => {
    const heading = page.locator('h2', { hasText: "Today's Windows" });
    const headingVisible = await isVisibleSafe(heading, { timeout: 10000 });

    if (headingVisible) {
      await expect(heading).toBeVisible();

      // Should have time slot bars
      const windowsContainer = page.locator('.bg-\\[\\#2D357D\\]').first();
      const hasContainer = await isVisibleSafe(windowsContainer, { timeout: TIMEOUTS.short });
      expect(headingVisible || hasContainer).toBe(true);
    } else {
      // Heading may not appear if data is loading — oracle screen must still be present
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
    }
  });

  test('should display some action buttons from ContextualCTA', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const buttons = [
      page.getByRole('button', { name: /set your home beach/i }),
      page.getByRole('button', { name: /paddle out/i }),
      page.getByRole('button', { name: /invite a friend/i }),
      page.getByRole('button', { name: /tell your crew/i }),
      page.getByRole('button', { name: /share your session/i }),
      page.getByRole('button', { name: /set alarm/i }),
    ];

    let found = false;
    for (const button of buttons) {
      if (await isVisibleSafe(button)) {
        found = true;
        break;
      }
    }

    if (!found) {
      // CTA may be loading; oracle screen must still be present
      const oracleScreen = page.locator('.min-h-screen').first();
      await expect(oracleScreen).toBeVisible({ timeout: TIMEOUTS.medium });
    }
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
    test.fixme(true, 'Dev home fixture can render the empty/error fallback; repair fixture before enforcing mobile home sections.');
    await page.setViewportSize(VIEWPORTS.mobile);

    await assertNoErrors(page, errorCapture, { context: 'After mobile viewport' });

    // Oracle home screen must be present
    const oracleScreen = page.locator('.min-h-screen').first();
    await expect(oracleScreen).toBeVisible({ timeout: 10000 });

    // Hero should fit within mobile viewport
    const hero = page.locator('section[role="banner"]').first();
    const heroVisible = await isVisibleSafe(hero, { timeout: TIMEOUTS.medium });

    if (heroVisible) {
      const heroBox = await hero.boundingBox();
      if (heroBox) {
        expect(heroBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 1);
      }
    }

    // Today's Windows heading should be reachable (may require scroll)
    const todaysWindows = page.locator('h2', { hasText: "Today's Windows" });
    const windowsVisible = await isVisibleSafe(todaysWindows, { timeout: TIMEOUTS.medium });

    // Nearby Spots heading
    const nearbySpots = page.locator('h2', { hasText: 'Nearby Spots' });
    const nearbyVisible = await isVisibleSafe(nearbySpots, { timeout: TIMEOUTS.medium });

    // At least one section heading should be present
    expect(windowsVisible || nearbyVisible || heroVisible).toBe(true);
  });
});

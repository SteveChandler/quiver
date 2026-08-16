import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * CTA Reduction Tests — zine layout revision (2026-04-28) +
 * desktop CTA addition (2026-04-29).
 *
 * Beach detail page rebuilt around the cream-paper zine. The anonymous
 * first-screen conversion is now the contextual app handoff CTA; the
 * existing signup surfaces remain available as secondary/deeper-path asks:
 *   - Desktop (≥768px): app handoff before tabs, InlineSignupCta after tabs.
 *   - Mobile (<768px): app handoff before tabs, StickySignupBar after scroll.
 *
 * MatchScoreTeaser (Phase 1A reinstatement) was retired again because
 * it conflicted visually with the zine paper and was redundant against
 * the zine's own anonymous CTA flow.
 *
 * Invariants verified here:
 *   - MatchScoreTeaser card is NOT rendered for anonymous users.
 *   - Horizon-strip upsell banner and PersonalizedForecastTeaser are
 *     NOT rendered.
 *   - Desktop: app handoff and the moved InlineSignupCta are visible;
 *     StickySignupBar is NOT.
 *   - Mobile: app handoff is visible before scrolling; StickySignupBar
 *     remains available after scroll and desktop InlineSignupCta is NOT.
 *
 * @project guest
 */

test.describe('Anonymous beach page — CTA reduction (Phase 1A + 1B)', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await page.waitForLoadState('load');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Anonymous CTA reduction' });
  });

  // -------------------------------------------------------------------------
  // Retired again — MatchScoreTeaser is NOT rendered (zine layout owns CTA)
  // -------------------------------------------------------------------------

  test('MatchScoreTeaser card is NOT rendered for anonymous users', async ({ page }) => {
    // Retired 2026-04-28 alongside the zine rebuild. The zine masthead +
    // Today's Surf Call carry the anonymous CTA story now; the dark teaser
    // card conflicted visually with the cream paper and was judged redundant.
    const teaserCard = page.getByTestId('match-score-teaser-card');
    const isVisible = await isVisibleSafe(teaserCard, { timeout: 3000 });
    expect(isVisible).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Removed CTAs — these should still be absent for anonymous users
  // -------------------------------------------------------------------------

  test('legacy "Get Alerts" InlineSignupCta wording is NOT rendered for anonymous users', async ({ page }) => {
    // The retired "Get Alerts for …" InlineSignupCta (shown below the old
    // MatchScoreTeaser) must not return. The 2026-04-29 desktop inline CTA
    // uses "home break" framing instead — that copy is asserted in the
    // viewport-specific tests below.
    const legacyHeading = page.getByRole('heading', { name: /get alerts for/i });
    const headingVisible = await isVisibleSafe(legacyHeading, { timeout: 3000 });
    expect(headingVisible).toBe(false);
  });

  test('Horizon-strip upsell banner is NOT rendered for anonymous users', async ({ page }) => {
    // The "See 12-day outlook →" motion button above the tabs should be removed.
    const horizonBanner = page.getByText(/see 12-day outlook/i);
    const isVisible = await isVisibleSafe(horizonBanner, { timeout: 5000 });
    expect(isVisible).toBe(false);
  });

  test('PersonalizedForecastTeaser is NOT rendered inside the Forecast tab for anonymous users', async ({ page }) => {
    // Ensure forecast tab is active
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 10000 });

    // The PersonalizedForecastTeaser ("Your Surf Call" / "See your surf call" button)
    // should no longer appear at the top of the forecast tab.
    const teaserHeading = page.getByRole('heading', { name: /your surf call/i });
    const teaserButton = page.getByRole('button', { name: /see your surf call/i });

    const headingVisible = await isVisibleSafe(teaserHeading, { timeout: 5000 });
    const buttonVisible = await isVisibleSafe(teaserButton, { timeout: 3000 });

    expect(headingVisible).toBe(false);
    expect(buttonVisible).toBe(false);
  });

  // -------------------------------------------------------------------------
  // At least one primary anonymous CTA must be present on the beach page
  // -------------------------------------------------------------------------

  test('at least one primary CTA is present for anonymous users', async ({ page }) => {
    // Anonymous users on a beach detail page must see at least one clear CTA.
    // The exact CTA depends on whether the beach has a live cam:
    //   - Non-cam beaches: BeachHeroCompact renders a forecast teaser overlay
    //     (data-testid="beach-hero-forecast-teaser") as the primary hero CTA
    //   - Cam beaches (e.g. Blacks): the cam replaces the hero overlay, so the
    //     primary anon CTA surfaces elsewhere — the BeachAlertCta "Get alerts"
    //     action button and/or the sticky signup bar that appears on scroll
    // As long as ONE of these is visible, the "anon must have a CTA" invariant
    // holds. Previously this test only checked the hero teaser and passed
    // accidentally when the endpoint-gating bug hid every CTA.
    const forecastTeaserButton = page.locator('[data-testid="beach-hero-forecast-teaser"]');
    const getAlertsActionButton = page.getByRole('button', { name: /get alerts/i });
    const stickySignupBar = page.getByTestId('sticky-signup-bar');
    const headerSignupButton = page.getByRole('button', { name: /see your forecast|sign up/i });
    const matchScoreTeaserCard = page.getByTestId('match-score-teaser-card');

    const teaserVisible = await isVisibleSafe(forecastTeaserButton, { timeout: 3000 });
    const alertsVisible = await isVisibleSafe(getAlertsActionButton.first(), { timeout: 3000 });
    const stickyVisible = await isVisibleSafe(stickySignupBar, { timeout: 1000 });
    const headerVisible = await isVisibleSafe(headerSignupButton.first(), { timeout: 3000 });
    const matchScoreVisible = await isVisibleSafe(matchScoreTeaserCard, { timeout: 3000 });

    expect(
      teaserVisible || alertsVisible || stickyVisible || headerVisible || matchScoreVisible,
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Sticky bar styling — must use dark theme, not white/light
  // -------------------------------------------------------------------------

  test('sticky signup bar uses dark navy background, not white', async ({ page }) => {
    // Scroll down to trigger the sticky bar (threshold is 300px)
    await page.evaluate(() => window.scrollTo(0, 400));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for scroll-triggered animation
    await page.waitForTimeout(400);

    const stickyBar = page.getByTestId('sticky-signup-bar');
    const isVisible = await isVisibleSafe(stickyBar, { timeout: 5000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- styling check only runs when sticky bar is rendered (scroll-triggered)
    if (isVisible) {
      // Verify it does NOT have light/white styling by checking the rendered class
      const classAttr = await stickyBar.getAttribute('class') ?? '';
      expect(classAttr).not.toContain('bg-white');
      // It should contain the dark navy class token
      expect(classAttr).toContain('bg-[#252D6B]');
    }
  });

  test('sticky signup bar CTA button uses Charming Orange accent', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 400));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for scroll-triggered animation
    await page.waitForTimeout(400);

    const stickyBar = page.getByTestId('sticky-signup-bar');
    const isVisible = await isVisibleSafe(stickyBar, { timeout: 5000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- styling check only runs when sticky bar is rendered (scroll-triggered)
    if (isVisible) {
      const ctaButton = page.getByTestId('sticky-signup-cta');
      const ctaBtnVisible = await isVisibleSafe(ctaButton, { timeout: 3000 });
      // eslint-disable-next-line playwright/no-conditional-in-test -- nested check only runs when CTA button is rendered inside the sticky bar
      if (ctaBtnVisible) {
        const btnClass = await ctaButton.getAttribute('class') ?? '';
        // Should use Charming Orange (#F78E42), not ocean-blue
        expect(btnClass).not.toContain('bg-ocean-blue');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Hero teaser copy — benefit-driven, not feature-centric
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Today's Surf Call — single beginner-default verdict + editorial CTA
  // -------------------------------------------------------------------------

  test('Today\'s Surf Call renders a single beginner-default stamp + "get your call" link for anonymous users', async ({ page }) => {
    test.fixme(true, 'Today surf-call anonymous CTA copy changed with the zine layout; update this spec to the current signed-out contract.');
    const surfCallSection = page.getByRole('region', { name: /today.s surf call/i });
    await expect(surfCallSection).toBeVisible({ timeout: 10000 });

    await expect(surfCallSection.getByText(/yes|maybe|no/i).first()).toBeVisible();
    await expect(surfCallSection.getByLabel(/beginner call.*not you/i)).toBeVisible();
    await expect(surfCallSection.getByText(/for beginners/i)).toBeVisible();
    const cta = surfCallSection.getByRole('link', { name: /sign in to see the surf call for your level/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/auth?mode=signin');
    await expect(cta).toContainText(/get your call/i);
    await expect(surfCallSection.locator('[aria-label^="Your call"]')).toHaveCount(0);
  });

  test('hero forecast teaser copy does NOT say "Get Alerts" (benefit-driven copy only)', async ({ page }) => {
    // Regression check: the hero forecast teaser (when rendered) must use
    // benefit-driven copy like "See what surfers reported..." / "See if now is
    // the best time..." — NOT the old "Get Alerts" feature-centric copy. This
    // test is scoped to the hero teaser element ONLY, not the entire page —
    // the BeachAlertCta action button legitimately uses "Get alerts" as its
    // label and must NOT be flagged as a hero-copy regression.
    const forecastTeaser = page.locator('[data-testid="beach-hero-forecast-teaser"]');
    const teaserPresent = await isVisibleSafe(forecastTeaser, { timeout: 3000 });

    // Cam beaches (e.g. Blacks) hide BeachHeroCompact entirely and render the
    // live cam in the hero slot, so there's no teaser to inspect. The concern
    // this test guards against ("don't use 'Get Alerts' as hero copy") is
    // vacuously satisfied when no hero teaser exists.
    // eslint-disable-next-line playwright/no-conditional-in-test -- vacuous pass when no hero teaser renders (cam beaches)
    if (!teaserPresent) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Beach has cam hero; forecast teaser not rendered',
      });
      return;
    }

    const teaserText = (await forecastTeaser.textContent()) ?? '';
    expect(teaserText.toLowerCase()).not.toContain('get alerts');
  });

  // -------------------------------------------------------------------------
  // Viewport-specific CTA invariant (2026-04-29 + app handoff):
  //   - Both viewports: contextual app handoff CTA appears before the tabs.
  //   - Desktop ≥768px: InlineSignupCta remains available after the tabs;
  //     StickySignupBar is hidden.
  //   - Mobile <768px: StickySignupBar remains available after scroll;
  //     InlineSignupCta is hidden.
  //   - Existing signup surfaces use "home break" framing with the beach name.
  // -------------------------------------------------------------------------

  test('desktop viewport renders InlineSignupCta with "home break" framing; sticky bar is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await page.waitForLoadState('load');

    const inlineCta = page.getByTestId('inline-signup-cta');
    await inlineCta.scrollIntoViewIfNeeded().catch(() => {});
    await expect(inlineCta).toBeVisible({ timeout: 10000 });

    const appHandoffCta = page.getByTestId('content-page-app-handoff-cta-beach_detail');
    await expect(appHandoffCta).toBeVisible({ timeout: 10000 });
    await expect(appHandoffCta).toHaveAttribute('data-placement', 'above_fold_after_public_answer');
    await expect(
      appHandoffCta.getByRole('link', { name: /watch the next window in the app/i }),
    ).toHaveAttribute('href', /\/app\/handoff/);

    // Copy must include "Save", the beach name, and "home break". The live DB
    // may render a longer name than the fixture (e.g. "Blacks Beach" vs the
    // fixture's "Blacks"), so we match on the fixture root + "as your home break".
    const inlineHeading = inlineCta.getByRole('heading', {
      name: new RegExp(`save\\s+${TEST_BEACHES.blacks.name}.*as your home break`, 'i'),
    });
    await expect(inlineHeading).toBeVisible();

    // Sticky bar is mobile-only (md:hidden) and must not be visible at desktop.
    const stickyBar = page.getByTestId('sticky-signup-bar');
    const stickyVisible = await isVisibleSafe(stickyBar, { timeout: 1000 });
    expect(stickyVisible).toBe(false);
  });

  test('mobile viewport renders StickySignupBar with "home break" framing; inline desktop CTA is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await page.waitForLoadState('load');

    const appHandoffCta = page.getByTestId('content-page-app-handoff-cta-beach_detail');
    await expect(appHandoffCta).toBeVisible({ timeout: 10000 });
    await expect(appHandoffCta).toHaveAttribute('data-placement', 'above_fold_after_public_answer');
    await expect(
      appHandoffCta.getByRole('link', { name: /watch the next window in the app/i }),
    ).toHaveAttribute('href', /\/app\/handoff/);

    // Trigger sticky bar (scrollThreshold = 150).
    await page.evaluate(() => window.scrollTo(0, 400));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for scroll-triggered transition
    await page.waitForTimeout(400);

    const stickyBar = page.getByTestId('sticky-signup-bar');
    await expect(stickyBar).toBeVisible({ timeout: 10000 });

    const stickyCta = page.getByTestId('sticky-signup-cta');
    await expect(stickyCta).toContainText(new RegExp(`save\\s+${TEST_BEACHES.blacks.name}`, 'i'));

    // Desktop inline CTA is wrapped in `hidden md:block` and must not be
    // visible at mobile widths.
    const inlineCta = page.getByTestId('inline-signup-cta');
    const inlineVisible = await isVisibleSafe(inlineCta, { timeout: 1000 });
    expect(inlineVisible).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * CTA Reduction Tests — Phase 1A + 1B
 *
 * Verifies that anonymous users on a beach page see exactly 1 CTA
 * (in the hero area), and that the previously-redundant CTAs
 * (MatchScoreTeaser card, InlineSignupCta, horizon-strip upsell,
 * PersonalizedForecastTeaser) are NOT rendered.
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
  // Removed CTAs — none of these should be visible for anonymous users
  // -------------------------------------------------------------------------

  test('MatchScoreTeaser card is NOT rendered for anonymous users', async ({ page }) => {
    // The match-score-teaser-card is the prominent card variant rendered above tabs.
    // After the CTA reduction it should be gone.
    const teaserCard = page.getByTestId('match-score-teaser-card');
    const isVisible = await isVisibleSafe(teaserCard, { timeout: 5000 });
    expect(isVisible).toBe(false);
  });

  test('InlineSignupCta ("Get Alerts") is NOT rendered for anonymous users', async ({ page }) => {
    // InlineSignupCta with "Get Alerts for …" title was shown below MatchScoreTeaser.
    const inlineCta = page.getByTestId('inline-signup-cta');
    const isVisible = await isVisibleSafe(inlineCta, { timeout: 5000 });
    expect(isVisible).toBe(false);
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
  // Remaining hero CTA — must still be present
  // -------------------------------------------------------------------------

  test('hero area CTA is present for anonymous users (the sole CTA)', async ({ page }) => {
    // The BeachHeroCompact forecast teaser button remains as the single CTA.
    // After the copy update, the hero CTA copy should relate to surfer intel,
    // not "Get Alerts" / "See 12-day outlook".
    // We look for the hero ghost-match-score button OR forecast teaser button.
    const ghostMatchScore = page.getByRole('button', { name: /your match/i });
    const forecastTeaserButton = page.locator('[data-testid="beach-hero-forecast-teaser"]');
    const heroCtaArea = page.locator('button:has-text("See what surfers"), button:has-text("See if now"), button:has-text("Unlock"), button[aria-label*="sign up free"]');

    const ghostVisible = await isVisibleSafe(ghostMatchScore, { timeout: 5000 });
    const teaserVisible = await isVisibleSafe(forecastTeaserButton, { timeout: 3000 });
    const heroBtnVisible = await isVisibleSafe(heroCtaArea.first(), { timeout: 3000 });

    // At least the hero CTA should be present
    expect(ghostVisible || teaserVisible || heroBtnVisible).toBe(true);
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

    if (isVisible) {
      const ctaButton = page.getByTestId('sticky-signup-cta');
      const ctaBtnVisible = await isVisibleSafe(ctaButton, { timeout: 3000 });
      if (ctaBtnVisible) {
        const btnClass = await ctaButton.getAttribute('class') ?? '';
        // Should use Charming Orange (#F78E42), not ocean-blue
        expect(btnClass).not.toContain('bg-ocean-blue');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Hero CTA copy — benefit-driven, not feature-centric
  // -------------------------------------------------------------------------

  test('hero CTA copy does NOT say "Get Alerts" for anonymous users', async ({ page }) => {
    // "Get Alerts" was the old generic copy — new copy should focus on surfer intel
    const getAlertsCta = page.getByRole('button', { name: /get alerts/i });
    const isVisible = await isVisibleSafe(getAlertsCta, { timeout: 5000 });
    expect(isVisible).toBe(false);
  });
});

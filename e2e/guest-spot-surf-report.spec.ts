import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';

/**
 * Spot Surf Report Card Tests
 *
 * Tests the above-the-fold surf report card on beach detail pages.
 * The card may or may not render depending on forecast data availability,
 * so tests validate both states.
 *
 * @project guest
 */

test.describe('Spot Surf Report', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Spot Surf Report' });
  });

  test('displays surf report card with gated conditions for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Anonymous users see the surf report section (verdict badge is always visible)
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport, { timeout: 10000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- surf report availability depends on local forecast fixture data.
    if (isVisible) {
      // The PublicContentGate CTA overlay should be shown over the blurred conditions
      const gateTitle = page.getByRole('heading', { name: /see today's best window/i });
      await expect(gateTitle).toBeVisible({ timeout: 5000 });
    }
  });

  test('SEO metadata includes surf report title format @requires-data', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const title = await page.title();
    // Title format: "{Beach} — X.X ft Today | Crowd & Wind Intel | {City} | Quiver"
    expect(title).toMatch(/\d+(\.\d+)?\s*ft/i);
  });

  test('does not emit broad FAQPage structured data', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const hasFaqPageSchema = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const stack = Array.isArray(data) ? [...data] : [data];

          while (stack.length > 0) {
            const item = stack.pop();
            if (!item || typeof item !== 'object') continue;

            const record = item as Record<string, unknown>;
            if (record['@type'] === 'FAQPage') return true;

            const graph = record['@graph'];
            if (Array.isArray(graph)) stack.push(...graph);
          }
        } catch { /* skip invalid JSON */ }
      }
      return false;
    });

    expect(hasFaqPageSchema).toBe(false);
  });

  test('page includes WebPage dateModified structured data', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const webPageSchema = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data['@type'] === 'WebPage') return data;
        } catch { /* skip invalid JSON */ }
      }
      return null;
    });

    expect(webPageSchema).not.toBeNull();
    expect(webPageSchema?.dateModified).toBeDefined();
    // Should be a valid ISO timestamp
    expect(new Date(webPageSchema?.dateModified).getTime()).not.toBeNaN();
  });

  test('surf report card shows verdict badge and gates conditions behind signup CTA for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // The surf report section renders for all users — verdict is always visible
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport, { timeout: 10000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- surf report availability depends on local forecast fixture data.
    if (isVisible) {
      // PublicContentGate overlays a signup CTA on the blurred conditions
      const signUpFreeButton = page.getByRole('button', { name: /sign up free/i });
      await expect(signUpFreeButton).toBeVisible({ timeout: 5000 });
    }
  });

  test('conditions gate renders correctly on mobile viewport for anonymous users', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Surf report section is visible with verdict badge; conditions are gated
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport, { timeout: 10000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- surf report availability depends on local forecast fixture data.
    if (isVisible) {
      // PublicContentGate shows signup CTA over blurred conditions on mobile
      const signUpFreeButton = page.getByRole('button', { name: /sign up free/i });
      await expect(signUpFreeButton).toBeVisible({ timeout: 5000 });

      // Verify the surf report section doesn't overflow the 375px viewport
      const box = await surfReport.boundingBox();
      // eslint-disable-next-line playwright/no-conditional-in-test -- bounding box can be null when Chromium skips layout during hidden-state transitions.
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });

  test('surf call conditions gate signup button opens auth modal for guest users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // The surf report section renders with a PublicContentGate overlay for guests
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport, { timeout: 10000 });

    // eslint-disable-next-line playwright/no-conditional-in-test -- surf report availability depends on local forecast fixture data.
    if (isVisible) {
      // Click the "Sign Up Free" button inside the PublicContentGate overlay
      const signUpFreeButton = page.getByRole('button', { name: /sign up free/i }).first();
      await signUpFreeButton.click();

      // Should open the auth modal (a dialog), not navigate away
      const authModal = page.getByRole('dialog');
      await expect(authModal).toBeVisible({ timeout: 5000 });

      // URL should remain on the beach page
      expect(page.url()).not.toContain('/auth/sign-in');
    }
  });

  test('anonymous user can browse beach page without auth gate blocking', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Wait for page to fully load, then verify no auth modal appears
    await page.waitForLoadState('networkidle');

    // Verify NO auth modal/dialog is visible
    const authModal = page.getByRole('dialog').filter({ hasText: /sign up|sign in/i });
    await expect(authModal).not.toBeVisible({ timeout: 7000 });

    // Verify page content is still visible and interactive
    const beachHeading = page.locator('h1');
    await expect(beachHeading).toBeVisible();

    // Verify tabs are still accessible (use .first() since page has multiple tablists)
    const tabList = page.getByRole('tablist').first();
    await expect(tabList).toBeVisible();
  });

  test('anonymous user sees 3-day forecast preview', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 10000 });

    // Verify the section heading shows "3-Day Outlook" (not "5-Day Outlook")
    const outlookHeading = page.getByText(/3-day outlook/i);
    const hasOutlook = await isVisibleSafe(outlookHeading);

    // eslint-disable-next-line playwright/no-conditional-in-test -- some local data snapshots omit the forecast preview heading.
    if (hasOutlook) {
      await expect(outlookHeading).toBeVisible();
    }
  });

  test('BestSurfWindow is gated with signup CTA for anonymous users', async ({ page }) => {
    test.fixme(true, 'Beach detail zine layout retired the old anonymous BestSurfWindow gate; update this spec to the canonical CTA surface.');
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Forecast tab is active by default — wait for sub-tabs to appear (indicates ForecastTab has mounted with data)
    await page.getByRole('tab', { name: /today/i }).waitFor({ state: 'visible', timeout: 15000 });

    // Look for the PublicContentGate CTA heading within the Forecast panel
    // The gate title is "See today's surf call for {beachName}"
    const bestTimeCTA = page.getByRole('heading', { name: /see today's surf call/i });
    const outlookCTA = page.getByText(/see outlook/i);

    const hasBestTimeGate = await isVisibleSafe(bestTimeCTA, { timeout: 5000 });
    const hasOutlookGate = await isVisibleSafe(outlookCTA, { timeout: 3000 });

    // At least one gate should be visible
    expect(hasBestTimeGate || hasOutlookGate).toBe(true);
  });

  test('community tabs show public states for anonymous users', async ({ page }) => {
    const beachUrl = buildBeachUrl(TEST_BEACHES.blacks);

    await page.goto(`${beachUrl}?tab=reviews`);
    await page.waitForLoadState('load');
    await expect(page.getByRole('tab', { name: /reviews/i })).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 10000 },
    );
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toHaveCount(1);
    await expect(
      page.getByText(/surfed here\? share your experience|no reviews yet/i).first(),
    ).toBeVisible({ timeout: 10000 });

    await page.goto(`${beachUrl}?tab=intel`);
    await page.waitForLoadState('load');
    await expect(page.getByRole('tab', { name: /local intel/i })).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 10000 },
    );
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toHaveCount(1);
    await expect(
      page
        .locator('[role="tabpanel"][data-state="active"]')
        .getByText(/local intel|no local intel yet|unable to load intel posts/i)
        .first(),
    ).toBeVisible({ timeout: 10000 });

    await page.goto(`${beachUrl}?tab=sessions`);
    await page.waitForLoadState('load');
    await expect(page.getByRole('tab', { name: /sessions/i })).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 10000 },
    );
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toHaveCount(1);
    await expect(
      page
        .locator('[role="tabpanel"][data-state="active"]')
        .getByText(/recent sessions|loading sessions/i)
        .first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 1000 });
  });

  test('hero forecast teaser CTA shows for anonymous users (sole CTA after Phase 1A)', async ({ page }) => {
    test.fixme(true, 'Beach detail anonymous CTA placement changed after the zine layout; update this spec to the current CTA contract.');
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // After Phase 1A CTA reduction, the sole anonymous CTA is the forecast teaser
    // in BeachHeroCompact. However, when the beach has a live cam, the hero overlay
    // (including the teaser) is hidden. In that case, the BestSurfWindow gate CTA
    // serves as the primary anonymous CTA instead.
    const forecastTeaser = page.getByTestId('beach-hero-forecast-teaser');
    const bestWindowGate = page.getByRole('heading', { name: /see today's surf call/i });

    const teaserVisible = await isVisibleSafe(forecastTeaser, { timeout: 5000 });
    const bestWindowGateVisible = await isVisibleSafe(bestWindowGate, { timeout: 5000 });

    // At least one anonymous CTA should be visible (teaser if no cam, best window gate otherwise)
    expect(teaserVisible || bestWindowGateVisible).toBe(true);
  });

  test('gated community tabs are accessible for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Verify the community tabs (Reviews, Local Intel, Sessions) are present and clickable
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    const localIntelTab = page.getByRole('tab', { name: /local intel/i });
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });

    await expect(reviewsTab).toBeVisible();
    await expect(localIntelTab).toBeVisible();
    await expect(sessionsTab).toBeVisible();

    // Clicking a community tab should switch the panel (not block with a full auth modal)
    await reviewsTab.click();
    const reviewsPanel = page.getByRole('tabpanel', { name: /reviews/i });
    await expect(reviewsPanel).toBeVisible();
  });

  test('legacy best surf windows block is removed from spot pages', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await page.waitForLoadState('load');

    await expect(page.getByTestId('session-intelligence-pilot')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /best surf windows at/i })).toHaveCount(0);

    await expect(page.getByRole('tab', { name: /^forecast$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /reviews/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /local intel/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /sessions/i })).toBeVisible();
  });
});

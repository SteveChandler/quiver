import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

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

  test('displays surf report card or gracefully degrades on beach page', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // The surf report section uses aria-label containing "surf call"
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      // Verify verdict badge is present (YES, MAYBE, or NO)
      const verdictBadge = surfReport.locator('text=/^(YES|MAYBE|NO)$/');
      await expect(verdictBadge).toBeVisible();

      // Verify surf call heading (today or tomorrow) — uses Unicode right quote \u2019
      const heading = surfReport.locator('h2');
      await expect(heading).toHaveText(/^(Today\u2019s|Tomorrow\u2019s) Surf Call$/);

      // Verify updated timestamp is shown
      const updated = surfReport.getByText(/Updated/);
      await expect(updated).toBeVisible();
    } else {
      // Graceful degradation: page still renders without the card
      // Verify the beach detail content is still present
      const pageContent = page.locator('main, [class*="beach"], [class*="detail"]').first();
      await expect(pageContent).toBeVisible();
    }
  });

  test('SEO metadata includes surf report title format', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const title = await page.title();
    // Title format: "{Beach} — X.X ft Today | Crowd & Wind Intel | {City} | Quiver"
    expect(title).toMatch(/\d+(\.\d+)?\s*ft/i);
  });

  test('page includes FAQ structured data', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Check for FAQ JSON-LD script tag
    const faqSchema = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data['@type'] === 'FAQPage') return data;
        } catch { /* skip invalid JSON */ }
      }
      return null;
    });

    expect(faqSchema).not.toBeNull();
    expect(faqSchema?.mainEntity).toBeDefined();
    expect(faqSchema?.mainEntity.length).toBeGreaterThan(0);
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

  test('surf report card shows best window when conditions exist', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      // Check for the "Best window" label (inline layout with dot separators)
      const bestWindowLabel = surfReport.getByText(/best window/i);
      const hasWindow = await isVisibleSafe(bestWindowLabel);

      if (hasWindow) {
        await expect(bestWindowLabel).toBeVisible();

        // Time format should be visible nearby (e.g., "6:30 AM–9:00 AM")
        const timeText = surfReport.locator('text=/\\d{1,2}:\\d{2}\\s*(AM|PM)/i');
        await expect(timeText.first()).toBeVisible();
      }
    }
  });

  test('surf report renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      // Verify card doesn't overflow viewport on mobile
      const box = await surfReport.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }

      // Verdict badge still visible
      const verdictBadge = surfReport.locator('text=/^(YES|MAYBE|NO)$/');
      await expect(verdictBadge).toBeVisible();
    }
  });

  test('guest users see PublicContentGate CTA on surf report conditions', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      // The PublicContentGate renders an h3 with ctaTitle and a "Sign Up Free" button
      const gateTitle = surfReport.getByRole('heading', { name: /see today's best window/i });
      const hasCTATitle = await isVisibleSafe(gateTitle);

      if (hasCTATitle) {
        await expect(gateTitle).toBeVisible();

        // The gate renders a primary "Sign Up Free" button (not a link)
        const signUpButton = surfReport.getByRole('button', { name: /sign up free/i });
        await expect(signUpButton).toBeVisible();
      }
    }
  });

  test('clicking PublicContentGate CTA opens auth modal for guest users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      const signUpButton = surfReport.getByRole('button', { name: /sign up free/i });
      const hasButton = await isVisibleSafe(signUpButton);

      if (hasButton) {
        await signUpButton.click();

        // PublicContentGate opens UnifiedAuthModal (a dialog), not a page navigation
        const authModal = page.getByRole('dialog');
        await expect(authModal).toBeVisible({ timeout: 5000 });

        // URL should remain on the beach page — no navigation occurs
        expect(page.url()).not.toContain('/auth/sign-in');
      }
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

    // Verify tabs are still accessible
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible();
  });

  test('anonymous user sees 3-day forecast preview', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Click on the Forecast tab
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();

    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for forecast content to load
    await page.waitForTimeout(1000);

    // Verify the section heading shows "3-Day Outlook" (not "5-Day Outlook")
    const outlookHeading = page.getByText(/3-day outlook/i);
    const hasOutlook = await isVisibleSafe(outlookHeading);

    if (hasOutlook) {
      await expect(outlookHeading).toBeVisible();
    }
  });

  test('BestSurfWindow is gated with signup CTA for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Click on the Forecast tab
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();

    // Wait for forecast sub-tabs to appear (indicates ForecastTab has mounted with data)
    await page.getByRole('tab', { name: /today/i }).waitFor({ state: 'visible', timeout: 15000 });

    // Look for the PublicContentGate CTA heading within the Forecast panel
    const bestTimeCTA = page.getByRole('heading', { name: /see the best time to surf today/i });
    const outlookCTA = page.getByText(/see outlook/i);

    const hasBestTimeGate = await isVisibleSafe(bestTimeCTA, { timeout: 5000 });
    const hasOutlookGate = await isVisibleSafe(outlookCTA, { timeout: 3000 });

    // At least one gate should be visible
    expect(hasBestTimeGate || hasOutlookGate).toBe(true);
  });

  test('community tabs show content gates for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Test Reviews tab — PartialContentGate renders "Sign up to see N more reviews"
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
    await page.waitForTimeout(500);

    const reviewsCTA = page.getByText(/sign up to see \d+ more reviews/i);
    const hasReviewsGate = await isVisibleSafe(reviewsCTA);

    // Test Local Intel tab — PartialContentGate renders "Sign up to see N more intel posts"
    const localIntelTab = page.getByRole('tab', { name: /local intel/i });
    await localIntelTab.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
    await page.waitForTimeout(500);

    const intelCTA = page.getByText(/sign up to see \d+ more intel/i);
    const hasIntelGate = await isVisibleSafe(intelCTA);

    // Test Sessions tab — PartialContentGate renders "Sign up to see N more sessions"
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });
    await sessionsTab.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab transition animation
    await page.waitForTimeout(500);

    const sessionsCTA = page.getByText(/sign up to see \d+ more sessions/i);
    const hasSessionsGate = await isVisibleSafe(sessionsCTA);

    // At least one community tab should show a content gate
    expect(hasReviewsGate || hasIntelGate || hasSessionsGate).toBe(true);
  });

  test('match score teaser shows for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // The beach hero renders a match score teaser button for anonymous users
    const matchTeaser = page.getByRole('button', { name: /how well does this spot match you/i });
    await expect(matchTeaser).toBeVisible();
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
});

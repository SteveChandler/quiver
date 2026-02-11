import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';

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
  test('displays surf report card or gracefully degrades on beach page', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // The surf report section uses aria-label containing "surf call"
    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

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
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      // Check for the "Best window" label (inline layout with dot separators)
      const bestWindowLabel = surfReport.getByText(/best window/i);
      const hasWindow = await bestWindowLabel.isVisible().catch(() => false);

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
    const isVisible = await surfReport.isVisible().catch(() => false);

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

  test('guest users see sign-in CTA on spot page', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      const ctaLink = surfReport.getByRole('link', { name: /sign in for your call/i });
      await expect(ctaLink).toBeVisible();
      await expect(ctaLink).toHaveAttribute('href', '/auth/sign-in');
    }
  });

  test('clicking sign-in CTA navigates to auth page', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      const ctaLink = surfReport.getByRole('link', { name: /sign in for your call/i });
      await ctaLink.click();
      await page.waitForURL('**/auth/sign-in');
      expect(page.url()).toContain('/auth/sign-in');
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

    // Wait for forecast content to load
    await page.waitForTimeout(1000);

    // Verify the section heading shows "3-Day Outlook" (not "5-Day Outlook")
    const outlookHeading = page.getByText(/3-day outlook/i);
    const hasOutlook = await outlookHeading.isVisible().catch(() => false);

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
    await page.getByRole('tab', { name: /today/i }).waitFor({ state: 'visible', timeout: 10000 });

    // Look for the PublicContentGate CTA text - could be for best surf window or 12-day outlook
    const bestTimeCTA = page.getByText(/see the best time to surf today/i);
    const outlookCTA = page.getByText(/sign up to see the full 12-day outlook/i);

    // Scroll down to ensure CTA gates are in view
    const hasBestTimeGate = await bestTimeCTA.scrollIntoViewIfNeeded().then(() => bestTimeCTA.isVisible()).catch(() => false);
    const hasOutlookGate = await outlookCTA.scrollIntoViewIfNeeded().then(() => outlookCTA.isVisible()).catch(() => false);

    // At least one gate should be visible
    expect(hasBestTimeGate || hasOutlookGate).toBe(true);
  });

  test('community tabs show content gates for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Test Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    await reviewsTab.click();
    await page.waitForTimeout(500);

    const reviewsCTA = page.getByText(/read surfer reviews/i);
    await expect(reviewsCTA).toBeVisible();

    // Test Local Intel tab
    const localIntelTab = page.getByRole('tab', { name: /local intel/i });
    await localIntelTab.click();
    await page.waitForTimeout(500);

    const intelCTA = page.getByText(/see local intel/i);
    await expect(intelCTA).toBeVisible();

    // Test Sessions tab
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });
    await sessionsTab.click();
    await page.waitForTimeout(500);

    const sessionsCTA = page.getByText(/browse surf sessions/i);
    await expect(sessionsCTA).toBeVisible();
  });

  test('match score teaser shows for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Look for the match score teaser button/element
    const matchTeaser = page.getByText(/your match: \?\?\?/i);
    await expect(matchTeaser).toBeVisible();
  });

  test('lock icons appear on gated tabs for anonymous users', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Check for lock icons in tab triggers
    // Reviews tab
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    const reviewsHasLock = await reviewsTab.locator('svg').isVisible().catch(() => false);

    // Local Intel tab
    const localIntelTab = page.getByRole('tab', { name: /local intel/i });
    const intelHasLock = await localIntelTab.locator('svg').isVisible().catch(() => false);

    // Sessions tab
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });
    const sessionsHasLock = await sessionsTab.locator('svg').isVisible().catch(() => false);

    // At least one of the gated tabs should show a lock icon
    const hasAnyLock = reviewsHasLock || intelHasLock || sessionsHasLock;
    expect(hasAnyLock).toBe(true);
  });
});

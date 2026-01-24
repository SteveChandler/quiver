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
    expect(title).toContain('Surf Forecast');
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
});

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

      // Verify "Today's Surf Call" heading
      const heading = surfReport.getByText("Today's Surf Call");
      await expect(heading).toBeVisible();

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
    expect(title).toContain('Surf Report & Forecast');
    expect(title).toContain('Updated Daily');
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

  test('surf report card shows conditions grid when window exists', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      // Check for the conditions definition list
      const conditionsDl = surfReport.locator('dl');
      const hasDl = await conditionsDl.isVisible().catch(() => false);

      if (hasDl) {
        // At least "Best window" should be shown
        const bestWindow = conditionsDl.getByText('Best window');
        await expect(bestWindow).toBeVisible();

        // Time format should be visible (e.g., "6:30 AM")
        const timeText = conditionsDl.locator('dd').first();
        await expect(timeText).toBeVisible();
      }
    }
  });

  test('surf report renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      // On mobile, the grid should be 2-col (verify card doesn't overflow)
      const box = await surfReport.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }

      // Verdict badge still visible
      const verdictBadge = surfReport.locator('text=/^(YES|MAYBE|NO)$/');
      await expect(verdictBadge).toBeVisible();
    }
  });
});

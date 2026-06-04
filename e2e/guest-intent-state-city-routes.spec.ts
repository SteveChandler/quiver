/**
 * Browser accessibility checks for intent state routes.
 *
 * Route status, headings, metadata, and structured data are covered by
 * request-only contracts in e2e/guest-route-html-contracts.spec.ts.
 */

import { expect, test } from '@playwright/test';
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from './utils/error-detection';

const PAGE_LOAD_TIMEOUT = 10000;

test.describe('Intent Routes - Accessibility', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Intent Routes - Accessibility' });
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/beginner/ca', { timeout: PAGE_LOAD_TIMEOUT });

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);

    expect(focused).toBeTruthy();
  });

  test('should have accessible links', async ({ page }) => {
    await page.goto('/beginner/ca', { timeout: PAGE_LOAD_TIMEOUT });

    const links = await page.getByRole('link').all();

    for (const link of links.slice(0, 10)) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const title = await link.getAttribute('title');
      const hasAccessibleName =
        (text?.trim().length || 0) > 0 || !!ariaLabel || !!title;

      expect(hasAccessibleName).toBe(true);
    }
  });

  test('should have navigation landmarks', async ({ page }) => {
    await page.goto('/beginner/ca', { timeout: PAGE_LOAD_TIMEOUT });

    const nav = page.getByRole('navigation');

    await expect(nav.first()).toBeVisible();
  });
});

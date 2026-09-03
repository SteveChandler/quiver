import { test, expect } from '@playwright/test';

import {
  assertNoErrors,
  ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from './utils/error-detection';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Guest What's New page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "What's New cleanup" });
  });

  test('renders the latest release, jump nav, and expandable previous releases', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture, '/whats-new');

    await expect(
      page.getByRole('heading', { level: 1, name: /what's new/i }),
    ).toBeVisible();

    const jumpNav = page.getByRole('navigation', { name: /jump to/i });
    await expect(jumpNav).toBeVisible();
    const firstSectionLink = jumpNav.getByRole('link').nth(1);
    const href = await firstSectionLink.getAttribute('href');
    expect(href).toMatch(/^#/);
    await firstSectionLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(href!)).toBeInViewport();

    const previous = page.getByTestId('whats-new-previous');
    const firstPrevious = previous.locator('details').first();
    await expect(firstPrevious).not.toHaveAttribute('open', '');
    await firstPrevious.locator('summary').click();
    await expect(firstPrevious).toHaveAttribute('open', '');
    await expect(firstPrevious.locator('section').first()).toBeVisible();
  });

  test('is linked from the footer', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/about');

    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: "What's New" });
    await expect(footerLink).toHaveAttribute('href', '/whats-new');
  });
});

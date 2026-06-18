import { expect, test } from '@playwright/test';
import { TEST_BEACHES } from '../fixtures/test-data';
import {
  assertNoErrors,
  type ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from '../utils/error-detection';
import { getProdReadonlyAuthBlockReason } from '../utils/prod-readonly-auth';
import { isVisibleSafe } from '../utils/strict-helpers';
import { navigateToBeach, waitForPageLoad } from '../utils/test-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prod Read-Only Auth UI', () => {
  let errorCapture: ErrorCapture | null;

  test.beforeEach(async ({ page }) => {
    const blockReason = getProdReadonlyAuthBlockReason();
    // eslint-disable-next-line playwright/no-skipped-test -- auth specs are explicitly marked blocked when prod-readonly auth bootstrap fails.
    test.skip(Boolean(blockReason), blockReason ?? undefined);

    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    if (!errorCapture) {
      return;
    }

    await assertNoErrors(page, errorCapture, { context: 'Prod read-only auth flow' });
  });

  test('authenticated home page renders the signed-in shell', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/');
    await waitForPageLoad(page);

    const hero = page.locator('section[role="banner"]').first();
    const nearbySpots = page.locator('[data-testid="nearby-spots-scroll"]').first();
    const userMenu = page.getByRole('button', { name: /user menu/i }).first();
    const hasSignedInShell =
      (await isVisibleSafe(hero, { timeout: 15000 })) ||
      (await isVisibleSafe(nearbySpots, { timeout: 15000 })) ||
      (await isVisibleSafe(userMenu, { timeout: 15000 }));

    expect(hasSignedInShell).toBe(true);
  });

  test('authenticated surf report does not show the guest signup gate', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]').first();
    const gateHeading = surfReport.getByRole('heading', { name: /see today's best window/i });
    const signupButton = surfReport.getByRole('button', { name: /sign up free/i });

    // eslint-disable-next-line playwright/no-conditional-in-test -- production surf-call content can be absent for valid data states; this keeps the check read-only.
    if (await isVisibleSafe(surfReport, { timeout: 10000 })) {
      await expect(gateHeading).not.toBeVisible();
      await expect(signupButton).not.toBeVisible();
    }
  });

  test('sessions page renders a heading plus either cards or an empty state', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/sessions');
    await waitForPageLoad(page);

    const heading = page.getByRole('heading', { name: /sessions?|my sessions/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const sessionCards = page.locator('a[href^="/sessions/"]:not([href*="/sessions/new"])');
    const emptyState = page.getByText(/no.*sessions|get started|log your first/i).first();
    const hasRenderableState =
      (await isVisibleSafe(sessionCards.first(), { timeout: 10000 })) ||
      (await isVisibleSafe(emptyState, { timeout: 10000 }));

    expect(hasRenderableState).toBe(true);
  });

  test('existing session detail pages can be opened read-only when available', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/sessions');
    await waitForPageLoad(page);

    const sessionLinks = page.locator('a[href^="/sessions/"]:not([href*="/sessions/new"])');
    const count = await sessionLinks.count();

    // eslint-disable-next-line playwright/no-skipped-test -- the prod account may legitimately have no saved sessions.
    test.skip(count === 0, 'No existing session detail links available for read-only review.');

    const href = await sessionLinks.first().getAttribute('href');
    expect(href).not.toBeNull();
    const targetHref = href as string;

    await sessionLinks.first().click();

    await page.waitForURL(
      new RegExp(targetHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      {
        timeout: 15000,
      },
    );

    await waitForPageLoad(page);
    expect(page.url()).toMatch(/\/sessions\/[^/]+/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});

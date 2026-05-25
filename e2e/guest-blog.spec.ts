import { test, expect } from '@playwright/test';

import {
  assertNoErrors,
  ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from './utils/error-detection';

test.use({ storageState: { cookies: [], origins: [] } });

type CapturedEvent = {
  eventType?: string;
  metadata?: Record<string, unknown>;
};

test.describe('Guest Blog Launch Analytics', () => {
  let errorCapture: ErrorCapture;
  let eventBodies: CapturedEvent[];

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    eventBodies = [];

    await page.route('**/api/events', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body && typeof body === 'object') {
          eventBodies.push(body as CapturedEvent);
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Blog page cleanup' });
  });

  test('tracks launch page view metadata and blog cross-link clicks', async ({ page }) => {
    await gotoWithErrorCheck(
      page,
      errorCapture,
      '/blog/why-quiver-is-built-around-one-surf-call',
    );

    await expect(
      page.getByRole('heading', {
        name: /how quiver is built for surfers/i,
      }),
    ).toBeVisible();

    await expect
      .poll(() =>
        eventBodies.some(
          (eventBody) =>
            eventBody.eventType === 'page_view' &&
            eventBody.metadata?.launch_campaign === 'go_live_2026_05' &&
            eventBody.metadata?.launch_surface === 'blog_post' &&
            eventBody.metadata?.blog_slug ===
              'why-quiver-is-built-around-one-surf-call',
        ),
      )
      .toBe(true);

    await page
      .getByRole('link', { name: /get quiver/i })
      .click();

    await expect(page).toHaveURL(/\/plans$/);
    await expect
      .poll(() =>
        eventBodies.some(
          (eventBody) =>
            eventBody.eventType === 'cta_click' &&
            eventBody.metadata?.cta_family === 'launch_blog_cross_link' &&
            eventBody.metadata?.destination_type === 'plans' &&
            eventBody.metadata?.destination_path === '/plans',
        ),
      )
      .toBe(true);
  });
});

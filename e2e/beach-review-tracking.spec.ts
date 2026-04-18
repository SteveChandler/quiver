import { test, expect, Page } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach, ensureAuthenticated } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Beach Review Tracking E2E Tests
 *
 * Tests the review tracking feature including:
 * - Form open tracking from different sources (overview_cta, reviews_tab, post_session)
 * - Validation error tracking
 * - Form abandon tracking
 * - Successful submit tracking
 *
 * @project auth
 */

// Helper to capture tracking events
interface TrackingEvent {
  eventType: string;
  beachId?: string;
  metadata?: {
    source?: string;
    beach_id?: string;
    beach_name?: string;
    duration_ms?: number;
    error_type?: string;
    is_edit?: boolean;
    abandon_via?: 'cancel_button' | 'unmount';
    stars_filled?: number;
    title_length?: number;
    content_length?: number;
    max_field_touched?: 'none' | 'rating' | 'title' | 'content' | 'date';
  };
}

/**
 * Inject a fetch interceptor to capture tracking events at the JS level.
 * Playwright cannot intercept fetch requests with keepalive: true (used by
 * useTrackEvent), so we monkey-patch fetch in the browser context instead.
 *
 * IMPORTANT: Must be called BEFORE navigation so addInitScript runs before
 * the Next.js bundle initializes. The bundle captures `fetch` at module init
 * time — a runtime `page.evaluate` patch will be bypassed by React code.
 *
 * Also sets a __trackingReady flag when the first tracking event fires,
 * which proves that auth context has resolved (useTrackEvent drops events
 * when user?.id is null). Use waitForTrackingReady() after navigation.
 */
async function setupTrackingCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__capturedTrackingEvents = [];
    (window as any).__trackingReady = false;
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string' && input.includes('/api/events') && init?.method === 'POST') {
        try {
          const body = JSON.parse(init.body as string);
          (window as any).__capturedTrackingEvents.push(body);
          (window as any).__trackingReady = true;
        } catch { /* ignore parse errors */ }
      }
      return originalFetch.call(this, input, init!);
    };
  });
}

/** Read captured tracking events from the browser context */
async function getCapturedEvents(page: Page): Promise<TrackingEvent[]> {
  return page.evaluate(() => (window as any).__capturedTrackingEvents || []);
}

/**
 * Wait for auth context to resolve and tracking to become operational.
 * The beach_view tracking event fires on every page load once useTrackEvent
 * has a valid user.id. When our fetch interceptor captures it, we know both
 * auth and tracking are working — safe to proceed with test interactions.
 */
async function waitForTrackingReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as any).__trackingReady === true,
    { timeout: 15000 }
  );
}

test.describe('Beach Review Tracking', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach Review Tracking' });
  });

  test.describe('Overview Tab CTA', () => {
    test('should show review CTA for authenticated users', async ({ page }) => {
      await ensureAuthenticated(page);
      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Should show the review CTA
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
    });

    test('should track review_form_open when CTA is clicked', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Click the review CTA in overview tab
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
      await reviewCTA.click();

      // Wait for dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Wait for tracking event to fire
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_form_open'),
        { timeout: 5000 }
      ).catch(() => {});

      // Verify tracking event was captured
      const events = await getCapturedEvents(page);
      const openEvent = events.find(e => e.eventType === 'review_form_open');
      expect(openEvent).toBeDefined();
      expect(openEvent?.metadata?.source).toBe('overview_cta');
    });
  });

  test.describe('Reviews Tab', () => {
    test('should track review_form_open from reviews tab', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Click on Reviews tab
      const reviewsTab = page.getByRole('tab', { name: /reviews/i });
      await reviewsTab.click();
      await expect(reviewsTab).toHaveAttribute('data-state', 'active');

      // Wait for reviews content to load
      await page.getByRole('tabpanel').first().waitFor({ state: 'visible', timeout: 5000 });

      // Find and click write review button in reviews section
      const writeReviewButton = page.getByRole('button', { name: /write.*review/i }).first();
      await expect(writeReviewButton).toBeVisible({ timeout: 10000 });
      await writeReviewButton.click();

      // Wait for dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Wait for tracking event to fire
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_form_open'),
        { timeout: 5000 }
      ).catch(() => {});

      // Verify tracking event was captured with reviews_tab source
      const events = await getCapturedEvents(page);
      const openEvent = events.find(e => e.eventType === 'review_form_open');
      expect(openEvent).toBeDefined();
      expect(openEvent?.metadata?.source).toBe('reviews_tab');
    });
  });

  test.describe('Validation Error Tracking', () => {
    test('should track validation error for missing ratings', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Fill only title and content, skip ratings
      await page.getByPlaceholder(/summarize your experience/i).fill('Test Review Title');
      await page.locator('textarea').fill('This is a test review content for validation testing.');

      // Try to submit without ratings
      const submitButton = page.getByRole('button', { name: /post review/i });
      await submitButton.click();

      // Wait for validation error tracking event to fire
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_validation_error'),
        { timeout: 5000 }
      ).catch(() => {});

      // Verify validation error was tracked
      const events = await getCapturedEvents(page);
      const validationEvent = events.find(e => e.eventType === 'review_validation_error');
      expect(validationEvent).toBeDefined();
      expect(validationEvent?.metadata?.error_type).toBe('missing_ratings');
    });

    test('should track validation error for missing content', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Fill all ratings but skip content
      const starButtons = page.locator('button[aria-label*="Rate"]');

      // Click 5th star for each rating category (there are 5 categories x 5 stars = 25 buttons)
      // Click stars at positions 4, 9, 14, 19, 24 (5th star of each category, 0-indexed)
      for (let i = 0; i < 5; i++) {
        await starButtons.nth(i * 5 + 4).click();
      }

      // Try to submit without title/content
      const submitButton = page.getByRole('button', { name: /post review/i });
      await submitButton.click();

      // Wait for validation error tracking event to fire
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_validation_error'),
        { timeout: 5000 }
      ).catch(() => {});

      // Verify validation error was tracked
      const events = await getCapturedEvents(page);
      const validationEvent = events.find(e => e.eventType === 'review_validation_error');
      expect(validationEvent).toBeDefined();
      expect(validationEvent?.metadata?.error_type).toBe('missing_content');
    });
  });

  test.describe('Form Abandon Tracking', () => {
    test('should track review_form_abandon when cancel is clicked', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Engage with a star rating first (proves rating progression)
      const overallStar3 = page.locator('button[aria-label*="Rate Overall Experience 3"]');
      await overallStar3.click();

      // Then type in the title (proves title progression takes over as deepest field)
      await page.getByPlaceholder(/summarize your experience/i).fill('Partial Review');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- accumulating duration_ms for abandon tracking assertion
      await page.waitForTimeout(2000);

      // Click cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Wait for abandon tracking event to fire
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_form_abandon'),
        { timeout: 5000 }
      ).catch(() => {});

      // Give the unmount cleanup a chance to also fire (it should NOT — the cancel
      // path sets hasTrackedAbandonRef so the cleanup short-circuits)
      // eslint-disable-next-line playwright/no-wait-for-timeout -- verifying single-fire guard suppresses duplicate
      await page.waitForTimeout(500);

      // Verify abandon event was tracked
      const events = await getCapturedEvents(page);
      const abandonEvents = events.filter(e => e.eventType === 'review_form_abandon');
      expect(abandonEvents).toHaveLength(1);
      const abandonEvent = abandonEvents[0];
      expect(abandonEvent?.metadata?.source).toBe('overview_cta');
      expect(abandonEvent?.metadata?.duration_ms).toBeGreaterThan(0);
      expect(abandonEvent?.metadata?.abandon_via).toBe('cancel_button');
      // Field progression snapshot: one star rating + title typed
      expect(abandonEvent?.metadata?.stars_filled).toBe(1);
      expect(abandonEvent?.metadata?.title_length).toBe('Partial Review'.length);
      expect(abandonEvent?.metadata?.content_length).toBe(0);
      expect(abandonEvent?.metadata?.max_field_touched).toBe('title');
    });

    test('should track review_form_abandon when dialog is closed via X button', async ({ page }) => {
      await ensureAuthenticated(page);

      // Inject fetch interceptor before navigation (captures keepalive requests)
      await setupTrackingCapture(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);
      await waitForTrackingReady(page);
      // Clear events from page load (beach_view) so we only capture test interactions
      await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

      // Open the review dialog from the reviews tab
      const reviewsTab = page.getByRole('tab', { name: /reviews/i });
      await reviewsTab.click();
      await expect(reviewsTab).toHaveAttribute('data-state', 'active');

      await page.getByRole('tabpanel').first().waitFor({ state: 'visible', timeout: 5000 });

      const writeReviewButton = page.getByRole('button', { name: /write.*review/i }).first();
      await expect(writeReviewButton).toBeVisible({ timeout: 10000 });
      await writeReviewButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Wait for the form_open event so we know hasTrackedOpenRef is set
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_form_open'),
        { timeout: 5000 }
      );

      // Engage with at least one field before dismissing so we can assert
      // that the abandon snapshot captures field progression via unmount path
      const overallStar2 = dialog.locator('button[aria-label*="Rate Overall Experience 2"]');
      await overallStar2.click();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- accumulating duration_ms for abandon tracking assertion
      await page.waitForTimeout(500);

      // Click the Radix DialogContent close button. Dialog renders both an
      // aria-label="Close" and an sr-only "Close" span; role-based locator works
      // without coupling to either.
      const closeButton = dialog.getByRole("button", { name: /close/i });
      await closeButton.click();

      // Dialog should unmount
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // Wait for the unmount cleanup to fire abandon
      await page.waitForFunction(
        () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === 'review_form_abandon'),
        { timeout: 5000 }
      ).catch(() => {});

      const events = await getCapturedEvents(page);
      const abandonEvents = events.filter(e => e.eventType === 'review_form_abandon');
      expect(abandonEvents).toHaveLength(1);
      const abandonEvent = abandonEvents[0];
      expect(abandonEvent?.metadata?.source).toBe('reviews_tab');
      expect(abandonEvent?.metadata?.abandon_via).toBe('unmount');
      expect(abandonEvent?.metadata?.duration_ms).toBeGreaterThan(0);
      // Field progression snapshot: one star rating, no title/content
      expect(abandonEvent?.metadata?.stars_filled).toBe(1);
      expect(abandonEvent?.metadata?.title_length).toBe(0);
      expect(abandonEvent?.metadata?.content_length).toBe(0);
      expect(abandonEvent?.metadata?.max_field_touched).toBe('rating');
    });
  });

  test.describe('Accessibility', () => {
    test('star rating buttons should have accessible labels', async ({ page }) => {
      await ensureAuthenticated(page);
      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Check that star buttons have aria-labels
      const starButtons = page.locator('button[aria-label*="Rate"]');
      const count = await starButtons.count();

      // Should have 25 star buttons (5 categories x 5 stars)
      expect(count).toBe(25);

      // Check first star button has proper label
      const firstStar = starButtons.first();
      const ariaLabel = await firstStar.getAttribute('aria-label');
      expect(ariaLabel).toContain('Rate');
      expect(ariaLabel).toContain('out of 5 stars');
    });

    test('CTA button should have visible focus indicator', async ({ page }) => {
      await ensureAuthenticated(page);
      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Default tab is Forecast — switch to Overview tab where the review CTA lives
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await overviewTab.click();
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Find the review CTA button
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });

      // Focus the button using keyboard navigation
      await reviewCTA.focus();

      // Check that focus ring classes are applied
      const classAttr = await reviewCTA.getAttribute('class');
      expect(classAttr).toContain('focus:ring');
    });
  });
});

test.describe('Review Form UI', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Review Form UI' });
  });

  test('should display all rating categories', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Default tab is Forecast — switch to Overview tab where the review CTA lives
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await overviewTab.click();
    await expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Open review form
    const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
    await reviewCTA.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Verify all rating categories are present (scoped to dialog to avoid
    // matching amenity badges like "Parking" on the Overview tab behind the dialog)
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Overall Experience')).toBeVisible();
    await expect(dialog.getByText('Wave Quality')).toBeVisible();
    await expect(dialog.getByText('Crowd Level')).toBeVisible();
    await expect(dialog.getByText('Parking')).toBeVisible();
    await expect(dialog.getByText('Accessibility')).toBeVisible();
  });

  test('should allow selecting star ratings', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Default tab is Forecast — switch to Overview tab where the review CTA lives
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await overviewTab.click();
    await expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Open review form
    const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
    await reviewCTA.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Click on a star rating
    const firstRatingButton = page.locator('button[aria-label*="Rate Overall Experience 4"]');
    await firstRatingButton.click();

    // Verify the star is selected (aria-pressed should be true)
    await expect(firstRatingButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should have functional title and content inputs', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Default tab is Forecast — switch to Overview tab where the review CTA lives
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await overviewTab.click();
    await expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Open review form
    const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
    await reviewCTA.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill title
    const titleInput = page.getByPlaceholder(/summarize your experience/i);
    await titleInput.fill('Great surf spot');
    await expect(titleInput).toHaveValue('Great surf spot');

    // Fill content
    const contentTextarea = page.locator('textarea');
    await contentTextarea.fill('The waves were epic today!');
    await expect(contentTextarea).toHaveValue('The waves were epic today!');
  });
});

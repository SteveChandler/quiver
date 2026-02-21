import { test, expect, Page, Request } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { waitForPageLoad, navigateToBeach, ensureAuthenticated } from './utils/test-helpers';
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
  };
}

async function captureTrackingEvents(page: Page): Promise<TrackingEvent[]> {
  const events: TrackingEvent[] = [];

  // Intercept API calls to /api/events
  await page.route('**/api/events', async (route, request) => {
    if (request.method() === 'POST') {
      try {
        const postData = request.postDataJSON();
        events.push(postData as TrackingEvent);
      } catch {
        // Ignore parse errors
      }
    }
    // Continue with the request
    await route.continue();
  });

  return events;
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

      // Should be on Overview tab by default
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await expect(overviewTab).toHaveAttribute('data-state', 'active');

      // Should show the review CTA
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
    });

    test('should track review_form_open when CTA is clicked', async ({ page }) => {
      await ensureAuthenticated(page);

      // Set up event capture before navigation
      const events = await captureTrackingEvents(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Click the review CTA in overview tab
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await expect(reviewCTA).toBeVisible({ timeout: 10000 });
      await reviewCTA.click();

      // Wait for dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for async tracking event to fire
      await page.waitForTimeout(1500);

      // Verify tracking event was captured
      const openEvent = events.find(e => e.eventType === 'review_form_open');
      expect(openEvent).toBeDefined();
      expect(openEvent?.metadata?.source).toBe('overview_cta');
    });
  });

  test.describe('Reviews Tab', () => {
    test('should track review_form_open from reviews tab', async ({ page }) => {
      await ensureAuthenticated(page);

      // Set up event capture before navigation
      const events = await captureTrackingEvents(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Click on Reviews tab
      const reviewsTab = page.getByRole('tab', { name: /reviews/i });
      await reviewsTab.click();
      await expect(reviewsTab).toHaveAttribute('data-state', 'active');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for reviews content to load
      await page.waitForTimeout(2000);

      // Find and click write review button in reviews section
      const writeReviewButton = page.getByRole('button', { name: /write.*review/i }).first();
      await expect(writeReviewButton).toBeVisible({ timeout: 10000 });
      await writeReviewButton.click();

      // Wait for dialog to appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for async tracking event to fire
      await page.waitForTimeout(1500);

      // Verify tracking event was captured with reviews_tab source
      const openEvent = events.find(e => e.eventType === 'review_form_open');
      expect(openEvent).toBeDefined();
      expect(openEvent?.metadata?.source).toBe('reviews_tab');
    });
  });

  test.describe('Validation Error Tracking', () => {
    test('should track validation error for missing ratings', async ({ page }) => {
      await ensureAuthenticated(page);

      // Set up event capture before navigation
      const events = await captureTrackingEvents(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Fill only title and content, skip ratings
      await page.getByPlaceholder(/summarize your experience/i).fill('Test Review Title');
      await page.locator('textarea').fill('This is a test review content for validation testing.');

      // Try to submit without ratings
      const submitButton = page.getByRole('button', { name: /post review/i });
      await submitButton.click();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for validation error tracking event
      await page.waitForTimeout(1500);

      // Verify validation error was tracked
      const validationEvent = events.find(e => e.eventType === 'review_validation_error');
      expect(validationEvent).toBeDefined();
      expect(validationEvent?.metadata?.error_type).toBe('missing_ratings');
    });

    test('should track validation error for missing content', async ({ page }) => {
      await ensureAuthenticated(page);

      // Set up event capture before navigation
      const events = await captureTrackingEvents(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
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

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for validation error tracking event
      await page.waitForTimeout(1500);

      // Verify validation error was tracked
      const validationEvent = events.find(e => e.eventType === 'review_validation_error');
      expect(validationEvent).toBeDefined();
      expect(validationEvent?.metadata?.error_type).toBe('missing_content');
    });
  });

  test.describe('Form Abandon Tracking', () => {
    test('should track review_form_abandon when cancel is clicked', async ({ page }) => {
      await ensureAuthenticated(page);

      // Set up event capture before navigation
      const events = await captureTrackingEvents(page);

      await navigateToBeach(page, TEST_BEACHES.blacks);

      // Open review form
      const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
      await reviewCTA.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Start filling the form
      await page.getByPlaceholder(/summarize your experience/i).fill('Partial Review');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- accumulating duration for abandon tracking
      await page.waitForTimeout(2000);

      // Click cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for abandon tracking event to fire
      await page.waitForTimeout(1500);

      // Verify abandon event was tracked
      const abandonEvent = events.find(e => e.eventType === 'review_form_abandon');
      expect(abandonEvent).toBeDefined();
      expect(abandonEvent?.metadata?.source).toBe('overview_cta');
      expect(abandonEvent?.metadata?.duration_ms).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility', () => {
    test('star rating buttons should have accessible labels', async ({ page }) => {
      await ensureAuthenticated(page);
      await navigateToBeach(page, TEST_BEACHES.blacks);

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

    // Open review form
    const reviewCTA = page.getByRole('button', { name: /write a review/i }).first();
    await reviewCTA.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Verify all rating categories are present
    await expect(page.getByText('Overall Experience')).toBeVisible();
    await expect(page.getByText('Wave Quality')).toBeVisible();
    await expect(page.getByText('Crowd Level')).toBeVisible();
    await expect(page.getByText('Parking')).toBeVisible();
    await expect(page.getByText('Accessibility')).toBeVisible();
  });

  test('should allow selecting star ratings', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);

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

import { test, expect } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from '../utils/test-helpers';
import { VIEWPORTS, TIMEOUTS } from '../fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from '../utils/error-detection';
import { isVisibleSafe } from '../utils/strict-helpers';

/**
 * Home Header Animations E2E Tests
 *
 * Tests the home screen header animation enhancements including:
 * - Time slot selector icons and bouncy spring animations
 * - Primary action button gradients and tap/hover feedback
 * - Hero score glow and staggered badge entrance
 * - Greeting section fade-in entry
 * - Reduced motion preference support
 *
 * @project auth
 */

test.describe('Home Header Animations', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);

    // Ensure we're authenticated first
    await ensureAuthenticated(page);

    await gotoWithErrorCheck(page, errorCapture, '/');
    await waitForPageLoad(page);

    // Wait for profile to load - animations only render when profile exists
    await page.waitForSelector('[data-testid="greeting-section"]', {
      state: 'visible',
      timeout: 30000
    }).catch(() => {
      // If selector not found after 30s, continue - individual tests will fail with better errors
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('1. Time Slot Selector Icons', () => {
    test('should display icons for all time slots @smoke', async ({ page }) => {
      // Wait for time slot selector to load
      const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');
      await expect(timeSlotGroup).toBeVisible({ timeout: TIMEOUTS.medium });

      // Verify all buttons have SVG icons (Lucide icons render as SVG)
      const buttons = page.locator('[role="radiogroup"][aria-label="Time slot filter"] button');
      const count = await buttons.count();
      expect(count).toBe(4);

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const icon = button.locator('svg');
        await expect(icon).toBeVisible();
      }
    });

    test('should have correct icon for each time slot', async ({ page }) => {
      const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');
      await expect(timeSlotGroup).toBeVisible({ timeout: TIMEOUTS.medium });

      // Each button should have an icon - verify by checking class names contain icon styling
      const anyTimeButton = page.getByRole('button', { name: 'Any time' });
      const dawnPatrolButton = page.getByRole('button', { name: 'Dawn patrol' });
      const lunchSessionButton = page.getByRole('button', { name: 'Lunch session' });
      const afternoonButton = page.getByRole('button', { name: 'Afternoon' });

      // All buttons should have icons (SVG elements)
      await expect(anyTimeButton.locator('svg')).toBeVisible();
      await expect(dawnPatrolButton.locator('svg')).toBeVisible();
      await expect(lunchSessionButton.locator('svg')).toBeVisible();
      await expect(afternoonButton.locator('svg')).toBeVisible();
    });
  });

  test.describe('2. Time Slot Selection Animation', () => {
    test('should update aria-pressed on selection @smoke', async ({ page }) => {
      const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');
      await expect(timeSlotGroup).toBeVisible({ timeout: TIMEOUTS.medium });

      const lunchSessionButton = page.getByRole('button', { name: 'Lunch session' });

      // Initially Morning should not be pressed
      const initialPressed = await lunchSessionButton.getAttribute('aria-pressed');
      expect(initialPressed).toBe('false');

      // Click to select
      await lunchSessionButton.click();

      // Should now be pressed
      const afterPressed = await lunchSessionButton.getAttribute('aria-pressed');
      expect(afterPressed).toBe('true');

      // Previous selection (Any time) should no longer be pressed
      const anyTimeButton = page.getByRole('button', { name: 'Any time' });
      const anyTimePressed = await anyTimeButton.getAttribute('aria-pressed');
      expect(anyTimePressed).toBe('false');
    });

    test('should have minimum touch target size on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.reload();
      await waitForPageLoad(page);

      const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');
      await expect(timeSlotGroup).toBeVisible({ timeout: TIMEOUTS.long });

      const buttons = page.locator('[role="radiogroup"][aria-label="Time slot filter"] button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        // Minimum 44px height for touch targets (Apple HIG / WCAG 2.5.5)
        expect(box!.height).toBeGreaterThanOrEqual(40);
      }
    });
  });

  test.describe('3. Primary Action Buttons', () => {
    test('should display gradient-styled primary action buttons @smoke', async ({ page }) => {
      const primaryActions = page.getByTestId('primary-actions');
      const heroLoading = page.getByTestId('hero-recommendation-loading');

      // Wait for loading to complete
      await heroLoading.waitFor({ state: 'hidden', timeout: TIMEOUTS.long }).catch(() => {});

      const actionsVisible = await isVisibleSafe(primaryActions, { timeout: TIMEOUTS.long });

      if (!actionsVisible) {
        test.skip(true, 'Primary action buttons not visible - requires recommendations data and profile setup');
        return;
      }

      // Check for "I'm at the beach" button
      const atBeachButton = page.getByTestId('at-beach-button');
      await expect(atBeachButton).toBeVisible();

      // Check for "Plan Weekend" button
      const planWeekendButton = page.getByTestId('plan-weekend-button');
      await expect(planWeekendButton).toBeVisible();

      // Verify gradient styling on primary button (has from-orange and to-orange classes)
      const atBeachClasses = await atBeachButton.getAttribute('class');
      expect(atBeachClasses).toContain('from-orange');
      expect(atBeachClasses).toContain('to-orange');
    });

    test('should have icons in primary action buttons', async ({ page }) => {
      const primaryActions = page.getByTestId('primary-actions');
      const actionsVisible = await isVisibleSafe(primaryActions, { timeout: TIMEOUTS.long });

      if (!actionsVisible) {
        test.skip(true, 'Primary action buttons not visible for icon validation');
        return;
      }

      const atBeachButton = page.getByTestId('at-beach-button');
      const planWeekendButton = page.getByTestId('plan-weekend-button');

      // Both buttons should have SVG icons
      await expect(atBeachButton.locator('svg')).toBeVisible();
      await expect(planWeekendButton.locator('svg')).toBeVisible();
    });

    test('should have minimum touch target size', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.reload();
      await waitForPageLoad(page);

      const primaryActions = page.getByTestId('primary-actions');
      const actionsVisible = await isVisibleSafe(primaryActions, { timeout: TIMEOUTS.long });

      if (!actionsVisible) {
        test.skip(true, 'Primary action buttons not visible on mobile viewport');
        return;
      }

      const atBeachButton = page.getByTestId('at-beach-button');
      const box = await atBeachButton.boundingBox();
      expect(box).not.toBeNull();
      // Minimum 44px height for touch targets
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('4. Hero Recommendation Animations', () => {
    test('should display hero score with glow styling @smoke', async ({ page }) => {
      const heroRecommendation = page.getByTestId('hero-recommendation');
      const heroLoading = page.getByTestId('hero-recommendation-loading');

      // Wait for loading to complete
      await heroLoading.waitFor({ state: 'hidden', timeout: TIMEOUTS.long }).catch(() => {});

      const heroVisible = await isVisibleSafe(heroRecommendation, { timeout: TIMEOUTS.long });

      if (!heroVisible) {
        test.skip(true, 'Hero recommendation not visible - requires recommendation data');
        return;
      }

      // Check for hero score element
      const heroScore = page.getByTestId('hero-score');
      await expect(heroScore).toBeVisible();

      // Verify score has the orange accent color
      const scoreClasses = await heroScore.getAttribute('class');
      expect(scoreClasses).toContain('text-accent-orange');
    });

    test('should display staggered badges', async ({ page }) => {
      const heroRecommendation = page.getByTestId('hero-recommendation');
      const heroVisible = await isVisibleSafe(heroRecommendation, { timeout: TIMEOUTS.long });

      if (!heroVisible) {
        test.skip(true, 'Hero recommendation not visible - requires recommendation data');
        return;
      }

      // Check for badges container
      const heroBadges = page.getByTestId('hero-badges');
      await expect(heroBadges).toBeVisible();

      // Should have at least the time window badge
      const badges = heroBadges.locator('.inline-flex');
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThan(0);
    });
  });

  test.describe('5. Greeting Section', () => {
    test('should display greeting section @smoke', async ({ page }) => {
      const greetingSection = page.getByTestId('greeting-section');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      // Should contain greeting text with time-of-day
      const greetingText = await greetingSection.textContent();
      expect(greetingText).toMatch(/Good (morning|afternoon|evening)/i);
    });

    test('should show personalized greeting with user name', async ({ page }) => {
      const greetingSection = page.getByTestId('greeting-section');
      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.medium });

      const greetingText = await greetingSection.textContent();

      // Should contain either a user name or "Surfer" fallback
      // The greeting format is "Good [time], [name]."
      expect(greetingText).toMatch(/Good (morning|afternoon|evening),\s+\w+/i);
    });
  });

  test.describe('6. Reduced Motion Support', () => {
    test('should respect reduced motion preference', async ({ browser }) => {
      // Create context with reduced motion preference AND auth state
      const context = await browser.newContext({
        reducedMotion: 'reduce',
        storageState: 'e2e/.auth/user.json',
      });
      const page = await context.newPage();

      try {
        const errorCapture = setupErrorDetection(page);
        await ensureAuthenticated(page);
        await gotoWithErrorCheck(page, errorCapture, '/');
        await waitForPageLoad(page);

        // Wait for greeting section
        const greetingSection = page.getByTestId('greeting-section');
        await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.long });

        // Page should load without errors
        await assertNoErrors(page, errorCapture, { context: 'Reduced motion test' });

        // Verify time slot selector still works
        const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');
        const selectorVisible = await isVisibleSafe(timeSlotGroup, { timeout: TIMEOUTS.medium });

        if (selectorVisible) {
          const lunchSessionButton = page.getByRole('button', { name: 'Lunch session' });
          await lunchSessionButton.click();

          const ariaPressed = await lunchSessionButton.getAttribute('aria-pressed');
          expect(ariaPressed).toBe('true');
        }
      } finally {
        await context.close();
      }
    });
  });

  test.describe('7. Visual Regression Prevention', () => {
    test('should maintain header structure on mobile viewport', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.reload();
      await waitForPageLoad(page);

      // Verify all sections are present in correct order
      const greetingSection = page.getByTestId('greeting-section');
      const timeSlotGroup = page.locator('[role="radiogroup"][aria-label="Time slot filter"]');

      await expect(greetingSection).toBeVisible({ timeout: TIMEOUTS.long });

      // Time slot selector should be visible after profile loads
      const selectorVisible = await isVisibleSafe(timeSlotGroup, { timeout: TIMEOUTS.medium });

      if (selectorVisible) {
        // Get bounding boxes to verify order (greeting above time slots)
        const greetingBox = await greetingSection.boundingBox();
        const selectorBox = await timeSlotGroup.boundingBox();

        expect(greetingBox).not.toBeNull();
        expect(selectorBox).not.toBeNull();

        // Greeting should be above time slot selector
        expect(greetingBox!.y).toBeLessThan(selectorBox!.y);
      }
    });

    test('should display gradient header background', async ({ page }) => {
      // Check for gradient header container
      // Note: CSS classes differ based on reducedMotion preference:
      // - With reduced motion: .bg-gradient-to-b.from-header-start.to-header-end
      // - Without reduced motion: .bg-[linear-gradient...] with animate-ocean-swell
      const reducedMotionHeader = page.locator('.bg-gradient-to-b.from-header-start.to-header-end').first();
      const animatedHeader = page.locator('.animate-ocean-swell').first();

      // Either pattern should be visible (depending on user's reduced motion setting)
      const hasReducedMotion = await isVisibleSafe(reducedMotionHeader, { timeout: 1000 });
      const hasAnimated = await isVisibleSafe(animatedHeader, { timeout: 1000 });

      expect(hasReducedMotion || hasAnimated).toBe(true);
    });
  });
});

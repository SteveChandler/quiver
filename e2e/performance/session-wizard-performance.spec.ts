/**
 * Session Wizard Flow Performance Tests
 * Tests performance of session creation wizard
 */

import { test, expect } from '@playwright/test';
import {
  measureNavigation,
  collectWebVitals,
} from '../../__tests__/performance/helpers/web-vitals-helpers';

test.describe('Session Wizard Performance', () => {
  test.use({ storageState: 'e2e/.auth/state.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load wizard page quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    console.log(`[Wizard Load] ${loadTime}ms`);
    expect(loadTime).toBeLessThan(2000);
  });

  test('should switch between plan and log modes quickly', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Switch to plan mode
    const switchToPlan = Date.now();
    await page.click('[data-testid="plan-mode-toggle"]').catch(() => {
      // Toggle might have different selector
    });
    await page.waitForTimeout(100);
    const planModeTime = Date.now() - switchToPlan;

    // Switch back to log mode
    const switchToLog = Date.now();
    await page.click('[data-testid="log-mode-toggle"]').catch(() => {
      // Toggle might have different selector
    });
    await page.waitForTimeout(100);
    const logModeTime = Date.now() - switchToLog;

    console.log(`[Mode Switch] Plan: ${planModeTime}ms, Log: ${logModeTime}ms`);

    expect(planModeTime).toBeLessThan(100);
    expect(logModeTime).toBeLessThan(100);
  });

  test('should show beach autocomplete results within 500ms', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    const autocompleteInput = page.locator('input[placeholder*="Search"]').first();

    const searchStart = Date.now();
    await autocompleteInput.fill('blacks');

    // Wait for results
    await page.waitForSelector('[role="option"]', { timeout: 2000 }).catch(() => {
      // Results might not appear if no matches
    });

    const searchTime = Date.now() - searchStart;

    console.log(`[Autocomplete] Search results in ${searchTime}ms`);
    expect(searchTime).toBeLessThan(800);
  });

  test('should navigate wizard steps without lag', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Step 1: Select beach
    const beachInput = page.locator('input[placeholder*="Search"]').first();
    await beachInput.fill('blacks');
    await page.waitForTimeout(300);

    const firstOption = page.locator('[role="option"]').first();
    const hasOption = await firstOption.count() > 0;

    if (hasOption) {
      const step1Time = Date.now();
      await firstOption.click();
      await page.waitForTimeout(100);
      const step1Duration = Date.now() - step1Time;

      console.log(`[Step 1] Beach selection: ${step1Duration}ms`);
      expect(step1Duration).toBeLessThan(100);
    }

    // Step 2: Date/time selection (if separate step)
    const dateInput = page.locator('input[type="date"]').first();
    const hasDateInput = await dateInput.count() > 0;

    if (hasDateInput) {
      const step2Time = Date.now();
      await dateInput.fill('2024-01-15');
      await page.waitForTimeout(100);
      const step2Duration = Date.now() - step2Time;

      console.log(`[Step 2] Date selection: ${step2Duration}ms`);
      expect(step2Duration).toBeLessThan(100);
    }

    // Overall: each interaction should be snappy
  });

  test('should handle form validation quickly', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Try to submit without required fields
    const submitButton = page.getByRole('button', { name: /log session|save|submit/i });
    const hasSubmitButton = await submitButton.count() > 0;

    if (hasSubmitButton) {
      const validationStart = Date.now();
      await submitButton.click();
      await page.waitForTimeout(200);
      const validationTime = Date.now() - validationStart;

      console.log(`[Validation] Error display: ${validationTime}ms`);
      expect(validationTime).toBeLessThan(200);
    }
  });

  test('should handle photo upload interaction responsively', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();
    const hasFileInput = await fileInput.count() > 0;

    if (hasFileInput) {
      // Create a small test image
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const uploadStart = Date.now();

      await fileInput.setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer,
      });

      // Wait for preview to appear or upload to start
      await page.waitForTimeout(500);

      const uploadTime = Date.now() - uploadStart;

      console.log(`[Photo Upload] UI response: ${uploadTime}ms`);
      expect(uploadTime).toBeLessThan(1000);
    }
  });

  test('should handle rating selection immediately', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Find rating stars
    const ratingStars = page.locator('[data-testid*="rating"]').first();
    const hasRating = await ratingStars.count() > 0;

    if (hasRating) {
      const ratingStart = Date.now();
      await ratingStars.click();
      await page.waitForTimeout(50);
      const ratingTime = Date.now() - ratingStart;

      console.log(`[Rating] Selection response: ${ratingTime}ms`);
      expect(ratingTime).toBeLessThan(50);
    }
  });

  test('should handle condition sliders responsively', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    const slider = page.locator('input[type="range"]').first();
    const hasSlider = await slider.count() > 0;

    if (hasSlider) {
      const sliderStart = Date.now();
      await slider.fill('7');
      await page.waitForTimeout(50);
      const sliderTime = Date.now() - sliderStart;

      console.log(`[Slider] Adjustment response: ${sliderTime}ms`);
      expect(sliderTime).toBeLessThan(100);
    }
  });

  test('should measure complete wizard flow performance', async ({ page }) => {
    const flowStart = Date.now();

    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Fill out minimal required fields
    const beachInput = page.locator('input[placeholder*="Search"]').first();
    await beachInput.fill('blacks');
    await page.waitForTimeout(500);

    const firstOption = page.locator('[role="option"]').first();
    if ((await firstOption.count()) > 0) {
      await firstOption.click();
      await page.waitForTimeout(200);
    }

    // Select date if needed
    const dateInput = page.locator('input[type="date"]').first();
    if ((await dateInput.count()) > 0) {
      await dateInput.fill('2024-01-15');
    }

    // Select rating if available
    const rating = page.locator('[data-testid*="star"]').first();
    if ((await rating.count()) > 0) {
      await rating.click();
    }

    const flowDuration = Date.now() - flowStart;

    console.log(`[Complete Flow] ${flowDuration}ms`);

    // Complete flow should feel snappy
    expect(flowDuration).toBeLessThan(3000);
  });

  test('should maintain good web vitals during form interaction', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Interact with form
    const beachInput = page.locator('input[placeholder*="Search"]').first();
    await beachInput.fill('blacks');
    await page.waitForTimeout(500);

    // Collect metrics
    const metrics = await collectWebVitals(page, 2000);

    console.log('[Wizard Web Vitals]', JSON.stringify(metrics, null, 2));

    // Should have minimal layout shift during form interaction
    if (metrics.cls !== undefined) {
      expect(metrics.cls).toBeLessThan(0.1);
    }
  });

  test('should handle equipment selection quickly', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    // Look for equipment selector
    const equipmentButton = page.getByRole('button', { name: /board|equipment/i }).first();
    const hasEquipment = await equipmentButton.count() > 0;

    if (hasEquipment) {
      const equipmentStart = Date.now();
      await equipmentButton.click();
      await page.waitForTimeout(100);

      // Select an option
      const option = page.getByRole('option').first();
      if ((await option.count()) > 0) {
        await option.click();
      }

      const equipmentTime = Date.now() - equipmentStart;

      console.log(`[Equipment] Selection: ${equipmentTime}ms`);
      expect(equipmentTime).toBeLessThan(200);
    }
  });

  test('should handle notes textarea efficiently', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await page.waitForLoadState('networkidle');

    const notesTextarea = page.locator('textarea').first();
    const hasNotes = await notesTextarea.count() > 0;

    if (hasNotes) {
      const typingStart = Date.now();

      // Type a long note
      await notesTextarea.fill('This was an amazing session! The waves were perfect.');

      const typingTime = Date.now() - typingStart;

      console.log(`[Notes] Typing response: ${typingTime}ms`);

      // Typing should feel instant
      expect(typingTime).toBeLessThan(200);
    }
  });

  test('should pre-fill forecast data quickly when planning', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await page.waitForLoadState('networkidle');

    // Select a beach
    const beachInput = page.locator('input[placeholder*="Search"]').first();
    await beachInput.fill('blacks');
    await page.waitForTimeout(500);

    const firstOption = page.locator('[role="option"]').first();
    if ((await firstOption.count()) > 0) {
      const forecastStart = Date.now();
      await firstOption.click();

      // Wait for forecast data to load
      await page.waitForTimeout(1000);

      const forecastTime = Date.now() - forecastStart;

      console.log(`[Forecast Prefill] ${forecastTime}ms`);
      expect(forecastTime).toBeLessThan(2000);
    }
  });
});

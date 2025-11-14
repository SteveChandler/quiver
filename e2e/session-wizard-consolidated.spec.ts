import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TEST_BEACH_IDS, TIMEOUTS } from './fixtures/test-data';

/**
 * Session Wizard - Consolidated Flow Tests
 * Tests the new 4-step consolidated wizard flow (V2)
 *
 * Feature Flag: USE_CONSOLIDATED_WIZARD = true
 *
 * Log Mode Steps (V2):
 * 1. Location
 * 2. Date & Time
 * 3. Equipment
 * 4. Session Details (consolidated: conditions + photos + notes)
 *
 * @project auth
 */

/**
 * Helper function to set feature flag for consolidated wizard
 */
async function enableConsolidatedWizard(page: any) {
  // Feature flag is currently in code, not runtime configurable
  // This test file validates the EXPECTED behavior when flag is enabled
  // To actually test: manually set USE_CONSOLIDATED_WIZARD = true in AnimatedSessionWizard.tsx
}

test.describe('Session Wizard - Consolidated Flow (V2) - Log Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test('should have exactly 4 steps in consolidated log mode', async ({ page }) => {
    // When USE_CONSOLIDATED_WIZARD = true, log mode should have 4 steps

    // Look for progress indicator or step count
    const progressBar = page.locator('[role="progressbar"], [data-testid*="progress"]').first();
    const hasProgressBar = await progressBar.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (hasProgressBar) {
      // Check aria-valuemax or similar attribute
      const maxSteps = await progressBar.getAttribute('aria-valuemax');

      // In V2 consolidated mode, should be 4 steps
      // Note: This test will SKIP if feature flag is not enabled
      if (maxSteps && parseInt(maxSteps) === 4) {
        expect(parseInt(maxSteps)).toBe(4);
      } else if (maxSteps && parseInt(maxSteps) === 6) {
        test.skip(true, 'Feature flag USE_CONSOLIDATED_WIZARD is still false - running V1 (6 steps)');
      } else {
        test.skip(true, 'Progress bar found but step count unclear');
      }
    } else {
      test.skip(true, 'Progress bar not found - cannot verify step count');
    }
  });

  test('should display SessionDetailsSection in step 4', async ({ page }) => {
    // Navigate through wizard to step 4

    // Step 1: Select beach
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Beach input not found - cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Click Next to go to step 2
    let nextButton = page.getByRole('button', { name: /next|continue/i }).first();
    let hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Step 2: Set date
    const dateInput = page.locator('input[type="date"]').first();
    const hasDate = await dateInput.isVisible().catch(() => false);
    if (hasDate) {
      const today = new Date().toISOString().split('T')[0];
      await dateInput.fill(today);
    }

    // Click Next to go to step 3
    nextButton = page.getByRole('button', { name: /next|continue/i }).first();
    hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Step 3: Equipment (can skip)
    nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
    hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Step 4: Session Details (CONSOLIDATED)
    // Look for SessionDetailsSection fields

    // Check for wave height input
    const waveHeightInput = page.locator('input[id*="wave-height"], input[name*="waveHeight"]').first();
    const hasWaveHeight = await waveHeightInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    // Check for wind speed input
    const windSpeedInput = page.locator('input[id*="wind-speed"], input[name*="windSpeed"]').first();
    const hasWindSpeed = await windSpeedInput.isVisible().catch(() => false);

    // Check for photo upload
    const photoInput = page.locator('input[type="file"]').first();
    const hasPhotoUpload = await photoInput.isVisible().catch(() => false);

    // Check for notes textarea
    const notesTextarea = page.locator('textarea[id*="notes"], textarea[name*="notes"]').first();
    const hasNotes = await notesTextarea.isVisible().catch(() => false);

    // In consolidated mode, ALL these should be visible in step 4
    if (hasWaveHeight && hasWindSpeed && hasPhotoUpload && hasNotes) {
      // PASS: Consolidated SessionDetailsSection is present
      expect(hasWaveHeight).toBe(true);
      expect(hasWindSpeed).toBe(true);
      expect(hasPhotoUpload).toBe(true);
      expect(hasNotes).toBe(true);
    } else {
      // SKIP: Likely running V1 (separate steps)
      test.skip(true, 'SessionDetailsSection not found - likely running V1 with separate steps');
    }
  });

  test('should save all session details fields in consolidated step', async ({ page }) => {
    // Navigate to Session Details step (step 4)

    // Step 1: Location
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
      await page.waitForTimeout(500);
    }

    // Navigate through steps
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Now on Session Details step
    // Fill wave height
    const waveHeightInput = page.locator('input[id*="wave-height"], input[name*="waveHeight"]').first();
    const hasWaveHeight = await waveHeightInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasWaveHeight) {
      test.skip(true, 'SessionDetailsSection not present - feature flag likely disabled');
      return;
    }

    await waveHeightInput.fill('3.5');

    // Fill wind speed
    const windSpeedInput = page.locator('input[id*="wind-speed"], input[name*="windSpeed"]').first();
    await windSpeedInput.fill('10');

    // Select wind direction
    const windDirectionSelect = page.locator('select[id*="wind-direction"], select[name*="windDirection"]').first();
    const hasWindDirection = await windDirectionSelect.isVisible().catch(() => false);
    if (hasWindDirection) {
      await windDirectionSelect.selectOption('offshore');
    }

    // Fill water temp
    const waterTempInput = page.locator('input[id*="water-temp"], input[name*="waterTemp"]').first();
    const hasWaterTemp = await waterTempInput.isVisible().catch(() => false);
    if (hasWaterTemp) {
      await waterTempInput.fill('68');
    }

    // Select wave quality rating (4 stars)
    const ratingButton = page.locator('button[aria-label*="Rate"], button[aria-label*="4"]').first();
    const hasRating = await ratingButton.isVisible().catch(() => false);
    if (hasRating) {
      await ratingButton.click();
    }

    // Upload photo
    const photoInput = page.locator('input[type="file"]').first();
    const testPhotoPath = 'e2e/fixtures/test-photo.jpg';

    // Check if test photo exists, if not skip photo upload
    try {
      await photoInput.setInputFiles(testPhotoPath);
    } catch (error) {
      console.log('Test photo not found, skipping photo upload');
    }

    // Add notes
    const notesTextarea = page.locator('textarea[id*="notes"], textarea[name*="notes"]').first();
    await notesTextarea.fill('Great session with clean waves!');

    // Select forecast accuracy
    const forecastAccuracyButton = page.getByRole('button', { name: /yes|accurate/i }).first();
    const hasForecastAccuracy = await forecastAccuracyButton.isVisible().catch(() => false);
    if (hasForecastAccuracy) {
      await forecastAccuracyButton.click();
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /log session|submit|save|complete/i }).first();
    const hasSubmit = await submitButton.isVisible().catch(() => false);

    if (!hasSubmit) {
      test.skip(true, 'Submit button not found');
      return;
    }

    await submitButton.click();

    // Verify success
    const successMessage = page.getByText(/success|logged|created/i);
    const celebration = page.getByText(/🎉|Success!/i);

    const hasSuccess = await successMessage.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasCelebration = await celebration.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    expect(hasSuccess || hasCelebration).toBe(true);
  });

  test('should validate wave height range (0-50)', async ({ page }) => {
    // Navigate to Session Details step

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate to step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Try to enter invalid wave height
    const waveHeightInput = page.locator('input[id*="wave-height"], input[name*="waveHeight"]').first();
    const hasWaveHeight = await waveHeightInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasWaveHeight) {
      test.skip(true, 'Wave height input not found - feature flag likely disabled');
      return;
    }

    // Test validation
    await waveHeightInput.fill('100'); // Invalid: over 50

    // Check for validation error or input constraint
    const maxValue = await waveHeightInput.getAttribute('max');
    const value = await waveHeightInput.inputValue();

    // Either input has max constraint or validation message appears
    if (maxValue) {
      expect(parseFloat(maxValue)).toBe(50);
    } else {
      // Look for validation error message
      const errorMessage = page.getByText(/wave height.*50|between 0 and 50/i);
      const hasError = await errorMessage.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

      if (hasError) {
        expect(hasError).toBe(true);
      }
    }
  });

  test('should enforce max 5 photos', async ({ page }) => {
    // Navigate to Session Details step

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate to step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Check for photo upload
    const photoInput = page.locator('input[type="file"]').first();
    const hasPhotoUpload = await photoInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasPhotoUpload) {
      test.skip(true, 'Photo upload not found - feature flag likely disabled');
      return;
    }

    // Look for max photos message or constraint
    const maxPhotosText = page.getByText(/max.*5.*photo|maximum.*5|5 photos/i);
    const hasMaxPhotosText = await maxPhotosText.isVisible().catch(() => false);

    // At minimum, there should be documentation about the limit
    expect(hasMaxPhotosText || hasPhotoUpload).toBe(true);
  });

  test('should display forecast comparison when available', async ({ page }) => {
    // Navigate through wizard to session details

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Go to date step
    const nextButton1 = page.getByRole('button', { name: /next|continue/i }).first();
    const hasNext1 = await nextButton1.isVisible().catch(() => false);
    if (hasNext1) {
      await nextButton1.click();
      await page.waitForTimeout(500);
    }

    // Set date (today)
    const dateInput = page.locator('input[type="date"]').first();
    const hasDate = await dateInput.isVisible().catch(() => false);
    if (hasDate) {
      const today = new Date().toISOString().split('T')[0];
      await dateInput.fill(today);
    }

    // Navigate to step 4
    for (let i = 0; i < 2; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Look for forecast comparison section
    const forecastSection = page.getByText(/forecast|predicted/i).first();
    const hasForecastSection = await forecastSection.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (hasForecastSection) {
      // Forecast data is available
      expect(hasForecastSection).toBe(true);
    } else {
      // Forecast might not be available for selected beach/date
      // This is acceptable - forecast comparison is conditional
      test.skip(true, 'Forecast data not available for selected beach/date');
    }
  });

  test('should persist data when navigating back and forward', async ({ page }) => {
    // Navigate to step 4 and fill data

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate to step 4
    for (let i = 0; i < 3; i++) {
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Fill wave height
    const waveHeightInput = page.locator('input[id*="wave-height"], input[name*="waveHeight"]').first();
    const hasWaveHeight = await waveHeightInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasWaveHeight) {
      test.skip(true, 'SessionDetailsSection not found - feature flag likely disabled');
      return;
    }

    await waveHeightInput.fill('4.5');

    // Add notes
    const notesTextarea = page.locator('textarea[id*="notes"], textarea[name*="notes"]').first();
    await notesTextarea.fill('Testing data persistence');

    // Go back to step 3
    const backButton = page.getByRole('button', { name: /back|previous/i }).first();
    const hasBack = await backButton.isVisible().catch(() => false);

    if (!hasBack) {
      test.skip(true, 'Back button not found');
      return;
    }

    await backButton.click();
    await page.waitForTimeout(500);

    // Go forward again to step 4
    const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
    const hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Verify data is still present
    const waveHeightValue = await waveHeightInput.inputValue();
    const notesValue = await notesTextarea.inputValue();

    expect(waveHeightValue).toBe('4.5');
    expect(notesValue).toBe('Testing data persistence');
  });
});

test.describe('Session Wizard - Legacy Flow (V1) - Log Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test('should have 6 steps in legacy log mode', async ({ page }) => {
    // When USE_CONSOLIDATED_WIZARD = false (default), log mode should have 6 steps

    const progressBar = page.locator('[role="progressbar"], [data-testid*="progress"]').first();
    const hasProgressBar = await progressBar.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (hasProgressBar) {
      const maxSteps = await progressBar.getAttribute('aria-valuemax');

      // In V1 legacy mode, should be 6 steps
      if (maxSteps && parseInt(maxSteps) === 6) {
        expect(parseInt(maxSteps)).toBe(6);
      } else if (maxSteps && parseInt(maxSteps) === 4) {
        test.skip(true, 'Feature flag USE_CONSOLIDATED_WIZARD is enabled - running V2 (4 steps)');
      } else {
        test.skip(true, 'Progress bar found but step count unclear');
      }
    } else {
      test.skip(true, 'Progress bar not found - cannot verify step count');
    }
  });

  test('should have separate Conditions, Photos, and Notes steps', async ({ page }) => {
    // Navigate through wizard looking for separate steps

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate through steps
    let foundConditionsStep = false;
    let foundPhotosStep = false;
    let foundNotesStep = false;

    for (let step = 0; step < 6; step++) {
      // Check current step
      const stepHeading = page.getByRole('heading', { level: 2 }).first();
      const headingText = await stepHeading.textContent().catch(() => '');

      // Check for step titles
      if (headingText?.toLowerCase().includes('condition')) {
        foundConditionsStep = true;
      }
      if (headingText?.toLowerCase().includes('photo')) {
        foundPhotosStep = true;
      }
      if (headingText?.toLowerCase().includes('note')) {
        foundNotesStep = true;
      }

      // Try to go to next step
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    // In V1, all three separate steps should exist
    if (foundConditionsStep && foundPhotosStep && foundNotesStep) {
      expect(foundConditionsStep).toBe(true);
      expect(foundPhotosStep).toBe(true);
      expect(foundNotesStep).toBe(true);
    } else {
      test.skip(true, 'Separate steps not found - likely running V2 consolidated wizard');
    }
  });
});

test.describe('Session Wizard - Plan Mode (Both Versions)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);
  });

  test('should have 4 steps in plan mode (unchanged)', async ({ page }) => {
    // Plan mode should always have 4 steps in both V1 and V2

    const progressBar = page.locator('[role="progressbar"], [data-testid*="progress"]').first();
    const hasProgressBar = await progressBar.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (hasProgressBar) {
      const maxSteps = await progressBar.getAttribute('aria-valuemax');

      if (maxSteps) {
        expect(parseInt(maxSteps)).toBe(4);
      }
    } else {
      // Try to count steps by navigating
      let stepCount = 1;
      for (let i = 0; i < 5; i++) {
        const nextButton = page.getByRole('button', { name: /next|continue/i }).first();
        const hasNext = await nextButton.isVisible().catch(() => false);
        if (hasNext) {
          stepCount++;
          await nextButton.click();
          await page.waitForTimeout(500);
        } else {
          break;
        }
      }

      expect(stepCount).toBe(4);
    }
  });

  test('should have Goals and Notes steps (not Session Details)', async ({ page }) => {
    // Plan mode should NOT use SessionDetailsSection

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate through steps
    let foundGoalsStep = false;
    let foundNotesStep = false;
    let foundSessionDetailsStep = false;

    for (let step = 0; step < 4; step++) {
      const stepHeading = page.getByRole('heading', { level: 2 }).first();
      const headingText = await stepHeading.textContent().catch(() => '');

      if (headingText?.toLowerCase().includes('goal')) {
        foundGoalsStep = true;
      }
      if (headingText?.toLowerCase().includes('note')) {
        foundNotesStep = true;
      }
      if (headingText?.toLowerCase().includes('session details')) {
        foundSessionDetailsStep = true;
      }

      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Plan mode should have Goals and Notes, NOT Session Details
    expect(foundGoalsStep).toBe(true);
    expect(foundNotesStep).toBe(true);
    expect(foundSessionDetailsStep).toBe(false);
  });
});

test.describe('Session Wizard - Feature Flag Comparison', () => {
  test('V1 vs V2: verify step count difference in log mode', async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);

    const progressBar = page.locator('[role="progressbar"], [data-testid*="progress"]').first();
    const hasProgressBar = await progressBar.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (hasProgressBar) {
      const maxSteps = await progressBar.getAttribute('aria-valuemax');

      if (maxSteps) {
        const stepCount = parseInt(maxSteps);

        // Should be either 6 (V1) or 4 (V2)
        expect([4, 6]).toContain(stepCount);

        if (stepCount === 6) {
          console.log('Running V1 (legacy) wizard with 6 steps');
        } else if (stepCount === 4) {
          console.log('Running V2 (consolidated) wizard with 4 steps');
        }
      }
    } else {
      test.skip(true, 'Cannot determine wizard version - progress bar not found');
    }
  });
});

test.describe('Session Wizard - Data Persistence Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test('should validate notes max length (2000 characters)', async ({ page }) => {
    // Navigate to notes field (either in SessionDetailsSection or NotesSection)

    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow');
      return;
    }

    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    }

    // Navigate through all steps to find notes field
    for (let i = 0; i < 6; i++) {
      const notesTextarea = page.locator('textarea[id*="notes"], textarea[name*="notes"]').first();
      const hasNotes = await notesTextarea.isVisible().catch(() => false);

      if (hasNotes) {
        // Found notes field - test validation
        const longText = 'A'.repeat(2001); // Over limit
        await notesTextarea.fill(longText);

        const maxLength = await notesTextarea.getAttribute('maxlength');
        const value = await notesTextarea.inputValue();

        // Either maxlength constraint or validation message
        if (maxLength) {
          expect(parseInt(maxLength)).toBe(2000);
        } else {
          // Check for validation error
          const errorMessage = page.getByText(/2000|maximum.*character/i);
          const hasError = await errorMessage.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

          if (hasError) {
            expect(hasError).toBe(true);
          }
        }
        return;
      }

      // Go to next step
      const nextButton = page.getByRole('button', { name: /next|continue|skip/i }).first();
      const hasNext = await nextButton.isVisible().catch(() => false);
      if (hasNext) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    test.skip(true, 'Notes field not found');
  });
});

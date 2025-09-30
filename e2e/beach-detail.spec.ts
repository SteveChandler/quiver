import { test, expect } from '@playwright/test';

// Consolidated Beach Detail page coverage
// Runs under the `auth` project (requires authenticated storageState)

const BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('@beach - Beach Detail Page', () => {
  test('loads beach detail and shows hero section with wave height card', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Assert hero section elements are present
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
    
    // Check for wave height card in hero
    await expect(page.getByText(/wave height/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/ft/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('loads beach detail and shows 5 Day Outlook section', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // 5-Day Outlook is now a section heading (not accordion)
    const outlookHeading = page.getByRole('heading', { name: /5-day outlook/i });
    await expect(outlookHeading).toBeVisible({ timeout: 20000 });

    // Check for overview chips in the forecast section
    const tideChartChip = page.getByText(/tide chart included/i);
    await expect(tideChartChip).toBeVisible({ timeout: 20000 });
  });

  test('defaults to Tides tab in 5-Day Outlook section', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Wait for 5-Day Outlook section to be visible
    const outlookHeading = page.getByRole('heading', { name: /5-day outlook/i });
    await expect(outlookHeading).toBeVisible({ timeout: 20000 });

    // The Tides tab should be active by default
    const tidesTab = page.getByRole('tab', { name: /tides/i });
    await expect(tidesTab).toBeVisible({ timeout: 20000 });
    await expect(tidesTab).toHaveAttribute('data-state', /active/);
  });

  test('deep-link to intel section scrolls into view and is visible', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}?section=intel`, { waitUntil: 'domcontentloaded' });

    // Intel is now a section with heading (not accordion)
    const intelSectionById = page.locator('#intel, #intel-section');
    await expect(intelSectionById.first()).toBeVisible({ timeout: 20000 });

    // Check for the Local Intel heading
    const intelHeading = page.getByRole('heading', { name: /local intel/i });
    await expect(intelHeading).toBeVisible({ timeout: 20000 });
  });

  test('favorite button is visible and clickable', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Button is accessible via aria-label set in FavoriteButton
    const favButton = page.getByRole('button', { name: /add to favorites|remove from favorites/i });
    await expect(favButton).toBeVisible({ timeout: 20000 });

    // Button should be clickable (state change might be async/debounced)
    await favButton.click();
    
    // Wait a moment for any state updates
    await page.waitForTimeout(1000);
    
    // Button should still be visible after click
    await expect(favButton).toBeVisible();
  });

  test('reviews: open write review dialog from Reviews section', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Scroll to reviews section (it's visible by default, no accordion)
    const reviewsSection = page.locator('#reviews');
    await reviewsSection.scrollIntoViewIfNeeded();

    // Try to find write review button
    const writeButtons = page.getByRole('button', { name: /write review|write the first review/i });
    const buttonCount = await writeButtons.count();
    
    if (buttonCount === 0) {
      test.info().annotations.push({ type: 'note', description: 'No write review CTA available' });
      return;
    }

    await writeButtons.first().click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20000 });

    // Close dialog (Escape)
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20000 });
  });

  test('spot summary section is visible and shows key fields', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Scroll to bottom where spot summary is located
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Look for "Spot Summary" text in CardTitle (not a heading role)
    const spotSummaryText = page.getByText(/spot summary/i);
    await expect(spotSummaryText).toBeVisible({ timeout: 20000 });

    // Check for key fields
    await expect(page.getByText(/break type/i).first()).toBeVisible();
    await expect(page.getByText(/best swell/i).first()).toBeVisible();
  });

  test('intel section: view all toggles to show less when available', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}?section=intel`, { waitUntil: 'domcontentloaded' });

    // Wait for intel section to be visible
    const intelSection = page.locator('#intel-section, #intel');
    await expect(intelSection.first()).toBeVisible({ timeout: 20000 });

    // Button only appears when posts > 3; guard with conditional
    const viewAllBtn = page.getByRole('button', { name: /view all .* intel posts/i });
    const btnCount = await viewAllBtn.count();
    
    if (btnCount > 0) {
      await viewAllBtn.first().click();
      await expect(page.getByRole('button', { name: /show less/i })).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'note', description: 'Not enough intel posts to test view all' });
    }
  });

  test('forecast snapshot section shows tide, wind, and swell cards', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Check for forecast snapshot heading
    const snapshotHeading = page.getByRole('heading', { name: /forecast snapshot/i });
    await expect(snapshotHeading).toBeVisible({ timeout: 20000 });

    // Check for the three main forecast cards
    await expect(page.getByText(/next tide/i).first()).toBeVisible();
    await expect(page.getByText(/wind/i).first()).toBeVisible();
    await expect(page.getByText(/swell/i).first()).toBeVisible();
  });

  test('live cam section is visible', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Live cam is now a standalone section
    const liveCamHeading = page.getByRole('heading', { name: /live cam/i });
    await liveCamHeading.scrollIntoViewIfNeeded();
    await expect(liveCamHeading).toBeVisible({ timeout: 20000 });
  });

  test('5-day mini forecast cards are interactive', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Scroll to 5-Day Outlook section
    const outlookHeading = page.getByRole('heading', { name: /5-day outlook/i });
    await outlookHeading.scrollIntoViewIfNeeded();
    await expect(outlookHeading).toBeVisible({ timeout: 20000 });

    // Find mini forecast cards (buttons with wave height)
    const forecastCards = page.locator('button:has-text("ft")');
    const cardCount = await forecastCards.count();
    
    if (cardCount > 0) {
      // Click first card to open detailed modal
      await forecastCards.first().click();
      
      // Check if modal/dialog opens (DetailedSwellModal)
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
      
      // Close modal
      await page.keyboard.press('Escape');
    } else {
      test.info().annotations.push({ type: 'note', description: 'No forecast cards available' });
    }
  });

  test('tabs in 5-Day Outlook section are functional', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Scroll to outlook section
    const outlookHeading = page.getByRole('heading', { name: /5-day outlook/i });
    await outlookHeading.scrollIntoViewIfNeeded();

    // Check that tabs exist
    const todayTab = page.getByRole('tab', { name: /today/i });
    const tidesTab = page.getByRole('tab', { name: /tides/i });
    const windTab = page.getByRole('tab', { name: /wind/i });
    const swellTab = page.getByRole('tab', { name: /swell/i });
    const weekTab = page.getByRole('tab', { name: /week/i });

    // All tabs should be visible
    await expect(todayTab).toBeVisible();
    await expect(tidesTab).toBeVisible();
    await expect(windTab).toBeVisible();
    await expect(swellTab).toBeVisible();
    await expect(weekTab).toBeVisible();

    // Click Today tab
    await todayTab.click();
    await expect(todayTab).toHaveAttribute('data-state', /active/);

    // Click Week tab
    await weekTab.click();
    await expect(weekTab).toHaveAttribute('data-state', /active/);
  });
});

test.describe('Beach Detail - Navigation', () => {
  test('navigates to beach detail and shows expected sections', async ({ page }) => {
    const isDev = (process.env.BASE_URL || '').includes('dev.quiversurf.app');
    const envId = process.env.TEST_BEACH_ID;
    const fallbackDevId = '15c7337e-5258-4339-9dc3-c435c666926b';
    const beachId = envId || (isDev ? fallbackDevId : undefined);

    if (beachId) {
      await page.goto(`/beach/${beachId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const viewDetails = page.getByRole('button', { name: /view details/i });
      const canClick = await viewDetails.isVisible().catch(() => false);
      if (!canClick) {
        test.info().annotations.push({ type: 'note', description: 'No View Details button present; skipping beach detail checks.' });
        return;
      }
      await viewDetails.click();
      await expect(page).toHaveURL(/\/beach\//);
    }

    // Beach name heading should be visible (h1)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // Expect main section headings to be visible
    await expect(page.getByRole('heading', { name: /5-day outlook/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /local intel/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /live cam/i })).toBeVisible();

    // Spot Summary should be present (scroll to bottom)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/spot summary/i)).toBeVisible({ timeout: 20000 });
  });
});

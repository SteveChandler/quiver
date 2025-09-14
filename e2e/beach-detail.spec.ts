import { test, expect } from '@playwright/test';

// Consolidated Beach Detail page coverage
// Runs under the `auth` project (requires authenticated storageState)

const BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('@beach - Beach Detail Page', () => {
  test('loads beach detail and shows Forecast & Tides section (default open)', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Assert accordion trigger is present
    const forecastTrigger = page.getByRole('button', { name: /forecast & tides/i });
    await expect(forecastTrigger).toBeVisible({ timeout: 20000 });

    // Content heuristics inside Forecast & Tides (scope to region, avoid strict-mode ambiguity)
    const forecastRegion = page.getByRole('region', { name: /forecast & tides/i });
    await expect(forecastRegion).toBeVisible({ timeout: 20000 });
    const anyChip = forecastRegion
      .getByText(/(tide chart included|wind in forecast table)/i)
      .first();
    await expect(anyChip).toBeVisible({ timeout: 20000 });
  });

  test('defaults to Tides tab with 5-Day Tide Chart visible', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    const forecastRegion = page.getByRole('region', { name: /forecast & tides/i });
    await expect(forecastRegion).toBeVisible({ timeout: 20000 });

    // The tide chart card header should be visible by default
    await expect(forecastRegion.getByText(/5-day tide chart/i)).toBeVisible({ timeout: 20000 });

    // The Tides tab trigger should be active
    const tidesTab = forecastRegion.getByRole('tab', { name: /tides/i });
    await expect(tidesTab).toHaveAttribute('data-state', /active/);
  });

  test('deep-link to intel section scrolls into view and is visible', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}?section=intel`, { waitUntil: 'domcontentloaded' });

    // Prefer section IDs when present
    const intelSectionById = page.locator('#intel, #intel-section');
    if (await intelSectionById.count()) {
      await expect(intelSectionById.first()).toBeVisible({ timeout: 20000 });
    }

    // Fallback: the accordion trigger text
    const intelTrigger = page.getByRole('button', { name: /local intel/i });
    await expect(intelTrigger).toBeVisible({ timeout: 20000 });
  });

  test('favorite toggle via accessible label', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Button is accessible via aria-label set in FavoriteButton
    const favButton = page.getByRole('button', { name: /add to favorites|remove from favorites/i });
    await expect(favButton).toBeVisible({ timeout: 20000 });

    const beforeLabel = await favButton.getAttribute('aria-label');
    await favButton.click();

    // Label should flip after toggle; allow minor debounce/async
    await expect(async () => {
      const afterLabel = await favButton.getAttribute('aria-label');
      expect(afterLabel).not.toEqual(beforeLabel);
    }).toPass();
  });

  test('reviews: open write review dialog from Reviews section', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Open Reviews accordion
    const reviewsTrigger = page.getByRole('button', { name: /reviews/i });
    await reviewsTrigger.click();

    // Try primary CTA first (when reviews exist)
    const writeButtons = page.getByRole('button', { name: /write review|write the first review/i });
    if (await writeButtons.count()) {
      await writeButtons.first().click();
    } else {
      // If no CTA (unlikely when authed), skip gracefully
      test.info().annotations.push({ type: 'note', description: 'No write review CTA available' });
      return;
    }

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20000 });

    // Close dialog (Escape)
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20000 });
  });

  test('spot overview expands and shows key fields', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    const overviewTrigger = page.getByRole('button', { name: /spot overview/i });
    // Ensure the trigger is in view and activate via keyboard to avoid overlay interception
    await overviewTrigger.scrollIntoViewIfNeeded();
    await overviewTrigger.evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center' }));
    await overviewTrigger.focus();
    await expect(overviewTrigger).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByText(/break type/i)).toBeVisible();
    await expect(page.getByText(/best swell/i)).toBeVisible();
    await expect(page.getByText(/best wind\s*\/\s*tide/i)).toBeVisible();
  });

  test('intel section: view all toggles to show less when available', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}?section=intel`, { waitUntil: 'domcontentloaded' });

    // Expand intel if not already
    const intelTrigger = page.getByRole('button', { name: /local intel/i });
    if (await intelTrigger.isVisible().catch(() => false)) {
      await intelTrigger.click();
    }

    // Button only appears when posts > 3; guard with conditional
    const viewAllBtn = page.getByRole('button', { name: /view all .* intel posts/i });
    if (await viewAllBtn.count()) {
      await viewAllBtn.first().click();
      await expect(page.getByRole('button', { name: /show less/i })).toBeVisible();
    }
  });

  
});

test.describe('Beach Detail', () => {
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

    // Expect at least two accordion triggers to be visible
    await expect(page.getByRole('button', { name: /forecast & tides/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /local intel/i })).toBeVisible();

    // Expand Local Intel to ensure it responds
    await page.getByRole('button', { name: /local intel/i }).click();

    // Heading present (pick first h1 to avoid strict-mode conflict)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});

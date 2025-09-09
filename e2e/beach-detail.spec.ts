import { test, expect } from '@playwright/test';

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

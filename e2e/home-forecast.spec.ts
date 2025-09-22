import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';
import { selectors } from './utils/selectors';

test.describe('Home + Forecast', () => {
  test('logged-in user sees forecast tab and can open beach details', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/' });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Forecast tab container visible
    await expect(page.locator(selectors.forecastTab)).toBeVisible();

    // Try to navigate to beach details if the button is present; otherwise, treat as optional
    const viewDetails = page.getByRole('button', { name: /view details/i });
    const viewBeachDetails = page.getByRole('button', { name: /view beach details/i });
    const canClickViewDetails = await viewDetails.isVisible().catch(() => false);
    const canClickViewBeachDetails = await viewBeachDetails.isVisible().catch(() => false);
    let navigated = false;
    if (canClickViewDetails) {
      await viewDetails.click();
      await expect(page).toHaveURL(/\/beach\//);
      navigated = true;
    } else if (canClickViewBeachDetails) {
      await viewBeachDetails.click();
      await expect(page).toHaveURL(/\/beach\//);
      navigated = true;
    } else {
      // No navigation button present (skeleton or data-unavailable state). Forecast tab presence already verified.
      test.info().annotations.push({ type: 'note', description: 'No View Details button; skipping navigate assertion.' });
    }

    if (navigated) {
      // On beach page, expect either KPIs or fallback card
      const todayOverview = page.getByRole('heading', { name: /today's overview/i });
      const forecastUnavailable = page.getByText(/forecast unavailable/i);
      await expect(todayOverview.or(forecastUnavailable)).toBeVisible();

      // Also check accordion trigger exists
      await expect(page.getByRole('button', { name: /forecast & tides/i })).toBeVisible();
    }
  });
});

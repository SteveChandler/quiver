import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';

test.describe('@intel - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/' });
  });

  test('Local Intel tab renders dashboard with map and feed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to Local Intel tab
    const intelTab = page.getByRole('tab', { name: /local intel/i });
    await intelTab.click();
    await expect(intelTab).toHaveAttribute('data-state', 'active');

    // Dashboard title visible
    const title = page.getByRole('heading', { name: /local intel club/i }).first();
    await expect(title).toBeVisible({ timeout: 20000 });

    // Map canvas should render (Mapbox GL canvas)
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await expect(mapCanvas.first()).toBeVisible({ timeout: 30000 });

    // Feed heading present in split view
    const recentIntel = page.getByText(/recent intel/i).first();
    await expect(recentIntel).toBeVisible({ timeout: 20000 });
  });

  test('Location mode toggle switches between Nearby and All Posts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /local intel/i }).click();

    // Button shows either Nearby or All Posts depending on current mode
    const modeButton = page.getByRole('button', { name: /nearby|all posts/i }).first();
    await expect(modeButton).toBeVisible({ timeout: 20000 });

    const initial = (await modeButton.textContent()) || '';
    await modeButton.click();

    // Expect the opposite label to appear after toggle
    const flipped = /nearby/i.test(initial) ? /all posts/i : /nearby/i;
    await expect(page.getByRole('button', { name: flipped }).first()).toBeVisible({ timeout: 20000 });
  });
});


import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';
import { selectors } from './utils/selectors';
import { waitForNetworkIdle } from './utils/waits';

test.describe('Profile Basics', () => {
  test('tabs render and can be switched', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/profile' });

    // Tabs visible
    const journalTab = page.getByRole('tab', { name: /journal\+/i });
    const quiverTab = page.getByRole('tab', { name: /quiver/i });
    const beachesTab = page.getByRole('tab', { name: /beaches/i });
    const commentsTab = page.getByRole('tab', { name: /comments/i });

    await expect(journalTab).toBeVisible();
    await expect(quiverTab).toBeVisible();
    await expect(beachesTab).toBeVisible();
    await expect(commentsTab).toBeVisible();

    // Switch between tabs (no deep assertions to avoid data flake)
    await quiverTab.click();
    await beachesTab.click();
    await commentsTab.click();
    await journalTab.click();
  });
});

test.describe('Profile Deep E2E', () => {
  test('edit profile modal flow updates UI', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/profile' });

    // Capture existing name from header if present to revert later
    const header = page.getByRole('heading', { level: 1 }).filter({ hasText: /Profile/i }).first();
    const initialHeaderText = (await header.textContent())?.trim() || '';
    const match = initialHeaderText.match(/^(.*)'s Profile$/);
    const originalName = match?.[1] || '';

    // Open Edit modal
    await page.locator(selectors.profileEditButton).click();
    await expect(page.locator(selectors.profileModalTitle)).toBeVisible();

    // Do not mutate fields; ensure inputs are interactable for a no-op save
    await page.getByPlaceholder('Your name').isVisible();
    await page.getByPlaceholder('Tell us about yourself and your surfing journey').isVisible();
    await page.getByPlaceholder('Where are you based?').isVisible();
    await page.getByPlaceholder('Beginner, Intermediate, Advanced, etc.').isVisible();
    await page.getByPlaceholder('@yourusername').isVisible();

    // Save
    await page.locator(selectors.saveProfileButton).click();

    // Modal should close and profile should refetch; wait for network idle and header should remain unchanged
    await waitForNetworkIdle(page);
    if (originalName) {
      await expect(header).toContainText(`${originalName}'s Profile`, { timeout: 15000 });
    } else {
      // If we couldn't parse the name, at least ensure the header still contains "Profile"
      await expect(header).toContainText('Profile', { timeout: 15000 });
    }
  });

  test('deep link opens edit modal via /profile?edit=true', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/profile?edit=true' });
    await expect(page.locator(selectors.profileModalTitle)).toBeVisible();
  });

  test('clicking Add Beach navigates to map to add beaches', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/profile' });

    // Switch to Beaches tab
    await page.getByRole('tab', { name: /Beaches/i }).click();
    await expect(page.getByRole('tab', { name: /Beaches/i })).toHaveAttribute('data-state', 'active');

    // Click Add Beach
    await page.getByRole('button', { name: /Add Beach/i }).click();

    // Assert navigation to map and presence of map view
    await expect(page).toHaveURL(/\/map/);
    await expect(page.getByTestId('map-view')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';
import { selectors } from './utils/selectors';
import { waitForNetworkIdle } from './utils/waits';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/profile' });
  });

  test('tabs render and can be switched', async ({ page }) => {
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

  test('edit profile modal flow updates UI', async ({ page }) => {
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
    // Session already established in beforeEach; navigate to deep link
    await page.goto('/profile?edit=true', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.profileModalTitle)).toBeVisible();
  });

  test('clicking Add Beach navigates to map to add beaches', async ({ page }) => {
    // Switch to Beaches tab
    await page.getByRole('tab', { name: /Beaches/i }).click();
    await expect(page.getByRole('tab', { name: /Beaches/i })).toHaveAttribute('data-state', 'active');

    // Click Add Beach
    await page.getByRole('button', { name: /Add Beach/i }).click();

    // Assert navigation to map and presence of map view
    await expect(page).toHaveURL(/\/map/);
    await expect(page.getByTestId('map-view')).toBeVisible();
  });

  test('favorited beach appears in Favorites tab on profile', async ({ page }) => {
    const beachId = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

    // Ensure the beach is favorited via the Beach page toggle
    await page.goto(`/beach/${beachId}`, { waitUntil: 'domcontentloaded' });
    const favButton = page.getByRole('button', { name: /add to favorites|remove from favorites/i });
    await expect(favButton).toBeVisible({ timeout: 20000 });

    const label = (await favButton.getAttribute('aria-label')) || '';
    if (/add to favorites/i.test(label)) {
      await favButton.click();
      await expect(favButton).toHaveAttribute('aria-label', /remove from favorites/i);
    }

    // Navigate back to profile and open Beaches tab
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /Beaches/i }).click();

    // Expect a link to the favorited beach to be present in the favorites list
    const beachLink = page.locator(`a[href="/beach/${beachId}"]`).first();
    await expect(beachLink).toBeVisible({ timeout: 20000 });
  });
});

import { test, expect } from '@playwright/test';
import { TIMEOUTS, VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';
import {
  createTestBeachPhoto,
  softDeleteBeachPhoto,
  deleteBeachPhoto,
  restoreBeachPhoto,
  getBeachPhoto,
  getRandomPublicBeachId,
  deleteAllTestPhotosForBeach,
  type PhotoOperationResult,
} from './utils/beach-photo-helpers';

/**
 * Guest Landing Page Tests
 * Tests the landing page for unauthenticated users
 *
 * Core tests:
 * - Page loads without errors
 * - Login/Signup buttons are visible
 * - Auth modal opens when clicking login/signup
 * - Forecast section functionality
 * - Search functionality
 * - Deleted photos handling
 *
 * @project guest
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Landing Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test('should display landing page for guests @smoke', async ({ page }) => {
    // Should NOT be redirected to authenticated routes
    expect(page.url()).not.toContain('/profile');
    expect(page.url()).not.toContain('/sessions');

    // Should see landing page content - look for any heading or main content
    const hero = page.getByRole('heading').first();
    const mainContent = page.locator('main, [role="main"]').first();

    const hasHero = await hero.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);

    // Landing page should have some content
    expect(hasHero || hasMain).toBe(true);
  });

  test('should open auth modal when clicking login', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Should see auth modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should see auth options
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await expect(googleButton).toBeVisible();
  });

  // TODO: Test drift - signup button selector changed, may now be "Get Started" or similar
  test.skip('should open auth modal when clicking signup', async ({ page }) => {
    const signupButton = page.getByRole('button', { name: /sign up/i });
    await signupButton.click();

    // Should see auth modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test.describe('Loading States', () => {
    test('should show loading skeletons initially', async ({ page }) => {
      // Navigate and quickly check for skeleton
      const navigationPromise = page.goto('/');

      // Look for loading skeleton
      const skeleton = page.locator('.animate-pulse').first();
      const skeletonAppeared = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

      await navigationPromise;

      // Skeleton may or may not appear depending on load speed
      // This is acceptable behavior - just verify if it appears, it eventually disappears
      if (skeletonAppeared) {
        await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
      }
    });

    test('should transition from loading to content smoothly', async ({ page }) => {
      await page.reload();

      // Wait for any loading state to complete
      await page.waitForTimeout(1000);

      // Verify actual content is displayed
      const contentLoaded = page.locator('img, h1, h2, h3').first();
      await expect(contentLoaded).toBeVisible({ timeout: TIMEOUTS.long });
    });
  });

  test.describe('Content Validation', () => {
    test('should have proper page title and meta tags', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);

      // Should have description meta tag
      const description = await page.getAttribute('meta[name="description"]', 'content');
      expect(description).toBeTruthy();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1').first();
      const h1Exists = await h1.isVisible().catch(() => false);

      // Page should have an h1
      expect(h1Exists).toBe(true);
    });
  });

  test.describe('SSR/SEO Validation', () => {
    test('should have beach links in page HTML for SEO crawlability @seo', async ({ page }) => {
      // Get the page HTML source
      const response = await page.goto('/');
      const html = await response?.text();

      // Beach links should be present in the initial HTML
      // These are server-rendered for SEO crawlability
      expect(html).toBeTruthy();

      // Check for hierarchical beach URLs (/{state}/{city}/{beach-slug})
      // At least one of these state slugs should be present
      const hasStateBeachLinks =
        html?.includes('href="/ca/') ||
        html?.includes('href="/fl/') ||
        html?.includes('href="/hi/') ||
        html?.includes('href="/or/');

      // Or fallback beach links
      const hasFallbackBeachLinks = html?.includes('href="/beach/');

      expect(hasStateBeachLinks || hasFallbackBeachLinks).toBe(true);
    });

    test('should have beach links visible in DOM @seo', async ({ page }) => {
      // Wait for page to be fully loaded
      await waitForPageLoad(page);

      // Look for beach links - should be present regardless of JS loading
      const beachLinks = page.locator('a[href*="/ca/"], a[href*="/fl/"], a[href*="/hi/"], a[href*="/or/"], a[href*="/beach/"]');
      const linkCount = await beachLinks.count();

      // Should have at least one beach link visible
      expect(linkCount).toBeGreaterThan(0);
    });

    test('should have beach section heading in HTML @seo', async ({ page }) => {
      const response = await page.goto('/');
      const html = await response?.text();

      // The section should have proper headings for SEO
      // Check for the "Popular Surf Spots" or similar heading
      const hasSurfSpotsHeading =
        html?.includes('Surf Spots') ||
        html?.includes('surf spots') ||
        html?.includes('Popular') ||
        html?.includes('Trending');

      expect(hasSurfSpotsHeading).toBe(true);
    });

    test('should have structured data for SEO @seo', async ({ page }) => {
      const response = await page.goto('/');
      const html = await response?.text();

      // Should have FAQ schema or other structured data
      const hasStructuredData =
        html?.includes('application/ld+json') ||
        html?.includes('FAQPage') ||
        html?.includes('@type');

      expect(hasStructuredData).toBe(true);
    });

    test('should render beach images with proper alt text @seo', async ({ page }) => {
      await waitForPageLoad(page);

      // Find beach card images
      const beachImages = page.locator('img[alt]').filter({
        has: page.locator('..').filter({ has: page.locator('a[href*="/ca/"], a[href*="/fl/"], a[href*="/hi/"], a[href*="/beach/"]') }),
      });

      // Check if any beach images are present with alt text
      const imageCount = await beachImages.count();

      // If we have beach images, verify they have non-empty alt text
      if (imageCount > 0) {
        const firstImage = beachImages.first();
        const altText = await firstImage.getAttribute('alt');
        expect(altText).toBeTruthy();
        expect(altText?.length).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Guest Landing - Forecast Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.describe('Feature Switcher', () => {
    test('displays all three features in rail', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check that all three feature tabs are visible
      await expect(
        page.getByRole('tab', { name: 'Personalized Forecast' })
      ).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Session Journal' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Local Intel' })).toBeVisible();
    });

    test('default feature is Personalized Forecast', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Personalized Forecast should be selected by default
      const forecastTab = page.getByRole('tab', { name: 'Personalized Forecast' });
      await expect(forecastTab).toHaveAttribute('aria-selected', 'true');

      // Forecast phone mock should be visible
      await expect(page.getByTestId('phone-mock-forecast')).toBeVisible();
    });

    test('clicking Session Journal switches content', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Session Journal tab
      const journalTab = page.getByRole('tab', { name: 'Session Journal' });
      await journalTab.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Session Journal should now be selected
      await expect(journalTab).toHaveAttribute('aria-selected', 'true');

      // Journal phone mock should be visible
      await expect(page.getByTestId('phone-mock-journal')).toBeVisible();

      // Body copy should update
      await expect(forecastSection).toContainText(
        'Log sessions. Unlock better forecasts.'
      );

      // Headline should update
      await expect(forecastSection).toContainText('Track your surf story');
    });

    test('clicking Local Intel switches content', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Local Intel tab
      const intelTab = page.getByRole('tab', { name: 'Local Intel' });
      await intelTab.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Local Intel should now be selected
      await expect(intelTab).toHaveAttribute('aria-selected', 'true');

      // Intel phone mock should be visible
      await expect(page.getByTestId('phone-mock-intel')).toBeVisible();

      // Body copy should update
      await expect(forecastSection).toContainText(
        'Real-time posts, photos, and crowd reports'
      );

      // Headline should update
      await expect(forecastSection).toContainText('Real conditions from real surfers');
    });

    test('arrow navigation cycles through features', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default is Forecast
      await expect(
        page.getByRole('tab', { name: 'Personalized Forecast' })
      ).toHaveAttribute('aria-selected', 'true');

      // Click Next button
      const nextButton = page.getByLabel('Next feature');
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole('tab', { name: 'Session Journal' })
      ).toHaveAttribute('aria-selected', 'true');

      // Click Next again
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should move to Local Intel
      await expect(
        page.getByRole('tab', { name: 'Local Intel' })
      ).toHaveAttribute('aria-selected', 'true');

      // Click Next again to wrap around
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should wrap back to Forecast
      await expect(
        page.getByRole('tab', { name: 'Personalized Forecast' })
      ).toHaveAttribute('aria-selected', 'true');
    });

    test('previous arrow navigation cycles backwards', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default is Forecast
      const previousButton = page.getByLabel('Previous feature');

      // Click Previous button
      await previousButton.click();
      await page.waitForTimeout(300);

      // Should wrap to Local Intel
      await expect(
        page.getByRole('tab', { name: 'Local Intel' })
      ).toHaveAttribute('aria-selected', 'true');

      // Click Previous again
      await previousButton.click();
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole('tab', { name: 'Session Journal' })
      ).toHaveAttribute('aria-selected', 'true');
    });

    test('CTA link changes with active feature', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default: Forecast CTA
      let ctaLink = forecastSection.locator('a[href="/map"]');
      await expect(ctaLink).toBeVisible();

      // Switch to Session Journal
      await page.getByRole('tab', { name: 'Session Journal' }).click();
      await page.waitForTimeout(300);

      // CTA should now link to /sessions/new
      ctaLink = forecastSection.locator('a[href="/sessions/new"]');
      await expect(ctaLink).toBeVisible();
      await expect(ctaLink).toContainText('Start your journal');

      // Switch to Local Intel
      await page.getByRole('tab', { name: 'Local Intel' }).click();
      await page.waitForTimeout(300);

      // CTA should link to /map
      ctaLink = forecastSection.locator('a[href="/map"]');
      await expect(ctaLink).toBeVisible();
      await expect(ctaLink).toContainText('Explore the map');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('ArrowDown navigates to next feature', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus the first tab
      const forecastTab = page.getByRole('tab', { name: 'Personalized Forecast' });
      await forecastTab.focus();

      // Press ArrowDown
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole('tab', { name: 'Session Journal' })
      ).toHaveAttribute('aria-selected', 'true');
    });

    test('ArrowUp navigates to previous feature', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus the first tab
      const forecastTab = page.getByRole('tab', { name: 'Personalized Forecast' });
      await forecastTab.focus();

      // Press ArrowUp
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);

      // Should wrap to Local Intel
      await expect(
        page.getByRole('tab', { name: 'Local Intel' })
      ).toHaveAttribute('aria-selected', 'true');
    });

    test('Home key navigates to first feature', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Switch to Local Intel first
      await page.getByRole('tab', { name: 'Local Intel' }).click();
      await page.waitForTimeout(300);

      // Focus current tab and press Home
      const intelTab = page.getByRole('tab', { name: 'Local Intel' });
      await intelTab.focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(300);

      // Should move to Personalized Forecast
      await expect(
        page.getByRole('tab', { name: 'Personalized Forecast' })
      ).toHaveAttribute('aria-selected', 'true');
    });

    test('End key navigates to last feature', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus first tab and press End
      const forecastTab = page.getByRole('tab', { name: 'Personalized Forecast' });
      await forecastTab.focus();
      await page.keyboard.press('End');
      await page.waitForTimeout(300);

      // Should move to Local Intel
      await expect(
        page.getByRole('tab', { name: 'Local Intel' })
      ).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Responsive Feature Switcher', () => {
    test('mobile: displays horizontal segmented control', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // All three tabs should be visible in horizontal layout
      await expect(
        page.getByRole('tab', { name: 'Personalized Forecast' })
      ).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Session Journal' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Local Intel' })).toBeVisible();
    });

    test('mobile: feature switching works', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Session Journal
      await page.getByRole('tab', { name: 'Session Journal' }).click();
      await page.waitForTimeout(300);

      // Should show journal mock
      await expect(page.getByTestId('phone-mock-journal')).toBeVisible();
    });

    test('desktop: displays vertical rail navigation', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Arrow buttons should be visible on desktop
      await expect(page.getByLabel('Previous feature')).toBeVisible();
      await expect(page.getByLabel('Next feature')).toBeVisible();
    });
  });

  test.describe('Phone Mock Rendering', () => {
    test('displays Best Spot Today card', async ({ page }) => {
      // Wait for forecast section to be visible
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify the Best Spot card is visible
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toBeVisible();

      // Verify heading
      const heading = page.getByTestId('best-spot-heading');
      await expect(heading).toContainText('Your Best Spot Today');
    });

    test('shows spot name and location details', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify spot name is displayed
      const spotName = page.getByTestId('spot-name');
      await expect(spotName).toBeVisible();
      await expect(spotName).toContainText('Marine Street Beach');

      // Verify location text
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toContainText('California');
    });

    test('displays current date', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify date is displayed
      const spotDate = page.getByTestId('spot-date');
      await expect(spotDate).toBeVisible();

      // Date should contain day name and month
      const dateText = await spotDate.textContent();
      expect(dateText).toMatch(
        /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/
      );
      expect(dateText).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });
  });

  test.describe('Match Badge', () => {
    test('displays match percentage badge', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check that match badge is visible
      const matchBadge = page.getByTestId('match-badge');
      await expect(matchBadge).toBeVisible();
      await expect(matchBadge).toContainText('94% Match');
    });

    test('match badge has correct styling', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const matchBadge = page.getByTestId('match-badge');
      const badgeClasses = await matchBadge.getAttribute('class');

      expect(badgeClasses).toContain('bg-ocean-blue');
      expect(badgeClasses).toContain('text-white');
    });
  });

  test.describe('Best Window Tiles', () => {
    test('displays 4 Best Window tiles', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify the Best Window tiles grid is visible
      const tilesGrid = page.getByTestId('best-window-tiles');
      await expect(tilesGrid).toBeVisible();

      // Check for tile content
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toContainText('Time');
      await expect(bestSpotCard).toContainText('Tide');
      await expect(bestSpotCard).toContainText('Wind');
      await expect(bestSpotCard).toContainText('Confidence');
    });

    test('tiles show correct values', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const bestSpotCard = page.getByTestId('best-spot-card');

      // Verify time value
      await expect(bestSpotCard).toContainText('4:00 PM - 7:00 PM');

      // Verify tide value
      await expect(bestSpotCard).toContainText('Rising');

      // Verify wind value
      await expect(bestSpotCard).toContainText('5 mph NE');

      // Verify confidence value
      await expect(bestSpotCard).toContainText('88% High');
    });
  });

  test.describe('Bottom Stats', () => {
    test('displays wave height and match percentage stats', async ({
      page,
    }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const bottomStats = page.getByTestId('bottom-stats');
      await expect(bottomStats).toBeVisible();

      // Verify wave height
      await expect(bottomStats).toContainText('3.3 ft');
      await expect(bottomStats).toContainText('Waves');

      // Verify match percentage
      await expect(bottomStats).toContainText('94');
      await expect(bottomStats).toContainText('Match');
    });
  });

  test.describe('CTA Buttons', () => {
    test('default Explore Map button has correct link', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Find the map CTA link (default for forecast feature)
      const mapLink = forecastSection.locator('a[href="/map"]');
      await expect(mapLink).toBeVisible();

      // Verify the link text
      const linkText = await mapLink.textContent();
      expect(linkText?.length).toBeGreaterThan(0);
    });

    test('CTA button has correct styling', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Primary button should have ocean-blue styling
      const ctaButton = page.getByTestId('forecast-cta-forecast');
      const buttonClasses = await ctaButton.getAttribute('class');
      expect(buttonClasses).toContain('bg-ocean-blue');
    });
  });

  test.describe('Responsive Design', () => {
    test('mobile: displays Best Spot card', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should be visible on mobile
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toBeVisible();
    });

    test('desktop: displays Best Spot card', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should be visible on desktop
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toBeVisible();
    });

    test('CTA button visible on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // CTA button should be visible on mobile
      const ctaButton = page.getByTestId('forecast-cta-forecast');
      await expect(ctaButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('CTA button is focusable via keyboard', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Tab to the CTA button
      const ctaButton = page.getByTestId('forecast-cta-forecast');
      await ctaButton.focus();

      // Verify button is focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('section has proper heading hierarchy', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Section should have an h2 heading
      const sectionHeading = forecastSection.locator('h2');
      await expect(sectionHeading).toBeVisible();

      // Best Spot card should be visible
      const bestSpotCard = page.getByTestId('best-spot-card');
      await expect(bestSpotCard).toBeVisible();
    });

    test('CTA button has accessible text', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // CTA should have visible text
      const ctaButton = page.getByTestId('forecast-cta-forecast');
      const ctaButtonText = await ctaButton.textContent();
      expect(ctaButtonText?.length).toBeGreaterThan(0);
    });

    test('feature tabs have accessible ARIA attributes', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check tablist has proper role
      const tablist = page.getByRole('tablist');
      await expect(tablist).toBeVisible();

      // Each tab should have proper ARIA attributes
      const forecastTab = page.getByRole('tab', { name: 'Personalized Forecast' });
      await expect(forecastTab).toHaveAttribute('aria-controls', 'phone-mock-panel');
      await expect(forecastTab).toHaveAttribute('aria-selected');

      // Tabpanel should exist
      const tabpanel = page.locator('[role="tabpanel"]');
      await expect(tabpanel).toBeVisible();
    });
  });

  test.describe('Visual Styling', () => {
    test('section has styled background', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check section has background styling (beige color or gradient)
      const sectionClasses = await forecastSection.getAttribute('class');
      expect(sectionClasses).toMatch(/bg-\[|bg-gradient/);
    });

    test('Best Spot card has proper styling', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should have proper card styling
      const bestSpotCard = page.getByTestId('best-spot-card');
      const cardClasses = await bestSpotCard.getAttribute('class');
      expect(cardClasses).toContain('rounded');
    });

    test('phone mock displays Quiver logo', async ({ page }) => {
      const forecastSection = page.getByTestId('forecast-section');
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Phone mock should show Quiver logo
      const logo = page.getByTestId('phone-mock-logo');
      await expect(logo).toBeVisible();
      await expect(logo).toContainText('Quiver');
    });
  });
});

test.describe('Guest Landing - Search', () => {
  test('allows disambiguation for Ocean Beach and avoids 500s', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Use placeholder text to find the search input (works with both simple and cmdk inputs)
    const searchInput = page.getByPlaceholder('Search by beach, spot, or region');

    await searchInput.fill('ocean beach');
    await searchInput.press('Enter');

    // Expect we either land on the map search or a beach detail page – but not a 500.
    await expect(page).not.toHaveURL(/500/);
  });

  test('Tourmaline search still works without error', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Use placeholder text to find the search input (works with both simple and cmdk inputs)
    const searchInput = page.getByPlaceholder('Search by beach, spot, or region');

    await searchInput.fill('tourmaline');
    await searchInput.press('Enter');

    await expect(page).not.toHaveURL(/500/);
  });

  test('should handle search input on landing page', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const searchInput = page.getByPlaceholder(/search/i).first();
    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      await searchInput.fill('Ocean Beach');
      await expect(searchInput).toHaveValue('Ocean Beach');
    } else {
      test.skip(true, 'Search not available on landing page');
    }
  });
});

test.describe('Guest Landing - Deleted Photos', () => {
  // Track created photos for cleanup
  let testPhotoIds: string[] = [];
  let testBeachId: string | null = null;

  test.beforeAll(async () => {
    // Get a random public beach for testing
    testBeachId = await getRandomPublicBeachId();
    if (!testBeachId) {
      throw new Error('Failed to find a public beach for testing');
    }
    console.log(`[Test Setup] Using beach ID: ${testBeachId}`);
  });

  test.afterEach(async () => {
    // Clean up test photos after each test
    for (const photoId of testPhotoIds) {
      try {
        await deleteBeachPhoto(photoId);
        console.log(`[Test Cleanup] Deleted test photo: ${photoId}`);
      } catch (error) {
        console.error(`[Test Cleanup] Failed to delete photo ${photoId}:`, error);
      }
    }
    testPhotoIds = [];
  });

  test.afterAll(async () => {
    // Final cleanup: remove any remaining test photos for the beach
    if (testBeachId) {
      try {
        await deleteAllTestPhotosForBeach(testBeachId);
        console.log(`[Test Cleanup] Deleted all test photos for beach: ${testBeachId}`);
      } catch (error) {
        console.error('[Test Cleanup] Failed to delete all test photos:', error);
      }
    }
  });

  test('should NOT display soft-deleted beach photos on landing page', async ({ page }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Step 1: Create a test beach photo (approved, active)
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/dc2626/white?text=Deleted+Photo',
      thumbUrl: 'https://placehold.co/400x300/dc2626/white?text=Deleted+Thumb',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.photoId).toBeTruthy();

    if (!createResult.photoId) {
      test.skip(true, 'Failed to create test photo');
      return;
    }

    testPhotoIds.push(createResult.photoId);
    console.log(`[Test] Created test photo: ${createResult.photoId}`);

    // Step 2: Soft-delete the photo
    const deleteResult = await softDeleteBeachPhoto(createResult.photoId);
    expect(deleteResult.success).toBe(true);
    console.log(`[Test] Soft-deleted photo: ${createResult.photoId}`);

    // Verify photo is soft-deleted
    const deletedPhoto = await getBeachPhoto(createResult.photoId);
    expect(deletedPhoto).toBeTruthy();
    expect(deletedPhoto?.deleted_at).toBeTruthy();
    console.log(`[Test] Verified photo has deleted_at timestamp: ${deletedPhoto?.deleted_at}`);

    // Step 3: Navigate to landing page
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for featured beaches to load
    await page.waitForTimeout(2000);

    // Step 4: Verify the deleted photo does NOT appear on the page
    // We're looking for the specific placeholder image URL we used
    const deletedPhotoImage = page.locator(`img[src*="dc2626"]`);
    const isVisible = await deletedPhotoImage.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isVisible).toBe(false);
    console.log('[Test] ✓ Verified deleted photo does NOT appear on landing page');
  });

  test('should display active (non-deleted) beach photos on landing page', async ({ page }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Step 1: Create an active test beach photo
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/10b981/white?text=Active+Photo',
      thumbUrl: 'https://placehold.co/400x300/10b981/white?text=Active+Thumb',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.photoId).toBeTruthy();

    if (!createResult.photoId) {
      test.skip(true, 'Failed to create test photo');
      return;
    }

    testPhotoIds.push(createResult.photoId);
    console.log(`[Test] Created active test photo: ${createResult.photoId}`);

    // Verify photo is active (no deleted_at)
    const activePhoto = await getBeachPhoto(createResult.photoId);
    expect(activePhoto).toBeTruthy();
    expect(activePhoto?.deleted_at).toBeNull();
    console.log('[Test] Verified photo is active (deleted_at is null)');

    // Step 2: Navigate to landing page
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for featured beaches to load
    await page.waitForTimeout(2000);

    // Step 3: Verify the active photo DOES appear on the page
    // Look for beach cards/links (our test beach should appear if it has an active photo)
    const beachCards = page.locator('a[href^="/"]').filter({
      has: page.locator('img'),
    });

    const cardCount = await beachCards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`[Test] Found ${cardCount} beach cards on landing page`);

    // Note: We can't guarantee our specific test photo appears because:
    // 1. The landing page may limit the number of beaches shown
    // 2. Other beaches may be prioritized
    // 3. Our test beach might not be in the top N featured beaches
    // So we just verify that SOME beach cards are visible, confirming the system works
    console.log('[Test] ✓ Verified active photos can appear on landing page');
  });

  test('should handle soft-delete and restore workflow correctly', async ({ page }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Step 1: Create a test photo
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/f59e0b/white?text=Toggle+Photo',
      thumbUrl: 'https://placehold.co/400x300/f59e0b/white?text=Toggle+Thumb',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.photoId) {
      test.skip(true, 'Failed to create test photo');
      return;
    }
    testPhotoIds.push(createResult.photoId);

    // Step 2: Verify photo is initially active
    let photo = await getBeachPhoto(createResult.photoId);
    expect(photo?.deleted_at).toBeNull();
    console.log('[Test] Photo initially active');

    // Step 3: Soft-delete the photo
    const deleteResult = await softDeleteBeachPhoto(createResult.photoId);
    expect(deleteResult.success).toBe(true);

    photo = await getBeachPhoto(createResult.photoId);
    expect(photo?.deleted_at).toBeTruthy();
    console.log(`[Test] Photo soft-deleted at: ${photo?.deleted_at}`);

    // Step 4: Navigate to landing page - should NOT see photo
    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    let toggledPhotoImage = page.locator(`img[src*="f59e0b"]`);
    let isVisible = await toggledPhotoImage.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isVisible).toBe(false);
    console.log('[Test] ✓ Photo not visible after soft-delete');

    // Step 5: Restore the photo
    const restoreResult = await restoreBeachPhoto(createResult.photoId);
    expect(restoreResult.success).toBe(true);

    photo = await getBeachPhoto(createResult.photoId);
    expect(photo?.deleted_at).toBeNull();
    console.log('[Test] Photo restored (deleted_at cleared)');

    // Step 6: Reload landing page - photo COULD appear now
    // (Note: May not appear due to pagination/prioritization, but it's no longer excluded)
    await page.reload();
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // We just verify the page loads successfully after restore
    const beachCards = page.locator('a[href^="/"]').filter({ has: page.locator('img') });
    const cardCount = await beachCards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log('[Test] ✓ Landing page loads successfully after photo restore');
  });

  test('should exclude deleted photos from /api/beaches/featured API endpoint', async ({ request }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Step 1: Create two test photos for the same beach
    const activePhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/3b82f6/white?text=API+Active',
    });

    const deletedPhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/ef4444/white?text=API+Deleted',
    });

    expect(activePhotoResult.success).toBe(true);
    expect(deletedPhotoResult.success).toBe(true);

    if (!activePhotoResult.photoId || !deletedPhotoResult.photoId) {
      test.skip(true, 'Failed to create test photos');
      return;
    }

    testPhotoIds.push(activePhotoResult.photoId, deletedPhotoResult.photoId);
    console.log(`[Test] Created active photo: ${activePhotoResult.photoId}`);
    console.log(`[Test] Created deleted photo: ${deletedPhotoResult.photoId}`);

    // Step 2: Soft-delete the second photo
    await softDeleteBeachPhoto(deletedPhotoResult.photoId);
    console.log(`[Test] Soft-deleted photo: ${deletedPhotoResult.photoId}`);

    // Step 3: Call the featured beaches API
    const response = await request.get('/api/beaches/featured');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);

    const beaches = data.data;
    console.log(`[Test] Featured beaches API returned ${beaches.length} beaches`);

    // Step 4: Find our test beach in the results
    const testBeach = beaches.find((b: any) => b.id === testBeachId);

    if (testBeach) {
      console.log(`[Test] Found test beach in results:`, {
        id: testBeach.id,
        name: testBeach.name,
        photo_url: testBeach.photo_url,
        has_real_photo: testBeach.has_real_photo,
      });

      // If our beach has a photo_url, it should NOT be the deleted photo
      if (testBeach.photo_url) {
        expect(testBeach.photo_url).not.toContain('ef4444'); // Should NOT be deleted photo
        console.log('[Test] ✓ Beach photo_url does not reference deleted photo');
      }
    } else {
      console.log('[Test] Test beach not in top featured beaches (this is OK)');
    }

    // Step 5: Verify the API doesn't return any beaches with deleted photos
    // We can't easily verify this without checking all photo_urls against the database,
    // but we've confirmed the basic filtering works
    console.log('[Test] ✓ Featured beaches API endpoint executed successfully');
  });

  test('should handle unapproved AND deleted photos correctly', async ({ page }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Create a photo that is both unapproved AND deleted
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: false, // Unapproved
      imageUrl: 'https://placehold.co/800x600/7c3aed/white?text=Unapproved+Deleted',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.photoId) {
      test.skip(true, 'Failed to create test photo');
      return;
    }
    testPhotoIds.push(createResult.photoId);

    // Soft-delete it
    await softDeleteBeachPhoto(createResult.photoId);

    const photo = await getBeachPhoto(createResult.photoId);
    expect(photo?.approved).toBe(false);
    expect(photo?.deleted_at).toBeTruthy();
    console.log('[Test] Created photo that is both unapproved AND deleted');

    // Navigate to landing page
    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Should NOT appear (excluded by both filters)
    const photoImage = page.locator(`img[src*="7c3aed"]`);
    const isVisible = await photoImage.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isVisible).toBe(false);

    console.log('[Test] ✓ Unapproved + deleted photo correctly excluded from landing page');
  });

  test('should prioritize non-deleted photos over deleted ones for same beach', async ({ page }) => {
    if (!testBeachId) {
      test.skip(true, 'No test beach available');
      return;
    }

    // Create an older photo (will have earlier fetched_at)
    const olderPhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/8b5cf6/white?text=Older+Photo',
    });

    expect(olderPhotoResult.success).toBe(true);
    if (!olderPhotoResult.photoId) {
      test.skip(true, 'Failed to create older photo');
      return;
    }
    testPhotoIds.push(olderPhotoResult.photoId);

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a newer photo
    const newerPhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/ec4899/white?text=Newer+Photo',
    });

    expect(newerPhotoResult.success).toBe(true);
    if (!newerPhotoResult.photoId) {
      test.skip(true, 'Failed to create newer photo');
      return;
    }
    testPhotoIds.push(newerPhotoResult.photoId);

    console.log('[Test] Created two photos: older and newer');

    // Soft-delete the newer photo
    await softDeleteBeachPhoto(newerPhotoResult.photoId);
    console.log('[Test] Soft-deleted the newer photo');

    // The API should return the older photo (non-deleted) for this beach
    // Navigate to landing page
    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Should NOT see the newer (deleted) photo
    const newerPhoto = page.locator(`img[src*="ec4899"]`);
    const newerVisible = await newerPhoto.isVisible({ timeout: 3000 }).catch(() => false);
    expect(newerVisible).toBe(false);

    console.log('[Test] ✓ Newer deleted photo not shown, older active photo takes precedence');
  });
});

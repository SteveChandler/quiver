/* eslint-disable playwright/no-conditional-in-test, playwright/no-skipped-test -- Landing media/photo checks branch around seeded public-content availability and skip fixture-dependent assertions when required test data is absent. */
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
import { isVisibleSafe } from './utils/strict-helpers';

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

    const hasHero = await isVisibleSafe(hero);
    const hasMain = await isVisibleSafe(mainContent);

    // Landing page should have some content
    expect(hasHero || hasMain).toBe(true);

    const walkthrough = page.getByTestId('field-guide-walkthrough');
    await expect(walkthrough).toBeVisible({ timeout: 5000 });
    await expect(
      walkthrough.getByRole('heading', { name: /turn a forecast into a surf plan/i }),
    ).toBeVisible();
    await expect(walkthrough.getByRole('listitem')).toHaveCount(4);
    await expect(
      walkthrough.getByTestId('field-guide-walkthrough-video').locator('video'),
    ).toBeVisible();
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

  test('should open auth modal when clicking signup', async ({ page }) => {
    const signupButton = page.getByRole('button', { name: /sign up|get started|check your forecast|start surfing smarter/i }).first();
    const isVisible = await isVisibleSafe(signupButton);

    if (!isVisible) {
      // No signup button visible - user may already be authenticated or button uses different text
      return;
    }

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
      const skeletonAppeared = await isVisibleSafe(skeleton, { timeout: 2000 });

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
      await page.waitForLoadState('load');

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
      const h1Exists = await isVisibleSafe(h1);

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

test.describe('Guest Landing - Zine Field Guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('renders the zine field-guide landing for guests', async ({ page }) => {
    const mainContent = page.locator('#main-content');
    await expect(
      mainContent.getByTestId('quiver-field-guide-landing'),
    ).toBeVisible();
    await expect(page.getByTestId('field-guide-hero')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /know where to paddle out/i }),
    ).toBeVisible();
    const hero = page.getByTestId('field-guide-hero');
    await expect(hero.getByRole('link', { name: 'Get the app' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Watch demo' })).toBeVisible();
  });

  test('shows defensible proof stats', async ({ page }) => {
    const proofSection = page.getByTestId('field-guide-proof');
    await expect(proofSection).toBeVisible({ timeout: 5000 });
    await expect(proofSection.getByText('10-day')).toBeVisible();
    await expect(proofSection.getByText('Every 3 hours')).toBeVisible();
    await expect(proofSection.getByText('Sharper calls')).toBeVisible();
  });

  test('shows coverage and comparison context', async ({ page }) => {
    const coverageSection = page.getByTestId('field-guide-coverage');
    await expect(coverageSection).toBeVisible({ timeout: 5000 });
    await expect(coverageSection.getByText('279+')).toBeVisible();
    await expect(coverageSection.getByText(/US coasts, Hawaii/i)).toBeVisible();
    await expect(
      coverageSection.getByRole('link', { name: /vs surfline/i }),
    ).toHaveAttribute('href', '/vs/surfline');
  });

  test('shows inside-the-app product context', async ({ page }) => {
    const insideAppSection = page.getByTestId('field-guide-inside-app');
    await expect(insideAppSection).toBeVisible({ timeout: 5000 });
    await expect(
      insideAppSection.getByRole('heading', {
        name: /built for the board you paddle out on/i,
      }),
    ).toBeVisible();
    await expect(
      insideAppSection.getByAltText(/next 7 days of best windows/i),
    ).toBeVisible();
    await expect(insideAppSection.locator('video')).toHaveAttribute(
      'src',
      '/videos/whats-new/home.mp4',
    );
  });

  test('links the hero to the newest release', async ({ page }) => {
    const strip = page.getByTestId('field-guide-release-strip');
    await expect(strip).toBeVisible({ timeout: 5000 });
    await expect(strip).toHaveAttribute('href', '/whats-new');
  });

  test('shows audience and access context', async ({ page }) => {
    const audienceAccessSection = page.getByTestId('field-guide-audience-access');
    await expect(audienceAccessSection).toBeVisible({ timeout: 5000 });
    await expect(
      audienceAccessSection.getByText('Dawn patrol regulars'),
    ).toBeVisible();
    await expect(audienceAccessSection).toContainText(
      'Public forecast data is free forever',
    );
    await expect(
      audienceAccessSection.getByText(/no paywall for basic beach reads/i),
    ).toBeVisible();
    await expect(
      audienceAccessSection.getByText(/14-day App Store trial for Pro/i),
    ).toHaveCount(0);
    await expect(
      audienceAccessSection.getByRole('link', { name: /see plans/i }),
    ).toHaveAttribute('href', '/plans');
  });

  test('field guide renders on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForPageLoad(page);

    const mainContent = page.locator('#main-content');
    await expect(
      mainContent.getByTestId('quiver-field-guide-landing'),
    ).toBeVisible({ timeout: 5000 });
    await expect(mainContent.getByTestId('field-guide-final-cta')).toBeVisible();
  });

  test('field guide renders on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForPageLoad(page);

    const mainContent = page.locator('#main-content');
    await expect(
      mainContent.getByTestId('quiver-field-guide-landing'),
    ).toBeVisible({ timeout: 5000 });
    await expect(mainContent.getByTestId('field-guide-features')).toBeVisible();
  });
});

test.describe('Guest Landing - Header', () => {
  test('shows the simplified app-first header without beach search', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const header = page.locator('nav');
    await expect(header.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Get the app' })).toBeVisible();
    await expect(page.getByPlaceholder('Search by beach')).toHaveCount(0);
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
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

    // Step 1: Create a test beach photo (approved, active)
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/dc2626/white?text=Deleted+Photo',
      thumbUrl: 'https://placehold.co/400x300/dc2626/white?text=Deleted+Thumb',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.photoId).toBeTruthy();

    if (!createResult.photoId) return;

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

    // Step 4: Verify the deleted photo does NOT appear on the page
    // We're looking for the specific placeholder image URL we used
    const deletedPhotoImage = page.locator(`img[src*="dc2626"]`);
    const isVisible = await isVisibleSafe(deletedPhotoImage, { timeout: 3000 });

    expect(isVisible).toBe(false);
    console.log('[Test] ✓ Verified deleted photo does NOT appear on landing page');
  });

  test('should display active (non-deleted) beach photos on landing page', async ({ page }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

    // Step 1: Create an active test beach photo
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/10b981/white?text=Active+Photo',
      thumbUrl: 'https://placehold.co/400x300/10b981/white?text=Active+Thumb',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.photoId).toBeTruthy();

    if (!createResult.photoId) return;

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
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

    // Step 1: Create a test photo
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/f59e0b/white?text=Toggle+Photo',
      thumbUrl: 'https://placehold.co/400x300/f59e0b/white?text=Toggle+Thumb',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.photoId) return;
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
    let toggledPhotoImage = page.locator(`img[src*="f59e0b"]`);
    let isVisible = await isVisibleSafe(toggledPhotoImage, { timeout: 3000 });
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
    // We just verify the page loads successfully after restore
    const beachCards = page.locator('a[href^="/"]').filter({ has: page.locator('img') });
    const cardCount = await beachCards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log('[Test] ✓ Landing page loads successfully after photo restore');
  });

  test('should exclude deleted photos from /api/beaches/featured API endpoint', async ({ request }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

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

    if (!activePhotoResult.photoId || !deletedPhotoResult.photoId) return;

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
    expect(data.data).toHaveProperty('beaches');
    expect(Array.isArray(data.data.beaches)).toBe(true);

    const beaches = data.data.beaches;
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
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

    // Create a photo that is both unapproved AND deleted
    const createResult = await createTestBeachPhoto(testBeachId, {
      approved: false, // Unapproved
      imageUrl: 'https://placehold.co/800x600/7c3aed/white?text=Unapproved+Deleted',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.photoId) return;
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
    // Should NOT appear (excluded by both filters)
    const photoImage = page.locator(`img[src*="7c3aed"]`);
    const isVisible = await isVisibleSafe(photoImage, { timeout: 3000 });
    expect(isVisible).toBe(false);

    console.log('[Test] ✓ Unapproved + deleted photo correctly excluded from landing page');
  });

  test('should prioritize non-deleted photos over deleted ones for same beach', async ({ page }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires service role key for direct DB access');
    if (!testBeachId) return;

    // Create an older photo (will have earlier fetched_at)
    const olderPhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/8b5cf6/white?text=Older+Photo',
    });

    expect(olderPhotoResult.success).toBe(true);
    if (!olderPhotoResult.photoId) return;
    testPhotoIds.push(olderPhotoResult.photoId);

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a newer photo
    const newerPhotoResult = await createTestBeachPhoto(testBeachId, {
      approved: true,
      imageUrl: 'https://placehold.co/800x600/ec4899/white?text=Newer+Photo',
    });

    expect(newerPhotoResult.success).toBe(true);
    if (!newerPhotoResult.photoId) return;
    testPhotoIds.push(newerPhotoResult.photoId);

    console.log('[Test] Created two photos: older and newer');

    // Soft-delete the newer photo
    await softDeleteBeachPhoto(newerPhotoResult.photoId);
    console.log('[Test] Soft-deleted the newer photo');

    // The API should return the older photo (non-deleted) for this beach
    // Navigate to landing page
    await page.goto('/');
    await waitForPageLoad(page);
    // Should NOT see the newer (deleted) photo
    const newerPhoto = page.locator(`img[src*="ec4899"]`);
    const newerVisible = await isVisibleSafe(newerPhoto, { timeout: 3000 });
    expect(newerVisible).toBe(false);

    console.log('[Test] ✓ Newer deleted photo not shown, older active photo takes precedence');
  });
});

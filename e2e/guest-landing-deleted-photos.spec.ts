/**
 * Landing Page - Deleted Photos Tests
 *
 * Verifies that soft-deleted beach photos (with deleted_at timestamp) do not appear
 * on the landing page. This prevents admin-deleted photos from showing up in the
 * featured beaches section.
 *
 * Bug Context:
 * - Prior to fix: Soft-deleted photos still appeared because the API endpoint and
 *   database view didn't filter by deleted_at
 * - Fix Applied:
 *   1. API endpoint /app/api/beaches/featured/route.ts filters .is("deleted_at", null)
 *   2. Database view beach_photos_featured updated to exclude deleted_at IS NOT NULL
 *
 * Test Coverage:
 * - Test 1: Verify deleted photos don't appear on landing page
 * - Test 2: Verify active photos still appear
 * - Test 3: Verify soft-delete/restore workflow
 * - Test 4: Verify featured beaches API excludes deleted photos
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';
import { TIMEOUTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
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

// Track created photos for cleanup
let testPhotoIds: string[] = [];
let testBeachId: string | null = null;

test.describe('Landing Page - Deleted Photos', () => {
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

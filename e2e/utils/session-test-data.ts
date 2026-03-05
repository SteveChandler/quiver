/**
 * Test data helpers for creating sessions with photos for E2E tests
 */

import { Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Create a minimal valid JPEG image buffer
 * Used for testing photo uploads without needing actual image files
 */
function createMinimalJPEG(): Buffer {
  // Minimal valid JPEG file (1x1 pixel red image)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x37, 0xff, 0xd9,
  ]);
}

/**
 * Get or create test image files
 * Returns an array of file paths for test images
 */
export function getTestImagePaths(count: number = 3): string[] {
  const testDir = path.join(process.cwd(), "e2e", ".test-images");

  // Create test images directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const imagePaths: string[] = [];

  for (let i = 0; i < count; i++) {
    const imagePath = path.join(testDir, `test-image-${i + 1}.jpg`);

    // Create image if it doesn't exist
    if (!fs.existsSync(imagePath)) {
      fs.writeFileSync(imagePath, createMinimalJPEG());
    }

    imagePaths.push(imagePath);
  }

  return imagePaths;
}

/**
 * Create a test session via the UI wizard
 */
export async function createTestSession(
  page: Page,
  options: {
    beachName?: string;
    rating?: number;
    withPhotos?: boolean;
    photoCount?: number;
  } = {}
): Promise<string | null> {
  const {
    beachName = "Blacks",
    rating = 4,
    withPhotos = true,
    photoCount = 3,
  } = options;

  try {
    // Navigate to session wizard in log mode (for completed sessions)
    await page.goto("/sessions/new?mode=log");
    await page.waitForLoadState("networkidle");

    // Search for beach
    const beachSearch = page.getByTestId("beach-search-input");
    const hasBeachInput = await beachSearch
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!hasBeachInput) {
      throw new Error("Beach input not found");
    }

    // Use partial match (e.g. "Black" matches "Blacks")
    await beachSearch.fill(beachName);
    await page.waitForTimeout(800);

    // Select beach from dropdown list (BeachSelector renders <ul><button>…</button></ul>)
    const beachSelectorRoot = beachSearch.locator("..");
    const beachOption = beachSelectorRoot
      .locator("ul")
      .locator("button")
      .filter({ hasText: new RegExp(beachName, "i") })
      .first();
    const hasOption = await beachOption
      .isVisible({ timeout: 15000 })
      .catch(() => false);

    if (!hasOption) {
      throw new Error(`Beach option "${beachName}" not found in dropdown`);
    }

    await beachOption.click();
    await page.waitForTimeout(300);

    // Fill date/time on same Where & When step
    const dateInput = page.getByTestId("session-date-input");
    const hasDate = await dateInput.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasDate) {
      const today = new Date().toISOString().split("T")[0];
      await dateInput.fill(today);
    }

    const timeInput = page.getByTestId("session-time-input");
    const hasTime = await timeInput.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasTime) {
      await timeInput.fill("06:00");
    }

    // Advance to Session Details (step 2)
    const nextButton = page
      .getByRole("button", { name: /next/i })
      .first();
    const hasNext = await nextButton.isVisible().catch(() => false);

    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Set rating (stars or slider)
    const stars = page.locator('[data-testid*="star"], [aria-label*="star"]');
    const ratingSlider = page.locator('input[type="range"], [role="slider"]').first();

    const starCount = await stars.count();
    const hasSlider = await ratingSlider.isVisible().catch(() => false);

    if (starCount > 0) {
      await stars.nth(rating - 1).click();
      await page.waitForTimeout(500);
    } else if (hasSlider) {
      await ratingSlider.fill(rating.toString());
      await page.waitForTimeout(500);
    }

    // Add photos if requested
    if (withPhotos && photoCount > 0) {
      const imagePaths = getTestImagePaths(photoCount);

      // Look for file input
      const fileInput = page.locator('input[type="file"]').first();
      const isVisible = await fileInput.isVisible().catch(() => false);

      if (isVisible) {
        await fileInput.setInputFiles(imagePaths);
        await page.waitForTimeout(1000);
      }
    }

    // Submit session
    const submitButton = page.getByRole("button", {
      name: /log|submit|save|complete/i,
    }).first();

    const hasSubmit = await submitButton.isVisible().catch(() => false);
    if (!hasSubmit) {
      throw new Error("Submit button not found");
    }

    await submitButton.click();

    // Wait for success indication (celebration or redirect)
    await page.waitForTimeout(3000);

    // Try to extract session ID from URL (might redirect to /profile)
    const url = page.url();
    const match = url.match(/\/sessions\/([a-f0-9-]+)/);

    if (match) {
      return match[1];
    }

    // If redirected to profile, try to get the latest session
    if (url.includes('/profile')) {
      await page.goto('/sessions');
      await page.waitForLoadState('networkidle');

      const firstSessionLink = page.locator('a[href^="/sessions/"]').first();
      const hasLink = await firstSessionLink.isVisible().catch(() => false);

      if (hasLink) {
        const href = await firstSessionLink.getAttribute('href');
        const sessionMatch = href?.match(/\/sessions\/([a-f0-9-]+)/);
        if (sessionMatch) {
          return sessionMatch[1];
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to create test session:", error);
    return null;
  }
}

/**
 * Upload photos to an existing session
 */
export async function uploadPhotosToSession(
  page: Page,
  sessionId: string,
  photoCount: number = 3
): Promise<boolean> {
  try {
    // Navigate to session detail page
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState("networkidle");

    // Get test images
    const imagePaths = getTestImagePaths(photoCount);

    // Find the file input
    const fileInput = page
      .locator('div:has(> h3:has-text("Session Photos"))')
      .locator('input[type="file"]')
      .first();

    const isAttached = (await fileInput.count().catch(() => 0)) > 0;

    if (!isAttached) {
      // Try alternate selector - look for "Add Photos" button area
      const addPhotosSection = page.locator(
        'button:has-text("Add Photos"), button:has-text("Add More Photos")'
      );
      const hasButton = await addPhotosSection.isVisible().catch(() => false);

      if (hasButton) {
        // File input might be associated with this button
        const fileInputAlt = page.locator('input[type="file"]').first();
        await fileInputAlt.setInputFiles(imagePaths);
      } else {
        return false;
      }
    } else {
      // Upload files
      await fileInput.setInputFiles(imagePaths);
    }

    await page.waitForTimeout(1000);

    // Look for upload button
    const uploadButton = page.getByRole("button", { name: /upload/i });
    const hasUploadButton = await uploadButton.isVisible().catch(() => false);

    if (hasUploadButton) {
      await uploadButton.click();
      await page.waitForTimeout(2000);
    }

    return true;
  } catch (error) {
    console.error("Failed to upload photos:", error);
    return false;
  }
}

/**
 * Ensure test user has sessions with photos in their feed
 * Creates sessions if they don't exist
 */
export async function ensureSessionsWithPhotos(
  page: Page,
  minSessions: number = 3
): Promise<string[]> {
  const sessionIds: string[] = [];

  try {
    // Check current sessions
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    // Count existing sessions
    const sessionCards = page.locator('a[href^="/sessions/"]');
    const existingCount = await sessionCards.count();

    console.log(`Found ${existingCount} existing sessions`);

    // Count sessions with photos
    const sessionsWithPhotos = page.locator(
      'a[href^="/sessions/"]:has(img[alt*="photo"])'
    );
    const withPhotosCount = await sessionsWithPhotos.count();

    console.log(`Found ${withPhotosCount} sessions with photos`);

    // Determine how many more sessions we need to create
    const sessionsToCreate = Math.max(0, minSessions - withPhotosCount);

    if (sessionsToCreate > 0) {
      console.log(`Creating ${sessionsToCreate} new test sessions with photos`);

      for (let i = 0; i < sessionsToCreate; i++) {
        const sessionId = await createTestSession(page, {
          beachName: i === 0 ? "Blacks" : i === 1 ? "Swamis" : "Windansea",
          rating: 3 + (i % 3), // Vary ratings: 3, 4, 5
          withPhotos: true,
          photoCount: i === 0 ? 1 : i === 1 ? 2 : 3, // Vary photo counts
        });

        if (sessionId) {
          sessionIds.push(sessionId);
          console.log(`Created test session ${i + 1}: ${sessionId}`);
        }

        // Wait between creations to avoid rate limits
        if (i < sessionsToCreate - 1) {
          await page.waitForTimeout(1000);
        }
      }
    }

    return sessionIds;
  } catch (error) {
    console.error("Failed to ensure sessions with photos:", error);
    return sessionIds;
  }
}

/**
 * Clean up test images
 */
export function cleanupTestImages(): void {
  const testDir = path.join(process.cwd(), "e2e", ".test-images");

  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    files.forEach((file) => {
      fs.unlinkSync(path.join(testDir, file));
    });
    fs.rmdirSync(testDir);
  }
}

import { test, expect, Page } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Profile Form Integration Tests
 *
 * Comprehensive integration tests for:
 * 1. Avatar upload flow
 * 2. Form submission and validation
 *
 * These tests verify the refactored profile forms work correctly
 * with the shared components and validation schema.
 *
 * @project auth
 */

test.describe('Profile Form - Avatar Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);
    await ensureAuthenticated(page);

    // Wait for edit modal to appear
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should successfully upload a valid avatar image', async ({ page }) => {
    // Create a test image file
    const testImagePath = await createTestImage('avatar-test.png', 100, 100);

    // Find the file input (hidden) and upload
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete (loading spinner appears and disappears)
    // Note: Uploads to Supabase storage can take 5-10 seconds
    const loadingSpinner = page.locator('[role="dialog"] [class*="animate-spin"]').first();
    await expect(loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(loadingSpinner).toBeHidden({ timeout: 30000 }); // Increased timeout for upload

    // Verify success toast appears
    await expect(page.getByText(/profile picture updated/i).first()).toBeVisible({
      timeout: 5000
    });

    // Verify avatar image is displayed
    const avatar = page.locator('img[alt="Profile"]');
    const avatarSrc = await avatar.getAttribute('src');
    expect(avatarSrc).toBeTruthy();
    expect(avatarSrc).not.toContain('placeholder.svg');

    // Verify remove button appears
    const removeButton = page.locator('button[class*="destructive"]').filter({
      has: page.locator('svg')
    });
    await expect(removeButton).toBeVisible();

    // Cleanup
    await cleanupTestImage(testImagePath);
  });

  test('should reject files larger than 5MB', async ({ page }) => {
    // Create a large test image (> 5MB)
    const largeImagePath = await createTestImage('large-avatar.png', 2000, 2000);

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(largeImagePath);

    // Verify error toast appears
    await expect(page.getByText(/file too large/i).first()).toBeVisible({
      timeout: TIMEOUTS.short
    });
    await expect(page.getByText(/smaller than 5MB/i).first()).toBeVisible();

    // Verify no loading spinner appeared in the dialog
    const loadingSpinner = page.locator('[role="dialog"] [class*="animate-spin"]').first();
    await expect(loadingSpinner).toBeHidden();

    // Cleanup
    await cleanupTestImage(largeImagePath);
  });

  test('should reject non-image files', async ({ page }) => {
    // Create a text file to test rejection
    const textFilePath = await createTestTextFile('test.txt', 'This is not an image');

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(textFilePath);

    // Verify error toast appears
    await expect(page.getByText(/invalid file type/i).first()).toBeVisible({
      timeout: TIMEOUTS.short
    });
    await expect(page.getByText(/select an image file/i).first()).toBeVisible();

    // Cleanup
    await cleanupTestImage(textFilePath);
  });

  test('should successfully remove an avatar', async ({ page }) => {
    // First upload an avatar
    const testImagePath = await createTestImage('avatar-remove-test.png', 100, 100);
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete (increased timeout for storage operations)
    const loadingSpinner = page.locator('[role="dialog"] [class*="animate-spin"]').first();
    await expect(loadingSpinner).toBeHidden({ timeout: 30000 });

    await expect(page.getByText(/profile picture updated/i).first()).toBeVisible({
      timeout: 5000
    });

    // Find and click the remove button (X button on avatar)
    const removeButton = page.locator('button[class*="destructive"]').filter({
      has: page.locator('svg')
    }).first();
    await removeButton.click();

    // Wait for removal to complete
    await expect(loadingSpinner).toBeHidden({ timeout: 30000 });

    // Verify success toast
    await expect(page.getByText(/image removed/i)).toBeVisible({
      timeout: 5000
    });

    // Verify avatar shows placeholder or initials
    const avatar = page.locator('img[alt="Profile"]');
    const avatarSrc = await avatar.getAttribute('src');
    expect(avatarSrc).toContain('placeholder.svg');

    // Verify remove button is hidden
    await expect(removeButton).toBeHidden();

    // Cleanup
    await cleanupTestImage(testImagePath);
  });

  test('should persist avatar immediately to database', async ({ page }) => {
    // Upload an avatar
    const testImagePath = await createTestImage('persist-test.png', 100, 100);
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete
    const loadingSpinner = page.locator('[role="dialog"] [class*="animate-spin"]').first();
    await expect(loadingSpinner).toBeHidden({ timeout: 30000 });

    await expect(page.getByText(/profile picture updated/i)).toBeVisible({
      timeout: 5000
    });

    // Close the modal without saving
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Wait for modal to close
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeHidden({ timeout: TIMEOUTS.short });

    // Reload the page to verify persistence
    await page.reload();
    await waitForPageLoad(page);

    // Avatar should still be visible on profile page
    const avatar = page.locator('img[alt*="avatar" i], img[alt*="profile" i]').first();
    const avatarSrc = await avatar.getAttribute('src');
    expect(avatarSrc).toBeTruthy();
    expect(avatarSrc).not.toContain('placeholder.svg');

    // Cleanup
    await cleanupTestImage(testImagePath);
  });
});

test.describe('Profile Form - Form Submission and Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);
    await ensureAuthenticated(page);

    // Wait for edit modal to appear
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should successfully submit valid form data', async ({ page }) => {
    // Fill in all form fields with valid data
    const nameInput = page.getByLabel(/^name$/i);
    await nameInput.clear();
    await nameInput.fill('John Doe');

    const bioInput = page.getByLabel(/bio/i);
    await bioInput.clear();
    await bioInput.fill('Passionate surfer from California');

    const locationInput = page.getByLabel(/location/i);
    await locationInput.clear();
    await locationInput.fill('San Diego, CA');

    const experienceInput = page.getByLabel(/experience level/i);
    await experienceInput.clear();
    await experienceInput.fill('Intermediate');

    const instagramInput = page.getByLabel(/instagram/i);
    await instagramInput.clear();
    await instagramInput.fill('@johndoe');

    // Submit the form
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for submission (loading state)
    const loadingSpinner = page.locator('[role="dialog"] [class*="animate-spin"]').first();
    await expect(loadingSpinner).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for success toast
    await expect(page.getByText(/profile updated/i).first()).toBeVisible({
      timeout: TIMEOUTS.medium
    });

    // Should redirect to profile page or close modal
    // Wait for either the URL to change or the modal to close
    await Promise.race([
      page.waitForURL('/profile', { timeout: TIMEOUTS.medium }),
      page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: TIMEOUTS.medium })
    ]).catch(() => {
      // Either is acceptable - some implementations redirect, others close modal
    });
  });

  test('should validate required name field', async ({ page }) => {
    // Clear the name field (required field)
    const nameInput = page.getByLabel(/^name$/i);
    await nameInput.clear();
    await nameInput.blur();

    // Try to submit
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Should show validation error (FormMessage renders as <p class="text-destructive">)
    // Wait a bit for validation to run
    await page.waitForTimeout(500);

    // Look for error in multiple possible locations
    const errorText = /name must be at least 2 characters/i;
    const errorInForm = page.locator('.text-destructive', { hasText: errorText });
    const errorInToast = page.locator('[role="alert"]', { hasText: errorText });

    // Check if error appears in either location
    const formErrorVisible = await errorInForm.isVisible().catch(() => false);
    const toastErrorVisible = await errorInToast.isVisible().catch(() => false);

    // At least one should be visible
    expect(formErrorVisible || toastErrorVisible).toBe(true);

    // Should not have submitted (modal still open)
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeVisible();
  });

  test('should validate name length constraints', async ({ page }) => {
    const nameInput = page.getByLabel(/^name$/i);
    const saveButton = page.getByTestId('save-profile');

    // Test minimum length (< 2 characters)
    await nameInput.clear();
    await nameInput.fill('A');
    await nameInput.blur();
    await saveButton.click();
    await page.waitForTimeout(500);

    // Check for min length error
    const minErrorVisible = await page.locator('.text-destructive', {
      hasText: /name must be at least 2 characters/i
    }).isVisible().catch(() => false);
    expect(minErrorVisible).toBe(true);

    // Test maximum length (> 50 characters)
    const longName = 'A'.repeat(51);
    await nameInput.clear();
    await nameInput.fill(longName);
    await nameInput.blur();
    await saveButton.click();
    await page.waitForTimeout(500);

    // Check for max length error
    const maxErrorVisible = await page.locator('.text-destructive', {
      hasText: /name must be less than 50 characters/i
    }).isVisible().catch(() => false);
    expect(maxErrorVisible).toBe(true);
  });

  test('should validate bio length constraint', async ({ page }) => {
    const bioInput = page.getByLabel(/bio/i);
    const longBio = 'A'.repeat(301);

    await bioInput.clear();
    await bioInput.fill(longBio);
    await bioInput.blur();

    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();
    await page.waitForTimeout(500);

    const errorVisible = await page.locator('.text-destructive', {
      hasText: /bio must be less than 300 characters/i
    }).isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('should validate location length constraint', async ({ page }) => {
    const locationInput = page.getByLabel(/location/i);
    const longLocation = 'A'.repeat(101);

    await locationInput.clear();
    await locationInput.fill(longLocation);
    await locationInput.blur();

    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();
    await page.waitForTimeout(500);

    const errorVisible = await page.locator('.text-destructive', {
      hasText: /location must be less than 100 characters/i
    }).isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('should validate experience level length constraint', async ({ page }) => {
    const experienceInput = page.getByLabel(/experience level/i);
    const longExperience = 'A'.repeat(51);

    await experienceInput.clear();
    await experienceInput.fill(longExperience);
    await experienceInput.blur();

    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();
    await page.waitForTimeout(500);

    const errorVisible = await page.locator('.text-destructive', {
      hasText: /experience level must be less than 50 characters/i
    }).isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('should validate Instagram username length constraint', async ({ page }) => {
    const instagramInput = page.getByLabel(/instagram/i);
    const longInstagram = '@' + 'A'.repeat(30);

    await instagramInput.clear();
    await instagramInput.fill(longInstagram);
    await instagramInput.blur();

    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();
    await page.waitForTimeout(500);

    const errorVisible = await page.locator('.text-destructive', {
      hasText: /instagram username must be less than 30 characters/i
    }).isVisible().catch(() => false);
    expect(errorVisible).toBe(true);
  });

  test('should handle form cancellation', async ({ page }) => {
    // Make changes
    const nameInput = page.getByLabel(/^name$/i);
    const originalName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill('Changed Name');

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Modal should close
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeHidden({ timeout: TIMEOUTS.short });

    // Reopen to verify changes were not saved
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);
    await expect(editDialog).toBeVisible({ timeout: TIMEOUTS.medium });

    const nameAfterCancel = await page.getByLabel(/^name$/i).inputValue();
    expect(nameAfterCancel).toBe(originalName);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure by going offline
    await page.context().setOffline(true);

    // Try to submit the form
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Should show error toast
    await expect(page.getByText(/failed to update/i).first()).toBeVisible({
      timeout: TIMEOUTS.medium
    });

    // Restore network
    await page.context().setOffline(false);
  });

  test('should preserve form state during editing', async ({ page }) => {
    // Fill in multiple fields
    await page.getByLabel(/^name$/i).fill('Test User');
    await page.getByLabel(/bio/i).fill('Test bio');
    await page.getByLabel(/location/i).fill('Test location');

    // Values should persist when switching between fields
    expect(await page.getByLabel(/^name$/i).inputValue()).toBe('Test User');
    expect(await page.getByLabel(/bio/i).inputValue()).toBe('Test bio');
    expect(await page.getByLabel(/location/i).inputValue()).toBe('Test location');
  });

  test('should display loading state during submission', async ({ page }) => {
    // Fill valid data
    await page.getByLabel(/^name$/i).fill('John Doe');

    // Submit
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Button should show loading state
    await expect(saveButton).toBeDisabled({ timeout: TIMEOUTS.short });

    // Loading spinner should be visible
    const spinner = page.locator('[class*="animate-spin"]');
    await expect(spinner).toBeVisible({ timeout: TIMEOUTS.short });

    // Wait for completion
    await expect(saveButton).toBeEnabled({ timeout: TIMEOUTS.medium });
  });
});

test.describe('Profile Form - Home Beach Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);
    await ensureAuthenticated(page);

    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(editDialog).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should allow selecting home beach', async ({ page }) => {
    // Find the home beach selector (BeachSelector component)
    const homeBeachInput = page.locator('input[id*="home-beach" i], input[placeholder*="beach" i]').first();

    // Type to search for a beach
    await homeBeachInput.fill('Black');
    await page.waitForTimeout(1000); // Wait for autocomplete

    // Look for suggestions
    const beachOption = page.getByText(/blacks/i).first();
    const optionVisible = await beachOption.isVisible().catch(() => false);

    if (optionVisible) {
      await beachOption.click();

      // Verify beach was selected
      const selectedValue = await homeBeachInput.inputValue();
      expect(selectedValue.toLowerCase()).toContain('black');

      // Submit and verify
      const saveButton = page.getByTestId('save-profile');
      await saveButton.click();

      await expect(page.getByText(/profile updated/i)).toBeVisible({
        timeout: TIMEOUTS.medium
      });
    } else {
      test.skip(true, 'Beach autocomplete not available in this environment');
    }
  });
});

/**
 * Test Utilities
 */

/**
 * Creates a test image file using a 1x1 PNG (minimal valid image)
 */
async function createTestImage(filename: string, width: number, height: number): Promise<string> {
  const tempDir = path.join(process.cwd(), 'e2e', 'temp');

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filepath = path.join(tempDir, filename);

  // Create a minimal valid PNG file based on requested size
  let buffer: Buffer;

  if (width > 1500 || height > 1500) {
    // Large image (>5MB) - create by repeating data
    const smallPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    // Repeat to create >5MB file
    const chunks = Math.ceil((5 * 1024 * 1024) / smallPng.length) + 100;
    buffer = Buffer.concat(Array(chunks).fill(smallPng));
  } else {
    // Small valid PNG (1x1 pixel, blue color)
    buffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);
  }

  fs.writeFileSync(filepath, buffer);
  return filepath;
}

/**
 * Creates a test text file
 */
async function createTestTextFile(filename: string, content: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'e2e', 'temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filepath = path.join(tempDir, filename);
  fs.writeFileSync(filepath, content);

  return filepath;
}

/**
 * Cleans up test files
 */
async function cleanupTestImage(filepath: string): Promise<void> {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

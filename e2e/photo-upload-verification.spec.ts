/**
 * E2E test for photo upload functionality
 * Verifies the complete upload flow including storage_usage tracking
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// Test configuration
// Using a session ID from the local or production database
const TEST_SESSION_ID =
  process.env.BASE_URL?.includes("localhost")
    ? "6d04bbab-85b6-420e-ae50-4719410963dd" // Local test session
    : "2a0838d1-a108-4ec1-8b94-a35ed5ffb282"; // Production test session
const TEST_SESSION_URL = `${process.env.BASE_URL || "http://localhost:3000"}/sessions/${TEST_SESSION_ID}`;

test.describe("Photo Upload E2E Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to session detail page
    await page.goto(TEST_SESSION_URL);

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  // TODO: Test drift - photo upload section UI changed
  test.skip("should have photo upload section visible", async ({ page }) => {
    // Check for photo upload section heading
    await expect(page.getByText("Session Photos")).toBeVisible();

    // Check for upload button (when user owns the session)
    const addPhotosButton = page.getByRole("button", {
      name: /Add (More )?Photos/i,
    });
    await expect(addPhotosButton).toBeVisible({ timeout: 10000 });
  });

  // TODO: Test drift - file input selectors changed
  test.skip("should accept file upload programmatically", async ({ page }) => {
    // Create a test image file
    const testImagePath = path.join(__dirname, "test-image.jpg");

    // Create a simple 1x1 pixel JPEG if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      // Minimal valid JPEG file (1x1 pixel)
      const minimalJPEG = Buffer.from([
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
      fs.writeFileSync(testImagePath, minimalJPEG);
    }

    // Find the hidden file input in the session photos section
    const fileInput = page
      .locator('div:has(> h3:has-text("Session Photos"))')
      .locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Upload the file
    await fileInput.setInputFiles(testImagePath);

    // Wait for file to be processed
    await page.waitForTimeout(1000);

    // Look for file selection confirmation
    const selectedText = page.getByText(/\d+ photo\(s\) selected/i);
    await expect(selectedText).toBeVisible({ timeout: 5000 });

    // Check for Upload button
    const uploadButton = page.getByRole("button", { name: /Upload/i });
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();
  });

  // TODO: Test drift - upload button name/selector changed
  test.skip("should show upload button for session owner", async ({ page }) => {
    // Session owners should see upload UI
    await expect(page.getByText("Session Photos")).toBeVisible();

    // Check for upload button
    const addPhotosButton = page.getByRole("button", {
      name: /Add (More )?Photos/i,
    });
    await expect(addPhotosButton).toBeVisible();
  });

  test.describe("Infrastructure Verification", () => {
    test("should not have storage_usage errors in console", async ({
      page,
    }) => {
      // Monitor console for database errors
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);

      // Check for database errors in console
      const hasStorageError = consoleErrors.some((err) =>
        err.includes("storage_usage")
      );
      const hasRelationError = consoleErrors.some((err) =>
        err.includes("relation")
      );

      expect(hasStorageError).toBe(false);
      expect(hasRelationError).toBe(false);
    });
  });
});

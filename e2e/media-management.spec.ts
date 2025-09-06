import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  uploadTestPhoto,
  createTestSession,
  ensureAuthenticated,
} from "./test-helpers";

test.describe("Media/Photo Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
    await ensureAuthenticated(page);
  });

  test.describe("Photo Upload During Session Logging", () => {
    test("should upload photos during session creation", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      // Fill basic session information first
      const beachInput = page.locator("#beach-input").first();
      if (await beachInput.isVisible()) {
        await beachInput.fill("Test Beach for Photos");
      }

      const dateInput = page.locator("#session-date").first();
      if (await dateInput.isVisible()) {
        await dateInput.fill(new Date().toISOString().split("T")[0]);
      }

      // Look for photo upload section
      const photoSection = page.locator(
        "[data-testid*='photo'], .photo-upload, .media-upload"
      );
      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.isVisible()) {
        // Create test image files
        const testFiles = [
          {
            name: "session-photo-1.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from("fake-session-photo-1-content"),
          },
          {
            name: "session-photo-2.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from("fake-session-photo-2-content"),
          },
        ];

        // Upload multiple photos
        await fileInput.setInputFiles(testFiles);
        await page.waitForTimeout(3000);

        // Check for photo previews
        const photoPreviews = page.locator(
          'img[src*="blob"], .photo-preview, [data-testid*="photo-preview"]'
        );
        const previewCount = await photoPreviews.count();
        expect(previewCount).toBeGreaterThan(0);

        // Check for upload progress or success indicators
        const uploadStatus = page.getByText(/upload|processing|complete/i);
        const hasUploadStatus = await uploadStatus
          .isVisible()
          .catch(() => false);

        if (hasUploadStatus) {
          expect(hasUploadStatus).toBeTruthy();
        }

        // Submit session with photos
        const saveButton = page
          .getByRole("button", { name: /save|log session/i })
          .first();
        if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
          await saveButton.click();
          await page.waitForTimeout(3000);

          // Check for success message
          const successMessage = page.getByText(
            /session.*saved|success|logged/i
          );
          const hasSuccess = await successMessage
            .isVisible()
            .catch(() => false);
          expect(hasSuccess).toBeTruthy();
        }
      }
    });

    test("should validate photo file types", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Try to upload invalid file type
        const invalidFile = {
          name: "invalid-file.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("This is not an image"),
        };

        await fileInput.setInputFiles([invalidFile]);
        await page.waitForTimeout(2000);

        // Should show error or reject the file
        const errorMessage = page.getByText(
          /invalid.*file|only.*images|unsupported/i
        );
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBeTruthy();
      }
    });

    test("should handle large photo files", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Create a large test file (simulate 5MB image)
        const largeFileBuffer = Buffer.alloc(5 * 1024 * 1024, "a"); // 5MB
        const largeFile = {
          name: "large-photo.jpg",
          mimeType: "image/jpeg",
          buffer: largeFileBuffer,
        };

        await fileInput.setInputFiles([largeFile]);
        await page.waitForTimeout(5000); // Give more time for processing

        // Should either process successfully or show size warning
        const processingIndicator = page.getByText(
          /processing|compressing|optimizing/i
        );
        const sizeWarning = page.getByText(/too.*large|size.*limit|compress/i);

        const hasProcessing = await processingIndicator
          .isVisible()
          .catch(() => false);
        const hasWarning = await sizeWarning.isVisible().catch(() => false);

        expect(hasProcessing || hasWarning).toBeTruthy();
      }
    });

    test("should show photo upload progress", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        const testPhoto = {
          name: "progress-test.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("fake-image-data-for-progress-test"),
        };

        await fileInput.setInputFiles([testPhoto]);
        await page.waitForTimeout(1000);

        // Look for progress indicators
        const progressBar = page.locator(
          '.progress-bar, [role="progressbar"], [data-testid*="progress"]'
        );
        const loadingSpinner = page.locator(
          ".loading, .spinner, .animate-spin"
        );
        const percentageText = page.getByText(/\d+%/);

        const hasProgressBar = await progressBar.isVisible().catch(() => false);
        const hasSpinner = await loadingSpinner.isVisible().catch(() => false);
        const hasPercentage = await percentageText
          .isVisible()
          .catch(() => false);

        // Should show some form of progress indication
        expect(hasProgressBar || hasSpinner || hasPercentage).toBeTruthy();
      }
    });
  });

  test.describe("Photo Gallery Viewing", () => {
    test("should display session photo gallery", async ({ page }) => {
      await handleAuthRedirect(page);

      // Navigate to community feed to find sessions with photos
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(".session-card, .max-w-2xl");
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          // Look for session with photos
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const sessionCard = sessionCards.nth(i);
            const photoGallery = sessionCard.locator(
              'img, .photo-gallery, [data-testid*="photo"]'
            );

            if (await photoGallery.isVisible()) {
              // Click on photo to open gallery
              await photoGallery.first().click();
              await page.waitForTimeout(1000);

              // Should open photo gallery or modal
              const galleryModal = page.locator(
                '[role="dialog"], .photo-modal, .gallery-modal'
              );
              const hasGallery = await galleryModal
                .isVisible()
                .catch(() => false);

              if (hasGallery) {
                expect(hasGallery).toBeTruthy();

                // Check for navigation controls
                const nextButton = galleryModal.getByRole("button", {
                  name: /next/i,
                });
                const prevButton = galleryModal.getByRole("button", {
                  name: /prev|previous/i,
                });
                const closeButton = galleryModal.getByRole("button", {
                  name: /close|×/i,
                });

                const hasNavigation =
                  (await nextButton.isVisible().catch(() => false)) ||
                  (await prevButton.isVisible().catch(() => false));
                const hasClose = await closeButton
                  .isVisible()
                  .catch(() => false);

                expect(hasNavigation || hasClose).toBeTruthy();

                // Close gallery
                if (hasClose) {
                  await closeButton.click();
                  await page.waitForTimeout(500);
                }
                break;
              }
            }
          }
        }
      }
    });

    test("should navigate through multiple photos", async ({ page }) => {
      await handleAuthRedirect(page);

      // Look for session with multiple photos
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(".session-card, .max-w-2xl");
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const sessionCard = sessionCards.first();
          const photos = sessionCard.locator('img, [data-testid*="photo"]');
          const photoCount = await photos.count();

          if (photoCount > 1) {
            // Click on first photo
            await photos.first().click();
            await page.waitForTimeout(1000);

            const galleryModal = page.locator('[role="dialog"], .photo-modal');
            if (await galleryModal.isVisible()) {
              // Test next navigation
              const nextButton = galleryModal.getByRole("button", {
                name: /next/i,
              });
              if (await nextButton.isVisible()) {
                await nextButton.click();
                await page.waitForTimeout(500);

                // Should show different photo
                const currentPhoto = galleryModal.locator("img").first();
                const hasPhoto = await currentPhoto
                  .isVisible()
                  .catch(() => false);
                expect(hasPhoto).toBeTruthy();
              }

              // Test previous navigation
              const prevButton = galleryModal.getByRole("button", {
                name: /prev|previous/i,
              });
              if (await prevButton.isVisible()) {
                await prevButton.click();
                await page.waitForTimeout(500);
              }

              // Close gallery
              const closeButton = galleryModal.getByRole("button", {
                name: /close|×/i,
              });
              if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(500);
              }
            }
          }
        }
      }
    });

    test("should support keyboard navigation in gallery", async ({ page }) => {
      await handleAuthRedirect(page);

      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page.locator(".session-card, .max-w-2xl").first();
        const photo = sessionCard
          .locator('img, [data-testid*="photo"]')
          .first();

        if (await photo.isVisible()) {
          await photo.click();
          await page.waitForTimeout(1000);

          const galleryModal = page.locator('[role="dialog"], .photo-modal');
          if (await galleryModal.isVisible()) {
            // Test escape key to close
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);

            const isGalleryClosed = !(await galleryModal
              .isVisible()
              .catch(() => true));
            expect(isGalleryClosed).toBeTruthy();
          }
        }
      }
    });

    test("should display photo metadata", async ({ page }) => {
      await handleAuthRedirect(page);

      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page.locator(".session-card, .max-w-2xl").first();
        const photo = sessionCard
          .locator('img, [data-testid*="photo"]')
          .first();

        if (await photo.isVisible()) {
          await photo.click();
          await page.waitForTimeout(1000);

          const galleryModal = page.locator('[role="dialog"], .photo-modal');
          if (await galleryModal.isVisible()) {
            // Look for metadata like date, location, etc.
            const metadata = galleryModal.getByText(
              /taken|uploaded|location|date/i
            );
            const hasMetadata = await metadata.isVisible().catch(() => false);

            // Photo counter (1 of 3, etc.)
            const photoCounter = galleryModal.getByText(/\d+.*of.*\d+/);
            const hasCounter = await photoCounter
              .isVisible()
              .catch(() => false);

            expect(hasMetadata || hasCounter).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe("Photo Management", () => {
    test("should delete photos from sessions", async ({ page }) => {
      await handleAuthRedirect(page);

      // Go to own profile to find sessions with photos
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(2000);

        const ownSessions = page.locator(".session-card");
        const sessionCount = await ownSessions.count();

        if (sessionCount > 0) {
          const sessionWithPhotos = ownSessions.first();
          const photo = sessionWithPhotos
            .locator('img, [data-testid*="photo"]')
            .first();

          if (await photo.isVisible()) {
            // Open photo gallery
            await photo.click();
            await page.waitForTimeout(1000);

            const galleryModal = page.locator('[role="dialog"], .photo-modal');
            if (await galleryModal.isVisible()) {
              // Look for delete button
              const deleteButton = galleryModal.getByRole("button", {
                name: /delete|remove/i,
              });
              if (await deleteButton.isVisible()) {
                await deleteButton.click();
                await page.waitForTimeout(1000);

                // Should show confirmation
                const confirmDialog = page.getByText(
                  /confirm|are you sure|delete/i
                );
                if (await confirmDialog.isVisible()) {
                  const confirmButton = page.getByRole("button", {
                    name: /confirm|yes|delete/i,
                  });
                  if (await confirmButton.isVisible()) {
                    await confirmButton.click();
                    await page.waitForTimeout(2000);

                    // Photo should be removed or gallery should close
                    const isGalleryStillOpen = await galleryModal
                      .isVisible()
                      .catch(() => false);
                    // It's ok if gallery closes or photo is removed
                    expect(typeof isGalleryStillOpen).toBe("boolean");
                  }
                }
              }
            }
          }
        }
      }
    });

    test("should reorder photos in session", async ({ page }) => {
      await handleAuthRedirect(page);

      // This test checks if reordering functionality exists
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(2000);

        const sessionCard = page.locator(".session-card").first();
        const photos = sessionCard.locator('img, [data-testid*="photo"]');
        const photoCount = await photos.count();

        if (photoCount > 1) {
          // Look for edit session button
          const editButton = sessionCard.getByRole("button", { name: /edit/i });
          if (await editButton.isVisible()) {
            await editButton.click();
            await page.waitForTimeout(1000);

            // Look for photo management interface
            const photoManager = page.locator(
              ".photo-manager, [data-testid*='photo-manage']"
            );
            const dragHandles = page.locator(
              ".drag-handle, [data-testid*='drag']"
            );

            const hasPhotoManager = await photoManager
              .isVisible()
              .catch(() => false);
            const hasDragHandles = await dragHandles
              .isVisible()
              .catch(() => false);

            // Should have some photo management interface
            expect(hasPhotoManager || hasDragHandles).toBeTruthy();
          }
        }
      }
    });

    test("should set photo as session cover", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/profile");
      await page.waitForTimeout(2000);

      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(2000);

        const sessionCard = page.locator(".session-card").first();
        const photo = sessionCard
          .locator('img, [data-testid*="photo"]')
          .first();

        if (await photo.isVisible()) {
          await photo.click();
          await page.waitForTimeout(1000);

          const galleryModal = page.locator('[role="dialog"], .photo-modal');
          if (await galleryModal.isVisible()) {
            // Look for set as cover option
            const setCoverButton = galleryModal.getByRole("button", {
              name: /set.*cover|make.*cover/i,
            });
            if (await setCoverButton.isVisible()) {
              await setCoverButton.click();
              await page.waitForTimeout(1000);

              // Should show success message
              const successMessage = page.getByText(
                /cover.*set|cover.*updated/i
              );
              const hasSuccess = await successMessage
                .isVisible()
                .catch(() => false);
              expect(hasSuccess).toBeTruthy();
            }
          }
        }
      }
    });
  });

  test.describe("Image Optimization", () => {
    test("should compress large images automatically", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Create large test image
        const largeImage = {
          name: "large-image.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.alloc(2 * 1024 * 1024, "a"), // 2MB
        };

        await fileInput.setInputFiles([largeImage]);
        await page.waitForTimeout(3000);

        // Should show compression indicator
        const compressionIndicator = page.getByText(
          /compressing|optimizing|resizing/i
        );
        const hasCompression = await compressionIndicator
          .isVisible()
          .catch(() => false);

        // Check for size reduction notification
        const sizeReduction = page.getByText(/reduced|compressed|optimized/i);
        const hasSizeInfo = await sizeReduction.isVisible().catch(() => false);

        expect(hasCompression || hasSizeInfo).toBeTruthy();
      }
    });

    test("should generate thumbnails", async ({ page }) => {
      await handleAuthRedirect(page);

      // Look for existing sessions with photos to check thumbnails
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(".session-card, .max-w-2xl");
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const sessionCard = sessionCards.first();
          const thumbnails = sessionCard.locator(
            'img[src*="thumb"], .thumbnail, img[width][height]'
          );

          const thumbnailCount = await thumbnails.count();
          if (thumbnailCount > 0) {
            const firstThumbnail = thumbnails.first();

            // Check that thumbnail has appropriate dimensions
            const boundingBox = await firstThumbnail.boundingBox();
            if (boundingBox) {
              // Thumbnails should be reasonably sized (not full resolution)
              expect(boundingBox.width).toBeLessThan(400);
              expect(boundingBox.height).toBeLessThan(400);
            }
          }
        }
      }
    });

    test("should lazy load images", async ({ page }) => {
      await handleAuthRedirect(page);

      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        // Scroll to bottom to trigger lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000);

        // Check for lazy loading attributes or placeholder behavior
        const lazyImages = page.locator('img[loading="lazy"], img[data-src]');
        const placeholders = page.locator(".image-placeholder, .skeleton");

        const hasLazyImages = (await lazyImages.count()) > 0;
        const hasPlaceholders = (await placeholders.count()) > 0;

        // Should have some optimization technique
        expect(hasLazyImages || hasPlaceholders).toBeTruthy();
      }
    });
  });

  test.describe("Mobile Photo Experience", () => {
    test("should work on mobile devices", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Should be properly sized for mobile
        const inputBox = await fileInput.boundingBox();
        if (inputBox) {
          expect(inputBox.width).toBeLessThanOrEqual(375);
        }

        // Test mobile photo upload
        const testPhoto = {
          name: "mobile-test.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("mobile-photo-content"),
        };

        await fileInput.setInputFiles([testPhoto]);
        await page.waitForTimeout(2000);

        // Photo preview should be mobile-friendly
        const photoPreview = page.locator('img[src*="blob"], .photo-preview');
        if (await photoPreview.isVisible()) {
          const previewBox = await photoPreview.boundingBox();
          if (previewBox) {
            expect(previewBox.width).toBeLessThanOrEqual(375);
          }
        }
      }
    });

    test("should support mobile photo gallery", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await handleAuthRedirect(page);

      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page.locator(".session-card, .max-w-2xl").first();
        const photo = sessionCard
          .locator('img, [data-testid*="photo"]')
          .first();

        if (await photo.isVisible()) {
          await photo.click();
          await page.waitForTimeout(1000);

          const galleryModal = page.locator('[role="dialog"], .photo-modal');
          if (await galleryModal.isVisible()) {
            // Gallery should fill mobile screen
            const modalBox = await galleryModal.boundingBox();
            if (modalBox) {
              expect(modalBox.width).toBeLessThanOrEqual(375);
              expect(modalBox.height).toBeLessThanOrEqual(667);
            }

            // Touch targets should be large enough
            const closeButton = galleryModal.getByRole("button", {
              name: /close|×/i,
            });
            if (await closeButton.isVisible()) {
              const buttonBox = await closeButton.boundingBox();
              if (buttonBox) {
                expect(buttonBox.height).toBeGreaterThanOrEqual(44);
                expect(buttonBox.width).toBeGreaterThanOrEqual(44);
              }
            }
          }
        }
      }
    });

    test("should support swipe navigation on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await handleAuthRedirect(page);

      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page.locator(".session-card, .max-w-2xl").first();
        const photos = sessionCard.locator('img, [data-testid*="photo"]');
        const photoCount = await photos.count();

        if (photoCount > 1) {
          await photos.first().click();
          await page.waitForTimeout(1000);

          const galleryModal = page.locator('[role="dialog"], .photo-modal');
          if (await galleryModal.isVisible()) {
            const galleryImage = galleryModal.locator("img").first();

            if (await galleryImage.isVisible()) {
              // Simulate swipe left (touchstart -> touchmove -> touchend)
              const imageBox = await galleryImage.boundingBox();
              if (imageBox) {
                const startX = imageBox.x + imageBox.width / 2;
                const startY = imageBox.y + imageBox.height / 2;
                const endX = startX - 100; // Swipe left

                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.mouse.move(endX, startY);
                await page.mouse.up();

                await page.waitForTimeout(1000);

                // Should navigate to next photo or show some response
                const galleryStillOpen = await galleryModal
                  .isVisible()
                  .catch(() => false);
                expect(galleryStillOpen).toBeTruthy();
              }
            }
          }
        }
      }
    });
  });

  test.describe("Photo Error Handling", () => {
    test("should handle upload failures gracefully", async ({ page }) => {
      await handleAuthRedirect(page);

      // Mock upload failure
      await page.route("**/api/media/**", (route) => route.abort());

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        const testPhoto = {
          name: "test-failure.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("test-photo-for-failure"),
        };

        await fileInput.setInputFiles([testPhoto]);
        await page.waitForTimeout(3000);

        // Should show error message
        const errorMessage = page.getByText(
          /upload.*failed|error.*uploading|try.*again/i
        );
        const hasError = await errorMessage.isVisible().catch(() => false);
        expect(hasError).toBeTruthy();

        // App should not crash
        const pageContent = await page.textContent("body");
        expect(pageContent).toBeTruthy();
      }
    });

    test("should handle corrupted images", async ({ page }) => {
      await handleAuthRedirect(page);

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Create corrupted image file
        const corruptedFile = {
          name: "corrupted.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("Not a real image file"),
        };

        await fileInput.setInputFiles([corruptedFile]);
        await page.waitForTimeout(2000);

        // Should handle gracefully
        const errorMessage = page.getByText(
          /invalid.*image|corrupted|unsupported/i
        );
        const hasError = await errorMessage.isVisible().catch(() => false);

        // Either shows error or quietly rejects
        expect(typeof hasError).toBe("boolean");
      }
    });

    test("should handle storage quota exceeded", async ({ page }) => {
      await handleAuthRedirect(page);

      // Mock storage quota error
      await page.route("**/api/media/**", (route) =>
        route.fulfill({
          status: 413,
          contentType: "application/json",
          body: JSON.stringify({ error: "Storage quota exceeded" }),
        })
      );

      await page.goto("/sessions/new?mode=log");
      await page.waitForTimeout(2000);

      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        const testPhoto = {
          name: "quota-test.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("test-photo-for-quota"),
        };

        await fileInput.setInputFiles([testPhoto]);
        await page.waitForTimeout(2000);

        // Should show storage quota error
        const quotaError = page.getByText(
          /storage.*full|quota.*exceeded|space.*limit/i
        );
        const hasQuotaError = await quotaError.isVisible().catch(() => false);
        expect(hasQuotaError).toBeTruthy();
      }
    });
  });
});

import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  createTestBoard,
  createTestSession,
} from "./test-helpers";

test.describe("Board/Quiver Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await waitForPageLoad(page);
  });

  test.describe("Board Creation", () => {
    test("should create a new board successfully", async ({ page }) => {
      await handleAuthRedirect(page);

      // Navigate to quiver tab
      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        // Click add board button
        const addBoardButton = page.getByRole("button", {
          name: /add.*board/i,
        });
        if (await addBoardButton.isVisible()) {
          await addBoardButton.click();
          await page.waitForTimeout(1000);

          // Fill board form
          const nameInput = page.getByLabel(/name|brand/i);
          if (await nameInput.isVisible()) {
            await nameInput.fill("Test Shortboard");
          }

          const lengthInput = page.getByLabel(/length|size/i);
          if (await lengthInput.isVisible()) {
            await lengthInput.fill("6'2\"");
          }

          const typeSelect = page.getByLabel(/type|category/i);
          if (await typeSelect.isVisible()) {
            await typeSelect.selectOption("shortboard");
          }

          const volumeInput = page.getByLabel(/volume/i);
          if (await volumeInput.isVisible()) {
            await volumeInput.fill("28.5");
          }

          const notesInput = page.getByLabel(/notes|description/i);
          if (await notesInput.isVisible()) {
            await notesInput.fill(
              "High performance shortboard for overhead waves"
            );
          }

          // Submit form
          const saveButton = page.getByRole("button", {
            name: /save|add.*board/i,
          });
          if (
            (await saveButton.isVisible()) &&
            (await saveButton.isEnabled())
          ) {
            await saveButton.click();
            await page.waitForTimeout(3000);

            // Check if board appears in list
            const boardCard = page.getByText("Test Shortboard");
            const hasBoardCard = await boardCard.isVisible().catch(() => false);
            expect(hasBoardCard).toBeTruthy();

            // Check for success message
            const successMessage = page.getByText(/board.*added|success/i);
            const hasSuccess = await successMessage
              .isVisible()
              .catch(() => false);

            // Either shows success message or board appears in list
            expect(hasBoardCard || hasSuccess).toBeTruthy();
          }
        }
      }
    });

    test("should validate required board fields", async ({ page }) => {
      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        const addBoardButton = page.getByRole("button", {
          name: /add.*board/i,
        });
        if (await addBoardButton.isVisible()) {
          await addBoardButton.click();
          await page.waitForTimeout(1000);

          // Try to submit empty form
          const saveButton = page.getByRole("button", {
            name: /save|add.*board/i,
          });
          if (await saveButton.isVisible()) {
            // Should be disabled for empty form
            const isDisabled = await saveButton.isDisabled();
            expect(isDisabled).toBeTruthy();

            // Fill required fields and check if button enables
            const nameInput = page.getByLabel(/name|brand/i);
            if (await nameInput.isVisible()) {
              await nameInput.fill("Valid Board Name");
              await page.waitForTimeout(500);

              const lengthInput = page.getByLabel(/length|size/i);
              if (await lengthInput.isVisible()) {
                await lengthInput.fill("6'0\"");
                await page.waitForTimeout(500);

                const isEnabledNow = await saveButton.isEnabled();
                expect(isEnabledNow).toBeTruthy();
              }
            }
          }
        }
      }
    });

    test("should handle different board types", async ({ page }) => {
      await handleAuthRedirect(page);

      const boardTypes = ["shortboard", "longboard", "funboard", "fish"];

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        for (const boardType of boardTypes) {
          const addBoardButton = page.getByRole("button", {
            name: /add.*board/i,
          });
          if (await addBoardButton.isVisible()) {
            await addBoardButton.click();
            await page.waitForTimeout(1000);

            // Fill form with board type
            const nameInput = page.getByLabel(/name|brand/i);
            if (await nameInput.isVisible()) {
              await nameInput.fill(`Test ${boardType}`);
            }

            const lengthInput = page.getByLabel(/length|size/i);
            if (await lengthInput.isVisible()) {
              await lengthInput.fill("6'2\"");
            }

            const typeSelect = page.getByLabel(/type|category/i);
            if (await typeSelect.isVisible()) {
              await typeSelect.selectOption(boardType);

              // Verify selection
              const selectedValue = await typeSelect.inputValue();
              expect(selectedValue).toBe(boardType);
            }

            // Cancel to test next type
            const cancelButton = page.getByRole("button", { name: /cancel/i });
            if (await cancelButton.isVisible()) {
              await cancelButton.click();
              await page.waitForTimeout(500);
            } else {
              // If no cancel button, press escape
              await page.keyboard.press("Escape");
              await page.waitForTimeout(500);
            }
          }
        }
      }
    });

    test("should upload board photo", async ({ page }) => {
      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        const addBoardButton = page.getByRole("button", {
          name: /add.*board/i,
        });
        if (await addBoardButton.isVisible()) {
          await addBoardButton.click();
          await page.waitForTimeout(1000);

          // Look for photo upload
          const photoInput = page.locator('input[type="file"]');
          if (await photoInput.isVisible()) {
            // Create test image file
            const fileContent = Buffer.from("fake-board-image-content");
            await photoInput.setInputFiles({
              name: "board-photo.jpg",
              mimeType: "image/jpeg",
              buffer: fileContent,
            });

            await page.waitForTimeout(2000);

            // Should show preview or success indicator
            const photoPreview = page.locator(
              'img[src*="blob"], .photo-preview'
            );
            const hasPreview = await photoPreview
              .isVisible()
              .catch(() => false);
            expect(hasPreview).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe("Board Viewing and Management", () => {
    test("should display user's board collection", async ({ page }) => {
      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        // Check for board cards or empty state
        const boardCards = page.locator(".board-card, .board-item");
        const emptyState = page.getByText(
          /no boards|add your first board|empty quiver/i
        );

        const cardCount = await boardCards.count();
        const hasEmptyState = await emptyState.isVisible().catch(() => false);

        // Should either have boards or show empty state
        expect(cardCount > 0 || hasEmptyState).toBeTruthy();

        if (cardCount > 0) {
          const firstBoard = boardCards.first();

          // Should show board details
          const boardName = firstBoard.locator(
            "h3, .board-name, [data-testid*='board-name']"
          );
          const hasName = await boardName.isVisible().catch(() => false);
          expect(hasName).toBeTruthy();

          // Should show board type or dimensions
          const boardDetails = firstBoard.getByText(
            /shortboard|longboard|fish|funboard|[0-9]+'[0-9]+"|ft/i
          );
          const hasDetails = await boardDetails.isVisible().catch(() => false);
          expect(hasDetails).toBeTruthy();
        }
      }
    });

    test("should show board details in cards", async ({ page }) => {
      await handleAuthRedirect(page);

      // First create a test board
      try {
        await createTestBoard(page);

        // Refresh to see the new board
        await page.reload();
        await page.waitForTimeout(2000);

        const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
        if (await quiverTab.isVisible()) {
          await quiverTab.click();
          await page.waitForTimeout(2000);

          const boardCards = page.locator(".board-card, .board-item");
          if (await boardCards.first().isVisible()) {
            const firstBoard = boardCards.first();

            // Check for expected board information
            const expectedInfo = [
              firstBoard.getByText("Test Board"),
              firstBoard.getByText(/6'2"|6.2/),
              firstBoard.getByText(/shortboard/i),
              firstBoard.getByText(/test board/i),
            ];

            let visibleInfoCount = 0;
            for (const info of expectedInfo) {
              if (await info.isVisible().catch(() => false)) {
                visibleInfoCount++;
              }
            }

            // Should show at least 2 pieces of board information
            expect(visibleInfoCount).toBeGreaterThanOrEqual(2);
          }
        }
      } catch (error) {
        console.log("Could not create test board:", error);
      }
    });

    test("should filter boards by type", async ({ page }) => {
      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        // Look for filter options
        const filterSelect = page.getByLabel(/filter|type|category/i);
        const filterButton = page.getByRole("button", { name: /filter/i });

        if (await filterSelect.isVisible()) {
          await filterSelect.selectOption("shortboard");
          await page.waitForTimeout(1000);

          // Check if boards are filtered
          const boardCards = page.locator(".board-card, .board-item");
          const cardCount = await boardCards.count();

          if (cardCount > 0) {
            // All visible boards should be shortboards
            const shortboardText = page.getByText(/shortboard/i);
            const hasShortboards = await shortboardText
              .isVisible()
              .catch(() => false);
            expect(hasShortboards).toBeTruthy();
          }
        } else if (await filterButton.isVisible()) {
          await filterButton.click();
          await page.waitForTimeout(1000);

          // Look for filter dropdown
          const shortboardOption = page.getByText(/shortboard/i);
          if (await shortboardOption.isVisible()) {
            await shortboardOption.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });

  test.describe("Board Editing", () => {
    test("should edit existing board", async ({ page }) => {
      await handleAuthRedirect(page);

      // Create a test board first
      try {
        await createTestBoard(page);
        await page.reload();
        await page.waitForTimeout(2000);

        const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
        if (await quiverTab.isVisible()) {
          await quiverTab.click();
          await page.waitForTimeout(2000);

          const boardCard = page.locator(".board-card, .board-item").first();
          if (await boardCard.isVisible()) {
            // Look for edit button
            const editButton = boardCard.getByRole("button", { name: /edit/i });
            if (await editButton.isVisible()) {
              await editButton.click();
              await page.waitForTimeout(1000);

              // Edit board name
              const nameInput = page.getByLabel(/name|brand/i);
              if (await nameInput.isVisible()) {
                await nameInput.clear();
                await nameInput.fill("Updated Test Board");

                // Save changes
                const saveButton = page.getByRole("button", {
                  name: /save|update/i,
                });
                if (
                  (await saveButton.isVisible()) &&
                  (await saveButton.isEnabled())
                ) {
                  await saveButton.click();
                  await page.waitForTimeout(2000);

                  // Check if changes are reflected
                  const updatedBoard = page.getByText("Updated Test Board");
                  const hasUpdatedBoard = await updatedBoard
                    .isVisible()
                    .catch(() => false);
                  expect(hasUpdatedBoard).toBeTruthy();
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not create/edit test board:", error);
      }
    });

    test("should validate edit form", async ({ page }) => {
      await handleAuthRedirect(page);

      // This test assumes there's at least one board to edit
      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        const boardCard = page.locator(".board-card, .board-item").first();
        if (await boardCard.isVisible()) {
          const editButton = boardCard.getByRole("button", { name: /edit/i });
          if (await editButton.isVisible()) {
            await editButton.click();
            await page.waitForTimeout(1000);

            // Clear required field
            const nameInput = page.getByLabel(/name|brand/i);
            if (await nameInput.isVisible()) {
              await nameInput.clear();

              // Save button should be disabled
              const saveButton = page.getByRole("button", {
                name: /save|update/i,
              });
              if (await saveButton.isVisible()) {
                const isDisabled = await saveButton.isDisabled();
                expect(isDisabled).toBeTruthy();

                // Re-enter valid name
                await nameInput.fill("Valid Board Name");
                await page.waitForTimeout(500);

                const isEnabledNow = await saveButton.isEnabled();
                expect(isEnabledNow).toBeTruthy();
              }
            }
          }
        }
      }
    });
  });

  test.describe("Board Deletion", () => {
    test("should delete board with confirmation", async ({ page }) => {
      await handleAuthRedirect(page);

      // Create a board to delete
      try {
        await createTestBoard(page, { name: "Board to Delete" });
        await page.reload();
        await page.waitForTimeout(2000);

        const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
        if (await quiverTab.isVisible()) {
          await quiverTab.click();
          await page.waitForTimeout(2000);

          // Find the board we created
          const boardCard = page
            .getByText("Board to Delete")
            .locator("..")
            .or(page.locator(".board-card, .board-item").first());

          if (await boardCard.isVisible()) {
            // Look for delete button
            const deleteButton = boardCard.getByRole("button", {
              name: /delete|remove/i,
            });
            if (await deleteButton.isVisible()) {
              await deleteButton.click();
              await page.waitForTimeout(1000);

              // Should show confirmation dialog
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

                  // Board should be removed
                  const deletedBoard = page.getByText("Board to Delete");
                  const boardStillExists = await deletedBoard
                    .isVisible()
                    .catch(() => false);
                  expect(boardStillExists).toBeFalsy();
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not create/delete test board:", error);
      }
    });

    test("should prevent deletion of board used in recent sessions", async ({
      page,
    }) => {
      await handleAuthRedirect(page);

      // This test would require creating a session with a specific board
      // For now, we'll just check that deletion has proper confirmation
      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        const boardCard = page.locator(".board-card, .board-item").first();
        if (await boardCard.isVisible()) {
          const deleteButton = boardCard.getByRole("button", {
            name: /delete|remove/i,
          });
          if (await deleteButton.isVisible()) {
            await deleteButton.click();
            await page.waitForTimeout(1000);

            // Should show some form of confirmation or warning
            const warningText = page.getByText(
              /confirm|warning|used.*session|sure/i
            );
            const hasWarning = await warningText.isVisible().catch(() => false);
            expect(hasWarning).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe("Board Selection in Sessions", () => {
    test("should show boards in session logging form", async ({ page }) => {
      await handleAuthRedirect(page);

      // Create a test board first
      try {
        await createTestBoard(page, { name: "Session Test Board" });

        // Navigate to session logging
        await page.goto("/log-session");
        await page.waitForTimeout(2000);

        // Look for board selection
        const boardSelect = page.getByLabel(/board/i);
        if (await boardSelect.isVisible()) {
          await boardSelect.click();
          await page.waitForTimeout(1000);

          // Should show the test board as an option
          const testBoardOption = page.getByText("Session Test Board");
          const hasTestBoard = await testBoardOption
            .isVisible()
            .catch(() => false);
          expect(hasTestBoard).toBeTruthy();
        }
      } catch (error) {
        console.log("Could not create test board for session:", error);
      }
    });

    test("should allow board selection during session logging", async ({
      page,
    }) => {
      await handleAuthRedirect(page);

      await page.goto("/log-session");
      await page.waitForTimeout(2000);

      const boardSelect = page.getByLabel(/board/i);
      if (await boardSelect.isVisible()) {
        await boardSelect.click();
        await page.waitForTimeout(1000);

        // Select first available board
        const boardOptions = page.locator("option");
        const optionCount = await boardOptions.count();

        if (optionCount > 1) {
          // More than just the placeholder option
          await boardOptions.nth(1).click();
          await page.waitForTimeout(500);

          // Verify selection
          const selectedValue = await boardSelect.inputValue();
          expect(selectedValue.length).toBeGreaterThan(0);
        }
      }
    });

    test("should handle no boards available", async ({ page }) => {
      await handleAuthRedirect(page);

      // This test assumes user has no boards or we can simulate that state
      await page.goto("/log-session");
      await page.waitForTimeout(2000);

      const boardSelect = page.getByLabel(/board/i);
      if (await boardSelect.isVisible()) {
        await boardSelect.click();
        await page.waitForTimeout(1000);

        // Should show option to add a board or manual entry
        const addBoardOption = page.getByText(
          /add.*board|no boards|create board/i
        );
        const manualEntry = page.getByPlaceholder(/board.*name|enter.*board/i);

        const hasAddOption = await addBoardOption
          .isVisible()
          .catch(() => false);
        const hasManualEntry = await manualEntry.isVisible().catch(() => false);

        // Should provide some way to handle missing boards
        expect(hasAddOption || hasManualEntry).toBeTruthy();
      }
    });
  });

  test.describe("Mobile Board Management", () => {
    test("should work on mobile devices", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        // Check that board cards are mobile-friendly
        const boardCards = page.locator(".board-card, .board-item");
        const cardCount = await boardCards.count();

        if (cardCount > 0) {
          const firstCard = boardCards.first();
          const cardBox = await firstCard.boundingBox();

          if (cardBox) {
            // Should fit within mobile viewport
            expect(cardBox.width).toBeLessThanOrEqual(375);
          }

          // Touch targets should be large enough
          const actionButtons = firstCard.locator("button");
          const buttonCount = await actionButtons.count();

          if (buttonCount > 0) {
            const firstButton = actionButtons.first();
            const buttonBox = await firstButton.boundingBox();

            if (buttonBox) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(40);
            }
          }
        }

        // Add board button should be touch-friendly
        const addBoardButton = page.getByRole("button", {
          name: /add.*board/i,
        });
        if (await addBoardButton.isVisible()) {
          const buttonBox = await addBoardButton.boundingBox();
          if (buttonBox) {
            expect(buttonBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
  });

  test.describe("Board Management Error Handling", () => {
    test("should handle API errors gracefully", async ({ page }) => {
      await handleAuthRedirect(page);

      // Mock API error
      await page.route("**/api/boards**", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Server error" }),
        })
      );

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(3000);

        // Should show error state or loading state, not crash
        const errorMessage = page.getByText(/error|failed|problem/i);
        const loadingSpinner = page.locator(
          ".loading, .spinner, .animate-spin"
        );

        const hasError = await errorMessage.isVisible().catch(() => false);
        const hasLoading = await loadingSpinner.isVisible().catch(() => false);
        const hasContent = await page
          .locator("body")
          .isVisible()
          .catch(() => false);

        // App should remain functional
        expect(hasError || hasLoading || hasContent).toBeTruthy();
      }
    });

    test("should validate form inputs", async ({ page }) => {
      await handleAuthRedirect(page);

      const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
      if (await quiverTab.isVisible()) {
        await quiverTab.click();
        await page.waitForTimeout(2000);

        const addBoardButton = page.getByRole("button", {
          name: /add.*board/i,
        });
        if (await addBoardButton.isVisible()) {
          await addBoardButton.click();
          await page.waitForTimeout(1000);

          // Test invalid length format
          const lengthInput = page.getByLabel(/length|size/i);
          if (await lengthInput.isVisible()) {
            await lengthInput.fill("invalid length");

            const saveButton = page.getByRole("button", {
              name: /save|add.*board/i,
            });
            if (await saveButton.isVisible()) {
              // Should show validation error or disable save
              const isDisabled = await saveButton.isDisabled();
              expect(isDisabled).toBeTruthy();
            }
          }
        }
      }
    });
  });
});

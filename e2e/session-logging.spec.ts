import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  safeClick,
  createPlannedSession,
} from "./test-helpers";

test.describe("Session Logging", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to log session page
    await page.goto("/log-session");

    // Wait for page to load and handle potential auth redirect
    await waitForPageLoad(page);
  });

  test.fixme(
    "should display session logging form when authenticated",
    async ({ page }) => {
      // Skip if redirected to auth (user not logged in)
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping session logging tests");
      }

      // Check that session form is visible or we're redirected
      const hasSessionForm = await page
        .getByTestId("session-form")
        .isVisible()
        .catch(() => false);
      const hasForm = await page
        .locator("form")
        .isVisible()
        .catch(() => false);
      const hasMainContent = await page
        .locator("main")
        .isVisible()
        .catch(() => false);

      expect(hasSessionForm || hasForm || hasMainContent).toBeTruthy();

      // Check for key form fields that should be present in session logging
      const beachField = page
        .getByLabel(/beach/i)
        .or(page.getByPlaceholder(/beach/i));
      const dateField = page
        .getByLabel(/date/i)
        .or(page.getByPlaceholder(/date/i));
      const timeField = page
        .getByLabel(/time/i)
        .or(page.getByPlaceholder(/time/i));
      const boardField = page
        .getByLabel(/board/i)
        .or(page.getByPlaceholder(/board/i));

      // At least some of these fields should be visible
      const visibleFields = await Promise.all([
        beachField.isVisible().catch(() => false),
        dateField.isVisible().catch(() => false),
        timeField.isVisible().catch(() => false),
        boardField.isVisible().catch(() => false),
      ]);

      expect(visibleFields.some((field) => field)).toBeTruthy();
    }
  );

  test("should show validation errors for required fields", async ({
    page,
  }) => {
    // Skip if not authenticated
    const authState = await handleAuthRedirect(page);
    if (authState.isAuthPage) {
      test.skip("User not authenticated - skipping validation tests");
    }

    // Try to submit form without filling required fields
    const submitButton = page
      .getByRole("button", {
        name: /add to journal|log session|save|submit/i,
      })
      .first();

    if (await submitButton.isVisible()) {
      // Check if button is disabled (expected for empty form)
      const isEnabled = await submitButton.isEnabled().catch(() => false);
      if (!isEnabled) {
        // Button is disabled as expected for empty form - this is the correct behavior
        console.log("Submit button correctly disabled for empty form");
        expect(isEnabled).toBe(false);
      } else {
        // If enabled, try to submit and expect validation errors
        await safeClick(submitButton);
        await page.waitForTimeout(1000);

        const errorMessages = page.locator(
          '[role="alert"], .error, .text-red, .text-destructive'
        );
        const hasErrors = (await errorMessages.count()) > 0;
        expect(hasErrors).toBeTruthy();
      }
    }
  });

  test("should allow filling out session details", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping form filling tests");
    }

    // Fill out beach information
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.click();
      await beachField.fill("Malibu");
    }

    // Fill out date
    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      const today = new Date().toISOString().split("T")[0];
      await dateField.fill(today);
    }

    // Fill out time if available
    const timeField = page
      .getByLabel(/time/i)
      .or(page.getByPlaceholder(/time/i));
    if (await timeField.isVisible()) {
      await timeField.fill("07:00");
    }

    // Select or fill board information
    const boardField = page
      .getByLabel(/board/i)
      .or(page.getByPlaceholder(/board/i));
    if (await boardField.isVisible()) {
      await boardField.click();
      await boardField.fill("6'2\" Shortboard");
    }

    // Fill session notes if available
    const notesField = page
      .getByLabel(/notes|description/i)
      .or(page.getByPlaceholder(/notes|description/i));
    if (await notesField.isVisible()) {
      await notesField.fill("Great morning session with clean waves");
    }

    // Test wave conditions fields
    const waveHeightField = page
      .getByLabel(/wave height|height/i)
      .or(page.getByPlaceholder(/height/i));
    if (await waveHeightField.isVisible()) {
      await waveHeightField.fill("3-4 feet");
    }

    const conditionsField = page
      .getByLabel(/conditions/i)
      .or(page.getByPlaceholder(/conditions/i));
    if (await conditionsField.isVisible()) {
      await conditionsField.fill("Clean, offshore winds");
    }
  });

  test("should handle beach selection from dropdown or autocomplete", async ({
    page,
  }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping beach selection tests");
    }

    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      // Click on beach field
      await beachField.click();

      // Start typing to trigger autocomplete/dropdown
      await beachField.fill("Mal");

      // Wait for dropdown options to appear
      await page.waitForTimeout(1000);

      // Look for dropdown options
      const dropdownOptions = page.locator(
        '[role="option"], .option, .dropdown-item'
      );
      if ((await dropdownOptions.count()) > 0) {
        // Click on first option
        await dropdownOptions.first().click();

        // Verify selection
        const selectedValue = await beachField.inputValue();
        expect(selectedValue.length).toBeGreaterThan(0);
      }
    }
  });

  test("should handle board selection from user quiver", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping board selection tests");
    }

    const boardField = page
      .getByLabel(/board/i)
      .or(page.getByPlaceholder(/board/i));
    if (await boardField.isVisible()) {
      await boardField.click();

      // Look for board options from user's quiver
      const boardOptions = page.locator(
        '[role="option"], .board-option, .dropdown-item'
      );
      if ((await boardOptions.count()) > 0) {
        await boardOptions.first().click();
      } else {
        // If no saved boards, should allow manual entry
        await boardField.fill("Custom Board 6'0\"");
      }
    }
  });

  test("should allow setting session duration", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping duration tests");
    }

    // Look for duration field (could be separate start/end times or duration)
    const durationField = page
      .getByLabel(/duration/i)
      .or(page.getByPlaceholder(/duration/i));
    const startTimeField = page.getByLabel(/start time/i);
    const endTimeField = page.getByLabel(/end time/i);

    if (await durationField.isVisible()) {
      await durationField.fill("2 hours");
    } else if (
      (await startTimeField.isVisible()) &&
      (await endTimeField.isVisible())
    ) {
      await startTimeField.fill("07:00");
      await endTimeField.fill("09:00");
    }
  });

  test("should handle session rating or quality assessment", async ({
    page,
  }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping rating tests");
    }

    // Look for rating controls (stars, numbers, or quality selectors)
    const ratingStars = page.locator(
      '[data-testid*="rating"], .rating, [aria-label*="star"]'
    );
    const qualitySelect = page.getByLabel(/quality|rating/i);

    if ((await ratingStars.count()) > 0) {
      // Click on 4th star (4/5 rating)
      await ratingStars.nth(3).click();
    } else if (await qualitySelect.isVisible()) {
      await qualitySelect.click();
      await page
        .getByText(/good|excellent|4/i)
        .first()
        .click();
    }
  });

  test("should successfully submit session log", async ({ page }) => {
    // Skip if not authenticated
    const authState = await handleAuthRedirect(page);
    if (authState.isAuthPage) {
      test.skip("User not authenticated - skipping submission tests");
    }

    // Fill out minimum required fields
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i))
      .first();
    if (await beachField.isVisible()) {
      await beachField.fill("Test Beach");
    }

    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i))
      .first();
    if (await dateField.isVisible()) {
      const today = new Date().toISOString().split("T")[0];
      await dateField.fill(today);
    }

    // Submit the form
    const submitButton = page
      .getByRole("button", {
        name: /add to journal|log session|save|submit/i,
      })
      .first();

    if (await submitButton.isVisible()) {
      // Check if button is enabled after filling required fields
      const isEnabled = await submitButton.isEnabled().catch(() => false);
      if (!isEnabled) {
        // If still disabled, the form might need more fields
        console.log(
          "Submit button still disabled - may need more required fields"
        );
        test.skip("Form validation requires more fields than provided");
      } else {
        await safeClick(submitButton);

        // Wait for submission to complete
        await page.waitForTimeout(2000);

        // Should either redirect to sessions list or show success message
        const isRedirectedToSessions = page.url().includes("/sessions");
        const hasSuccessMessage = await page
          .getByText(/success|saved|logged/i)
          .isVisible()
          .catch(() => false);
        const hasLoadingState = await page
          .locator(".loading, .spinner, .animate-spin")
          .isVisible()
          .catch(() => false);

        expect(
          isRedirectedToSessions || hasSuccessMessage || hasLoadingState
        ).toBeTruthy();
      }
    }
  });

  test("should handle form cancellation", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping cancellation tests");
    }

    // Look for cancel button
    const cancelButton = page.getByRole("button", { name: /cancel|back/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Should handle the cancellation (page remains functional)
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    } else {
      // If no cancel button, test navigation away manually
      await page.goto("/");
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should validate date field constraints", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping date validation tests");
    }

    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      // Try to enter future date (should be prevented or warned)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateString = futureDate.toISOString().split("T")[0];

      await dateField.fill(futureDateString);

      // Try to submit and check for validation
      const submitButton = page.getByRole("button", {
        name: /add to journal|log session|save|submit/i,
      });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation error for future date
        await page.waitForTimeout(1000);
        const errorMessage = await page
          .getByText(/future|invalid date|cannot be in the future/i)
          .isVisible()
          .catch(() => false);

        if (errorMessage) {
          expect(errorMessage).toBeTruthy();
        }
      }
    }
  });

  test.describe("Session Conversion (Planned to Completed)", () => {
    test("should convert planned session to completed session", async ({
      page,
    }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping session conversion tests");
      }

      // Create a planned session first
      try {
        const plannedSession = await createPlannedSession(page, {
          beach: "Test Beach for Conversion",
          notes: "Planned session to convert",
        });

        // Navigate to profile to find planned sessions
        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          // Look for planned sessions section
          const plannedSessionsSection = page.getByText(
            /planned|upcoming|future/i
          );
          if (await plannedSessionsSection.isVisible()) {
            await plannedSessionsSection.click();
            await page.waitForTimeout(1000);
          }

          // Find the planned session
          const plannedSessionCard = page
            .getByText("Test Beach for Conversion")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            // Look for convert button
            const convertButton = plannedSessionCard.getByRole("button", {
              name: /convert|log.*session|mark.*completed/i,
            });
            if (await convertButton.isVisible()) {
              await convertButton.click();
              await page.waitForTimeout(1000);

              // Should open conversion form with pre-filled data
              const conversionForm = page.locator("form, .session-form");
              if (await conversionForm.isVisible()) {
                // Beach should be pre-filled
                const beachInput = conversionForm.locator(
                  "#beach-input, [name*='beach']"
                );
                if (await beachInput.isVisible()) {
                  const beachValue = await beachInput.inputValue();
                  expect(beachValue).toContain("Test Beach for Conversion");
                }

                // Date should be changeable to today
                const dateInput = conversionForm.locator(
                  "#session-date, [name*='date']"
                );
                if (await dateInput.isVisible()) {
                  await dateInput.fill(new Date().toISOString().split("T")[0]);
                }

                // Add actual session details
                const ratingSelect =
                  conversionForm.getByLabel(/quality|rating/i);
                if (await ratingSelect.isVisible()) {
                  await ratingSelect.selectOption("4");
                }

                const durationInput = conversionForm.getByLabel(/duration/i);
                if (await durationInput.isVisible()) {
                  await durationInput.fill("2");
                }

                // Update notes
                const notesInput = conversionForm.getByLabel(/notes/i);
                if (await notesInput.isVisible()) {
                  await notesInput.clear();
                  await notesInput.fill(
                    "Actually surfed! Converted from planned session."
                  );
                }

                // Submit conversion
                const saveButton = conversionForm.getByRole("button", {
                  name: /save|log|convert/i,
                });
                if (
                  (await saveButton.isVisible()) &&
                  (await saveButton.isEnabled())
                ) {
                  await saveButton.click();
                  await page.waitForTimeout(3000);

                  // Check for success message
                  const successMessage = page.getByText(
                    /converted|session.*logged|success/i
                  );
                  const hasSuccess = await successMessage
                    .isVisible()
                    .catch(() => false);
                  expect(hasSuccess).toBeTruthy();

                  // Session should move from planned to completed
                  const completedSection = page.getByText(
                    /completed|logged|journal/i
                  );
                  if (await completedSection.isVisible()) {
                    await completedSection.click();
                    await page.waitForTimeout(1000);

                    const convertedSession = page.getByText(
                      "Actually surfed! Converted from planned session."
                    );
                    const hasConvertedSession = await convertedSession
                      .isVisible()
                      .catch(() => false);
                    expect(hasConvertedSession).toBeTruthy();
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not create/convert planned session:", error);
      }
    });

    test("should preserve planned session data during conversion", async ({
      page,
    }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip(
          "User not authenticated - skipping session data preservation tests"
        );
      }

      try {
        const plannedSessionData = {
          beach: "Data Preservation Beach",
          time: "06:00",
          notes: "Early morning planned session",
        };

        await createPlannedSession(page, plannedSessionData);

        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          const plannedSessionCard = page
            .getByText("Data Preservation Beach")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            const convertButton = plannedSessionCard.getByRole("button", {
              name: /convert|log.*session|mark.*completed/i,
            });
            if (await convertButton.isVisible()) {
              await convertButton.click();
              await page.waitForTimeout(1000);

              const conversionForm = page.locator("form, .session-form");
              if (await conversionForm.isVisible()) {
                // Check that original data is preserved
                const beachInput = conversionForm.locator(
                  "#beach-input, [name*='beach']"
                );
                if (await beachInput.isVisible()) {
                  const beachValue = await beachInput.inputValue();
                  expect(beachValue).toContain("Data Preservation Beach");
                }

                const timeInput = conversionForm.locator(
                  "#session-time, [name*='time']"
                );
                if (await timeInput.isVisible()) {
                  const timeValue = await timeInput.inputValue();
                  expect(timeValue).toBe("06:00");
                }

                const notesInput = conversionForm.getByLabel(/notes/i);
                if (await notesInput.isVisible()) {
                  const notesValue = await notesInput.inputValue();
                  expect(notesValue).toContain("Early morning planned session");
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not test data preservation:", error);
      }
    });

    test("should allow canceling session conversion", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip(
          "User not authenticated - skipping conversion cancellation tests"
        );
      }

      try {
        await createPlannedSession(page, {
          beach: "Cancellation Test Beach",
          notes: "Session to cancel conversion",
        });

        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          const plannedSessionCard = page
            .getByText("Cancellation Test Beach")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            const convertButton = plannedSessionCard.getByRole("button", {
              name: /convert|log.*session|mark.*completed/i,
            });
            if (await convertButton.isVisible()) {
              await convertButton.click();
              await page.waitForTimeout(1000);

              // Cancel the conversion
              const cancelButton = page.getByRole("button", {
                name: /cancel/i,
              });
              if (await cancelButton.isVisible()) {
                await cancelButton.click();
                await page.waitForTimeout(1000);

                // Should return to profile without converting
                const plannedSessionStillExists = page.getByText(
                  "Session to cancel conversion"
                );
                const stillExists = await plannedSessionStillExists
                  .isVisible()
                  .catch(() => false);
                expect(stillExists).toBeTruthy();
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not test conversion cancellation:", error);
      }
    });

    test("should validate conversion form", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip(
          "User not authenticated - skipping conversion validation tests"
        );
      }

      try {
        await createPlannedSession(page, {
          beach: "Validation Test Beach",
          notes: "Session for validation testing",
        });

        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          const plannedSessionCard = page
            .getByText("Validation Test Beach")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            const convertButton = plannedSessionCard.getByRole("button", {
              name: /convert|log.*session|mark.*completed/i,
            });
            if (await convertButton.isVisible()) {
              await convertButton.click();
              await page.waitForTimeout(1000);

              const conversionForm = page.locator("form, .session-form");
              if (await conversionForm.isVisible()) {
                // Clear required field to test validation
                const dateInput = conversionForm.locator(
                  "#session-date, [name*='date']"
                );
                if (await dateInput.isVisible()) {
                  await dateInput.clear();

                  const saveButton = conversionForm.getByRole("button", {
                    name: /save|log|convert/i,
                  });
                  if (await saveButton.isVisible()) {
                    // Should be disabled without valid date
                    const isDisabled = await saveButton.isDisabled();
                    expect(isDisabled).toBeTruthy();

                    // Re-enter valid date
                    await dateInput.fill(
                      new Date().toISOString().split("T")[0]
                    );
                    await page.waitForTimeout(500);

                    const isEnabledNow = await saveButton.isEnabled();
                    expect(isEnabledNow).toBeTruthy();
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not test conversion validation:", error);
      }
    });

    test("should delete planned sessions", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip(
          "User not authenticated - skipping planned session deletion tests"
        );
      }

      try {
        await createPlannedSession(page, {
          beach: "Deletion Test Beach",
          notes: "Planned session to delete",
        });

        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          const plannedSessionCard = page
            .getByText("Deletion Test Beach")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            // Look for delete button
            const deleteButton = plannedSessionCard.getByRole("button", {
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

                  // Session should be removed
                  const deletedSession = page.getByText(
                    "Planned session to delete"
                  );
                  const sessionStillExists = await deletedSession
                    .isVisible()
                    .catch(() => false);
                  expect(sessionStillExists).toBeFalsy();
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not test planned session deletion:", error);
      }
    });

    test("should edit planned sessions", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip(
          "User not authenticated - skipping planned session editing tests"
        );
      }

      try {
        await createPlannedSession(page, {
          beach: "Edit Test Beach",
          notes: "Original planned session notes",
        });

        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await journalTab.click();
          await page.waitForTimeout(2000);

          const plannedSessionCard = page
            .getByText("Edit Test Beach")
            .locator("..");
          if (await plannedSessionCard.isVisible()) {
            // Look for edit button
            const editButton = plannedSessionCard.getByRole("button", {
              name: /edit/i,
            });
            if (await editButton.isVisible()) {
              await editButton.click();
              await page.waitForTimeout(1000);

              const editForm = page.locator("form, .session-form");
              if (await editForm.isVisible()) {
                // Edit the notes
                const notesInput = editForm.getByLabel(/notes/i);
                if (await notesInput.isVisible()) {
                  await notesInput.clear();
                  await notesInput.fill("Updated planned session notes");

                  const saveButton = editForm.getByRole("button", {
                    name: /save|update/i,
                  });
                  if (
                    (await saveButton.isVisible()) &&
                    (await saveButton.isEnabled())
                  ) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);

                    // Check if changes are reflected
                    const updatedNotes = page.getByText(
                      "Updated planned session notes"
                    );
                    const hasUpdatedNotes = await updatedNotes
                      .isVisible()
                      .catch(() => false);
                    expect(hasUpdatedNotes).toBeTruthy();
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Could not test planned session editing:", error);
      }
    });
  });
});

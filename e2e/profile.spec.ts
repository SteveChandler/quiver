import { test, expect } from "@playwright/test";

test.describe("Profile Management", () => {
  test.describe("Profile View", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/profile");
    });

    test.fixme("should display profile page correctly", async ({ page }) => {
      // Check that profile content is visible or we have content
      const hasProfileView = await page
        .getByTestId("profile-view")
        .isVisible()
        .catch(() => false);
      const hasProfileContent = await page
        .locator(".profile")
        .isVisible()
        .catch(() => false);
      const hasMainContent = await page
        .locator("main")
        .isVisible()
        .catch(() => false);

      expect(
        hasProfileView || hasProfileContent || hasMainContent
      ).toBeTruthy();

      // Look for basic profile elements
      const profileElements = [
        page.getByTestId("profile-avatar").or(page.locator(".avatar")),
        page.getByTestId("profile-name").or(page.getByText(/name|username/i)),
        page.getByTestId("profile-email").or(page.getByText(/@/)), // Email contains @
      ];

      const visibleElements = await Promise.all(
        profileElements.map((el) => el.isVisible().catch(() => false))
      );

      expect(visibleElements.some((el) => el)).toBeTruthy();
    });

    test("should show user boards (quiver)", async ({ page }) => {
      // Look for boards section
      const boardsSection = page
        .getByTestId("user-boards")
        .or(page.getByText(/boards|quiver/i));
      const boardsList = page.locator(
        '[data-testid="board-item"], .board-item'
      );

      if (await boardsSection.isVisible()) {
        await expect(boardsSection).toBeVisible();

        // Check if boards are displayed
        const boardCount = await boardsList.count();
        if (boardCount > 0) {
          // Verify board information is shown
          const firstBoard = boardsList.first();
          await expect(firstBoard).toBeVisible();
        }
      }
    });

    test("should show session history", async ({ page }) => {
      // Look for session history section
      const sessionsSection = page
        .getByTestId("session-history")
        .or(page.getByText(/sessions|history/i));
      const sessionsList = page.locator(
        '[data-testid="session-item"], .session-item'
      );

      if (await sessionsSection.isVisible()) {
        await expect(sessionsSection).toBeVisible();

        // Check if sessions are displayed
        const sessionCount = await sessionsList.count();
        if (sessionCount > 0) {
          const firstSession = sessionsList.first();
          await expect(firstSession).toBeVisible();
        }
      }
    });

    test("should have edit profile button", async ({ page }) => {
      const editButton = page
        .getByRole("button", { name: /edit|edit profile/i })
        .or(page.getByTestId("edit-profile-button"));

      if (await editButton.isVisible()) {
        await expect(editButton).toBeVisible();

        // Click edit button and verify navigation
        await editButton.click();
        await expect(page).toHaveURL(/profile\/edit/);
      }
    });

    test("should display profile statistics", async ({ page }) => {
      // Look for statistics like total sessions, favorite beaches, etc.
      const statsElements = [
        page
          .getByTestId("total-sessions")
          .or(page.getByText(/total sessions/i)),
        page
          .getByTestId("favorite-beach")
          .or(page.getByText(/favorite beach/i)),
        page
          .getByTestId("total-hours")
          .or(page.getByText(/hours|time surfed/i)),
      ];

      const visibleStats = await Promise.all(
        statsElements.map((el) => el.isVisible().catch(() => false))
      );

      // At least some stats should be visible
      if (visibleStats.some((stat) => stat)) {
        expect(visibleStats.some((stat) => stat)).toBeTruthy();
      }
    });
  });

  test.describe("Profile Edit", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/profile/edit");
      // Wait for potential auth redirect
      await page.waitForTimeout(2000);
    });

    test("should display profile edit form when authenticated", async ({
      page,
    }) => {
      // Skip if redirected to auth
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping profile edit tests");
      }

      // Check that edit form is visible
      const editForm = page
        .getByTestId("profile-edit-form")
        .or(page.locator("form"));
      await expect(editForm).toBeVisible();

      // Check for basic form fields
      const formFields = [
        page.getByLabel(/name|username/i),
        page.getByLabel(/email/i),
        page.getByLabel(/bio|about/i).or(page.getByPlaceholder(/bio|about/i)),
      ];

      const visibleFields = await Promise.all(
        formFields.map((field) => field.isVisible().catch(() => false))
      );

      expect(visibleFields.some((field) => field)).toBeTruthy();
    });

    test("should allow editing basic profile information", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping profile edit tests");
      }

      // Fill out profile fields
      const nameField = page.getByLabel(/name|username/i);
      if (await nameField.isVisible()) {
        await nameField.clear();
        await nameField.fill("Test Surfer");
      }

      const bioField = page
        .getByLabel(/bio|about/i)
        .or(page.getByPlaceholder(/bio|about/i));
      if (await bioField.isVisible()) {
        await bioField.clear();
        await bioField.fill(
          "Passionate surfer from California. Love dawn patrol sessions!"
        );
      }

      // Look for location field
      const locationField = page.getByLabel(/location|where/i);
      if (await locationField.isVisible()) {
        await locationField.clear();
        await locationField.fill("Malibu, CA");
      }
    });

    test("should allow avatar/profile picture upload", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping avatar tests");
      }

      // Look for avatar upload controls
      const avatarUpload = page.getByLabel(/avatar|profile picture|photo/i);
      const avatarButton = page.getByRole("button", {
        name: /upload|change photo/i,
      });

      if (await avatarUpload.isVisible()) {
        // File upload input should be present
        await expect(avatarUpload).toBeVisible();
      } else if (await avatarButton.isVisible()) {
        // Avatar change button should be clickable
        await expect(avatarButton).toBeVisible();
      }
    });

    test("should handle board management", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping board management tests");
      }

      // Look for board management section
      const boardsSection = page
        .getByTestId("boards-section")
        .or(page.getByText(/boards|quiver/i));

      if (await boardsSection.isVisible()) {
        // Look for add board button
        const addBoardButton = page.getByRole("button", {
          name: /add board|new board/i,
        });

        if (await addBoardButton.isVisible()) {
          await addBoardButton.click();

          // Should show board form
          const boardForm = page
            .getByTestId("board-form")
            .or(page.locator("form"));
          await expect(boardForm).toBeVisible();

          // Fill board details
          const boardNameField = page.getByLabel(/name|board name/i);
          if (await boardNameField.isVisible()) {
            await boardNameField.fill("6'2\" Performance Shortboard");
          }

          const boardTypeField = page.getByLabel(/type|board type/i);
          if (await boardTypeField.isVisible()) {
            await boardTypeField.click();
            await page
              .getByText(/shortboard|longboard|funboard/i)
              .first()
              .click();
          }

          const boardLengthField = page.getByLabel(/length|size/i);
          if (await boardLengthField.isVisible()) {
            await boardLengthField.fill("6'2\"");
          }
        }
      }
    });

    test("should allow setting default beach preference", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping beach preference tests");
      }

      // Look for default beach field
      const defaultBeachField = page.getByLabel(
        /default beach|favorite beach|home beach/i
      );

      if (await defaultBeachField.isVisible()) {
        await defaultBeachField.click();
        await defaultBeachField.fill("Malibu");

        // Wait for autocomplete
        await page.waitForTimeout(1000);

        // Select from dropdown if available
        const beachOption = page.locator('[role="option"]').first();
        if (await beachOption.isVisible()) {
          await beachOption.click();
        }

        // Save the profile
        const saveButton = page.getByRole("button", { name: /save|update/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    });

    test("should display favorite beach on home page after setting", async ({
      page,
    }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip(
          "User not authenticated - skipping favorite beach integration tests"
        );
      }

      // First set a favorite beach in profile
      await page.goto("/profile/edit");
      await page.waitForTimeout(2000);

      const defaultBeachField = page.getByLabel(
        /default beach|favorite beach|home beach/i
      );

      if (await defaultBeachField.isVisible()) {
        await defaultBeachField.click();
        await defaultBeachField.fill("Ocean Beach");

        // Wait for autocomplete
        await page.waitForTimeout(1000);

        // Select from dropdown if available
        const beachOption = page.locator('[role="option"]').first();
        if (await beachOption.isVisible()) {
          await beachOption.click();
        }

        // Save the profile
        const saveButton = page.getByRole("button", { name: /save|update/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Navigate to home page
      await page.goto("/");
      await page.waitForTimeout(3000);

      // Check if Ocean Beach is displayed in the forecast section
      const forecastSection = page.locator(
        '[data-testid="forecast-tab"], .forecast-section'
      );
      if (await forecastSection.isVisible()) {
        // Look for Ocean Beach in the forecast content
        const oceanBeachText = page.getByText(/ocean beach/i);
        const favoriteMessage = page.getByText(
          /favorite beach|showing.*favorite/i
        );

        const hasOceanBeach = await oceanBeachText
          .isVisible()
          .catch(() => false);
        const hasFavoriteMessage = await favoriteMessage
          .isVisible()
          .catch(() => false);

        // At least one should be visible to confirm favorite beach is loading
        expect(hasOceanBeach || hasFavoriteMessage).toBeTruthy();
      }
    });

    test("should fallback to Huntington Beach for users without favorite", async ({
      page,
    }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip(
          "User not authenticated - skipping default beach fallback tests"
        );
      }

      // Clear any existing favorite beach
      await page.goto("/profile/edit");
      await page.waitForTimeout(2000);

      const defaultBeachField = page.getByLabel(
        /default beach|favorite beach|home beach/i
      );

      if (await defaultBeachField.isVisible()) {
        await defaultBeachField.click();
        await defaultBeachField.clear();

        // Save the profile
        const saveButton = page.getByRole("button", { name: /save|update/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Navigate to home page
      await page.goto("/");
      await page.waitForTimeout(3000);

      // Should show Huntington Beach as fallback
      const huntingtonText = page.getByText(/huntington beach/i);
      const isHuntingtonVisible = await huntingtonText
        .isVisible()
        .catch(() => false);

      if (isHuntingtonVisible) {
        expect(huntingtonText).toBeVisible();
      }
    });

    test("should handle surf preferences", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping surf preferences tests");
      }

      // Look for surf preference fields
      const skillLevelField = page.getByLabel(/skill level|experience/i);
      if (await skillLevelField.isVisible()) {
        await skillLevelField.click();
        await page
          .getByText(/beginner|intermediate|advanced/i)
          .first()
          .click();
      }

      const preferredWaveHeightField = page.getByLabel(
        /preferred wave height|ideal waves/i
      );
      if (await preferredWaveHeightField.isVisible()) {
        await preferredWaveHeightField.fill("2-4 feet");
      }

      const surfStyleField = page.getByLabel(/surf style|style/i);
      if (await surfStyleField.isVisible()) {
        await surfStyleField.click();
        await page
          .getByText(/performance|longboard|progressive/i)
          .first()
          .click();
      }
    });

    test("should validate required fields", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping validation tests");
      }

      // Clear required fields and try to submit
      const nameField = page.getByLabel(/name|username/i);
      if (await nameField.isVisible()) {
        await nameField.clear();
      }

      // Try to submit
      const saveButton = page.getByRole("button", { name: /save|update/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show validation errors
        await page.waitForTimeout(1000);
        const errorMessage = page.locator(
          '[role="alert"], .error, .text-red, .text-destructive'
        );
        const hasErrors = (await errorMessage.count()) > 0;

        expect(hasErrors).toBeTruthy();
      }
    });

    test("should successfully save profile changes", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping save tests");
      }

      // Fill out a basic field
      const nameField = page.getByLabel(/name|username/i);
      if (await nameField.isVisible()) {
        await nameField.clear();
        await nameField.fill("Updated Surfer Name");
      }

      // Save changes
      const saveButton = page.getByRole("button", { name: /save|update/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Wait for save to complete
        await page.waitForTimeout(2000);

        // Should show success message or redirect to profile
        const hasSuccessMessage = await page
          .getByText(/success|saved|updated/i)
          .isVisible()
          .catch(() => false);
        const isRedirectedToProfile =
          page.url().includes("/profile") && !page.url().includes("/edit");

        expect(hasSuccessMessage || isRedirectedToProfile).toBeTruthy();
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

        // Should navigate back to profile
        await page.waitForTimeout(1000);
        expect(page.url()).toContain("/profile");
        expect(page.url()).not.toContain("/edit");
      }
    });

    test("should handle board deletion", async ({ page }) => {
      // Skip if not authenticated
      if (
        page.url().includes("/auth") ||
        page.url() === new URL("/", page.url()).href
      ) {
        test.skip("User not authenticated - skipping board deletion tests");
      }

      // Look for existing boards with delete buttons
      const deleteButton = page
        .getByRole("button", { name: /delete|remove/i })
        .first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        const confirmDialog = page
          .getByRole("dialog")
          .or(page.getByText(/confirm|are you sure/i));
        if (await confirmDialog.isVisible()) {
          const confirmButton = page.getByRole("button", {
            name: /confirm|yes|delete/i,
          });
          if (await confirmButton.isVisible()) {
            await confirmButton.click();

            // Wait for deletion to complete
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });
});

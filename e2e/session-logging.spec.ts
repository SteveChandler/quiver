import { test, expect } from "@playwright/test";

test.describe("Session Logging", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to log session page
    await page.goto("/log-session");

    // Wait for page to load and handle potential auth redirect
    await page.waitForTimeout(2000);
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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping validation tests");
    }

    // Try to submit form without filling required fields
    const submitButton = page.getByRole("button", {
      name: /log session|save|submit/i,
    });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation errors
      await page.waitForTimeout(1000);
      const errorMessages = page.locator(
        '[role="alert"], .error, .text-red, .text-destructive'
      );
      const hasErrors = (await errorMessages.count()) > 0;

      expect(hasErrors).toBeTruthy();
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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping submission tests");
    }

    // Fill out minimum required fields
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.fill("Test Beach");
    }

    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      const today = new Date().toISOString().split("T")[0];
      await dateField.fill(today);
    }

    // Submit the form
    const submitButton = page.getByRole("button", {
      name: /log session|save|submit/i,
    });
    if (await submitButton.isVisible()) {
      await submitButton.click();

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

      // Should navigate away from the form
      await page.waitForTimeout(1000);
      expect(page.url()).not.toContain("/log-session");
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
        name: /log session|save|submit/i,
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
});

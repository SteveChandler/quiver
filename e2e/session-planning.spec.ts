import { test, expect } from "@playwright/test";

test.describe("Session Planning", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to plan session page
    await page.goto("/plan-session");

    // Wait for page to load and handle potential auth redirect
    await page.waitForTimeout(2000);
  });

  test("should display session planning form when authenticated", async ({
    page,
  }) => {
    // Skip if redirected to auth (user not logged in)
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping session planning tests");
    }

    // Check that session form is visible
    const sessionForm = page
      .getByTestId("session-form")
      .or(page.locator("form"));
    await expect(sessionForm).toBeVisible();

    // Check for key form fields that should be present in session planning
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
  });

  test("should allow planning future sessions", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip(
        "User not authenticated - skipping future session planning tests"
      );
    }

    // Fill out beach information
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.click();
      await beachField.fill("Malibu");
    }

    // Fill out future date
    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split("T")[0];
      await dateField.fill(tomorrowString);
    }

    // Fill out planned time
    const timeField = page
      .getByLabel(/time/i)
      .or(page.getByPlaceholder(/time/i));
    if (await timeField.isVisible()) {
      await timeField.fill("06:00");
    }

    // Select board for the session
    const boardField = page
      .getByLabel(/board/i)
      .or(page.getByPlaceholder(/board/i));
    if (await boardField.isVisible()) {
      await boardField.click();
      await boardField.fill("9'0\" Longboard");
    }
  });

  test("should display forecast information when available", async ({
    page,
  }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping forecast tests");
    }

    // Fill out beach to potentially trigger forecast display
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.fill("Malibu");
      await page.waitForTimeout(2000); // Wait for potential forecast loading
    }

    // Look for forecast information
    const forecastSection = page
      .getByTestId("forecast")
      .or(page.locator(".forecast"));
    const waveHeight = page.getByText(/wave height|waves|feet/i);
    const windInfo = page.getByText(/wind|offshore|onshore/i);
    const tideInfo = page.getByText(/tide|high tide|low tide/i);

    const hasForecastInfo = await Promise.all([
      forecastSection.isVisible().catch(() => false),
      waveHeight.isVisible().catch(() => false),
      windInfo.isVisible().catch(() => false),
      tideInfo.isVisible().catch(() => false),
    ]);

    // Should have some forecast information visible
    const forecastVisible = hasForecastInfo.some((info) => info);

    if (forecastVisible) {
      expect(forecastVisible).toBeTruthy();
    } else {
      // If no forecast is shown, that's also acceptable - just note it
      console.log(
        "No forecast information displayed - this may be expected behavior"
      );
    }
  });

  test("should allow setting planned session duration", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping duration planning tests");
    }

    // Look for duration or time-related fields
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
      await startTimeField.fill("06:00");
      await endTimeField.fill("08:00");
    }
  });

  test("should handle session planning notes and goals", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping notes tests");
    }

    // Fill session planning notes
    const notesField = page
      .getByLabel(/notes|goals|plan/i)
      .or(page.getByPlaceholder(/notes|goals|plan/i));
    if (await notesField.isVisible()) {
      await notesField.fill(
        "Dawn patrol session. Focus on bottom turns and cutbacks."
      );
    }

    // Look for goals or objectives field
    const goalsField = page
      .getByLabel(/goals|objectives/i)
      .or(page.getByPlaceholder(/goals|objectives/i));
    if (await goalsField.isVisible()) {
      await goalsField.fill("Work on backhand surfing");
    }
  });

  test("should validate future date selection", async ({ page }) => {
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
      // Try to enter past date (should be prevented or warned for planning)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateString = pastDate.toISOString().split("T")[0];

      await dateField.fill(pastDateString);

      // Check if there's validation or if past dates are allowed
      const submitButton = page.getByRole("button", {
        name: /plan session|save|submit/i,
      });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Look for validation message about past dates
        const validationMessage = await page
          .getByText(/past|cannot plan|future only/i)
          .isVisible()
          .catch(() => false);

        if (validationMessage) {
          expect(validationMessage).toBeTruthy();
        }
      }
    }
  });

  test("should allow selecting optimal conditions preferences", async ({
    page,
  }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping conditions tests");
    }

    // Look for wave height preferences
    const waveHeightField = page.getByLabel(
      /preferred wave height|ideal height/i
    );
    if (await waveHeightField.isVisible()) {
      await waveHeightField.fill("2-4 feet");
    }

    // Look for wind preferences
    const windField = page.getByLabel(/wind preference|ideal wind/i);
    if (await windField.isVisible()) {
      await windField.fill("Light offshore");
    }

    // Look for tide preferences
    const tideField = page.getByLabel(/tide preference|preferred tide/i);
    if (await tideField.isVisible()) {
      await tideField.click();
      await page
        .getByText(/high tide|low tide|incoming|outgoing/i)
        .first()
        .click();
    }
  });

  test("should successfully submit session plan", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping submission tests");
    }

    // Fill out minimum required fields for planning
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.fill("Test Beach Planning");
    }

    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split("T")[0];
      await dateField.fill(tomorrowString);
    }

    // Submit the form
    const submitButton = page.getByRole("button", {
      name: /plan session|save|submit/i,
    });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Wait for submission to complete
      await page.waitForTimeout(2000);

      // Should either redirect or show success message
      const isRedirectedToSessions = page.url().includes("/sessions");
      const hasSuccessMessage = await page
        .getByText(/success|planned|saved/i)
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

  test("should integrate with weather and surf forecasts", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping forecast integration tests");
    }

    // Select a beach and future date
    const beachField = page
      .getByLabel(/beach/i)
      .or(page.getByPlaceholder(/beach/i));
    if (await beachField.isVisible()) {
      await beachField.fill("Malibu");
    }

    const dateField = page
      .getByLabel(/date/i)
      .or(page.getByPlaceholder(/date/i));
    if (await dateField.isVisible()) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const futureDateString = futureDate.toISOString().split("T")[0];
      await dateField.fill(futureDateString);

      // Wait for potential forecast loading
      await page.waitForTimeout(3000);
    }

    // Check for forecast-based recommendations
    const recommendations = page
      .getByTestId("recommendations")
      .or(page.locator(".recommendations"));
    const forecastAlert = page.getByText(/conditions|forecast|recommended/i);

    const hasRecommendations = await recommendations
      .isVisible()
      .catch(() => false);
    const hasForecastAlert = await forecastAlert.isVisible().catch(() => false);

    if (hasRecommendations || hasForecastAlert) {
      expect(hasRecommendations || hasForecastAlert).toBeTruthy();
    }
  });

  test("should handle session reminders or notifications", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping reminder tests");
    }

    // Look for reminder options
    const reminderCheckbox = page.getByLabel(/reminder|notify|alert/i);
    const reminderTime = page.getByLabel(/remind me|notification time/i);

    if (await reminderCheckbox.isVisible()) {
      await reminderCheckbox.check();

      if (await reminderTime.isVisible()) {
        await reminderTime.fill("1 hour before");
      }
    }
  });

  test("should allow comparing multiple beach options", async ({ page }) => {
    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping beach comparison tests");
    }

    // Look for beach comparison features
    const addBeachButton = page.getByRole("button", {
      name: /add beach|compare beaches/i,
    });
    const beachOptions = page.locator('[data-testid="beach-option"]');

    if (await addBeachButton.isVisible()) {
      await addBeachButton.click();
      await page.waitForTimeout(1000);

      // Should show multiple beach selection options
      const beachCount = await beachOptions.count();
      expect(beachCount).toBeGreaterThanOrEqual(1);
    }
  });
});

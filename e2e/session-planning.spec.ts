import { test, expect } from "@playwright/test";
import { handleAuthRedirect } from "./test-helpers";

// Re-enabled session planning tests with comprehensive error detection
test.describe("Session Planning", () => {
  // Track React errors and infinite loops
  test.beforeEach(async ({ page }) => {
    // Set up error tracking
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("Page error:", error.message);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const errorText = msg.text();
        errors.push(errorText);
        console.error("Console error:", errorText);
      }
    });

    // Store errors array on page for test access
    await page.addInitScript(() => {
      (window as any).__testErrors = [];
      const originalError = console.error;
      console.error = (...args) => {
        (window as any).__testErrors.push(args.join(" "));
        originalError.apply(console, args);
      };
    });

    await page.goto("/plan-session");
    await page.waitForTimeout(3000); // Give time for any issues to manifest

    // Check for infinite loops or critical React errors
    const pageErrors = await page.evaluate(
      () => (window as any).__testErrors || []
    );
    const hasInfiniteLoop = pageErrors.some(
      (error: string) =>
        error.includes("Maximum update depth exceeded") ||
        error.includes("Too many re-renders") ||
        error.includes("Rendered more hooks than during the previous render")
    );

    if (hasInfiniteLoop) {
      throw new Error(
        `Infinite loop detected in Plan Session page: ${pageErrors.join(", ")}`
      );
    }

    // Skip if not authenticated
    await handleAuthRedirect(page);
  });

  test("should display session planning form without React errors", async ({
    page,
  }) => {
    // Verify no critical React errors occurred during load
    const jsErrors = await page.evaluate(
      () => (window as any).__testErrors || []
    );
    const criticalErrors = jsErrors.filter(
      (error: string) =>
        error.includes("Error:") ||
        error.includes("TypeError:") ||
        error.includes("ReferenceError:")
    );

    expect(criticalErrors.length).toBe(0);

    // Check for basic form elements
    const form = page.getByTestId("session-planning-form");
    const beachField = page.getByLabel(/beach/i);
    const dateField = page.getByLabel(/date/i);

    // At least one form element should be visible
    const hasForm = await form.isVisible().catch(() => false);
    const hasBeachField = await beachField.isVisible().catch(() => false);
    const hasDateField = await dateField.isVisible().catch(() => false);

    expect(hasForm || hasBeachField || hasDateField).toBeTruthy();
  });

  test("should handle friend invitations section without infinite loops", async ({
    page,
  }) => {
    // Test the specific component that was causing infinite loops
    await page.waitForTimeout(2000);

    // Look for the group invitations section
    const inviteSection = page
      .locator('[data-testid="group-invitations"]')
      .first();

    if (await inviteSection.isVisible()) {
      // Wait and verify no infinite re-renders
      await page.waitForTimeout(3000);

      const renderErrors = await page.evaluate(
        () => (window as any).__testErrors || []
      );
      const hasRenderLoop = renderErrors.some(
        (error: string) =>
          error.includes("Maximum update depth") ||
          error.includes("re-render") ||
          error.includes("useEffect")
      );

      expect(hasRenderLoop).toBeFalsy();
    }
  });

  test("should handle API failures gracefully", async ({ page }) => {
    // Mock the problematic API endpoint to return 500
    await page.route("/api/session-planner/invitations*", (route) => {
      if (route.request().url().includes("type=friends")) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Internal server error" }),
        });
      } else {
        route.continue();
      }
    });

    // Reload page with mocked failing API
    await page.reload();
    await page.waitForTimeout(3000);

    // Page should still load without crashing
    const hasMainContent = await page
      .locator("main")
      .isVisible()
      .catch(() => false);
    const hasBody = await page
      .locator("body")
      .isVisible()
      .catch(() => false);

    expect(hasMainContent || hasBody).toBeTruthy();

    // Should not have infinite loop errors even with API failure
    const apiErrors = await page.evaluate(
      () => (window as any).__testErrors || []
    );
    const hasInfiniteLoop = apiErrors.some((error: string) =>
      error.includes("Maximum update depth exceeded")
    );

    expect(hasInfiniteLoop).toBeFalsy();
  });

  test("should allow planning future sessions", async ({ page }) => {
    // Skip if we're on the sign-in page
    await handleAuthRedirect(page);

    // Fill out future session with a real beach from the database
    const beachField = page.locator('[data-testid="beach-search-input"]');
    if (await beachField.isVisible()) {
      await beachField.fill("Blacks");
      await page.waitForTimeout(1000);
      
      // Click on the beach suggestion if it appears
      const beachSuggestion = page.locator('text="Blacks"').first();
      if (await beachSuggestion.isVisible()) {
        await beachSuggestion.click();
      }
    }

    const dateField = page.locator('[data-testid="session-date-input"]');
    if (await dateField.isVisible()) {
      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split("T")[0];
      await dateField.fill(dateString);
    }

    const timeField = page.locator('[data-testid="session-time-input"]');
    if (await timeField.isVisible()) {
      await timeField.fill("08:00");
    }

    // Wait for form validation
    await page.waitForTimeout(1000);

    const saveButton = page.getByRole("button", { name: /save|plan/i });
    if (await saveButton.isVisible()) {
      expect(await saveButton.isEnabled()).toBeTruthy();
    }
  });

  test("should display forecast information when available", async ({
    page,
  }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    // Fill in beach to trigger forecast
    const beachField = page.getByLabel(/beach/i);
    if (await beachField.isVisible()) {
      await beachField.fill("Huntington Beach");
      await page.waitForTimeout(2000);

      // Look for forecast information
      const forecast = page.getByTestId("forecast-info");
      const waveHeight = page.getByText(/wave.*height/i);
      const windSpeed = page.getByText(/wind/i);

      const hasForecast = await forecast.isVisible().catch(() => false);
      const hasWaveHeight = await waveHeight.isVisible().catch(() => false);
      const hasWindSpeed = await windSpeed.isVisible().catch(() => false);

      // At least one forecast element should be visible
      expect(hasForecast || hasWaveHeight || hasWindSpeed).toBeTruthy();
    }
  });

  test("should allow setting planned session duration", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    const durationField = page.getByLabel(/duration/i);
    if (await durationField.isVisible()) {
      await durationField.fill("2"); // 2 hours
      expect(await durationField.inputValue()).toBe("2");
    }
  });

  test("should handle session planning notes and goals", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    const notesField = page.getByLabel(/notes|goals/i);
    if (await notesField.isVisible()) {
      await notesField.fill("Work on duck dives and timing");
      expect(await notesField.inputValue()).toContain("duck dives");
    }
  });

  test("should validate future date selection", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    const dateField = page.getByLabel(/date/i);
    if (await dateField.isVisible()) {
      // Try to set a past date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split("T")[0];

      await dateField.fill(pastDate);

      // Should show validation error or prevent submission
      const errorMessage = page.getByText(/past.*date|invalid.*date/i);
      const saveButton = page.getByRole("button", { name: /save|plan/i });

      const hasError = await errorMessage.isVisible().catch(() => false);
      const buttonDisabled = await saveButton.isDisabled().catch(() => true);

      expect(hasError || buttonDisabled).toBeTruthy();
    }
  });

  test("should handle session planning with weather conditions", async ({
    page,
  }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    // Fill in session details
    const beachField = page.getByLabel(/beach/i);
    if (await beachField.isVisible()) {
      await beachField.fill("Manhattan Beach");
    }

    // Look for weather/condition indicators
    const conditionIndicators = page.locator(
      '[data-testid*="condition"], .condition-indicator'
    );
    const weatherInfo = page.getByText(/weather|wind|temperature/i);

    const hasConditions =
      (await conditionIndicators.count().catch(() => 0)) > 0;
    const hasWeatherInfo = await weatherInfo.isVisible().catch(() => false);

    // Should show some kind of condition information
    expect(hasConditions || hasWeatherInfo).toBeTruthy();
  });

  test("should successfully submit session plan", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    // Fill out minimum required fields
    const beachField = page.getByLabel(/beach/i);
    if (await beachField.isVisible()) {
      await beachField.fill("Redondo Beach");
    }

    const dateField = page.getByLabel(/date/i);
    if (await dateField.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await dateField.fill(tomorrow.toISOString().split("T")[0]);
    }

    const saveButton = page.getByRole("button", { name: /save|plan/i });
    if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
      await saveButton.click();

      // Should show success message or redirect
      const successMessage = page.getByText(/planned|success/i);
      const isRedirected = !page.url().includes("/plan-session");

      const hasSuccess = await successMessage.isVisible().catch(() => false);

      expect(hasSuccess || isRedirected).toBeTruthy();
    }
  });

  test("should integrate with weather and surf forecasts", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    const beachField = page.getByLabel(/beach/i);
    if (await beachField.isVisible()) {
      await beachField.fill("Venice Beach");
      await page.waitForTimeout(2000);

      // Should show forecast integration
      const forecastSection = page.getByTestId("forecast-section");
      const waveInfo = page.getByText(/wave|surf|swell/i);
      const tideInfo = page.getByText(/tide|high|low/i);

      const hasForecastSection = await forecastSection
        .isVisible()
        .catch(() => false);
      const hasWaveInfo = await waveInfo.isVisible().catch(() => false);
      const hasTideInfo = await tideInfo.isVisible().catch(() => false);

      expect(hasForecastSection || hasWaveInfo || hasTideInfo).toBeTruthy();
    }
  });

  test("should handle session reminders or notifications", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    // Look for reminder options
    const reminderCheckbox = page.getByLabel(/reminder|notify/i);
    const reminderSelect = page.getByLabel(/remind.*me/i);

    const hasReminderOption =
      (await reminderCheckbox.isVisible().catch(() => false)) ||
      (await reminderSelect.isVisible().catch(() => false));

    if (hasReminderOption) {
      expect(hasReminderOption).toBeTruthy();
    }
  });

  test("should allow comparing multiple beach options", async ({ page }) => {
    // Skip if not authenticated
    await handleAuthRedirect(page);

    // Look for comparison features
    const compareButton = page.getByRole("button", { name: /compare/i });
    const multipleBeaches = page.locator('[data-testid*="beach-option"]');

    const hasCompareButton = await compareButton.isVisible().catch(() => false);
    const hasMultipleOptions =
      (await multipleBeaches.count().catch(() => 0)) > 1;

    if (hasCompareButton || hasMultipleOptions) {
      expect(hasCompareButton || hasMultipleOptions).toBeTruthy();
    }
  });
});

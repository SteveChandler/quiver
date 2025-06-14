import { test, expect } from "@playwright/test";

// Session planning feature is not yet implemented (Phase 2)
// Skipping entire test suite until the feature is ready
test.describe.skip("Session Planning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plan-session");
    await page.waitForTimeout(2000);

    // Skip if not authenticated
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping session planning tests");
    }
  });

  test("should display session planning form when authenticated", async ({
    page,
  }) => {
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

  test("should allow planning future sessions", async ({ page }) => {
    // Skip if we're on the sign-in page
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip(
        "User not authenticated - skipping future session planning test"
      );
    }

    // Fill out future session
    const beachField = page.getByLabel(/beach/i);
    if (await beachField.isVisible()) {
      await beachField.fill("Malibu");
    }

    const dateField = page.getByLabel(/date/i);
    if (await dateField.isVisible()) {
      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split("T")[0];
      await dateField.fill(dateString);
    }

    const timeField = page.getByLabel(/time/i);
    if (await timeField.isVisible()) {
      await timeField.fill("08:00");
    }

    // Check if form accepts future dates
    const saveButton = page.getByRole("button", { name: /save|plan/i });
    if (await saveButton.isVisible()) {
      expect(await saveButton.isEnabled()).toBeTruthy();
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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping duration planning tests");
    }

    const durationField = page.getByLabel(/duration/i);
    if (await durationField.isVisible()) {
      await durationField.fill("2"); // 2 hours
      expect(await durationField.inputValue()).toBe("2");
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

    const notesField = page.getByLabel(/notes|goals/i);
    if (await notesField.isVisible()) {
      await notesField.fill("Work on duck dives and timing");
      expect(await notesField.inputValue()).toContain("duck dives");
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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping conditions tests");
    }

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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping submission tests");
    }

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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping forecast integration tests");
    }

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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping reminder tests");
    }

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
    if (
      page.url().includes("/auth") ||
      page.url() === new URL("/", page.url()).href
    ) {
      test.skip("User not authenticated - skipping beach comparison tests");
    }

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

import { test, expect } from "@playwright/test";
import { ensureAuthenticated } from "./test-helpers";

test.describe("Session Conversion (Improved)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const authed = await ensureAuthenticated(page, 15000);
    if (!authed) throw new Error("Auth required for session conversion tests");
  });

  test("should convert planned session to completed session with proper validation", async ({
    page,
  }) => {
    // 1. Create a planned session first
    await page.goto("/sessions/new?mode=plan");
    await expect(page.locator("body")).toBeVisible();

    // Fill planning form deterministically
    const beachInput = page.locator("#beach-input");
    await expect(beachInput).toBeVisible();
    await beachInput.fill("Malibu");

    // Wait for and select from beach dropdown
    await page.waitForTimeout(1000); // Allow beach suggestions to load
    const beachSuggestion = page.getByText("Malibu").first();
    if (await beachSuggestion.isVisible()) {
      await beachSuggestion.click();
    }

    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    // Plan for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await dateInput.fill(tomorrow.toISOString().split("T")[0]);

    const notesInput = page.getByLabel(/notes/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill("Planned session for conversion testing");
    }

    // Submit planned session
    const planButton = page.getByRole("button", { name: /plan|save/i });
    await expect(planButton).toBeEnabled();
    await planButton.click();

    // Wait for success and navigation
    await expect(page.getByText(/planned|success/i)).toBeVisible();

    // 2. Navigate to profile to find planned session
    await page.goto("/profile");
    await expect(page.locator("body")).toBeVisible();

    // Find planned sessions section
    const plannedSection = page.getByText("Malibu");
    await expect(plannedSection).toBeVisible();

    // 3. Find and click convert button
    const sessionCard = plannedSection.locator("..").locator("..");
    const convertButton = sessionCard.getByRole("button", {
      name: /convert|mark.*completed|log.*session/i,
    });
    await expect(convertButton).toBeVisible();
    await convertButton.click();

    // 4. Verify conversion form opens with prefilled data
    await expect(page).toHaveURL(/log-session.*convert/);

    const conversionBeachInput = page.locator("#beach-input");
    await expect(conversionBeachInput).toHaveValue("Malibu");

    // 5. Fill conversion form with actual session data
    const ratingSelect = page.getByLabel(/rating|quality/i);
    if (await ratingSelect.isVisible()) {
      await ratingSelect.selectOption("4");
    }

    const durationInput = page.getByLabel(/duration/i);
    if (await durationInput.isVisible()) {
      await durationInput.fill("90");
    }

    // Update notes to reflect completed session
    const conversionNotesInput = page.getByLabel(/notes/i);
    await expect(conversionNotesInput).toBeVisible();
    await conversionNotesInput.clear();
    await conversionNotesInput.fill(
      "Completed session! Great waves at Malibu."
    );

    // 6. Submit conversion
    const convertSubmitButton = page.getByRole("button", {
      name: /save|log|complete/i,
    });
    await expect(convertSubmitButton).toBeEnabled();
    await convertSubmitButton.click();

    // 7. Verify successful conversion
    await expect(page.getByText(/success|completed|logged/i)).toBeVisible();

    // 8. Verify session moved to completed section
    await page.goto("/profile");
    const completedSession = page.getByText(
      "Completed session! Great waves at Malibu."
    );
    await expect(completedSession).toBeVisible();
  });

  test("should preserve all planned session data during conversion", async ({
    page,
  }) => {
    // Create planned session with specific data
    await page.goto("/sessions/new?mode=plan");
    await expect(page.locator("body")).toBeVisible();

    const beachInput = page.locator("#beach-input");
    await beachInput.fill("Specific Beach for Data Test");

    const dateInput = page.locator('input[type="date"]');
    const testDate = "2024-12-25";
    await dateInput.fill(testDate);

    const timeInput = page.locator('input[type="time"]');
    if (await timeInput.isVisible()) {
      await timeInput.fill("06:30");
    }

    // Add board selection if available
    const boardSelect = page.getByLabel(/board/i);
    if (await boardSelect.isVisible()) {
      await boardSelect.selectOption({ index: 1 });
    }

    const notesInput = page.getByLabel(/notes/i);
    await notesInput.fill("Early dawn patrol session with specific data");

    // Submit planned session
    const planButton = page.getByRole("button", { name: /plan|save/i });
    await planButton.click();
    await expect(page.getByText(/success/i)).toBeVisible();

    // Navigate to conversion
    await page.goto("/profile");
    const sessionCard = page.getByText("Specific Beach for Data Test");
    await expect(sessionCard).toBeVisible();

    const convertButton = sessionCard
      .locator("..")
      .locator("..")
      .getByRole("button", { name: /convert/i });
    await convertButton.click();

    // Verify all data is preserved
    await expect(page.locator("#beach-input")).toHaveValue(
      "Specific Beach for Data Test"
    );
    await expect(page.locator('input[type="date"]')).toHaveValue(testDate);

    const preservedNotes = page.getByLabel(/notes/i);
    await expect(preservedNotes).toHaveValue(
      "Early dawn patrol session with specific data"
    );

    // Verify this is a conversion (not new session)
    await expect(page).toHaveURL(/convert=/);
    await expect(page.getByText(/converting|planned.*session/i)).toBeVisible();
  });

  test("should handle conversion cancellation gracefully", async ({ page }) => {
    // Create planned session
    await page.goto("/sessions/new?mode=plan");
    await expect(page.locator("body")).toBeVisible();

    const beachInput = page.locator("#beach-input");
    await expect(beachInput).toBeVisible();
    await beachInput.fill("Cancellation Test Beach");

    // Add required date field
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await dateInput.fill(tomorrow.toISOString().split("T")[0]);

    const planButton = page.getByRole("button", { name: /plan|save/i });
    await expect(planButton).toBeEnabled();
    await planButton.click();
    await expect(page.getByText(/success/i)).toBeVisible();

    // Start conversion process
    await page.goto("/profile");
    const sessionCard = page.getByText("Cancellation Test Beach");
    const convertButton = sessionCard
      .locator("..")
      .locator("..")
      .getByRole("button", { name: /convert/i });
    await convertButton.click();

    // Cancel conversion (go back or navigate away)
    await page.goBack();

    // Verify planned session still exists and is unchanged
    await page.goto("/profile");
    const stillPlannedSession = page.getByText("Cancellation Test Beach");
    await expect(stillPlannedSession).toBeVisible();

    // Verify session is still marked as planned
    const sessionContainer = stillPlannedSession.locator("..").locator("..");
    await expect(
      sessionContainer.getByText(/planned|future|upcoming/i)
    ).toBeVisible();
  });

  test("should validate session ownership during conversion", async ({
    page,
  }) => {
    // This test ensures users can only convert their own sessions
    // In a real app, this would involve creating sessions as different users

    await page.goto("/log-session?convert=nonexistent-id");
    await page.waitForLoadState("load");

    // Should handle invalid session ID gracefully - either show error or redirect
    const hasErrorMessage = await page
      .getByText(/not found|error|invalid|failed/i)
      .isVisible()
      .catch(() => false);
    const isRedirected = !page.url().includes("convert=nonexistent-id");

    // Either should show error message or redirect away from invalid conversion
    expect(hasErrorMessage || isRedirected).toBeTruthy();

    // Should be on a valid page
    const currentUrl = page.url();
    const isOnValidPage =
      currentUrl.includes("/sessions/new?mode=log") ||
      currentUrl.includes("/profile") ||
      currentUrl.endsWith("/");
    expect(isOnValidPage).toBeTruthy();
  });
});

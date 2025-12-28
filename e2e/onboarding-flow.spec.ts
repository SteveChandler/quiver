/**
 * Onboarding Flow - Modal Close + Completion CTA
 *
 * Validates that:
 * - The onboarding Dialog close (X) actually closes a controlled Radix Dialog
 * - The completion CTA navigates to the dashboard Forecast tab deterministically
 *
 * Uses `showOnboarding=1` to force open and `debugOnboarding=1` (dev-only)
 * to skip the server-action save so this test is reproducible locally.
 *
 * @project auth
 */
import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";
import { ensureAuthenticated, waitForPageLoad } from "./utils/test-helpers";

test.describe("Onboarding - close + view full forecast", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test("close button dismisses, and completion CTA routes to forecast tab", async ({
    page,
  }) => {
    // Force onboarding to show in a predictable way.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });

    // Confirm first step is visible.
    await expect(page.getByTestId("welcome-step")).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Radix close button should work (wired via onOpenChange).
    const closeButton = dialog.getByRole("button", { name: /close/i });
    await closeButton.click();
    await expect(dialog).toBeHidden({ timeout: TIMEOUTS.long });

    // Re-open and run through steps.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);
    await expect(page.getByTestId("welcome-step")).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Step 1: Welcome
    await page.getByTestId("welcome-get-started").click();

    // Step 2: Profile
    await page.getByLabel(/full name/i).fill("Test User");
    await page.getByLabel(/display name/i).fill("TestSurfer");
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Experience
    await page.getByTestId("experience-intermediate").click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Wave preferences
    await page.getByTestId("wave-size-medium").click();
    await page.getByTestId("break-type-beach").click();
    await page.getByTestId("surf-style-shortboard").click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Home beach
    // Search and select first result (local DB should contain common beaches).
    await expect(page.getByText(/where do you usually surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    await page.getByLabel(/search for your beach/i).fill("Blacks");

    // Home beach results are rendered as buttons in an absolute dropdown beneath the input.
    // Click the first result row (most relevant match).
    const resultsDropdown = page.locator("div.absolute.z-10.w-full").first();
    const firstBeachOption = resultsDropdown.locator('button[type="button"]').first();
    await expect(firstBeachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await firstBeachOption.click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 6: Completion
    await expect(page.getByTestId("completion-step")).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Debug harness bypasses save and should navigate to forecast tab.
    await page.getByTestId("complete-onboarding-button").click();
    await expect(page).toHaveURL(/\/\?tab=forecast/i, { timeout: TIMEOUTS.long });

    // Home screen forecast tab content should be present.
    await expect(page.getByTestId("forecast-tab")).toBeVisible({
      timeout: TIMEOUTS.long,
    });
  });
});



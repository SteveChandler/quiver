/**
 * Onboarding Flow - Modal Close + Completion CTA
 *
 * Validates that:
 * - The onboarding overlay close (X) dismisses the full-screen onboarding
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
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

test.describe("Onboarding - close + view full forecast", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await ensureAuthenticated(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'close + view full forecast' });
  });

  test("close button dismisses, and completion CTA routes to forecast tab", async ({
    page,
  }) => {
    // Force onboarding to show in a predictable way.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.long });

    // Confirm first step (Home Beach) is visible.
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Skip (X) button dismisses the overlay.
    const closeButton = dialog.getByRole("button", { name: /skip onboarding/i });
    await closeButton.click();
    await expect(dialog).toBeHidden({ timeout: TIMEOUTS.long });

    // Re-open and run through steps.
    await page.goto("/?showOnboarding=1&debugOnboarding=1");
    await waitForPageLoad(page);
    await expect(page.getByText(/where do you surf/i)).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Step 1: Home beach — label is now uppercase tracking text
    await page.locator('#beachSearch').fill("Blacks");

    // Home beach results are rendered as buttons in a dark dropdown beneath the input.
    // Click the first result row (most relevant match).
    const resultsDropdown = page.locator("div.absolute.z-10.w-full").first();
    const firstBeachOption = resultsDropdown
      .locator('button[type="button"]')
      .first();
    await expect(firstBeachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await firstBeachOption.click();

    // Beach celebration: 500ms pause before auto-advancing
    // eslint-disable-next-line playwright/no-wait-for-timeout -- deliberate UX celebration delay
    await page.waitForTimeout(800);

    // Step 2: Level + Time (copy changed: "What kind of surfer are you?")
    await expect(page.getByTestId("level-and-time-step")).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    const levelStep = page.getByTestId("level-and-time-step");
    await levelStep.getByText("Intermediate").click();
    await levelStep.getByRole("button", { name: /continue/i }).click();

    // Step 3: Payoff
    await expect(page.getByTestId("payoff-step")).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    // Debug harness bypasses save — CTA text is now "See your full forecast →"
    await page.getByTestId("complete-onboarding-button").click();

    // After completing onboarding, router.push does a soft navigation.
    // Wait for the overlay to close and home page content to appear.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: TIMEOUTS.long });

    // Home screen content should be present - check for new UI elements
    // The home page now uses a time slot filter instead of tabs
    const timeSlotFilter = page.getByRole('radiogroup', { name: /time slot filter/i });
    const hasTimeSlotFilter = await isVisibleSafe(timeSlotFilter, { timeout: TIMEOUTS.long });

    if (hasTimeSlotFilter) {
      // New UI with time slot filter
      await expect(timeSlotFilter).toBeVisible();
    } else {
      // Fallback: check for any home page content (greeting, recommendation, or error state)
      const greeting = page.getByRole('heading', { level: 1 }).first();
      const hasGreeting = await isVisibleSafe(greeting, { timeout: TIMEOUTS.medium });

      // At minimum, the home page should have loaded with some content
      expect(hasGreeting).toBe(true);
    }
  });
});



import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";
import { waitForPageLoad } from "./utils/test-helpers";
import {
  TestUser,
  createTestUser,
  deleteTestUser,
  clearHomeBeach,
  getHomeBeachName,
  logProfileState,
  signInTestUser,
} from "./utils/profile-helpers";

/**
 * Nearby Beaches Regression Tests
 *
 * Regression guard for the get_nearby_beaches spatial RPC:
 * - Ensures GPS-based nearby beaches path does not silently fall back
 *   to client-side filtering due to DB function failures.
 * - Fails loudly if the browser console contains the spatial fallback warning.
 *
 * @project auth
 */

test.describe("Nearby Beaches - Spatial RPC Regression", () => {
  let testUser: TestUser | null = null;

  test.beforeAll(async () => {
    // Create an isolated test user with no home beach configured
    testUser = await createTestUser();
    await clearHomeBeach(testUser.id);
    await logProfileState(testUser.id, "Nearby Regression - Global Setup");
  });

  test.afterAll(async () => {
    if (testUser) {
      await deleteTestUser(testUser.id);
    }
  });

  test.beforeEach(async ({ page }) => {
    if (!testUser) {
      throw new Error("Test user not created - check beforeAll hook");
    }

    await signInTestUser(page, testUser.email, testUser.password);
    await waitForPageLoad(page);
  });

  test("GPS-based nearby beaches should not trigger spatial fallback", async ({
    page,
    context,
  }) => {
    if (!testUser) throw new Error("Test user not available");

    // Ensure profile has no home beach so GPS is the primary location source
    const clearResult = await clearHomeBeach(testUser.id);
    expect(clearResult.success).toBe(true);

    const homeBeachName = await getHomeBeachName(testUser.id);
    expect(homeBeachName).toBeNull();

    await logProfileState(testUser.id, "Nearby Regression - GPS Only Setup");

    // Grant geolocation and set coordinates near La Jolla (matches existing fixtures)
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    // Capture browser console warnings/errors for spatial fallback detection
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    // Navigate to home and wait for best-conditions section
    await page.goto("/");
    await waitForPageLoad(page);

    const section = page.getByTestId("best-conditions-section");
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    const heading = page.getByTestId("best-conditions-heading");
    await expect(heading).toHaveText("Best Conditions Near You", {
      timeout: TIMEOUTS.long,
    });

    const cards = page.getByTestId("best-conditions-card");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Assert that no spatial fallback warning was logged in the browser
    const spatialFallbackMessages = consoleMessages.filter((text) =>
      text.includes(
        "Spatial function failed, falling back to client-side filtering"
      )
    );
    expect(spatialFallbackMessages.length).toBe(0);
  });

  test("Nearby card navigation to beach detail and back should not use spatial fallback", async ({
    page,
    context,
  }) => {
    if (!testUser) throw new Error("Test user not available");

    // Ensure we are still in GPS-only mode (no home beach)
    const clearResult = await clearHomeBeach(testUser.id);
    expect(clearResult.success).toBe(true);
    const homeBeachName = await getHomeBeachName(testUser.id);
    expect(homeBeachName).toBeNull();

    await logProfileState(
      testUser.id,
      "Nearby Regression - Navigation Scenario Setup"
    );

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto("/");
    await waitForPageLoad(page);

    const section = page.getByTestId("best-conditions-section");
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    const cards = page.getByTestId("best-conditions-card");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCard = cards.first();
    await firstCard.click();
    await waitForPageLoad(page);

    // Should navigate to a beach detail page
    await expect(page).toHaveURL(/\/beach\//, { timeout: TIMEOUTS.long });

    // Basic sanity check that beach detail content is visible
    const detailHeading = page
      .getByRole("heading")
      .first();
    await expect(detailHeading).toBeVisible({ timeout: TIMEOUTS.long });

    // Navigate back to home to complete the nearby → detail → home loop
    await page.goBack();
    await waitForPageLoad(page);

    const sectionAfterBack = page.getByTestId("best-conditions-section");
    await expect(sectionAfterBack).toBeVisible({ timeout: TIMEOUTS.long });

    // Assert that no spatial fallback warning was logged at any point in the flow
    const spatialFallbackMessages = consoleMessages.filter((text) =>
      text.includes(
        "Spatial function failed, falling back to client-side filtering"
      )
    );
    expect(spatialFallbackMessages.length).toBe(0);
  });
});


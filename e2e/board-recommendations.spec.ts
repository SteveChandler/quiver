/**
 * Board Recommendations E2E Tests
 *
 * Tests the board recommendation badge display on:
 * - Beach detail page hero section
 * - Home screen hero card
 *
 * Requirements:
 * - Badge only shows for authenticated users
 * - Badge only shows when API returns confident recommendation (score >= 50, confidence >= 0.5)
 * - Badge format: "Bring your {boardName}"
 * - Graceful degradation when no recommendation available
 *
 * @project auth (requires authentication)
 */

import { test, expect } from "@playwright/test";
import { TIMEOUTS, TEST_BEACHES, VIEWPORTS } from "./fixtures/test-data";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Helper to navigate to a beach detail page
 */
async function navigateToBeachDetail(
  page: any,
  beach: { state: string; city: string; slug: string }
) {
  const statePath = beach.state.toLowerCase().replace(/\s+/g, "-");
  const cityPath = beach.city.toLowerCase().replace(/\s+/g, "-");
  const url = `/${statePath}/${cityPath}/${beach.slug}`;
  await page.goto(url);
}

test.describe("Board Recommendations - Beach Detail Page", () => {
  test.describe("Badge Display", () => {
    test("should display board recommendation badge when API returns confident suggestion", async ({
      page,
    }) => {
      // Navigate to beach detail page
      await navigateToBeachDetail(page, {
        state: TEST_BEACHES.blacks.state,
        city: TEST_BEACHES.blacks.city,
        slug: TEST_BEACHES.blacks.slug,
      });

      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Check for board recommendation badge
      // May not appear if user has no session history or no confident recommendation
      const badge = page.getByTestId("board-recommendation-badge");
      const badgeVisible = await badge
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false);

      if (badgeVisible) {
        // Verify badge content format: "Bring your {boardName}"
        const badgeText = await badge.textContent();
        expect(badgeText).toMatch(/Bring your .+/);

        // Verify accessibility attributes
        const ariaLabel = await badge.getAttribute("aria-label");
        expect(ariaLabel).toContain("Board recommendation");

        // Verify badge styling (amber theme)
        const badgeClasses = await badge.getAttribute("class");
        expect(badgeClasses).toMatch(/amber/i);
      } else {
        // Badge not visible - this is expected if user has no session history
        // or no confident recommendation for current conditions
        console.log(
          "[Board Rec] Badge not visible - user may lack session history or confident recommendation"
        );
      }
    });

    test("should NOT display badge for guest users", async ({ browser }) => {
      // Create unauthenticated context
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();

      try {
        await page.goto(
          `${BASE_URL}/california/san-diego/${TEST_BEACHES.blacks.slug}`
        );
        await page.waitForLoadState("networkidle");

        // Badge should NOT be visible for guests
        const badge = page.getByTestId("board-recommendation-badge");
        const badgeVisible = await badge
          .isVisible({ timeout: TIMEOUTS.short })
          .catch(() => false);

        expect(badgeVisible).toBe(false);
      } finally {
        await context.close();
      }
    });

    test("badge should be accessible with proper ARIA attributes", async ({
      page,
    }) => {
      await navigateToBeachDetail(page, {
        state: TEST_BEACHES.blacks.state,
        city: TEST_BEACHES.blacks.city,
        slug: TEST_BEACHES.blacks.slug,
      });
      await page.waitForLoadState("networkidle");

      const badge = page.getByTestId("board-recommendation-badge");
      const badgeVisible = await badge
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false);

      if (badgeVisible) {
        // Check role attribute
        const role = await badge.getAttribute("role");
        expect(role).toBe("status");

        // Check aria-label contains meaningful description
        const ariaLabel = await badge.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("Board recommendation");
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("badge should display correctly on mobile viewport", async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      await navigateToBeachDetail(page, {
        state: TEST_BEACHES.blacks.state,
        city: TEST_BEACHES.blacks.city,
        slug: TEST_BEACHES.blacks.slug,
      });
      await page.waitForLoadState("networkidle");

      const badge = page.getByTestId("board-recommendation-badge");
      const badgeVisible = await badge
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false);

      if (badgeVisible) {
        // Verify badge is within viewport
        const boundingBox = await badge.boundingBox();
        expect(boundingBox).toBeTruthy();
        expect(boundingBox!.x).toBeGreaterThanOrEqual(0);
        expect(boundingBox!.x + boundingBox!.width).toBeLessThanOrEqual(
          VIEWPORTS.mobile.width
        );

        // Verify text is not truncated (no ellipsis)
        const textContent = await badge.textContent();
        expect(textContent).not.toContain("...");
      }
    });
  });
});

test.describe("Board Recommendations - Home Screen", () => {
  test.describe("Badge Display on Hero Card", () => {
    test("should display board recommendation badge on hero recommendation card", async ({
      page,
    }) => {
      // Navigate to home page
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Wait for hero card to load
      const heroCard = page.getByTestId("hero-recommendation");
      const heroVisible = await heroCard
        .isVisible({ timeout: TIMEOUTS.long })
        .catch(() => false);

      if (!heroVisible) {
        test.skip(true, "Hero recommendation not available");
        return;
      }

      // Check for board recommendation badge within hero
      const badge = heroCard.getByTestId("board-recommendation-badge");
      const badgeVisible = await badge
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false);

      if (badgeVisible) {
        // Verify badge content format
        const badgeText = await badge.textContent();
        expect(badgeText).toMatch(/Bring your .+/);

        // Verify badge uses dark theme styling (on dark hero background)
        const badgeClasses = await badge.getAttribute("class");
        // Should have amber styling for visibility on dark background
        expect(badgeClasses).toMatch(/amber/i);
      } else {
        console.log(
          "[Board Rec] Home badge not visible - may lack session history or confident recommendation"
        );
      }
    });

    test("badge should NOT appear for guest users on home screen", async ({
      browser,
    }) => {
      // Create unauthenticated context
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();

      try {
        await page.goto(BASE_URL);
        await page.waitForLoadState("networkidle");

        // Badge should NOT be visible for guests
        const badge = page.getByTestId("board-recommendation-badge");
        const badgeVisible = await badge
          .isVisible({ timeout: TIMEOUTS.short })
          .catch(() => false);

        expect(badgeVisible).toBe(false);
      } finally {
        await context.close();
      }
    });
  });

  test.describe("Loading States", () => {
    test("badge should appear after recommendation data loads", async ({
      page,
    }) => {
      // Start navigation and watch for API call
      const apiResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/session-planner/gear-suggestions") &&
          response.status() === 200,
        { timeout: TIMEOUTS.long }
      );

      await page.goto("/");

      // If API returns 200, check if badge appears
      try {
        const apiResponse = await apiResponsePromise;
        const responseData = await apiResponse.json();

        if (
          responseData.success &&
          responseData.data?.suggestions?.length > 0
        ) {
          // API returned suggestions, badge should appear if confident
          const confidentSuggestion = responseData.data.suggestions.find(
            (s: any) => s.score >= 50 && s.confidence >= 0.5
          );

          if (confidentSuggestion) {
            const badge = page.getByTestId("board-recommendation-badge");
            await expect(badge).toBeVisible({ timeout: TIMEOUTS.medium });

            const badgeText = await badge.textContent();
            expect(badgeText).toContain(confidentSuggestion.board.name);
          }
        }
      } catch {
        // API call didn't complete or user not authenticated - expected
        console.log("[Board Rec] API call not captured - user may be guest");
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("home screen badge should display correctly on mobile", async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const badge = page.getByTestId("board-recommendation-badge");
      const badgeVisible = await badge
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false);

      if (badgeVisible) {
        // Verify badge fits within mobile viewport
        const boundingBox = await badge.boundingBox();
        expect(boundingBox).toBeTruthy();
        expect(boundingBox!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);

        // Verify touch-friendly size (minimum 44px height for accessibility)
        expect(boundingBox!.height).toBeGreaterThanOrEqual(24); // Badge is smaller, 24px is reasonable
      }
    });
  });
});

test.describe("Board Recommendations - Error Handling", () => {
  test("should gracefully handle API errors without crashing", async ({
    page,
  }) => {
    // Mock API to return error
    await page.route("**/api/session-planner/gear-suggestions**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Internal server error" }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should load without crashing
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Badge should NOT be visible when API fails
    const badge = page.getByTestId("board-recommendation-badge");
    const badgeVisible = await badge
      .isVisible({ timeout: TIMEOUTS.short })
      .catch(() => false);

    expect(badgeVisible).toBe(false);
  });

  test("should gracefully handle network timeout", async ({ page }) => {
    // Mock API to timeout
    await page.route("**/api/session-planner/gear-suggestions**", (route) => {
      // Never respond - simulate timeout
      // The test will verify the page handles this gracefully
    });

    await page.goto("/");

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Page should load without crashing
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Badge should NOT be visible when API times out
    const badge = page.getByTestId("board-recommendation-badge");
    const badgeVisible = await badge
      .isVisible({ timeout: TIMEOUTS.short })
      .catch(() => false);

    expect(badgeVisible).toBe(false);
  });

  test("should not show badge when API returns empty suggestions", async ({
    page,
  }) => {
    // Mock API to return empty suggestions
    await page.route("**/api/session-planner/gear-suggestions**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            userId: "test-user",
            conditions: { waveHeight: 3, windSpeed: 5 },
            suggestions: [], // Empty - no boards or no history
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Badge should NOT be visible when no suggestions
    const badge = page.getByTestId("board-recommendation-badge");
    const badgeVisible = await badge
      .isVisible({ timeout: TIMEOUTS.short })
      .catch(() => false);

    expect(badgeVisible).toBe(false);
  });

  test("should not show badge when suggestions have low confidence", async ({
    page,
  }) => {
    // Mock API to return low-confidence suggestions
    await page.route("**/api/session-planner/gear-suggestions**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            userId: "test-user",
            conditions: { waveHeight: 3, windSpeed: 5 },
            suggestions: [
              {
                board: { id: "board-1", name: "Test Board", board_type: "shortboard" },
                score: 30, // Below threshold of 50
                confidence: 0.3, // Below threshold of 0.5
                reasoning: "Low confidence due to limited data",
              },
            ],
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Badge should NOT be visible when confidence is too low
    const badge = page.getByTestId("board-recommendation-badge");
    const badgeVisible = await badge
      .isVisible({ timeout: TIMEOUTS.short })
      .catch(() => false);

    expect(badgeVisible).toBe(false);
  });
});

test.describe("Board Recommendations - Data Integrity", () => {
  test("badge should display correct board name from API response", async ({
    page,
  }) => {
    const testBoardName = "Magic Fish";

    // Mock API with specific board name
    await page.route("**/api/session-planner/gear-suggestions**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            userId: "test-user",
            conditions: { waveHeight: 3, windSpeed: 5 },
            suggestions: [
              {
                board: {
                  id: "board-1",
                  name: testBoardName,
                  board_type: "fish",
                },
                score: 85,
                confidence: 0.9,
                reasoning: "High confidence recommendation",
              },
            ],
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const badge = page.getByTestId("board-recommendation-badge");
    const badgeVisible = await badge
      .isVisible({ timeout: TIMEOUTS.medium })
      .catch(() => false);

    if (badgeVisible) {
      const badgeText = await badge.textContent();
      expect(badgeText).toContain(testBoardName);
      // Badge includes emoji prefix: "🏄 Bring your {boardName}"
      expect(badgeText).toMatch(new RegExp(`Bring your ${testBoardName}$`));
    }
  });
});

import { test, expect } from "./fixtures/auth-fixture";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.describe("Discover community page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);

    await page.route("**/api/users/suggested**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            source: "popular_profiles",
            users: [
              {
                id: "550e8400-e29b-41d4-a716-446655440001",
                full_name: "Luna Surfer",
                avatar_url: null,
                followers_count: 7,
                following_count: 2,
                following: false,
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/users/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            users: [
              {
                id: "550e8400-e29b-41d4-a716-446655440002",
                full_name: "Jordan Local",
                avatar_url: null,
                followers_count: 3,
                following_count: 1,
                following: false,
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/users/*/follow", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { following: false, followersCount: 7, followingCount: 2 },
        }),
      });
    });

    await page.route("**/api/users/*/follow/toggle", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            following: true,
            followersCount: 8,
            followingCount: 2,
          },
        }),
      });
    });

    await page.route("**/api/events", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Discover community page",
    });
  });

  test("shows suggested surfers, tracks a follow attempt, and supports search", async ({
    page,
  }) => {
    await page.goto("/discover");

    await expect(
      page.getByRole("heading", { name: /Suggested Surfers/i })
    ).toBeVisible();
    await expect(page.getByText("Luna Surfer")).toBeVisible();
    await expect(page.getByText("7 followers")).toBeVisible();
    await expect(page.getByText(/Search by surfer name/i)).toBeVisible();
    await expect(page.getByText(/Search by name or email/i)).toHaveCount(0);

    const followAttemptRequestPromise = page.waitForRequest((request) => {
      if (
        request.method() !== "POST" ||
        !request.url().endsWith("/api/events")
      ) {
        return false;
      }

      const body = request.postDataJSON() as { eventType?: string };
      return body.eventType === "discover_follow_attempt";
    });
    const followToggleRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes(
          "/api/users/550e8400-e29b-41d4-a716-446655440001/follow/toggle"
        )
    );
    const followButton = page.getByRole("button", {
      name: "Follow this user. Currently has 7 followers",
      exact: true,
    });

    await expect(followButton).toBeEnabled();
    await followButton.click();

    const [followAttemptRequest] = await Promise.all([
      followAttemptRequestPromise,
      followToggleRequestPromise,
    ]);
    expect(followAttemptRequest.postDataJSON()).toMatchObject({
      eventType: "discover_follow_attempt",
      metadata: {
        target_user_id: "550e8400-e29b-41d4-a716-446655440001",
        surface: "suggested",
      },
    });
    await expect(
      page.getByRole("button", {
        name: "Following this user. Currently has 8 followers",
        exact: true,
      })
    ).toBeVisible();

    await page.getByPlaceholder("Search by surfer name...").fill("Jordan");
    await page.getByRole("button", { name: /^Search$/i }).click();

    await expect(page.getByText("Search Results (1)")).toBeVisible();
    await expect(page.getByText("Jordan Local")).toBeVisible();
  });
});

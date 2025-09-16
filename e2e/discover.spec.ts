import { expect, test } from "@playwright/test";
import { loginViaUI } from "./utils/auth";

const DISCOVER_SIGN_IN_MESSAGE =
  "Sign in to discover and follow other surfers in your community.";

test.describe("Discover - guest", () => {
  test("shows sign-in prompt and bottom navigation", async ({ page }) => {
    await page.goto("/discover?test=true", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /Discover Surfers/i })
    ).toBeVisible();
    await expect(page.getByText(DISCOVER_SIGN_IN_MESSAGE)).toBeVisible();
    await expect(page.getByTestId("bottom-navigation")).toBeVisible();
  });
});

test.describe("Discover - authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, { redirectTo: "/discover?test=true" });
  });

  test("searching for surfers renders mocked API results", async ({ page }) => {
    const mockUsers = [
      {
        id: "user-kai",
        full_name: "Kai Lenny",
        followers_count: 321,
      },
      {
        id: "user-carissa",
        full_name: "Carissa Moore",
        followers_count: 540,
      },
    ];

    const followFixtures: Record<string, { followers: number; following: number }> = {
      "user-kai": { followers: 321, following: 12 },
      "user-carissa": { followers: 540, following: 18 },
    };

    await page.route("**/api/users/search**", async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("q")).toBe("Kai");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { users: mockUsers },
        }),
      });
    });

    await page.route(/\/api\/users\/([^/]+)\/follow$/, async (route) => {
      const match = route.request().url().match(/users\/(.+)\/follow/);
      const userId = match?.[1] ?? "";
      const fixture = followFixtures[userId] ?? { followers: 0, following: 0 };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            following: false,
            followersCount: fixture.followers,
            followingCount: fixture.following,
          },
        }),
      });
    });

    await page.route(/\/api\/users\/([^/]+)\/follow\/toggle$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { followId: "mock-follow" } }),
      });
    });

    const searchInput = page.getByPlaceholder("Search by name or email...");
    await searchInput.fill("Kai");

    const searchButton = page.getByRole("button", { name: /^Search$/i });
    await searchButton.click();

    await expect(page.getByText(/Search Results \(2\)/i)).toBeVisible();
    await expect(page.getByText("Kai Lenny")).toBeVisible();
    await expect(page.getByText("321 followers")).toBeVisible();
    await expect(page.getByText("Carissa Moore")).toBeVisible();
    await expect(page.getByText("540 followers")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^View Profile$/i })
    ).toHaveCount(2);
    await expect(page.getByTestId("follow-button").first()).toBeVisible();
  });

  test("shows empty suggested state and following guidance", async ({ page }) => {
    const searchButton = page.getByRole("button", { name: /^Search$/i });
    await expect(searchButton).toBeDisabled();

    await expect(
      page.getByText("Suggested Surfers", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("No suggested users right now")).toBeVisible();

    await expect(page.getByText("How Following Works")).toBeVisible();
    await expect(
      page.getByText(/Follow other surfers to see their session activities/i)
    ).toBeVisible();
  });
});

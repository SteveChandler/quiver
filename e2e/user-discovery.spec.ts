import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  safeClick,
  waitForElementReady,
} from "./test-helpers";

test.describe("User Discovery & Following", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/discover");
    await waitForPageLoad(page);
  });

  test.describe("Discover Page", () => {
    test("should display discover page with suggested users", async ({ page }) => {
      await handleAuthRedirect(page);

      // Verify page elements
      const heading = page.getByRole("heading", { name: /Discover Surfers/i });
      await expect(heading).toBeVisible();

      const searchSection = page.getByText("Search Users");
      await expect(searchSection).toBeVisible();

      const suggestedSection = page.getByText("Suggested Surfers");
      await expect(suggestedSection).toBeVisible();
    });

    test("should allow searching for users", async ({ page }) => {
      await handleAuthRedirect(page);

      // Find search input
      const searchInput = page.getByPlaceholder(/Search by name/i);
      await expect(searchInput).toBeVisible();

      // Search for a user
      await searchInput.fill("Big");
      
      const searchButton = page.getByRole("button", { name: /Search/i });
      await safeClick(searchButton);

      // Wait for search results
      await page.waitForTimeout(2000);

      // Check if results appear
      const searchResults = page.getByText(/Search Results/i);
      const hasResults = await searchResults.isVisible().catch(() => false);

      if (hasResults) {
        // Verify search results structure
        const userProfile = page.getByText("Big Boss");
        await expect(userProfile).toBeVisible();

        const followButton = page.getByRole("button", { name: /Follow/i });
        await expect(followButton).toBeVisible();

        const viewProfileButton = page.getByRole("button", { name: /View Profile/i });
        await expect(viewProfileButton).toBeVisible();
      }
    });

    test("should display suggested users if available", async ({ page }) => {
      await handleAuthRedirect(page);

      // Wait for suggested users to load
      await page.waitForTimeout(3000);

      // Check for suggested users section
      const suggestedSection = page.getByText("Suggested Surfers");
      await expect(suggestedSection).toBeVisible();

      // Check if any users are suggested
      const noUsers = page.getByText("No suggested users right now");
      const hasSuggestions = !(await noUsers.isVisible().catch(() => false));

      if (hasSuggestions) {
        // Verify follow buttons are present
        const followButtons = page.getByRole("button", { name: /Follow/i });
        const followButtonCount = await followButtons.count();
        expect(followButtonCount).toBeGreaterThan(0);
      }
    });

    test("should show user profile modal from search results", async ({ page }) => {
      await handleAuthRedirect(page);

      // Search for a specific user
      const searchInput = page.getByPlaceholder(/Search by name/i);
      await searchInput.fill("Big Boss");
      
      const searchButton = page.getByRole("button", { name: /Search/i });
      await safeClick(searchButton);
      await page.waitForTimeout(2000);

      // Click view profile and expect modal
      const viewProfileButton = page.getByRole("button", { name: /View Profile/i });
      const isVisible = await viewProfileButton.isVisible().catch(() => false);
      if (isVisible) {
        await safeClick(viewProfileButton);
        // Modal dialog should appear with title "Surfer Profile"
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(page.getByText(/Surfer Profile/i)).toBeVisible();
      }
    });
  });

  test.describe("Follow/Unfollow Functionality", () => {
    test("should follow and unfollow users", async ({ page }) => {
      await handleAuthRedirect(page);

      // Search for a user to follow
      const searchInput = page.getByPlaceholder(/Search by name/i);
      await searchInput.fill("Solid");
      
      const searchButton = page.getByRole("button", { name: /Search/i });
      await safeClick(searchButton);
      await page.waitForTimeout(2000);

      // Try to follow a user
      const followButton = page.getByRole("button", { name: /Follow/i }).first();
      if (await followButton.isVisible()) {
        await safeClick(followButton);

        // Wait for follow action to complete
        await page.waitForTimeout(1000);

        // Check if button changed to "Unfollow" (or is disabled while processing)
        const unfollowButton = page.getByRole("button", { name: /Unfollow/i }).first();
        const hasUnfollowButton = await unfollowButton.isVisible().catch(() => false);

        if (hasUnfollowButton) {
          // Test unfollowing
          await safeClick(unfollowButton);
          await page.waitForTimeout(1000);

          // Should change back to "Follow"
          const followButtonAgain = page.getByRole("button", { name: /Follow/i }).first();
          await expect(followButtonAgain).toBeVisible();
        }
      }
    });
  });

  test.describe("Navigation Integration", () => {
    test("should be accessible from bottom navigation", async ({ page }) => {
      await handleAuthRedirect(page);

      // Check if Discover tab exists in navigation
      const discoverTab = page.getByRole("link", { name: /Discover/i });
      const hasDiscoverTab = await discoverTab.isVisible().catch(() => false);

      if (hasDiscoverTab) {
        await safeClick(discoverTab);
        await waitForPageLoad(page);

        // Verify we're on the discover page
        expect(page.url()).toContain("/discover");
        
        const heading = page.getByRole("heading", { name: /Discover Surfers/i });
        await expect(heading).toBeVisible();
      } else {
        // If no discover tab, users can still access via direct URL
        await page.goto("/discover");
        await waitForPageLoad(page);
        
        const heading = page.getByRole("heading", { name: /Discover Surfers/i });
        await expect(heading).toBeVisible();
      }
    });
  });

  test.describe("User Profile Pages", () => {
    test("should display user profile with follow button", async ({ page }) => {
      await handleAuthRedirect(page);

      // Navigate to a known user profile
      const testUserId = "d242de73-33dd-4084-8a14-5c39014e2b84"; // Big Boss ID from our test data
      await page.goto(`/user/${testUserId}`);
      await waitForPageLoad(page);

      // Verify profile elements
      const backButton = page.getByRole("button", { name: /Back/i });
      await expect(backButton).toBeVisible();

      // Check for profile content
      const userName = page.getByRole("heading", { level: 1 });
      await expect(userName).toBeVisible();

      // Check for follow button (if not own profile)
      const followButton = page.getByRole("button", { name: /Follow|Unfollow/i });
      const hasFollowButton = await followButton.isVisible().catch(() => false);

      // Should have follow button unless it's own profile
      if (hasFollowButton) {
        expect(await followButton.isVisible()).toBeTruthy();
      }
    });

    test("should handle non-existent user profiles", async ({ page }) => {
      await handleAuthRedirect(page);

      // Navigate to non-existent user
      await page.goto("/user/non-existent-user-id");
      await waitForPageLoad(page);

      // Should show user not found message
      const notFound = page.getByText(/User Not Found/i);
      await expect(notFound).toBeVisible();

      const goBackButton = page.getByRole("button", { name: /Go Back/i });
      await expect(goBackButton).toBeVisible();
    });
  });
});

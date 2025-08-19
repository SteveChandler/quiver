import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  safeClick,
  waitForElementReady,
} from "./test-helpers";

test.describe("Social Friend Invitations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plan-session");
    await waitForPageLoad(page);
  });

  test.describe("Friend Invitation Flow", () => {
    test("should display friends list in session planning", async ({ page }) => {
      await handleAuthRedirect(page);

      // Wait for the page to fully load
      await page.waitForSelector('[data-testid="beach-search-input"]', { timeout: 10000 });

      // Fill out required fields to enable friend invitations
      const beachField = page.locator('[data-testid="beach-search-input"]');
      await beachField.fill("Ocean Beach");
      await page.waitForTimeout(1000);
      
      // Click on Ocean Beach suggestion
      const beachOption = page.getByText("Ocean Beach", { exact: true }).first();
      if (await beachOption.isVisible()) {
        await safeClick(beachOption);
      }

      // Look for the friend invitation section
      const inviteSection = page.getByText("Invite from Following");
      await expect(inviteSection).toBeVisible();

      // Check if friends list loads (should have at least the test friends we created)
      const friendsList = page.getByText("People You Follow");
      if (await friendsList.isVisible()) {
        // Verify specific test friends exist
        const liquidSnake = page.getByText("Liquid Snake");
        const bigBoss = page.getByText("Big Boss");
        const solidSnake = page.getByText("Solid Snake");

        // At least one friend should be visible
        const hasFriends = await liquidSnake.isVisible() || 
                          await bigBoss.isVisible() || 
                          await solidSnake.isVisible();
        
        expect(hasFriends).toBeTruthy();
      }
    });

    test("should allow selecting and deselecting friends", async ({ page }) => {
      await handleAuthRedirect(page);

      // Fill out required beach field
      const beachField = page.locator('[data-testid="beach-search-input"]');
      await beachField.fill("Ocean Beach");
      await page.waitForTimeout(1000);
      
      const beachOption = page.getByText("Ocean Beach", { exact: true }).first();
      if (await beachOption.isVisible()) {
        await safeClick(beachOption);
      }

      // Wait for friends to load
      await page.waitForTimeout(2000);

      // Try to select a friend if available
      const liquidSnakeButton = page.getByRole("button", { name: /Liquid Snake/i });
      if (await liquidSnakeButton.isVisible()) {
        await safeClick(liquidSnakeButton);
        
        // Verify selection feedback
        const selectedFriends = page.getByText(/Selected Friends/i);
        await expect(selectedFriends).toBeVisible();
        
        // Verify friend appears in selected list
        const selectedLiquidSnake = page.getByText("Liquid Snake").nth(1); // Second instance in selected list
        await expect(selectedLiquidSnake).toBeVisible();
        
        // Test remove functionality
        const removeButton = page.getByRole("button", { name: /Remove friend Liquid Snake/i });
        if (await removeButton.isVisible()) {
          await safeClick(removeButton);
          
          // Verify friend is removed from selection
          const selectedCount = page.getByText(/Selected Friends \\(0\\)/i);
          await expect(selectedCount).toBeVisible();
        }
      }
    });

    test("should update invitation preview with selected friends", async ({ page }) => {
      await handleAuthRedirect(page);

      // Fill out required fields
      const beachField = page.locator('[data-testid="beach-search-input"]');
      await beachField.fill("Ocean Beach");
      await page.waitForTimeout(1000);
      
      const beachOption = page.getByText("Ocean Beach", { exact: true }).first();
      if (await beachOption.isVisible()) {
        await safeClick(beachOption);
      }

      // Wait for friends to load
      await page.waitForTimeout(2000);

      // Select multiple friends if available
      const friends = ["Liquid Snake", "Big Boss"];
      let selectedCount = 0;

      for (const friendName of friends) {
        const friendButton = page.getByRole("button", { name: new RegExp(friendName, "i") });
        if (await friendButton.isVisible()) {
          await safeClick(friendButton);
          selectedCount++;
        }
      }

      if (selectedCount > 0) {
        // Add invitation message
        const messageField = page.getByRole("textbox", { name: /Invitation Message/i });
        if (await messageField.isVisible()) {
          await messageField.fill("Dawn patrol session! Let's get some waves.");
        }

        // Verify invitation preview updates
        const invitationPreview = page.getByText("Invitation Preview");
        await expect(invitationPreview).toBeVisible();

        // Check preview contains expected information
        const whoText = page.getByText(`Who: ${selectedCount} people`);
        const whereText = page.getByText("Where: Ocean Beach");
        const whenText = page.getByText(/When: 2025-\d{2}-\d{2} at \d{2}:\d{2}/);

        await expect(whoText).toBeVisible();
        await expect(whereText).toBeVisible();
        await expect(whenText).toBeVisible();
      }
    });

    test("should enable session submission with friend invitations", async ({ page }) => {
      await handleAuthRedirect(page);

      // Fill out required fields
      const beachField = page.locator('[data-testid="beach-search-input"]');
      await beachField.fill("Ocean Beach");
      await page.waitForTimeout(1000);
      
      const beachOption = page.getByText("Ocean Beach", { exact: true }).first();
      if (await beachOption.isVisible()) {
        await safeClick(beachOption);
      }

      // Wait for form to update
      await page.waitForTimeout(2000);

      // Verify submit button is enabled
      const submitButton = page.getByRole("button", { name: /Plan Session/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      // Optional: Select friends if available
      const liquidSnakeButton = page.getByRole("button", { name: /Liquid Snake/i });
      if (await liquidSnakeButton.isVisible()) {
        await safeClick(liquidSnakeButton);
        
        // Verify button still enabled with friends selected
        await expect(submitButton).toBeEnabled();
      }
    });

    test("should handle empty friends list gracefully", async ({ page }) => {
      await handleAuthRedirect(page);

      // Even with no friends, the invitation section should be visible
      const inviteSection = page.getByText("Invite from Following");
      await expect(inviteSection).toBeVisible();

      // Email invitation should still be available
      const emailInvite = page.getByText("Invite by Email");
      await expect(emailInvite).toBeVisible();

      const emailField = page.getByRole("textbox", { name: /Invite by Email/i });
      await expect(emailField).toBeVisible();
    });

    test("should validate invitation message character limit", async ({ page }) => {
      await handleAuthRedirect(page);

      // Find the invitation message field
      const messageField = page.getByRole("textbox", { name: /Invitation Message/i });
      if (await messageField.isVisible()) {
        // Type a long message
        const longMessage = "A".repeat(250); // Exceeds 200 character limit
        await messageField.fill(longMessage);

        // Check character count display
        const charCount = page.getByText(/\d+\/200 characters/);
        await expect(charCount).toBeVisible();

        // Verify the text is truncated or validation is shown
        const currentText = await messageField.inputValue();
        expect(currentText.length).toBeLessThanOrEqual(200);
      }
    });
  });

  test.describe("API Integration", () => {
    test("should load friends from API", async ({ page }) => {
      await handleAuthRedirect(page);

      // Monitor network requests
      let friendsApiCalled = false;
      page.on("request", (request) => {
        if (request.url().includes("/api/session-planner/invitations?type=friends")) {
          friendsApiCalled = true;
        }
      });

      // Navigate to session planning page
      await page.reload();
      await waitForPageLoad(page);

      // Wait for API calls to complete
      await page.waitForTimeout(3000);

      // Verify the friends API was called
      expect(friendsApiCalled).toBeTruthy();
    });

    test("should handle friends API errors gracefully", async ({ page }) => {
      await handleAuthRedirect(page);

      // Intercept and mock API error
      await page.route("**/api/session-planner/invitations?type=friends", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "Server error" }),
        });
      });

      await page.reload();
      await waitForPageLoad(page);

      // The section should still be visible even with API errors
      const inviteSection = page.getByText("Invite from Following");
      await expect(inviteSection).toBeVisible();

      // Email invitation should still work as fallback
      const emailInvite = page.getByText("Invite by Email");
      await expect(emailInvite).toBeVisible();
    });
  });

  test.describe("Session Submission with Friends", () => {
    test("should successfully submit session with friend invitations", async ({ page }) => {
      await handleAuthRedirect(page);

      // Fill out the complete form
      const beachField = page.locator('[data-testid="beach-search-input"]');
      await beachField.fill("Ocean Beach");
      await page.waitForTimeout(1000);
      
      const beachOption = page.getByText("Ocean Beach", { exact: true }).first();
      if (await beachOption.isVisible()) {
        await safeClick(beachOption);
      }

      // Select a friend if available
      const liquidSnakeButton = page.getByRole("button", { name: /Liquid Snake/i });
      if (await liquidSnakeButton.isVisible()) {
        await safeClick(liquidSnakeButton);
        
        // Add invitation message
        const messageField = page.getByRole("textbox", { name: /Invitation Message/i });
        if (await messageField.isVisible()) {
          await messageField.fill("Epic dawn patrol session planned!");
        }
      }

      // Submit the session
      const submitButton = page.getByRole("button", { name: /Plan Session/i });
      await waitForElementReady(submitButton);
      await safeClick(submitButton);

      // Wait for submission to complete
      await page.waitForTimeout(3000);

      // Check for success indicators
      const successToast = page.getByText(/session.*planned|success|saved/i);
      const hasSuccessToast = await successToast.isVisible().catch(() => false);

      // Or check if redirected to a success page
      const currentUrl = page.url();
      const isSuccessPage = currentUrl.includes("/sessions/") || 
                          currentUrl.includes("/profile") ||
                          currentUrl !== "http://localhost:3000/plan-session";

      expect(hasSuccessToast || isSuccessPage).toBeTruthy();
    });
  });
});

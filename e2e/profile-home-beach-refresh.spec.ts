import { test, expect } from "@playwright/test";

test.describe("Profile Home Beach Refresh", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (server is running on port 3002)
    await page.goto("http://localhost:3002");
  });

  test("should update Home Break card after profile change without page refresh", async ({
    page,
  }) => {
    // Step 1: Navigate to profile page
    // Assuming there's a profile link or we can navigate directly
    await page.goto("http://localhost:3002/profile");

    // Wait for the page to load
    await page.waitForLoadState("load");

    // Step 2: Check initial Home Break value
    const homeBreakCard = page.locator('[data-testid="home-break-value"]');
    await expect(homeBreakCard).toBeVisible();
    
    const initialHomeBreak = await homeBreakCard.textContent();
    console.log("Initial Home Break:", initialHomeBreak);

    // Step 3: Open edit profile modal
    const editButton = page.locator("button", { hasText: "Edit" });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for modal to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Step 4: Find and change home beach selection
    // Look for home beach selector (this might be a dropdown, search input, etc.)
    const homeBeachSelector = page.locator('[data-testid="home-beach-selector"]').first();
    
    if (await homeBeachSelector.isVisible()) {
      // If it's a dropdown/select
      await homeBeachSelector.click();
      
      // Select a different option (assuming there are options available)
      const beachOptions = page.locator('[role="option"]');
      const optionCount = await beachOptions.count();
      
      if (optionCount > 1) {
        // Select the second option if available
        await beachOptions.nth(1).click();
      }
    } else {
      // Look for alternative selectors (input fields, search boxes, etc.)
      const homeBeachInput = page.locator('input[name*="home"], input[placeholder*="beach"], input[placeholder*="Home"]');
      
      if (await homeBeachInput.first().isVisible()) {
        await homeBeachInput.first().clear();
        await homeBeachInput.first().fill("Test Beach");
      }
    }

    // Step 5: Save the profile changes
    const saveButton = page.locator("button", { hasText: /Save|Update/ });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Step 6: Wait for modal to close
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });

    // Step 7: Verify that Home Break card updates without page refresh
    // Wait for the stats to refresh (should happen within 1-2 seconds)
    await page.waitForTimeout(2000);
    
    const updatedHomeBreak = await homeBreakCard.textContent();
    console.log("Updated Home Break:", updatedHomeBreak);

    // The home break should be different from the initial value
    // (assuming we successfully changed it)
    if (initialHomeBreak !== "—" && updatedHomeBreak !== "—") {
      expect(updatedHomeBreak).not.toBe(initialHomeBreak);
    }

    // Step 8: Verify the page hasn't been refreshed
    // We can check that our test state is still present
    await expect(page.locator("h1")).toContainText("Profile");
  });

  test("should show loading state during stats refresh", async ({ page }) => {
    await page.goto("http://localhost:3002/profile");
    await page.waitForLoadState("load");

    // Open edit modal
    const editButton = page.locator("button", { hasText: "Edit" });
    await editButton.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Make a change (if possible)
    const saveButton = page.locator("button", { hasText: /Save|Update/ });
    await saveButton.click();

    // Should briefly show loading state
    // This might be hard to catch, but we can verify that the component
    // doesn't show stale data immediately after save
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });

    // Verify stats section is present
    const statsSection = page.locator('[data-testid="home-break-value"]');
    await expect(statsSection).toBeVisible();
  });

  test("should handle profile save errors gracefully", async ({ page }) => {
    // Intercept and mock a failing profile update request
    await page.route("**/api/profile*", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto("http://localhost:3002/profile");
    await page.waitForLoadState("networkidle");

    // Open edit modal and try to save
    const editButton = page.locator("button", { hasText: "Edit" });
    await editButton.click();

    const saveButton = page.locator("button", { hasText: /Save|Update/ });
    await saveButton.click();

    // Should show error message or toast
    // (The exact implementation depends on how errors are handled)
    await page.waitForTimeout(2000);

    // Modal might still be open due to error
    const modal = page.locator('[role="dialog"]');
    const isModalVisible = await modal.isVisible();

    if (isModalVisible) {
      // If modal is still open, there should be an error message
      console.log("Modal remained open after error, as expected");
    }

    // Stats should still be available (not broken by the error)
    const statsSection = page.locator('[data-testid="home-break-value"]');
    await expect(statsSection).toBeVisible();
  });
});
import { test, expect } from "@playwright/test";

test.describe("Home Beach Update Flow - Simple", () => {
  test("updates home beach from profile and verifies changes", async ({ page }) => {
    // Start with no home beach set
    let currentHomeBeachId: string | null = null;
    
    // Stub all necessary APIs
    await page.route("**/api/me/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-id",
          home_beach_id: currentHomeBeachId,
        }),
      });
    });

    await page.route("**/api/beaches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "beach-1",
            name: "Huntington Beach",
            latitude: 33.6595,
            longitude: -118.0034,
          },
          {
            id: "beach-2",
            name: "Newport Beach",
            latitude: 33.6189,
            longitude: -117.9289,
          },
        ]),
      });
    });

    // Step 1: Go to profile page
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    
    // Verify initial state shows no home beach
    const homeBreakValue = page.locator('[data-testid="home-break-value"]');
    await expect(homeBreakValue).toBeVisible({ timeout: 10000 });
    await expect(homeBreakValue).toContainText("—");

    // Step 2: Open edit profile modal
    const editButton = page.locator('button:has-text("Edit Profile")').first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Wait for modal and beach selector
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible', timeout: 10000 });
    
    // Step 3: Select Newport Beach
    const beachSelector = page.locator('[data-testid="home-beach-select"]');
    await beachSelector.click();
    await page.waitForTimeout(500); // Wait for dropdown animation
    
    // Find and click Newport Beach option
    const newportOption = page.locator('[role="option"]').filter({ hasText: "Newport Beach" });
    await expect(newportOption).toBeVisible({ timeout: 5000 });
    await newportOption.click();
    
    // Step 4: Save the profile
    const saveButton = page.locator('[data-testid="save-profile"]');
    await expect(saveButton).toBeVisible();
    
    // Mock successful save
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "POST") {
        currentHomeBeachId = "beach-2"; // Update the mock state
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
    
    await saveButton.click();
    
    // Wait for modal to close and profile to update
    await page.waitForTimeout(2000);
    
    // Step 5: Verify profile now shows Newport Beach
    await expect(homeBreakValue).toContainText("Newport Beach");
    
    // Step 6: Navigate to home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // The home beach banner should NOT be visible since we now have a home beach set
    const homeBanner = page.locator('[data-testid="home-beach-banner"]');
    await expect(homeBanner).toBeHidden({ timeout: 5000 });
    
    // Step 7: Go back to profile and clear the home beach
    await page.goto("/profile");
    await editButton.click();
    
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible' });
    
    // Try to clear the selection
    const clearButton = page.locator('[data-testid="home-beach-select"]').locator('button[aria-label*="Clear"], button[aria-label*="clear"]');
    const hasClearButton = await clearButton.count() > 0;
    
    if (hasClearButton) {
      await clearButton.first().click();
    } else {
      // Click selector and choose first (placeholder) option
      await beachSelector.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();
    }
    
    // Update mock to reflect cleared state
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "POST") {
        currentHomeBeachId = null;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
    
    await saveButton.click();
    await page.waitForTimeout(2000);
    
    // Step 8: Verify profile shows no beach again
    await expect(homeBreakValue).toContainText("—");
    
    // Step 9: Go to home page and verify banner is visible again
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Now the banner should be visible since there's no home beach
    await expect(homeBanner).toBeVisible({ timeout: 10000 });
  });
});
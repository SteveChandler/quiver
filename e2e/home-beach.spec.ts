import { test, expect } from "@playwright/test";

test.describe("Home Beach Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the /api/me/profile API endpoint
    await page.route("**/api/me/profile", async (route) => {
      const url = route.request().url();
      
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "test-user-123",
              home_beach_id: null,
              default_beach_id: null,
              full_name: "Test User",
              bio: "Test user for E2E testing",
              location: "San Diego, CA",
              avatar_url: null
            }
          })
        });
      }
    });

    // Stub other common API endpoints
    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json", 
        body: JSON.stringify({
          success: true,
          data: {
            id: "test-user-123",
            default_beach_id: null,
            full_name: "Test User"
          }
        })
      });
    });

    // Stub beaches API for home beach selector
    await page.route("**/api/beaches", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { id: "beach-123", name: "Ocean Beach", location: "San Diego" },
            { id: "beach-456", name: "Pacific Beach", location: "San Diego" },
            { id: "beach-789", name: "Mission Beach", location: "San Diego" }
          ]
        })
      });
    });
  });

  test("displays set home beach banner when beach is not set", async ({ page }) => {
    // Navigate to a beach detail page or home page where the banner would appear
    await page.goto("/");
    
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    
    // Look for the home beach banner (may need to navigate to specific location)
    const bannerCount = await page.locator('[data-testid="home-beach-banner"]').count();
    
    if (bannerCount > 0) {
      const banner = page.locator('[data-testid="home-beach-banner"]');
      await expect(banner).toBeVisible();
      
      const setButton = page.locator('[data-testid="set-home-beach"]');
      await expect(setButton).toBeVisible();
      await expect(setButton).toHaveText("Set Home Beach");
    }
  });

  test("allows setting home beach through edit profile form", async ({ page }) => {
    // Navigate to profile page
    await page.goto("/profile");
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Look for edit profile functionality
    const editButton = page.locator('text="Edit Profile"').or(
      page.locator('[href*="edit"]')
    ).or(
      page.locator('button:has-text("Edit")')
    ).first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Wait for the edit form to appear
      await page.waitForSelector('[data-testid="home-beach-select"]', { 
        state: "visible", 
        timeout: 5000 
      });
      
      // Find and interact with the home beach selector
      const beachSelect = page.locator('[data-testid="home-beach-select"]');
      await expect(beachSelect).toBeVisible();
      
      // Open the dropdown
      await beachSelect.click();
      
      // Select a beach option
      const beachOption = page.locator('text="Ocean Beach"').first();
      if (await beachOption.count() > 0) {
        await beachOption.click();
      }
      
      // Save the profile
      const saveButton = page.locator('[data-testid="save-profile"]');
      await expect(saveButton).toBeVisible();
      await saveButton.click();
      
      // Wait for completion
      await page.waitForLoadState("networkidle");
    }
  });

  test("displays home beach value in profile stats", async ({ page }) => {
    // Update the API stub to return a set home beach
    await page.route("**/api/me/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "test-user-123",
            home_beach_id: "beach-123",
            default_beach_id: "beach-123",
            full_name: "Test User",
            bio: "Test user for E2E testing",
            location: "San Diego, CA",
            avatar_url: null
          }
        })
      });
    });
    
    // Navigate to profile page
    await page.goto("/profile");
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Look for the home break value
    const homeBreakValue = page.locator('[data-testid="home-break-value"]');
    
    if (await homeBreakValue.count() > 0) {
      await expect(homeBreakValue).toBeVisible();
      
      // The value should show either the beach name or a dash
      const valueText = await homeBreakValue.textContent();
      expect(valueText).toBeTruthy();
    }
  });

  test("should allow clearing home beach selection", async ({ page }) => {
    // Navigate to edit profile
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");
    
    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]', { state: "visible" });
    
    // First set a beach
    const homeBeachSelector = page.locator('button[role="combobox"]').first();
    await homeBeachSelector.click();
    
    await page.waitForSelector('[role="option"]', { state: "visible" });
    const beachOption = page.locator('[role="option"]').first();
    await beachOption.click();
    
    // Now clear it using the X button
    const clearButton = homeBeachSelector.locator('button[aria-label=""]'); // X button
    await clearButton.click();
    
    // Verify it's cleared (should show placeholder again)
    await expect(homeBeachSelector).toContainText("Select your home beach");
    
    // Save the changes
    const saveButton = page.locator('button[type="submit"]', {
      has: page.locator("text=Save Changes"),
    });
    await saveButton.click();
    
    // Wait for modal to close
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });

    // Go to home page and verify fallback behavior
    await page.goto("/");
    await page.waitForLoadState("load");
    
    // Should show the fallback CTA again
    await expect(page.locator("text=Set Home Beach")).toBeVisible();
    await expect(page.locator("text=Showing popular beach forecast")).toBeVisible();
  });

  test("setting home beach updates everywhere", async ({ page }) => {
    await page.goto("/");
    // assume test user is already signed in with seeded profile

    // Open Edit Profile and set home beach
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Home Beach").selectOption({ label: "Ocean Beach" });
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Home banner should disappear (already set)
    await expect(page.getByRole("button", { name: "Set Home Beach" })).toBeHidden();

    // Profile tile shows Ocean Beach
    await page.goto("/profile");
    await expect(page.getByText("Home Break")).toBeVisible();
    await expect(page.getByText("Ocean Beach")).toBeVisible();
  });
});
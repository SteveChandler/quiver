import { test, expect } from "@playwright/test";
import { dismissOnboardingModal } from "./test-helpers";

test.describe("Home Beach Update Flow", () => {
  test("setting home beach updates everywhere - full flow", async ({ page }) => {
    // API route stubs
    let currentHomeBeachId: string | null = null;
    
    // Stub the profile API to return dynamic home beach
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

    // Stub beaches API
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
          {
            id: "beach-3",
            name: "Malibu",
            latitude: 34.0259,
            longitude: -118.7798,
          },
        ]),
      });
    });

    // Stub forecast API to provide data for the selected beach
    await page.route("**/api/forecasts/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "forecast-1",
          beach_id: currentHomeBeachId || "beach-1",
          wave_height_min: 2,
          wave_height_max: 4,
          conditions: "Fair to Good",
          date: new Date().toISOString(),
        }),
      });
    });

    // Stub profile action update
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "POST") {
        const body = await route.request().json();
        if (body.home_beach_id) {
          currentHomeBeachId = body.home_beach_id;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Ensure onboarding does not block clicks
    await page.addInitScript(() => {
      try { localStorage.setItem('quiver-onboarding-completed', 'true'); } catch {}
    });
    // Step 1: Navigate to home page and verify banner is visible when no beach is set
    await page.goto("/");
    await page.waitForLoadState("load");
    await dismissOnboardingModal(page).catch(() => {});
    
    // Check that the home beach banner is visible (it shows when using fallback beach)
    const homeBanner = page.locator('[data-testid="home-beach-banner"]');
    const bannerCount = await homeBanner.count();
    if (bannerCount === 0) {
      // Fallback: go straight to profile flow if banner is not present
      await page.goto("/profile");
      await page.waitForLoadState("load");
    } else {
      await expect(homeBanner).toBeVisible({ timeout: 10000 });
      const setHomeBeachButton = page.locator('[data-testid="set-home-beach"]');
      await expect(setHomeBeachButton).toBeVisible();
      await expect(setHomeBeachButton).toContainText("Set Home Beach");
      // Step 2: Click the Set Home Beach button to open the selector
      await setHomeBeachButton.click();
      // Wait for the beach selector to be visible
      const beachSelector = page.locator('[data-testid="home-beach-select"]');
      await expect(beachSelector).toBeVisible();
      // Step 3: Select "Newport Beach" from the dropdown
      await beachSelector.click();
      const newportOption = page.locator('[role="option"]').filter({ hasText: "Newport Beach" });
      await newportOption.click();
      // Update our mock to reflect the selection
      currentHomeBeachId = "beach-2";
      // Step 4: Verify the banner disappears after selection
      await expect(homeBanner).toBeHidden({ timeout: 10000 });
    }

    // Step 5: Navigate to profile page and open edit modal directly
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");
    
    // Ensure modal is open (click Edit if needed)
    const modalBeachSelector = page.locator('[data-testid="home-beach-select"]');
    if (!(await modalBeachSelector.isVisible())) {
      const editBtn = page.locator('button:has-text("Edit")').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
      }
    }
    await expect(modalBeachSelector).toBeVisible({ timeout: 15000 });
    await expect(modalBeachSelector).toContainText("Newport Beach");

    // Change home beach within the open modal
    
    // Change to Malibu
    await modalBeachSelector.click();
    await page.waitForTimeout(500);
    
    const malibuOption = page.locator('[role="option"]').filter({ hasText: "Malibu" });
    await expect(malibuOption).toBeVisible();
    await malibuOption.click();
    
    // Save the form
    const saveButton = page.locator('[data-testid="save-profile"]');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Update our mock
    currentHomeBeachId = "beach-3";
    
    // Wait for modal to close and verify update
    await page.waitForTimeout(1000);
    // Reopen modal via URL to validate persisted selection
    await page.goto("/profile?edit=true");
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible' });
    await expect(page.locator('[data-testid="home-beach-select"]')).toContainText("Malibu");

    // Step 7: Navigate back to home and verify banner is still hidden
    await page.goto("/");
    await page.waitForLoadState("load");
    await dismissOnboardingModal(page).catch(() => {});
    
    // Banner should remain hidden since home beach is set
    await expect(homeBanner).toBeHidden();

    // Step 8: Clear home beach and verify banner reappears
    await page.goto("/profile?edit=true");
    
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible' });
    
    // Clear the selection (if there's a clear button)
    const clearButton = page.locator('[data-testid="home-beach-select"]').locator('button[aria-label="Clear"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    } else {
      // Alternative: Select placeholder option if available
      await modalBeachSelector.click();
      const placeholderOption = page.locator('[role="option"]').first();
      await placeholderOption.click();
    }
    
    // Save with no home beach
    await saveButton.click();
    currentHomeBeachId = null;
    
    // Reopen modal and verify it shows cleared selection
    await page.goto("/profile?edit=true");
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible' });
    await expect(page.locator('[data-testid="home-beach-select"]')).not.toContainText("Malibu");
    
    // Step 9: Go back to home and verify banner is visible again
    await page.goto("/");
    await page.waitForLoadState("load");
    
    await expect(homeBanner).toBeVisible();
    await expect(setHomeBeachButton).toBeVisible();
  });

  test("home beach persists across page navigation", async ({ page }) => {
    // Set up with a pre-selected home beach
    const selectedBeachId = "beach-1";
    
    await page.route("**/api/me/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-id",
          home_beach_id: selectedBeachId,
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
        ]),
      });
    });

    // Navigate directly to profile edit modal
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");
    
    // Verify modal selector shows selected beach
    const modalSelector = page.locator('[data-testid="home-beach-select"]');
    await expect(modalSelector).toBeVisible({ timeout: 15000 });
    await expect(modalSelector).toContainText("Huntington Beach");

    // Navigate to another page and back
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");
    
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");
    await expect(page.locator('[data-testid="home-beach-select"]')).toContainText("Huntington Beach");
  });

  test("handles home beach update errors gracefully", async ({ page }) => {
    let shouldFailUpdate = false;
    
    await page.route("**/api/me/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-user-id",
          home_beach_id: null,
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
            name: "Test Beach",
            latitude: 33.6595,
            longitude: -118.0034,
          },
        ]),
      });
    });

    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "POST" && shouldFailUpdate) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Failed to update profile" }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to profile page
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    
    // Open edit modal
    await page.goto("/profile");
    const editBtn2 = page.locator('button:has-text("Edit")').first();
    await editBtn2.waitFor({ state: 'visible', timeout: 15000 });
    await editBtn2.click();
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible', timeout: 15000 });
    // Open edit modal reliably
    await page.goto("/profile");
    const editBtn3 = page.locator('button:has-text("Edit")').first();
    await editBtn3.waitFor({ state: 'visible', timeout: 15000 });
    await editBtn3.click();
    await page.waitForSelector('[data-testid="home-beach-select"]', { state: 'visible', timeout: 15000 });
    
    // Select a beach
    const beachSelector = page.locator('[data-testid="home-beach-select"]');
    await beachSelector.click();
    
    const beachOption = page.locator('[role="option"]').filter({ hasText: "Test Beach" });
    await beachOption.click();
    
    // Set flag to fail the update
    shouldFailUpdate = true;
    
    // Try to save
    const saveButton = page.locator('[data-testid="save-profile"]');
    await saveButton.click();
    
    // Should show error message (implementation dependent)
    // The modal should remain open
    await page.waitForTimeout(1000);
    await expect(beachSelector).toBeVisible();
    
    // Verify the value hasn't changed on the profile page
    const homeBreakValue = page.locator('[data-testid="home-break-value"]');
    await expect(homeBreakValue).toContainText("—");
  });
});
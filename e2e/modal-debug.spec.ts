import { test, expect } from "@playwright/test";
import { setupTestUser, cleanupTestData, waitForPageLoad, ensureAuthenticated, waitForPageLoadAndDismissModal } from "./test-helpers";

test.describe("Modal Debug Tests", () => {
  let testUserId: string;

  test.beforeEach(async ({ page }) => {
    // Ensure auth to avoid redirects obscuring modal checks
    const authed = await ensureAuthenticated(page, 12000);
    if (!authed) {
      // Fallback to legacy setup (non-blocking)
      testUserId = await setupTestUser(page);
    }
    
    // Monitor all console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[${type.toUpperCase()}] ${text}`);
    });
    
    // Monitor network failures
    page.on('requestfailed', request => {
      console.log(`❌ Request failed: ${request.url()}`);
    });
  });

  test.afterEach(async () => {
    if (testUserId) {
      await cleanupTestData(testUserId);
    }
  });

  test("should debug home page and profile modal access", async ({ page }) => {
    console.log("=== Testing Home Page ===");
    await page.goto("/");
    await waitForPageLoadAndDismissModal(page);
    
    // Check home page structure
    const bodyVisible = await page.locator("body").isVisible().catch(() => false);
    console.log(`Home page body visible: ${bodyVisible}`);
    
    // Look for main content areas
    const mainContent = await page.locator("main, [role='main'], .main-content").first().isVisible().catch(() => false);
    console.log(`Main content area visible: ${mainContent}`);
    
    // Check for Set Home Beach button
    const setHomeBeachButton = await page.locator("text=Set Home Beach").isVisible().catch(() => false);
    console.log(`Set Home Beach button visible: ${setHomeBeachButton}`);
    
    // Check for any forecast content
    const forecastContent = await page.locator('[data-testid*="forecast"], .forecast, text=forecast').first().isVisible().catch(() => false);
    console.log(`Forecast content visible: ${forecastContent}`);
    
    console.log("=== Testing Direct Profile Access ===");
    await page.goto("/profile");
    await waitForPageLoad(page);
    
    // Check if we're redirected to auth
    const currentUrl = page.url();
    console.log(`Profile page URL: ${currentUrl}`);
    const onAuthPage = currentUrl.includes("/auth");
    console.log(`On auth page: ${onAuthPage}`);
    
    if (!onAuthPage) {
      // Look for profile elements
      const profileVisible = await page.locator('[data-testid="profile"], .profile, text=Profile').first().isVisible().catch(() => false);
      console.log(`Profile content visible: ${profileVisible}`);
      
      // Look for edit button
      const editButton = await page.locator('text=Edit', 'button:has-text("Edit")', '[aria-label*="edit"]').first().isVisible().catch(() => false);
      console.log(`Edit button visible: ${editButton}`);
      
      console.log("=== Testing Direct Profile Edit Access ===");
      await page.goto("/profile?edit=true");
      await waitForPageLoad(page);
      
      // Wait and check for dialog elements
      await page.waitForTimeout(2000);
      
      const dialogElements = await page.locator('[role="dialog"], .dialog, [data-testid*="modal"], [data-testid*="dialog"]').all();
      console.log(`Found ${dialogElements.length} dialog elements`);
      
      for (let i = 0; i < dialogElements.length; i++) {
        const isVisible = await dialogElements[i].isVisible().catch(() => false);
        const text = await dialogElements[i].textContent().catch(() => "");
        console.log(`Dialog ${i}: visible=${isVisible}, text="${text.slice(0, 50)}..."`);
      }
      
      // Check specifically for edit profile modal
      const editModal = await page.locator('[role="dialog"]:has-text("Edit Profile")').isVisible().catch(() => false);
      console.log(`Edit Profile modal visible: ${editModal}`);
      
      // Check for home beach selector
      const homeBeachSelector = await page.locator('button[role="combobox"], [data-testid*="beach"], text*="beach"').first().isVisible().catch(() => false);
      console.log(`Home beach selector visible: ${homeBeachSelector}`);
    }
    
    console.log("=== Debug Complete ===");
  });
});

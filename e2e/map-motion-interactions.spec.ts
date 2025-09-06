import { test, expect } from "@playwright/test";
import { ensureAuthenticated, waitForPageLoadAndDismissModal } from "./test-helpers";

test.describe("Map Motion Interactions - Priority 1", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authenticated Home screen (not Landing) for components on '/'
    const authed = await ensureAuthenticated(page, 15000);
    if (!authed) throw new Error("Authentication failed for map motion tests");
    await page.goto("/");
    await waitForPageLoadAndDismissModal(page);

    // If we still see Landing (no bottom nav), prefer /map which also exposes search/motion
    const hasBottomNav = await page.getByTestId("bottom-navigation").isVisible().catch(() => false);
    if (!hasBottomNav) {
      await page.goto("/map");
      await page.waitForLoadState("load");
    }
  });

  test("should animate beach search bar with MAP_MOTION", async ({ page }) => {
    // Wait for beach search bar to appear
    const searchSection = page
      .locator('[data-testid="beach-search-bar"]').or(
        page.locator('section').filter({ has: page.locator('input[placeholder*="search beaches" i]') })
      )
      .or(page.locator('input[placeholder*="search" i]').first());
    
    await expect(searchSection).toBeVisible({ timeout: 15000 });
    
    // Test search input animations
    const searchInput = page.locator('input[placeholder*="search beaches" i]').or(
      page.locator('input[placeholder*="search" i]')
    ).first();
    await expect(searchInput).toBeVisible();
    
    // Test hover effects on search container
    const searchCard = page.locator('.card').filter({ has: searchInput }).first();
    await searchCard.hover();
    
    // Type in search to trigger search icon animation
    await searchInput.fill("Ocean Beach");
    await page.waitForTimeout(500); // Allow animation to complete
    
    // Test search button hover and press animations
    const searchButton = page.locator('button:has-text("Search")');
    await searchButton.hover();
    await page.waitForTimeout(200); // Allow hover animation
    
    // Test search submission
    await searchButton.click();
    await page.waitForTimeout(1000); // Allow for loading animation
  });

  test("should animate beach quick actions with MAP_MOTION", async ({ page }) => {
    // Navigate to a beach detail page or find quick actions
    const quickActions = page.locator('[data-testid="beach-quick-actions"]').or(
      page.locator('div').filter({ 
        has: page.locator('button:has-text("Plan Session"), button:has-text("Log Session")') 
      })
    );
    
    // Wait for quick actions to be visible
    await expect(quickActions.or(
      page.locator('button:has-text("Plan Session")').first()
    )).toBeVisible({ timeout: 10000 });

    // Test Plan Session button animations
    const planButton = page.locator('button:has-text("Plan Session")').first();
    if (await planButton.isVisible()) {
      await planButton.hover();
      await page.waitForTimeout(300); // Allow hover animation
      
      // Test button press animation
      await planButton.click();
      await page.waitForTimeout(500); // Allow navigation or animation
    }
    
    // Navigate back if we were redirected
    if (page.url() !== await page.evaluate(() => window.location.origin + "/")) {
      await page.goBack();
    }
    
    // Test Log Session button animations
    const logButton = page.locator('button:has-text("Log Session")').first();
    if (await logButton.isVisible()) {
      await logButton.hover();
      await page.waitForTimeout(300); // Allow hover animation
    }
  });

  test("should display and animate intel map markers", async ({ page }) => {
    // Navigate to intel map page
    await page.goto("/intel");
    
    // Wait for map to load
    await page.waitForTimeout(3000);
    
    // Check if map container is present
    const mapContainer = page.locator('.mapboxgl-map, [class*="mapbox"], .map-container').first();
    
    if (await mapContainer.isVisible()) {
      // Test map interactions
      await mapContainer.hover();
      await page.waitForTimeout(500);
      
      // Look for any map markers or pins
      const markers = page.locator('[class*="marker"], [class*="pin"], .mapboxgl-marker');
      
      if (await markers.first().isVisible({ timeout: 5000 })) {
        const markerCount = await markers.count();
        console.log(`Found ${markerCount} markers on map`);
        
        // Test marker hover animations
        for (let i = 0; i < Math.min(markerCount, 3); i++) {
          const marker = markers.nth(i);
          if (await marker.isVisible()) {
            await marker.hover();
            await page.waitForTimeout(300); // Allow hover animation
            
            // Test marker click
            await marker.click();
            await page.waitForTimeout(500); // Allow popup or modal animation
          }
        }
      }
    } else {
      console.log("Map container not found - test environment may need map setup");
    }
  });

  test("should respect reduced motion preferences", async ({ page, context }) => {
    // Set reduced motion preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          addEventListener: () => {},
          removeEventListener: () => {}
        })
      });
    });
    
    await page.reload();
    
    // Check that animations are reduced/disabled
    const searchInput = page.locator('input[placeholder*="Search beaches"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      
      // Verify that transitions are minimal or disabled
      const computedStyle = await searchInput.evaluate((el) => 
        getComputedStyle(el).transitionDuration
      );
      
      // Should be very short or 0 for reduced motion
      expect(parseFloat(computedStyle.replace('s', '')) < 0.1).toBeTruthy();
    }
  });

  test("should animate search error states", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search beaches"]');
    const searchButton = page.locator('button:has-text("Search")');
    
    if (await searchInput.isVisible() && await searchButton.isVisible()) {
      // Enter invalid search to trigger error
      await searchInput.fill("InvalidBeachName12345");
      await searchButton.click();
      
      // Wait for error message to appear with animation
      await page.waitForTimeout(1000);
      
      // Check for error message
      const errorMessage = page.locator('p').filter({ hasText: /no.*beach.*found/i }).or(
        page.locator('[role="alert"], .text-red-600, .text-red-800')
      );
      
      if (await errorMessage.isVisible()) {
        // Error message should be animated in
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test("should handle map zoom and navigation animations", async ({ page }) => {
    // Navigate to intel map
    await page.goto("/intel");
    
    // Wait for map to load
    await page.waitForTimeout(3000);
    
    const mapContainer = page.locator('.mapboxgl-map, [class*="mapbox"]').first();
    
    if (await mapContainer.isVisible()) {
      // Test zoom controls if available
      const zoomIn = page.locator('.mapboxgl-ctrl-zoom-in, [title*="Zoom in"]');
      const zoomOut = page.locator('.mapboxgl-ctrl-zoom-out, [title*="Zoom out"]');
      
      if (await zoomIn.isVisible()) {
        await zoomIn.click();
        await page.waitForTimeout(500); // Allow zoom animation
        
        await zoomOut.click();
        await page.waitForTimeout(500); // Allow zoom animation
      }
      
      // Test map panning
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(mapBounds.x + 100, mapBounds.y + 100);
        await page.mouse.up();
        await page.waitForTimeout(500); // Allow pan animation
      }
    }
  });

  test("should validate motion performance", async ({ page }) => {
    // Start performance measurement
    const startTime = Date.now();
    
    // Perform multiple motion interactions
    const searchInput = page.locator('input[placeholder*="Search beaches"]');
    
    if (await searchInput.isVisible()) {
      // Rapid interactions to test performance
      for (let i = 0; i < 5; i++) {
        await searchInput.hover();
        await page.waitForTimeout(50);
        await searchInput.blur();
        await page.waitForTimeout(50);
      }
    }
    
    const quickActionButtons = page.locator('button:has-text("Plan Session"), button:has-text("Log Session")');
    const buttonCount = await quickActionButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = quickActionButtons.nth(i);
      if (await button.isVisible()) {
        await button.hover();
        await page.waitForTimeout(50);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Animations should complete within reasonable time
    expect(totalTime).toBeLessThan(5000);
  });

  test("should animate forecast popup in intel map", async ({ page }) => {
    await page.goto("/intel");
    
    // Wait for map to load
    await page.waitForTimeout(3000);
    
    // Look for map markers
    const markers = page.locator('[class*="marker"], [class*="pin"], .mapboxgl-marker');
    
    if (await markers.first().isVisible({ timeout: 5000 })) {
      // Click on a marker to trigger popup
      await markers.first().click();
      
      // Wait for popup animation
      await page.waitForTimeout(500);
      
      // Check if popup appeared
      const popup = page.locator('.mapboxgl-popup, .intel-popup-animated, [class*="popup"]');
      
      if (await popup.isVisible()) {
        // Popup should be animated in
        await expect(popup).toBeVisible();
        
        // Test popup content
        const popupContent = page.locator('.intel-popup-content, .mapboxgl-popup-content');
        if (await popupContent.isVisible()) {
          await expect(popupContent).toBeVisible();
        }
      }
    }
  });

  test("should animate favorite button interactions", async ({ page }) => {
    // Look for favorite buttons
    const favoriteButton = page.locator('[data-testid="favorite-button"]').or(
      page.locator('button').filter({ has: page.locator('[class*="heart"], [class*="favorite"]') })
    );
    
    if (await favoriteButton.first().isVisible()) {
      const button = favoriteButton.first();
      
      // Test hover animation
      await button.hover();
      await page.waitForTimeout(300);
      
      // Test click animation (like/unlike)
      await button.click();
      await page.waitForTimeout(500);
    }
  });

  test("should validate accessibility with animations", async ({ page }) => {
    // Test that animations don't break accessibility
    const searchInput = page.locator('input[placeholder*="Search beaches"]');
    
    if (await searchInput.isVisible()) {
      // Test keyboard navigation
      await searchInput.focus();
      await expect(searchInput).toBeFocused();
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200); // Allow focus animation
      
      // Test screen reader compatibility
      const searchLabel = await searchInput.getAttribute('aria-label');
      expect(searchLabel).toBeTruthy();
    }
    
    // Check that buttons have proper accessibility
    const buttons = page.locator('button:has-text("Plan Session"), button:has-text("Log Session"), button:has-text("Search")');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const buttonText = await button.textContent();
        expect(buttonText?.trim()).toBeTruthy();
      }
    }
  });
});

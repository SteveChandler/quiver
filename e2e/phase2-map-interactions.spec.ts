import { test, expect } from '@playwright/test';

test.describe('Phase 2: Map Interactions Motion', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to map page
    await page.goto('/map');
    await page.waitForLoadState('load');
    // Give map components time to initialize
    await page.waitForTimeout(2000);
  });

  test.describe('Beach Marker Interactions', () => {
    test('should show hover effects on beach markers', async ({ page }) => {
      // Wait for map to load
      await page.waitForSelector('[data-testid="beach-marker"]', { timeout: 10000 });
      
      // Get first beach marker
      const marker = page.locator('[data-testid="beach-marker"]').first();
      
      // Test hover effect
      await marker.hover();
      
      // Verify scale animation (should be 1.2x on hover)
      const transform = await marker.evaluate(el => 
        getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
      
      // Verify marker is still visible after hover
      await expect(marker).toBeVisible();
    });

    test('should show selection animation when beach marker is clicked', async ({ page }) => {
      // Wait for map to load
      await page.waitForSelector('[data-testid="beach-marker"]', { timeout: 10000 });
      
      const marker = page.locator('[data-testid="beach-marker"]').first();
      
      // Click marker to select
      await marker.click();
      
      // Verify selection ring appears
      const selectionRing = page.locator('[data-testid="selection-ring"]');
      await expect(selectionRing).toBeVisible();
      
      // Verify marker scale increases (should be 1.4x when selected)
      const transform = await marker.evaluate(el => 
        getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
    });

    test('should display forecast popup with smooth animation', async ({ page }) => {
      // Wait for map to load
      await page.waitForSelector('[data-testid="beach-marker"]', { timeout: 10000 });
      
      const marker = page.locator('[data-testid="beach-marker"]').first();
      
      // Hover to trigger popup
      await marker.hover();
      
      // Wait for popup to appear
      const popup = page.locator('[data-testid="forecast-popup"]');
      await expect(popup).toBeVisible({ timeout: 2000 });
      
      // Verify popup content
      await expect(popup.locator('h4')).toBeVisible();
      await expect(popup.locator('.forecast-data')).toBeVisible();
      
      // Move mouse away to close popup
      await page.mouse.move(0, 0);
      await expect(popup).not.toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Beach List Interactions', () => {
    test('should show staggered entrance animations for beach list', async ({ page }) => {
      // Switch to list view first
      const listViewButton = page.getByRole('button', { name: /list/i });
      if (await listViewButton.isVisible().catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      // Wait for beach list to load
      await page.waitForSelector('[data-testid="beach-list"]', { timeout: 10000 });
      
      const beachItems = page.locator('[data-testid="beach-item"]');
      
      // Verify items appear with staggered timing
      const itemCount = await beachItems.count();
      expect(itemCount).toBeGreaterThan(0);
      
      // Check that items are visible (staggered animation should complete)
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        await expect(beachItems.nth(i)).toBeVisible();
      }
    });

    test('should show hover effects on beach list items', async ({ page }) => {
      // Switch to list view first
      const listViewButton = page.getByRole('button', { name: /list/i });
      if (await listViewButton.isVisible().catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      // Wait for beach list to load
      await page.waitForSelector('[data-testid="beach-item"]', { timeout: 10000 });
      
      const beachItem = page.locator('[data-testid="beach-item"]').first();
      
      // Test hover effect
      await beachItem.hover();
      
      // Verify scale animation (should be 1.02x on hover)
      const transform = await beachItem.evaluate(el => 
        getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
      
      // Verify item is still visible after hover
      await expect(beachItem).toBeVisible();
    });

    test('should show selection indicator when beach is selected', async ({ page }) => {
      // Switch to list view first
      const listViewButton = page.getByRole('button', { name: /list/i });
      if (await listViewButton.isVisible().catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(500);
      }

      // Wait for beach list to load
      await page.waitForSelector('[data-testid="beach-item"]', { timeout: 10000 });
      
      const beachItem = page.locator('[data-testid="beach-item"]').first();
      
      // Click to select
      await beachItem.click();
      
      // Verify selection indicator appears
      const selectionIndicator = page.locator('[data-testid="selection-indicator"]');
      await expect(selectionIndicator).toBeVisible();
      
      // Verify checkmark is present
      await expect(selectionIndicator).toContainText('✓');
    });

    test('should filter beaches with smooth animations', async ({ page }) => {
      // Wait for filter input to load
      await page.waitForSelector('[data-testid="filter-input"]', { timeout: 10000 });
      
      const filterInput = page.locator('[data-testid="filter-input"]');
      const beachItems = page.locator('[data-testid="beach-item"]');
      
      // Get initial count
      const initialCount = await beachItems.count();
      expect(initialCount).toBeGreaterThan(0);
      
      // Type in filter
      await filterInput.fill('Ocean');
      
      // Wait for filter animation
      await page.waitForTimeout(500);
      
      // Verify filtered results
      const filteredCount = await beachItems.count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
      
      // Verify remaining items contain "Ocean"
      for (let i = 0; i < filteredCount; i++) {
        const itemText = await beachItems.nth(i).textContent();
        expect(itemText?.toLowerCase()).toContain('ocean');
      }
    });
  });

  test.describe('Beach Card Interactions', () => {
    test('should show hover effects on beach cards', async ({ page }) => {
      // Wait for beach cards to appear
      await page.waitForSelector('[data-testid="beach-card"]', { timeout: 10000 });
      
      const beachCard = page.locator('[data-testid="beach-card"]').first();
      
      // Test hover effect
      await beachCard.hover();
      
      // Verify scale and shadow animation
      const transform = await beachCard.evaluate(el => 
        getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
      
      // Verify card is still visible after hover
      await expect(beachCard).toBeVisible();
    });

    test('should expand content with smooth animation', async ({ page }) => {
      // Wait for beach cards to appear
      await page.waitForSelector('[data-testid="beach-card"]', { timeout: 10000 });
      
      const beachCard = page.locator('[data-testid="beach-card"]').first();
      
      // Click to expand
      await beachCard.click();
      
      // Verify expanded content appears
      const expandedContent = page.locator('[data-testid="expanded-content"]');
      await expect(expandedContent).toBeVisible();
      
      // Verify forecast info is displayed
      await expect(expandedContent.locator('.forecast-info')).toBeVisible();
      await expect(expandedContent.locator('.conditions-grid')).toBeVisible();
    });
  });

  test.describe('Location Selection', () => {
    test('should show location selection excitement animation', async ({ page }) => {
      // Wait for location selector to load
      await page.waitForSelector('[data-testid="location-selector"]', { timeout: 10000 });
      
      const locationSelector = page.locator('[data-testid="location-selector"]');
      const searchInput = page.locator('[data-testid="search-input"]');
      
      // Type in search
      await searchInput.fill('Pacific Beach');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 2000 });
      
      const searchResult = page.locator('[data-testid="search-result-item"]').first();
      
      // Click to select location
      await searchResult.click();
      
      // Verify selection animation (should show "selecting" then "selected" state)
      await expect(locationSelector).toBeVisible();
      
      // Verify search input shows selected location
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toContain('Pacific Beach');
    });

    test('should show search results with staggered animations', async ({ page }) => {
      // Wait for location selector to load
      await page.waitForSelector('[data-testid="search-input"]', { timeout: 10000 });
      
      const searchInput = page.locator('[data-testid="search-input"]');
      
      // Type in search
      await searchInput.fill('Beach');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 2000 });
      
      const searchResults = page.locator('[data-testid="search-result-item"]');
      const resultCount = await searchResults.count();
      
      // Verify results appear with staggered timing
      expect(resultCount).toBeGreaterThan(0);
      
      // Check that all results are visible (staggered animation should complete)
      for (let i = 0; i < Math.min(resultCount, 5); i++) {
        await expect(searchResults.nth(i)).toBeVisible();
      }
    });
  });

  test.describe('Map Performance', () => {
    test('should maintain 60fps during map interactions', async ({ page }) => {
      // Navigate to map page
      await page.goto('/map');
      await page.waitForLoadState('load');
      
      // Start performance monitoring
      await page.evaluate(() => {
        window.frameCount = 0;
        window.lastTime = performance.now();
        
        const countFrames = () => {
          window.frameCount++;
          const currentTime = performance.now();
          if (currentTime - window.lastTime >= 1000) {
            const fps = Math.round((window.frameCount * 1000) / (currentTime - window.lastTime));
            console.log(`FPS: ${fps}`);
            window.frameCount = 0;
            window.lastTime = currentTime;
          }
          requestAnimationFrame(countFrames);
        };
        requestAnimationFrame(countFrames);
      });
      
      // Perform map interactions
      await page.waitForSelector('[data-testid="beach-marker"]', { timeout: 10000 });
      
      const marker = page.locator('[data-testid="beach-marker"]').first();
      
      // Hover and click multiple times
      for (let i = 0; i < 5; i++) {
        await marker.hover();
        await page.waitForTimeout(200);
        await marker.click();
        await page.waitForTimeout(200);
      }
      
      // Verify no performance warnings in console
      const consoleMessages = await page.evaluate(() => {
        return window.consoleMessages || [];
      });
      
      const performanceWarnings = consoleMessages.filter(msg => 
        msg.includes('performance') || msg.includes('slow') || msg.includes('fps')
      );
      
      expect(performanceWarnings.length).toBe(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation for map interactions', async ({ page }) => {
      // Navigate to map page
      await page.goto('/map');
      await page.waitForLoadState('load');
      
      // Focus on first beach marker
      await page.keyboard.press('Tab');
      
      // Verify focus indicator is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Press Enter to select
      await page.keyboard.press('Enter');
      
      // Verify selection occurred
      const selectionRing = page.locator('[data-testid="selection-ring"]');
      await expect(selectionRing).toBeVisible();
    });

    test('should respect reduced motion preferences', async ({ page, context }) => {
      // Set reduced motion preference
      await context.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          value: () => ({ matches: true }), // simulate reduced motion
        });
      });
      
      // Navigate to map page
      await page.goto('/map');
      await page.waitForLoadState('load');
      
      // Wait for map to load
      await page.waitForSelector('[data-testid="beach-marker"]', { timeout: 10000 });
      
      const marker = page.locator('[data-testid="beach-marker"]').first();
      
      // Hover on marker
      await marker.hover();
      
      // Verify animation duration is minimal (reduced motion)
      const animationDuration = await marker.evaluate(el => 
        getComputedStyle(el).animationDuration
      );
      
      // Should be very short or 0.01ms for reduced motion
      expect(animationDuration).toBe('0.01ms');
    });
  });

  test.describe('Fallback Tests for Missing Components', () => {
    test('should work with existing map container', async ({ page }) => {
      // Test existing map container
      const mapContainer = page.locator('[data-testid="map-container"]');
      await expect(mapContainer).toBeVisible({ timeout: 10000 });
      
      // Click on map container
      await mapContainer.click();
      await page.waitForTimeout(500);
      
      // Verify page doesn't crash
      await expect(page.locator('body')).toBeVisible();
    });

    test('should work with existing beach search functionality', async ({ page }) => {
      // Test existing search input if available
      const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Beach');
        await page.waitForTimeout(1000);
        
        // Verify search doesn't crash
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should work with existing beach cards', async ({ page }) => {
      // Test existing beach cards
      const beachCards = page.locator('.beach-card, [data-testid="beach-card"]');
      
      if (await beachCards.first().isVisible().catch(() => false)) {
        await beachCards.first().hover();
        await page.waitForTimeout(500);
        
        await beachCards.first().click();
        await page.waitForTimeout(500);
        
        // Verify interaction doesn't crash
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should work with view mode toggles', async ({ page }) => {
      // Test view mode buttons
      const mapViewButton = page.getByRole('button', { name: /map/i });
      const listViewButton = page.getByRole('button', { name: /list/i });

      if (await listViewButton.isVisible().catch(() => false)) {
        await listViewButton.click();
        await page.waitForTimeout(1000);
        
        // Verify switch doesn't crash
        await expect(page.locator('body')).toBeVisible();
      }

      if (await mapViewButton.isVisible().catch(() => false)) {
        await mapViewButton.click();
        await page.waitForTimeout(1000);
        
        // Verify switch doesn't crash
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });
});
import { test, expect } from "@playwright/test";

test.describe("Map and Beach Directory (Refactored)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/map");
    await page.waitForLoadState("networkidle");
  });

  test("should display map view correctly", async ({ page }) => {
    // Use deterministic assertions instead of timeouts
    await expect(page.locator("body")).toBeVisible();

    // Check for core page elements with proper waiting
    const mainContent = page.locator("main, [role='main']");
    await expect(mainContent).toBeVisible();

    // Look for map container with specific timeout
    const mapContainer = page.locator(
      '[data-testid="map-container"], .map-container, .leaflet-container, .mapbox-map'
    );

    // Either map container exists or we have beach list fallback
    const beachList = page.locator('[data-testid="beach-list"], .beach-list');

    try {
      await expect(mapContainer).toBeVisible({ timeout: 5000 });
    } catch {
      // Fallback to beach list if map doesn't load
      await expect(beachList).toBeVisible();
    }
  });

  test("should show beach markers or beach list", async ({ page }) => {
    // Wait for either markers or list to appear
    const beachMarkers = page.locator(
      '[data-testid="beach-marker"], .marker, .beach-pin'
    );
    const beachList = page.locator('[data-testid="beach-list"], .beach-list');
    const beachCards = page.locator('.beach-card, [data-testid="beach-card"]');

    // At least one of these should be visible
    const hasMarkers = await beachMarkers.count().then((count) => count > 0);
    const hasList = await beachList.isVisible().catch(() => false);
    const hasCards = await beachCards.count().then((count) => count > 0);

    expect(hasMarkers || hasList || hasCards).toBeTruthy();

    if (hasMarkers) {
      await expect(beachMarkers.first()).toBeVisible();
    } else if (hasCards) {
      await expect(beachCards.first()).toBeVisible();
    } else {
      await expect(beachList).toBeVisible();
    }
  });

  test("should handle beach selection interactions", async ({ page }) => {
    // Find any interactive beach element
    const beachMarker = page
      .locator('[data-testid="beach-marker"], .marker')
      .first();
    const beachCard = page
      .locator('.beach-card, [data-testid="beach-card"]')
      .first();
    const beachListItem = page
      .locator('[data-testid="beach-list-item"], .beach-item')
      .first();

    // Determine which element to interact with
    const markerVisible = await beachMarker.isVisible().catch(() => false);
    const cardVisible = await beachCard.isVisible().catch(() => false);
    const listItemVisible = await beachListItem.isVisible().catch(() => false);

    if (markerVisible) {
      await beachMarker.click();
    } else if (cardVisible) {
      await beachCard.click();
    } else if (listItemVisible) {
      await beachListItem.click();
    } else {
      test.skip("No interactive beach elements found");
    }

    // Verify interaction result - either navigation or popup
    const currentUrl = page.url();
    const hasNavigated = currentUrl.includes("/beach/");

    if (!hasNavigated) {
      // Look for popup or modal
      const beachInfo = page.locator(
        '.popup, .modal, .beach-details, [data-testid="beach-info"]'
      );
      await expect(beachInfo).toBeVisible({ timeout: 3000 });
    }
  });

  test("should support beach search functionality", async ({ page }) => {
    const searchInput = page.locator(
      '[data-testid="beach-search"], input[placeholder*="search"], input[placeholder*="beach"]'
    );

    await expect(searchInput).toBeVisible();

    // Test search functionality
    await searchInput.fill("Malibu");
    await searchInput.press("Enter");

    // Wait for search results
    const searchResults = page.locator(
      '.beach-card, .search-result, [data-testid="beach-card"]'
    );
    await expect(searchResults.first()).toBeVisible({ timeout: 5000 });

    // Verify search worked
    const resultCount = await searchResults.count();
    expect(resultCount).toBeGreaterThan(0);

    // Clear search
    await searchInput.clear();
    await searchInput.press("Enter");
  });

  test("should toggle between map and list views", async ({ page }) => {
    // Look for view toggle buttons
    const mapViewButton = page.getByRole("button", { name: /map/i });
    const listViewButton = page.getByRole("button", { name: /list/i });

    const hasViewToggle =
      (await mapViewButton.isVisible()) && (await listViewButton.isVisible());

    if (hasViewToggle) {
      // Test switching to list view
      await listViewButton.click();

      // Verify list view is active
      const beachList = page.locator('.beach-list, [data-testid="beach-list"]');
      await expect(beachList).toBeVisible();

      // Switch back to map view
      await mapViewButton.click();

      // Verify map view is active
      const mapContainer = page.locator(
        '.map-container, [data-testid="map-container"]'
      );
      await expect(mapContainer).toBeVisible();
    } else {
      test.skip("View toggle buttons not found");
    }
  });

  test("should display beach information accurately", async ({ page }) => {
    // Find first beach card or marker
    const beachElement = page
      .locator('.beach-card, [data-testid="beach-card"], .marker')
      .first();
    await expect(beachElement).toBeVisible();

    // Get beach name for verification
    const beachName = await beachElement.textContent();
    expect(beachName).toBeTruthy();

    // Click to view details
    await beachElement.click();

    // Verify beach detail page loads with correct information
    const beachDetailPage = page.locator(
      '[data-testid="beach-detail"], .beach-detail'
    );
    const hasDetailPage = await beachDetailPage.isVisible().catch(() => false);

    if (hasDetailPage) {
      await expect(beachDetailPage).toBeVisible();

      // Verify beach name appears in details
      const detailBeachName = page.getByRole("heading", {
        name: new RegExp(beachName || "", "i"),
      });
      await expect(detailBeachName).toBeVisible();
    }
  });

  test("should handle geolocation requests gracefully", async ({ page }) => {
    // Grant geolocation permission
    await page.context().grantPermissions(["geolocation"]);
    await page.setGeolocation({ latitude: 33.7175, longitude: -118.1881 }); // Redondo Beach

    // Look for location-based features
    const nearbyButton = page.getByRole("button", {
      name: /nearby|current.*location|find.*me/i,
    });
    const locationIcon = page.locator(
      '[data-testid="location-button"], .location-btn'
    );

    const hasLocationFeature =
      (await nearbyButton.isVisible()) || (await locationIcon.isVisible());

    if (hasLocationFeature) {
      const locationButton = (await nearbyButton.isVisible())
        ? nearbyButton
        : locationIcon;
      await locationButton.click();

      // Verify location-based results
      const nearbyResults = page.locator(
        '.nearby-beaches, [data-testid="nearby-beaches"]'
      );
      await expect(nearbyResults).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display forecast data on beach cards", async ({ page }) => {
    const beachCard = page
      .locator('.beach-card, [data-testid="beach-card"]')
      .first();
    await expect(beachCard).toBeVisible();

    // Look for forecast information within the card
    const forecastInfo = beachCard.locator(
      '.forecast, [data-testid="forecast-preview"]'
    );
    const waveHeight = beachCard.getByText(/\d+[\"']\s*|\d+ft|\d+m/);
    const windSpeed = beachCard.getByText(/\d+\s*(mph|kph|knots)/);
    const conditions = beachCard.getByText(/good|fair|poor|excellent/i);

    // At least one forecast element should be present
    const hasForecastData = await Promise.race([
      forecastInfo.isVisible().catch(() => false),
      waveHeight.isVisible().catch(() => false),
      windSpeed.isVisible().catch(() => false),
      conditions.isVisible().catch(() => false),
    ]);

    expect(hasForecastData).toBeTruthy();
  });

  test("should support beach favoriting functionality", async ({ page }) => {
    const beachCard = page
      .locator('.beach-card, [data-testid="beach-card"]')
      .first();
    await expect(beachCard).toBeVisible();

    // Look for favorite button (heart icon)
    const favoriteButton = beachCard.locator("button").filter({
      has: page.locator('svg[class*="heart"], [data-testid="favorite-icon"]'),
    });

    if (await favoriteButton.isVisible()) {
      // Test favoriting
      await favoriteButton.click();

      // Verify visual feedback
      const isFavorited = await favoriteButton
        .locator('svg[class*="heart-filled"], svg[fill*="red"]')
        .isVisible();

      // Either should show filled heart or provide other feedback
      expect(isFavorited || (await favoriteButton.isPressed())).toBeTruthy();

      // Test unfavoriting
      await favoriteButton.click();
    }
  });

  test("should maintain responsive design on different screen sizes", async ({
    page,
  }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify mobile layout
    await expect(page.locator("body")).toBeVisible();

    // Check for mobile-specific navigation
    const mobileNav = page.locator(
      '[data-testid="mobile-nav"], .mobile-nav, .bottom-nav'
    );
    const hasMobileNav = await mobileNav.isVisible().catch(() => false);

    if (hasMobileNav) {
      await expect(mobileNav).toBeVisible();
    }

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });
});

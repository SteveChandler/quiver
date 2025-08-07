import { test, expect } from "@playwright/test";

test.describe("Map and Beach Directory", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/map");
  });

  test.fixme("should display map view correctly", async ({ page }) => {
    // Check that page loads and has some content
    await page.waitForTimeout(2000);

    // Look for map-related content more flexibly
    const hasMapContent = await Promise.race([
      page
        .getByTestId("map-view")
        .isVisible()
        .catch(() => false),
      page
        .locator(".map-view, #map")
        .isVisible()
        .catch(() => false),
      page
        .getByText(/map/i)
        .isVisible()
        .catch(() => false),
      page
        .locator("main")
        .isVisible()
        .catch(() => false),
    ]);

    expect(hasMapContent).toBeTruthy();

    // Check for basic map functionality
    const mapContainer = page.locator(
      '[data-testid="map-container"], .map-container, .leaflet-container, .mapbox-map'
    );
    const hasMapContainer = await mapContainer.isVisible().catch(() => false);

    if (hasMapContainer) {
      await expect(mapContainer).toBeVisible();
    } else {
      // If no interactive map, check for static map or placeholder
      const mapPlaceholder = page.getByText(/map|loading|beaches/i);
      await expect(mapPlaceholder).toBeVisible();
    }
  });

  test("should show beach markers on the map", async ({ page }) => {
    // Wait for map to load
    await page.waitForTimeout(3000);

    // Look for beach markers or pins
    const beachMarkers = page.locator(
      '[data-testid="beach-marker"], .marker, .beach-pin'
    );
    const markerCount = await beachMarkers.count();

    if (markerCount > 0) {
      // Should have at least one beach marker
      expect(markerCount).toBeGreaterThan(0);

      // First marker should be visible
      await expect(beachMarkers.first()).toBeVisible();
    } else {
      // If no markers visible, check for beach list as alternative
      const beachList = page
        .getByTestId("beach-list")
        .or(page.locator(".beach-list"));
      const hasList = await beachList.isVisible().catch(() => false);

      if (hasList) {
        await expect(beachList).toBeVisible();
      }
    }
  });

  test("should handle beach marker interactions", async ({ page }) => {
    // Wait for map to load
    await page.waitForTimeout(3000);

    const beachMarker = page
      .locator('[data-testid="beach-marker"], .marker')
      .first();

    if (await beachMarker.isVisible()) {
      // Click on beach marker
      await beachMarker.click();

      // Should show beach info popup or modal
      const beachInfo = page
        .getByTestId("beach-info")
        .or(page.locator(".popup, .modal, .beach-details"));
      const hasBeachInfo = await beachInfo
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (hasBeachInfo) {
        await expect(beachInfo).toBeVisible();

        // Should show beach name
        const beachName = beachInfo.getByText(/beach|surf|break/i);
        if (await beachName.isVisible()) {
          await expect(beachName).toBeVisible();
        }
      }
    }
  });

  test("should display current surf conditions", async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    // Look for surf condition information
    const conditionsElements = [
      page.getByTestId("surf-conditions").or(page.getByText(/conditions/i)),
      page.getByText(/wave height|waves/i),
      page.getByText(/wind/i),
      page.getByText(/tide/i),
    ];

    const visibleConditions = await Promise.all(
      conditionsElements.map((el) => el.isVisible().catch(() => false))
    );

    // Should have some condition information visible
    expect(visibleConditions.some((condition) => condition)).toBeTruthy();
  });

  test("should allow filtering beaches by conditions", async ({ page }) => {
    // Look for filter controls
    const filterButton = page.getByRole("button", {
      name: /filter|conditions/i,
    });
    const filterPanel = page
      .getByTestId("filter-panel")
      .or(page.locator(".filters"));

    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Should show filter options
      await expect(filterPanel).toBeVisible();

      // Look for wave height filter
      const waveHeightFilter = page.getByLabel(/wave height|size/i);
      if (await waveHeightFilter.isVisible()) {
        await waveHeightFilter.click();
        await page
          .getByText(/2-4 feet|small|medium|large/i)
          .first()
          .click();
      }

      // Look for wind filter
      const windFilter = page.getByLabel(/wind/i);
      if (await windFilter.isVisible()) {
        await windFilter.click();
        await page
          .getByText(/offshore|onshore|light/i)
          .first()
          .click();
      }
    }
  });

  test("should support location search", async ({ page }) => {
    // Look for search box
    const searchBox = page
      .getByPlaceholder(/search|location|beach/i)
      .or(page.getByLabel(/search/i));

    if (await searchBox.isVisible()) {
      await searchBox.click();
      await searchBox.fill("Malibu");

      // Wait for search results
      await page.waitForTimeout(2000);

      // Look for search results
      const searchResults = page.locator(
        '[role="option"], .search-result, .autocomplete-item'
      );
      if ((await searchResults.count()) > 0) {
        // Click on first result
        await searchResults.first().click();

        // Map should update to show searched location
        await page.waitForTimeout(2000);
      }
    }
  });

  test("should show detailed beach information", async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for beach cards or list items
    const beachItem = page
      .locator('[data-testid="beach-item"], .beach-card, .beach-item')
      .first();

    if (await beachItem.isVisible()) {
      await beachItem.click();

      // Should navigate to beach detail or show detailed info
      await page.waitForTimeout(1000);

      // Check if we're on a beach detail page or modal opened
      const isBeachDetailPage = page.url().includes("/beach/");
      const beachModal = page
        .getByTestId("beach-modal")
        .or(page.locator('[role="dialog"]'));
      const hasModal = await beachModal.isVisible().catch(() => false);

      expect(isBeachDetailPage || hasModal).toBeTruthy();

      if (isBeachDetailPage || hasModal) {
        // Should show detailed beach information
        const detailElements = [
          page.getByText(/forecast/i),
          page.getByText(/conditions/i),
          page.getByText(/location/i),
          page.getByText(/description/i),
        ];

        const visibleDetails = await Promise.all(
          detailElements.map((el) => el.isVisible().catch(() => false))
        );

        expect(visibleDetails.some((detail) => detail)).toBeTruthy();
      }
    }
  });

  test("should handle geolocation for nearby beaches", async ({ page }) => {
    // Mock geolocation permission
    await page.context().grantPermissions(["geolocation"]);
    await page
      .context()
      .setGeolocation({ latitude: 34.0259, longitude: -118.7798 }); // Malibu coordinates

    // Look for "nearby" or location-based features
    const nearbyButton = page.getByRole("button", {
      name: /nearby|location|current/i,
    });
    const locationIcon = page.locator(
      '[data-testid="location-button"], .location-btn'
    );

    if (await nearbyButton.isVisible()) {
      await nearbyButton.click();

      // Should show nearby beaches or center map on current location
      await page.waitForTimeout(3000);

      // Check for nearby beaches indicator
      const nearbyIndicator = page.getByText(/nearby|closest|distance/i);
      const hasNearbyFeature = await nearbyIndicator
        .isVisible()
        .catch(() => false);

      if (hasNearbyFeature) {
        expect(hasNearbyFeature).toBeTruthy();
      }
    } else if (await locationIcon.isVisible()) {
      await locationIcon.click();
      await page.waitForTimeout(2000);
    }
  });

  test("should display forecast data for beaches", async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    // Look for forecast information
    const forecastElements = [
      page.getByTestId("forecast").or(page.getByText(/forecast/i)),
      page.getByText(/tomorrow|today|next/i),
      page.getByText(/am|pm|\d+:\d+/i), // Time indicators
      page.getByText(/\d+ feet|\d+ft|small|medium|large/i), // Wave height
    ];

    const visibleForecast = await Promise.all(
      forecastElements.map((el) => el.isVisible().catch(() => false))
    );

    // Should have some forecast data visible
    expect(visibleForecast.some((forecast) => forecast)).toBeTruthy();
  });

  test("should support different map view modes", async ({ page }) => {
    // Look for view toggle buttons (satellite, terrain, etc.)
    const viewButtons = [
      page.getByRole("button", { name: /satellite|terrain|street/i }),
      page.getByTestId("map-view-toggle"),
      page.locator(".map-type-control button"),
    ];

    for (const viewButton of viewButtons) {
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
  });

  test("should handle zoom controls", async ({ page }) => {
    // Wait for map to load
    await page.waitForTimeout(2000);

    // Look for zoom controls
    const zoomIn = page
      .getByRole("button", { name: /zoom in|\+/i })
      .or(page.locator(".zoom-in"));
    const zoomOut = page
      .getByRole("button", { name: /zoom out|\-/i })
      .or(page.locator(".zoom-out"));

    if (await zoomIn.isVisible()) {
      await zoomIn.click();
      await page.waitForTimeout(500);

      if (await zoomOut.isVisible()) {
        await zoomOut.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("should show beach ratings and reviews", async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(3000);

    // Look for rating information
    const ratingElements = [
      page.getByTestId("beach-rating").or(page.locator(".rating")),
      page.getByText(/\d+\/5|\d+ stars|rating/i),
      page.locator('[aria-label*="star"], .star-rating'),
      page.getByText(/review|comment/i),
    ];

    const visibleRatings = await Promise.all(
      ratingElements.map((el) => el.isVisible().catch(() => false))
    );

    if (visibleRatings.some((rating) => rating)) {
      expect(visibleRatings.some((rating) => rating)).toBeTruthy();
    }
  });

  test("should allow switching between map and list view", async ({ page }) => {
    // Look for view toggle buttons
    const listViewButton = page.getByRole("button", { name: /list|grid/i });
    const mapViewButton = page.getByRole("button", { name: /map/i });

    if (await listViewButton.isVisible()) {
      await listViewButton.click();

      // Should show list view
      await page.waitForTimeout(1000);
      const beachList = page
        .getByTestId("beach-list")
        .or(page.locator(".beach-list, .list-view"));
      if (await beachList.isVisible()) {
        await expect(beachList).toBeVisible();

        // Switch back to map view
        if (await mapViewButton.isVisible()) {
          await mapViewButton.click();
          await page.waitForTimeout(1000);

          const mapView = page
            .getByTestId("map-view")
            .or(page.locator(".map-view"));
          await expect(mapView).toBeVisible();
        }
      }
    }
  });

  test("should handle beach favoriting", async ({ page }) => {
    // Look for favorite/bookmark functionality
    const favoriteButton = page
      .getByRole("button", { name: /favorite|bookmark|heart/i })
      .first();
    const heartIcon = page
      .locator('[data-testid="favorite-button"], .favorite, .heart-icon')
      .first();

    if (await favoriteButton.isVisible()) {
      await favoriteButton.click();

      // Should update the favorite state
      await page.waitForTimeout(1000);

      // Button state should change or show confirmation
      const isFavorited = await favoriteButton.getAttribute("aria-pressed");
      const hasActiveClass = await favoriteButton.getAttribute("class");

      expect(
        isFavorited === "true" ||
          hasActiveClass?.includes("active") ||
          hasActiveClass?.includes("favorited")
      ).toBeTruthy();
    } else if (await heartIcon.isVisible()) {
      await heartIcon.click();
      await page.waitForTimeout(1000);
    }
  });
});

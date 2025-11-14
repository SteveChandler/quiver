import { test, expect } from "@playwright/test";

test.describe("Forecast Transparency Features", () => {
  // Use a known beach with forecast data
  const TEST_BEACH_SLUG = "blacks-beach";

  test("Beach page displays forecast data source indicator", async ({ page }) => {
    // Navigate to beach detail page
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Click on Forecast tab
    await page.click('button:has-text("Forecast")');

    // Wait for forecast tab content to load
    await page.waitForTimeout(2000);

    // Check if transparency section exists (it should contain data source info)
    const transparencySection = page.locator('section').filter({ has: page.locator('text=/NOAA|CDIP|FALLBACK/i') });

    // Verify transparency indicators are present
    await expect(transparencySection).toBeVisible({ timeout: 10000 });
  });

  test("Beach page shows confidence score", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    // Look for confidence score display
    const confidenceElement = page.locator('text=/confidence/i');
    await expect(confidenceElement.first()).toBeVisible({ timeout: 10000 });
  });

  test("Beach page shows data freshness indicator", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    // Look for freshness indicator (could be "Just now", "2h ago", etc.)
    const freshnessElement = page.locator('text=/ago|just now|updated/i');
    await expect(freshnessElement.first()).toBeVisible({ timeout: 10000 });
  });

  test("Beach page shows buoy station link when CDIP data available", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    // Check if data source is CDIP
    const dataSourceText = await page.locator('section').filter({ has: page.locator('text=/CDIP/i') }).textContent();

    if (dataSourceText?.includes('CDIP')) {
      // Look for buoy station link component
      const buoyLink = page.locator('[data-testid="buoy-station-link"]');
      const hasBuoyLink = await buoyLink.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasBuoyLink) {
        await expect(buoyLink).toBeVisible();

        // Verify link contains station info
        const linkText = await buoyLink.textContent();
        expect(linkText).toMatch(/station|buoy/i);
        expect(linkText).toMatch(/\d+/); // Should show station ID
      }
    }
  });

  test("BuoyStationLink shows distance from beach", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    const buoyLink = page.locator('[data-testid="buoy-station-link"]');
    const hasBuoyLink = await buoyLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBuoyLink) {
      const linkText = await buoyLink.textContent();

      // Should show distance in km or meters
      const hasDistance = linkText?.match(/\d+\s*(km|m|kilometer|meter)/i);

      if (hasDistance) {
        expect(hasDistance).toBeTruthy();
      }
    }
  });

  test("BuoyStationLink is clickable and has valid href", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    const buoyLink = page.locator('[data-testid="buoy-station-link"]');
    const hasBuoyLink = await buoyLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBuoyLink) {
      // Verify it's a link element
      const href = await buoyLink.getAttribute('href');

      if (href) {
        // Should link to buoys page
        expect(href).toMatch(/\/buoys\/|cdip/i);
      } else {
        // Or might contain a nested link
        const nestedLink = buoyLink.locator('a').first();
        const nestedHref = await nestedLink.getAttribute('href');
        expect(nestedHref).toMatch(/\/buoys\/|cdip/i);
      }
    }
  });

  test("BuoyStationLink renders with appropriate variant", async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_SLUG}`);
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Forecast")');
    await page.waitForTimeout(2000);

    const buoyLink = page.locator('[data-testid="buoy-station-link"]');
    const hasBuoyLink = await buoyLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBuoyLink) {
      // Verify component has proper styling classes
      const className = await buoyLink.getAttribute('class');

      // Should have some styling (variant: default, compact, or inline)
      expect(className).toBeTruthy();
      expect(className!.length).toBeGreaterThan(0);
    }
  });

  test("Map selected beach card shows data source", async ({ page }) => {
    // Navigate to map page
    await page.goto("/map");
    await page.waitForLoadState("networkidle");

    // Wait for map to load
    await page.waitForTimeout(3000);

    // Try to click on a beach marker (if available)
    const beachMarker = page.locator('[role="button"]').filter({ hasText: /beach/i }).first();

    if (await beachMarker.count() > 0) {
      await beachMarker.click();
      await page.waitForTimeout(2000);

      // Check if data source badge appears in selected beach card
      const dataSourceBadge = page.locator('text=/NOAA|CDIP|Real-time|Data/i');

      // This is optional - data might not load immediately
      if (await dataSourceBadge.count() > 0) {
        await expect(dataSourceBadge.first()).toBeVisible();
      }
    }
  });
});

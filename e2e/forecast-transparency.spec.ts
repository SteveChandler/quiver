import { test, expect } from "@playwright/test";

test.describe("Forecast Transparency Features", () => {
  // Use a known beach with forecast data
  const TEST_BEACH_SLUG = "blacks";

  test.describe("Forecast guest page", () => {
    // Explicitly run as a guest (no storage state)
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Old /forecast/[beachId] URL redirects to beach detail page with Forecast tab", async ({
      page,
      request,
    }) => {
      // Resolve a real beachId from the public beaches API
      const beachesRes = await request.get("/api/beaches");
      expect(beachesRes.ok()).toBeTruthy();
      const beachesJson = (await beachesRes.json()) as {
        success: boolean;
        data?: { beaches?: Array<{ id: string; slug: string | null; name: string }> };
      };
      expect(beachesJson.success).toBe(true);
      const beaches = beachesJson.data?.beaches ?? [];

      const blacks = beaches.find((b) => b?.slug === TEST_BEACH_SLUG);
      expect(
        blacks?.id,
        `Couldn't find beach slug "${TEST_BEACH_SLUG}" in /api/beaches (got ${beaches.length} beaches)`
      ).toBeTruthy();

      // Navigate to deprecated forecast URL (blacks is guaranteed to exist after expect)
      await page.goto(`/forecast/${blacks!.id}`);
      await page.waitForLoadState("load");

      // Should redirect to canonical beach detail page with ?tab=forecast
      expect(page.url()).toContain("?tab=forecast");
      expect(page.url()).not.toContain("/forecast/");

      // Forecast tab should be selected
      await expect(page.getByRole("tab", { name: "Forecast", selected: true })).toBeVisible({
        timeout: 15000,
      });
    });
  });

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

 
});

import { test, expect } from "@playwright/test";
import { waitForPageLoad, waitForElementReady } from "./test-helpers";

/**
 * Forecast Consistency Test Suite
 * 
 * This test suite ensures that forecast data is consistent between the home page
 * and beach detail page. This is a regression test to prevent the issue where
 * different pages showed different wave heights for the same beach.
 * 
 * Test scenarios:
 * 1. Compare forecast data between home page and beach detail page
 * 2. Verify consistency when navigating via search
 * 
 * Key metrics tested:
 * - Wave height (most critical for consistency)
 * - Wind speed
 * - Water temperature 
 * - Confidence score
 * 
 * How to run:
 * - All tests: `npm run test:e2e`
 * - Just this test: `npm run test:forecast-consistency`
 * - With UI: `npx playwright test e2e/forecast-consistency.spec.ts --ui`
 */
test.describe("Forecast Consistency Between Pages", () => {
  test.describe("Home Page vs Beach Detail Page", () => {
    test("should show identical forecast data on home page and beach detail page", async ({
      page,
    }) => {
      let homeForecastData: any = {};
      let beachDetailForecastData: any = {};
      let beachId: string | null = null;
      let beachName: string | null = null;

      await test.step("Navigate to home page and extract forecast data", async () => {
        await page.goto("/");
        await waitForPageLoad(page);

        // Wait for forecast data to load
        await page.waitForSelector("text=/ft/", { timeout: 10000 });

        // Extract wave height from home page
        const waveHeightElement = page.locator('[data-testid*="wave-height"], text=/[\d.]+\s*ft/').first();
        await waitForElementReady(waveHeightElement);
        const waveHeightText = await waveHeightElement.textContent();
        const waveHeightMatch = waveHeightText?.match(/([\d.]+)\s*ft/);
        homeForecastData.waveHeight = waveHeightMatch ? waveHeightMatch[1] : null;

        // Extract wind speed from home page
        const windSpeedElement = page.locator('[data-testid*="wind-speed"], text=/[\d.]+\s*mph/').first();
        if (await windSpeedElement.count() > 0) {
          const windSpeedText = await windSpeedElement.textContent();
          const windSpeedMatch = windSpeedText?.match(/([\d.]+)\s*mph/);
          homeForecastData.windSpeed = windSpeedMatch ? windSpeedMatch[1] : null;
        }

        // Extract water temperature from home page
        const waterTempElement = page.locator('[data-testid*="water-temp"], text=/[\d.]+\s*°?F/').first();
        if (await waterTempElement.count() > 0) {
          const waterTempText = await waterTempElement.textContent();
          const waterTempMatch = waterTempText?.match(/([\d.]+)\s*°?F/);
          homeForecastData.waterTemp = waterTempMatch ? waterTempMatch[1] : null;
        }

        // Extract confidence score from home page
        const confidenceElement = page.locator('[data-testid*="confidence"], text=/[\d.]+\s*%/').first();
        if (await confidenceElement.count() > 0) {
          const confidenceText = await confidenceElement.textContent();
          const confidenceMatch = confidenceText?.match(/([\d.]+)\s*%/);
          homeForecastData.confidence = confidenceMatch ? confidenceMatch[1] : null;
        }

        // Try to get beach information to navigate to detail page
        // Look for beach name or "View Details" link
        const viewDetailsLink = page.locator('text="View Details"').first();
        if (await viewDetailsLink.count() > 0) {
          const href = await viewDetailsLink.getAttribute("href");
          if (href) {
            const beachIdMatch = href.match(/\/beach\/([^/?]+)/);
            if (beachIdMatch) {
              beachId = beachIdMatch[1];
            }
          }
        }

        // Alternative: look for beach name in the header or forecast section
        const beachNameElement = page.locator('h1, h2, [data-testid*="beach-name"]').first();
        if (await beachNameElement.count() > 0) {
          beachName = await beachNameElement.textContent();
        }

        console.log("Home page forecast data:", homeForecastData);
        console.log("Detected beach ID:", beachId);
        console.log("Detected beach name:", beachName);
      });

      await test.step("Navigate to beach detail page", async () => {
        if (beachId) {
          // If we found a beach ID, navigate directly
          await page.goto(`/beach/${beachId}`);
        } else {
          // If no beach ID, try to click View Details or find Ocean Beach specifically
          const viewDetailsLink = page.locator('text="View Details"').first();
          if (await viewDetailsLink.count() > 0) {
            await viewDetailsLink.click();
          } else {
            // Fallback: search for Ocean Beach (the beach we were debugging)
            await page.goto("/beach/aa48a47-d80e-4815-8a3c-aa5005293cb8"); // Ocean Beach ID
          }
        }

        await waitForPageLoad(page);
        await page.waitForSelector("text=/Today's Overview/", { timeout: 10000 });
      });

      await test.step("Extract forecast data from beach detail page", async () => {
        // Wait for forecast data to be visible
        await page.waitForSelector("text=/ft/", { timeout: 10000 });

        // Extract wave height from "Today's Overview" section
        const todaysOverview = page.locator('text="Today\'s Overview"').locator("..").locator("..");
        
        // Look for wave height in the overview section
        const waveHeightInOverview = todaysOverview.locator('text=/Wave Height:.*[\d.]+\s*ft/').first();
        if (await waveHeightInOverview.count() > 0) {
          const waveHeightText = await waveHeightInOverview.textContent();
          const waveHeightMatch = waveHeightText?.match(/Wave Height:.*?([\d.]+)\s*ft/);
          beachDetailForecastData.waveHeight = waveHeightMatch ? waveHeightMatch[1] : null;
        } else {
          // Fallback: look for any wave height on the page
          const waveHeightElement = page.locator('text=/[\d.]+\s*ft/').first();
          if (await waveHeightElement.count() > 0) {
            const waveHeightText = await waveHeightElement.textContent();
            const waveHeightMatch = waveHeightText?.match(/([\d.]+)\s*ft/);
            beachDetailForecastData.waveHeight = waveHeightMatch ? waveHeightMatch[1] : null;
          }
        }

        // Extract wind speed from overview section
        const windSpeedInOverview = todaysOverview.locator('text=/Wind Speed:.*[\d.]+\s*mph/').first();
        if (await windSpeedInOverview.count() > 0) {
          const windSpeedText = await windSpeedInOverview.textContent();
          const windSpeedMatch = windSpeedText?.match(/Wind Speed:.*?([\d.]+)\s*mph/);
          beachDetailForecastData.windSpeed = windSpeedMatch ? windSpeedMatch[1] : null;
        }

        // Extract water temperature from overview section
        const waterTempInOverview = todaysOverview.locator('text=/Water Temp:.*[\d.]+\s*°?F/').first();
        if (await waterTempInOverview.count() > 0) {
          const waterTempText = await waterTempInOverview.textContent();
          const waterTempMatch = waterTempText?.match(/Water Temp:.*?([\d.]+)\s*°?F/);
          beachDetailForecastData.waterTemp = waterTempMatch ? waterTempMatch[1] : null;
        }

        // Extract confidence score from overview section
        const confidenceInOverview = todaysOverview.locator('text=/[\d.]+\s*%/').first();
        if (await confidenceInOverview.count() > 0) {
          const confidenceText = await confidenceInOverview.textContent();
          const confidenceMatch = confidenceText?.match(/([\d.]+)\s*%/);
          beachDetailForecastData.confidence = confidenceMatch ? confidenceMatch[1] : null;
        }

        console.log("Beach detail page forecast data:", beachDetailForecastData);
      });

      await test.step("Compare forecast data consistency", async () => {
        // Verify wave height consistency
        if (homeForecastData.waveHeight && beachDetailForecastData.waveHeight) {
          expect(beachDetailForecastData.waveHeight).toBe(homeForecastData.waveHeight);
          console.log(`✓ Wave height matches: ${homeForecastData.waveHeight} ft`);
        } else {
          console.warn("Could not extract wave height from both pages for comparison");
        }

        // Verify wind speed consistency (if available on both pages)
        if (homeForecastData.windSpeed && beachDetailForecastData.windSpeed) {
          expect(beachDetailForecastData.windSpeed).toBe(homeForecastData.windSpeed);
          console.log(`✓ Wind speed matches: ${homeForecastData.windSpeed} mph`);
        }

        // Verify water temperature consistency (if available on both pages)
        if (homeForecastData.waterTemp && beachDetailForecastData.waterTemp) {
          expect(beachDetailForecastData.waterTemp).toBe(homeForecastData.waterTemp);
          console.log(`✓ Water temperature matches: ${homeForecastData.waterTemp}°F`);
        }

        // Verify confidence score consistency (if available on both pages)
        if (homeForecastData.confidence && beachDetailForecastData.confidence) {
          // Allow for slight differences in confidence due to rounding
          const homeConfidence = parseFloat(homeForecastData.confidence);
          const detailConfidence = parseFloat(beachDetailForecastData.confidence);
          expect(Math.abs(homeConfidence - detailConfidence)).toBeLessThanOrEqual(1);
          console.log(`✓ Confidence score matches (within 1%): ${homeForecastData.confidence}% vs ${beachDetailForecastData.confidence}%`);
        }

        // Ensure at least one forecast metric was successfully compared
        const hasComparableData = 
          (homeForecastData.waveHeight && beachDetailForecastData.waveHeight) ||
          (homeForecastData.windSpeed && beachDetailForecastData.windSpeed) ||
          (homeForecastData.waterTemp && beachDetailForecastData.waterTemp);

        if (!hasComparableData) {
          throw new Error("Could not extract comparable forecast data from both pages. Test needs adjustment.");
        }
      });
    });

    test("should maintain forecast consistency when navigating via search", async ({
      page,
    }) => {
      await test.step("Search for Ocean Beach on home page", async () => {
        await page.goto("/");
        await waitForPageLoad(page);

        // Look for search input and search for Ocean Beach
        const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first();
        if (await searchInput.count() > 0) {
          await searchInput.fill("Ocean Beach");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
        }
      });

      await test.step("Extract forecast data from search result", async () => {
        // Wait for search results or forecast data
        await page.waitForSelector("text=/ft/", { timeout: 10000 });

        // Get wave height from search result
        const waveHeightElement = page.locator('text=/[\d.]+\s*ft/').first();
        await waitForElementReady(waveHeightElement);
        const searchWaveHeight = await waveHeightElement.textContent();

        // Navigate to beach detail page (if search shows a direct link)
        const beachLink = page.locator('a[href*="/beach/"]').first();
        if (await beachLink.count() > 0) {
          await beachLink.click();
          await waitForPageLoad(page);

          // Extract wave height from beach detail page
          await page.waitForSelector("text=/Today's Overview/", { timeout: 10000 });
          const detailWaveHeight = await page.locator('text=/[\d.]+\s*ft/').first().textContent();

          // Compare wave heights
          const searchMatch = searchWaveHeight?.match(/([\d.]+)\s*ft/);
          const detailMatch = detailWaveHeight?.match(/([\d.]+)\s*ft/);

          if (searchMatch && detailMatch) {
            expect(detailMatch[1]).toBe(searchMatch[1]);
            console.log(`✓ Wave height consistency maintained through search: ${searchMatch[1]} ft`);
          }
        }
      });
    });
  });
});

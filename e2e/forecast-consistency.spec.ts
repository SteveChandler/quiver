import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  waitForElementReady,
  ensureAuthenticated,
  waitForPageLoadAndDismissModal,
} from "./test-helpers";

/**
 * Forecast Consistency Test Suite
 *
 * Ensures that forecast data is consistent between the home page and beach detail page.
 */
test.describe("Forecast Consistency Between Pages", () => {
  test.beforeEach(async ({ page }) => {
    const authed = await ensureAuthenticated(page, 15000);
    if (!authed) {
      throw new Error("Auth required for forecast consistency tests on Home page");
    }
    await page.goto("/");
    await waitForPageLoadAndDismissModal(page);
    await expect(page).not.toHaveURL(/\/auth(\/?|$)/);
    await expect(page.locator("body")).toBeVisible();
  });

  test.describe("Home Page vs Beach Detail Page", () => {
    test("should show identical forecast data on home page and beach detail page", async ({ page }) => {
      let homeForecastData: any = {};
      let beachDetailForecastData: any = {};
      let beachId: string | null = null;
      let beachName: string | null = null;

      await test.step("Navigate to home page and extract forecast data", async () => {
        await page.goto("/");
        await waitForPageLoad(page);

        // Wait for forecast data to load (either numeric ft or known test id)
        await Promise.race([
          page
            .locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*ft\\b/i')
            .first()
            .waitFor({ state: "visible", timeout: 10000 }),
          page
            .locator('[data-testid*="wave-height"]').first()
            .waitFor({ state: "visible", timeout: 10000 }),
        ]).catch(() => {});

        // Extract wave height from home page
        const waveHeightElement = page
          .locator('[data-testid*="wave-height"]').first()
          .or(page.locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*ft\\b/i').first());
        await waveHeightElement.waitFor({ state: "visible", timeout: 10000 });
        const waveHeightText = await waveHeightElement.first().textContent();
        const waveHeightMatch = waveHeightText?.match(/([\\d.]+)\\s*ft/);
        homeForecastData.waveHeight = waveHeightMatch ? waveHeightMatch[1] : null;

        // Extract wind speed from home page
        const windSpeedElement = page
          .locator('[data-testid*="wind-speed"]').first()
          .or(page.locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*(mph|kts)\\b/i').first());
        if ((await windSpeedElement.count()) > 0) {
          const windSpeedText = await windSpeedElement.first().textContent();
          const windSpeedMatch = windSpeedText?.match(/([\\d.]+)\\s*(mph|kts)/i);
          homeForecastData.windSpeed = windSpeedMatch ? windSpeedMatch[1] : null;
        }

        // Extract water temperature from home page
        const waterTempElement = page
          .locator('[data-testid*="water-temp"]').first()
          .or(page.locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*°?F\\b/i').first());
        if ((await waterTempElement.count()) > 0) {
          const waterTempText = await waterTempElement.first().textContent();
          const waterTempMatch = waterTempText?.match(/([\\d.]+)\\s*°?F/i);
          homeForecastData.waterTemp = waterTempMatch ? waterTempMatch[1] : null;
        }

        // Extract confidence score from home page
        const confidenceElement = page
          .locator('[data-testid*="confidence"]').first()
          .or(page.locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*%\\b/i').first());
        if ((await confidenceElement.count()) > 0) {
          const confidenceText = await confidenceElement.first().textContent();
          const confidenceMatch = confidenceText?.match(/([\\d.]+)\\s*%/i);
          homeForecastData.confidence = confidenceMatch ? confidenceMatch[1] : null;
        }

        // Try to get beach information to navigate to detail page
        const viewDetailsLink = page.locator('text="View Details"').first();
        if ((await viewDetailsLink.count()) > 0) {
          const href = await viewDetailsLink.getAttribute("href");
          if (href) {
            const beachIdMatch = href.match(/\/beach\/([^/?]+)/);
            if (beachIdMatch) {
              beachId = beachIdMatch[1];
            }
          }
        }

        // Alternative: look for beach name in the header or forecast section
        const beachNameElement = page
          .locator('h1, h2, [data-testid*="beach-name"]').first();
        if ((await beachNameElement.count()) > 0) {
          beachName = await beachNameElement.textContent();
        }

        console.log("Home page forecast data:", homeForecastData);
        console.log("Detected beach ID:", beachId);
        console.log("Detected beach name:", beachName);
      });

      await test.step("Navigate to beach detail page", async () => {
        if (beachId) {
          await page.goto(`/beach/${beachId}`);
        } else {
          const viewDetailsLink = page.locator('text="View Details"').first();
          if ((await viewDetailsLink.count()) > 0) {
            await viewDetailsLink.click();
          } else {
            // Fallback: query API for a valid beach id
            try {
              const resp = await page.request.get('/api/beaches');
              if (resp.ok()) {
                const list = await resp.json();
                const id = Array.isArray(list) && list[0]?.id;
                if (id) {
                  await page.goto(`/beach/${id}`);
                } else {
                  throw new Error('No beaches returned from /api/beaches');
                }
              } else {
                throw new Error(`Failed to fetch beaches: ${resp.status()}`);
              }
            } catch (e) {
              // As a last resort, try clicking any beach link on the page
              const anyBeachLink = page.locator('a[href*="/beach/"]').first();
              if ((await anyBeachLink.count()) > 0) {
                await anyBeachLink.click();
              } else {
                // Try search-based navigation
                const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
                if ((await searchInput.count()) > 0) {
                  await searchInput.fill('Ocean');
                  await page.keyboard.press('Enter');
                  await page.waitForTimeout(1500);
                  const resultLink = page.locator('a[href*="/beach/"]').first();
                  if ((await resultLink.count()) > 0) {
                    await resultLink.click();
                  } else {
                    throw new Error('Unable to navigate to a beach detail page');
                  }
                } else {
                  throw new Error('Unable to navigate to a beach detail page');
                }
              }
            }
          }
        }
        await waitForPageLoad(page);
        // Wait for forecast content instead of brittle heading
        await Promise.race([
          page.locator('[data-testid*="wave-height"]').first().waitFor({ state: 'visible', timeout: 10000 }),
          page.locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*ft\\b/i').first().waitFor({ state: 'visible', timeout: 10000 })
        ]);
      });

      await test.step("Extract forecast data from beach detail page", async () => {
        // Wait for forecast data to be visible
        await Promise.race([
          page
            .locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*ft\\b/i')
            .first()
            .waitFor({ state: "visible", timeout: 10000 }),
          page
            .locator('[data-testid*="wave-height"]').first()
            .waitFor({ state: "visible", timeout: 10000 }),
        ]).catch(() => {});

        // Extract wave height from "Today's Overview" section
        const todaysOverview = page
          .locator('text="Today\'s Overview"')
          .locator("..")
          .locator("..");

        const waveHeightInOverview = todaysOverview
          .locator('text=/Wave Height:.*[\\d.]+\\s*ft/')
          .first();
        if ((await waveHeightInOverview.count()) > 0) {
          const waveHeightText = await waveHeightInOverview.textContent();
          const waveHeightMatch = waveHeightText?.match(
            /Wave Height:.*?([\\d.]+)\\s*ft/
          );
          beachDetailForecastData.waveHeight = waveHeightMatch
            ? waveHeightMatch[1]
            : null;
        } else {
          const waveHeightAny = page.locator('text=/[\\d.]+\\s*ft/').first();
          if ((await waveHeightAny.count()) > 0) {
            const waveHeightText = await waveHeightAny.textContent();
            const waveHeightMatch = waveHeightText?.match(/([\\d.]+)\\s*ft/);
            beachDetailForecastData.waveHeight = waveHeightMatch
              ? waveHeightMatch[1]
              : null;
          }
        }

        // Extract wind speed from overview section
        const windSpeedInOverview = todaysOverview
          .locator('text=/Wind Speed:.*[\\d.]+\\s*(mph|kts)/i')
          .first();
        if ((await windSpeedInOverview.count()) > 0) {
          const windSpeedText = await windSpeedInOverview.textContent();
          const windSpeedMatch = windSpeedText?.match(
            /Wind Speed:.*?([\\d.]+)\\s*(mph|kts)/i
          );
          beachDetailForecastData.windSpeed = windSpeedMatch
            ? windSpeedMatch[1]
            : null;
        }

        // Extract water temperature from overview section
        const waterTempInOverview = todaysOverview
          .locator('text=/Water Temp:.*[\\d.]+\\s*°?F/i')
          .first();
        if ((await waterTempInOverview.count()) > 0) {
          const waterTempText = await waterTempInOverview.textContent();
          const waterTempMatch = waterTempText?.match(
            /Water Temp:.*?([\\d.]+)\\s*°?F/i
          );
          beachDetailForecastData.waterTemp = waterTempMatch
            ? waterTempMatch[1]
            : null;
        }

        // Extract confidence score from overview section
        const confidenceInOverview = todaysOverview
          .locator('text=/[\\d.]+\\s*%/')
          .first();
        if ((await confidenceInOverview.count()) > 0) {
          const confidenceText = await confidenceInOverview.textContent();
          const confidenceMatch = confidenceText?.match(/([\\d.]+)\\s*%/);
          beachDetailForecastData.confidence = confidenceMatch
            ? confidenceMatch[1]
            : null;
        }

        console.log("Beach detail page forecast data:", beachDetailForecastData);
      });

      await test.step("Compare forecast data consistency", async () => {
        if (homeForecastData.waveHeight && beachDetailForecastData.waveHeight) {
          expect(beachDetailForecastData.waveHeight).toBe(
            homeForecastData.waveHeight
          );
          console.log(`✓ Wave height matches: ${homeForecastData.waveHeight} ft`);
        } else {
          console.warn(
            "Could not extract wave height from both pages for comparison"
          );
        }

        if (homeForecastData.windSpeed && beachDetailForecastData.windSpeed) {
          expect(beachDetailForecastData.windSpeed).toBe(
            homeForecastData.windSpeed
          );
          console.log(`✓ Wind speed matches: ${homeForecastData.windSpeed}`);
        }

        if (homeForecastData.waterTemp && beachDetailForecastData.waterTemp) {
          expect(beachDetailForecastData.waterTemp).toBe(
            homeForecastData.waterTemp
          );
          console.log(`✓ Water temperature matches: ${homeForecastData.waterTemp}°F`);
        }

        if (homeForecastData.confidence && beachDetailForecastData.confidence) {
          const homeConfidence = parseFloat(homeForecastData.confidence);
          const detailConfidence = parseFloat(beachDetailForecastData.confidence);
          expect(Math.abs(homeConfidence - detailConfidence)).toBeLessThanOrEqual(1);
          console.log(
            `✓ Confidence score matches (within 1%): ${homeForecastData.confidence}% vs ${beachDetailForecastData.confidence}%`
          );
        }

        const hasComparableData =
          (homeForecastData.waveHeight && beachDetailForecastData.waveHeight) ||
          (homeForecastData.windSpeed && beachDetailForecastData.windSpeed) ||
          (homeForecastData.waterTemp && beachDetailForecastData.waterTemp);

        if (!hasComparableData) {
          throw new Error(
            "Could not extract comparable forecast data from both pages. Test needs adjustment."
          );
        }
      });
    });

    test("should maintain forecast consistency when navigating via search", async ({ page }) => {
      await test.step("Search for Ocean Beach on home page", async () => {
        await page.goto("/");
        await waitForPageLoad(page);

        const searchInput = page
          .locator('input[placeholder*="search"], input[type="search"]')
          .first();
        if ((await searchInput.count()) > 0) {
          await searchInput.fill("Ocean Beach");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
        }
      });

      await test.step("Extract forecast data from search result", async () => {
        await Promise.race([
          page
            .locator('text=/\\b(\\d+(?:\\.\\d+)?)\\s*ft\\b/i')
            .first()
            .waitFor({ state: "visible", timeout: 10000 }),
          page
            .locator('[data-testid*="wave-height"]').first()
            .waitFor({ state: "visible", timeout: 10000 }),
        ]).catch(() => {});

        const waveHeightElement = page.locator('text=/[\\d.]+\\s*ft/').first();
        await waitForElementReady(waveHeightElement);
        const searchWaveHeight = await waveHeightElement.textContent();

        const beachLink = page.locator('a[href*="/beach/"]').first();
        if ((await beachLink.count()) > 0) {
          await beachLink.click();
          await waitForPageLoad(page);

          await page.waitForSelector("text=/Today's Overview/", { timeout: 10000 });
          const detailWaveHeight = await page
            .locator('text=/[\\d.]+\\s*ft/')
            .first()
            .textContent();

          const searchMatch = searchWaveHeight?.match(/([\\d.]+)\\s*ft/);
          const detailMatch = detailWaveHeight?.match(/([\\d.]+)\\s*ft/);

          if (searchMatch && detailMatch) {
            expect(detailMatch[1]).toBe(searchMatch[1]);
            console.log(
              `✓ Wave height consistency maintained through search: ${searchMatch[1]} ft`
            );
          }
        }
      });
    });
  });
});


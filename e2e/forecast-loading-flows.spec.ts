import { test, expect } from "@playwright/test";

test.describe("Forecast Loading Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route("**/api/forecasts/update-enhanced**", async (route) => {
      if (route.request().method() === "GET") {
        // Mock forecast preview response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              type: "enhanced",
              wave_height: "4-6 ft",
              wind_speed: "10-15 mph",
              wind_direction: "W",
              weather_condition: "Partly cloudy",
              confidence_score: 85,
            },
          }),
        });
      } else {
        // Mock forecast generation response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Forecasts generated successfully",
            forecastsGenerated: 96,
          }),
        });
      }
    });

    // Mock beaches API
    await page.route("**/api/beaches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "test-beach-1",
              name: "Ocean Beach",
              latitude: 32.7503,
              longitude: -117.2534,
              location: "San Diego, CA",
            },
            {
              id: "test-beach-2",
              name: "Pacific Beach",
              latitude: 32.803,
              longitude: -117.2405,
              location: "San Diego, CA",
            },
          ],
        }),
      });
    });
  });

  test.describe("Beach Card Forecast Previews", () => {
    test("should load forecast preview on beach card when enabled", async ({
      page,
    }) => {
      await page.goto("/map");

      // Wait for beach cards to load
      await expect(
        page.locator('[data-testid="beach-card"]').first()
      ).toBeVisible();

      // Check for forecast preview elements
      await expect(page.locator("text=4-6 ft")).toBeVisible();
      await expect(page.locator("text=10-15 mph")).toBeVisible();
      await expect(page.locator("text=Partly")).toBeVisible();

      // Verify icons are present (check for wave, wind, and thermometer colors)
      await expect(page.locator(".text-blue-600")).toBeVisible(); // Wave icon
      await expect(page.locator(".text-gray-600")).toBeVisible(); // Wind icon
      await expect(page.locator(".text-orange-600")).toBeVisible(); // Weather icon
    });

    test("should show loading state during forecast preview loading", async ({
      page,
    }) => {
      // Delay the forecast response to test loading state
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              type: "enhanced",
              wave_height: "4-6 ft",
              wind_speed: "10-15 mph",
              wind_direction: "W",
              weather_condition: "Partly cloudy",
              confidence_score: 85,
            },
          }),
        });
      });

      await page.goto("/map");

      // Should show loading state
      await expect(page.locator("text=Loading forecast...")).toBeVisible();
      await expect(page.locator(".animate-spin")).toBeVisible();

      // Should eventually show forecast data
      await expect(page.locator("text=4-6 ft")).toBeVisible({ timeout: 5000 });
      await expect(page.locator("text=Loading forecast...")).not.toBeVisible();
    });

    test("should handle forecast preview errors gracefully", async ({
      page,
    }) => {
      // Mock error response
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Server error",
          }),
        });
      });

      await page.goto("/map");

      // Should show error state
      await expect(
        page.locator("text=Failed to load forecast preview")
      ).toBeVisible();
      await expect(page.locator("text=4-6 ft")).not.toBeVisible();
    });
  });

  test.describe("Selected Beach Card Forecast Previews", () => {
    test("should load forecast preview on selected beach card", async ({
      page,
    }) => {
      await page.goto("/map");

      // Wait for beach cards and select one
      await page.locator('[data-testid="beach-card"]').first().click();

      // Check for selected beach card
      await expect(page.locator("text=Selected Beach")).toBeVisible();

      // Check for forecast preview in selected card
      await expect(page.locator("text=4-6 ft")).toBeVisible();
      await expect(page.locator("text=10-15 mph")).toBeVisible();
      await expect(page.locator("text=Partly")).toBeVisible();

      // Should show confidence score in selected beach card
      await expect(page.locator("text=Confidence: 85%")).toBeVisible();
    });

    test("should update forecast when switching between beaches", async ({
      page,
    }) => {
      // Mock different forecasts for different beaches
      let beachCallCount = 0;
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        beachCallCount++;
        const waveHeight = beachCallCount === 1 ? "4-6 ft" : "2-3 ft";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              type: "enhanced",
              wave_height: waveHeight,
              wind_speed: "10-15 mph",
              wind_direction: "W",
              weather_condition: "Partly cloudy",
              confidence_score: 85,
            },
          }),
        });
      });

      await page.goto("/map");

      // Select first beach
      await page.locator('[data-testid="beach-card"]').first().click();
      await expect(page.locator("text=4-6 ft")).toBeVisible();

      // Select second beach
      await page.locator('[data-testid="beach-card"]').nth(1).click();
      await expect(page.locator("text=2-3 ft")).toBeVisible();
    });
  });

  test.describe("Enhanced Forecast System Integration", () => {
    test("should auto-generate forecasts when visiting beach page", async ({
      page,
    }) => {
      // Mock enhanced forecast API responses
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        if (route.request().method() === "GET") {
          // First call - no data exists
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                forecasts: [],
                forecastsByDate: {},
              },
            }),
          });
        } else {
          // POST call - generate forecasts
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Forecasts generated successfully",
              forecastsGenerated: 96,
            }),
          });
        }
      });

      await page.goto("/beach/test-beach-1");

      // Should show auto-generation in progress
      await expect(page.locator("text=Generating Forecasts")).toBeVisible();
      await expect(
        page.locator("text=Creating enhanced forecast data")
      ).toBeVisible();
      await expect(page.locator(".animate-pulse")).toBeVisible();

      // Mock the successful data fetch after generation
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              forecasts: Array.from({ length: 96 }, (_, i) => ({
                id: `forecast-${i}`,
                forecast_date: "2024-01-01",
                forecast_time: "00:00:00",
                wave_height: "4-6 ft",
                wind_speed: "10 mph",
                weather_condition: "Sunny",
              })),
              forecastsByDate: {
                "2024-01-01": [
                  {
                    id: "forecast-1",
                    wave_height: "4-6 ft",
                    wind_speed: "10 mph",
                    weather_condition: "Sunny",
                  },
                ],
              },
            },
          }),
        });
      });

      // Should eventually show forecast data
      await expect(page.locator("text=Enhanced Forecast")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator("text=96 Forecasts")).toBeVisible();
    });

    test("should handle auto-generation failures gracefully", async ({
      page,
    }) => {
      // Mock failed auto-generation
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              success: false,
              error: "Failed to generate forecasts",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                forecasts: [],
                forecastsByDate: {},
              },
            }),
          });
        }
      });

      await page.goto("/beach/test-beach-1");

      // Should show error state with retry option
      await expect(page.locator("text=No Forecast Data")).toBeVisible();
      await expect(page.locator("text=Generate Forecasts")).toBeVisible();
    });
  });

  test.describe("Request Deduplication", () => {
    test("should not make duplicate requests for same beach", async ({
      page,
    }) => {
      let requestCount = 0;
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              type: "enhanced",
              wave_height: "4-6 ft",
              wind_speed: "10-15 mph",
              wind_direction: "W",
              weather_condition: "Partly cloudy",
              confidence_score: 85,
            },
          }),
        });
      });

      await page.goto("/map");

      // Wait for beach cards to load - should make only one request per beach
      await expect(page.locator('[data-testid="beach-card"]')).toHaveCount(2);
      await expect(page.locator("text=4-6 ft").first()).toBeVisible();

      // Should not have made excessive requests
      expect(requestCount).toBeLessThanOrEqual(2); // One per beach maximum
    });
  });

  test.describe("Profile Loading Integration", () => {
    test("should load user profile in header without blocking UI", async ({
      page,
    }) => {
      // Mock auth user
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "supabase.auth.token",
          JSON.stringify({
            access_token: "mock-token",
            user: { id: "user-123", email: "test@example.com" },
          })
        );
      });

      // Mock profile API
      await page.route("**/api/profile**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "user-123",
              full_name: "Test User",
              avatar_url: "/test-avatar.jpg",
            },
          }),
        });
      });

      await page.goto("/");

      // Header should be visible immediately
      await expect(page.locator("header")).toBeVisible();

      // Profile avatar should eventually load
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test("should handle profile loading timeout gracefully", async ({
      page,
    }) => {
      // Mock auth user
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "supabase.auth.token",
          JSON.stringify({
            access_token: "mock-token",
            user: { id: "user-123", email: "test@example.com" },
          })
        );
      });

      // Mock slow/hanging profile API
      await page.route("**/api/profile**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 15000)); // Longer than timeout
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "user-123",
              full_name: "Test User",
            },
          }),
        });
      });

      await page.goto("/");

      // Should still show header and not crash
      await expect(page.locator("header")).toBeVisible();

      // Should show default avatar or sign up button after timeout
      await expect(page.locator("text=Sign Up")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper loading states for screen readers", async ({
      page,
    }) => {
      await page.goto("/map");

      // Check for proper loading text
      await expect(page.locator("text=Loading forecast...")).toBeVisible();

      // Verify loading indicator has proper accessibility
      const loadingSpinner = page.locator(".animate-spin");
      await expect(loadingSpinner).toBeVisible();
    });

    test("should have proper error states for screen readers", async ({
      page,
    }) => {
      // Mock error response
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Network error",
          }),
        });
      });

      await page.goto("/map");

      // Should show accessible error message
      await expect(
        page.locator("text=Failed to load forecast preview")
      ).toBeVisible();
    });
  });

  test.describe("Performance", () => {
    test("should load forecast previews within reasonable time", async ({
      page,
    }) => {
      const startTime = Date.now();

      await page.goto("/map");
      await expect(page.locator("text=4-6 ft")).toBeVisible();

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test("should not block UI during forecast loading", async ({ page }) => {
      // Add delay to forecast loading
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              type: "enhanced",
              wave_height: "4-6 ft",
              wind_speed: "10-15 mph",
              wind_direction: "W",
              weather_condition: "Partly cloudy",
            },
          }),
        });
      });

      await page.goto("/map");

      // UI should be interactive while forecasts load
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator('[data-testid="beach-card"]')).toBeVisible();

      // Should be able to interact with page elements
      await page.locator('[data-testid="beach-card"]').first().click();
      await expect(page.locator("text=Selected Beach")).toBeVisible();
    });
  });
});

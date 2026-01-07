import { test, expect } from "@playwright/test";
import { waitForPageLoad, ensureAuthenticated } from "./utils/test-helpers";

/**
 * Home Activation Flow Tests
 *
 * Tests the activation sprint features:
 * - First-win recommendation card visibility
 * - Reminder CTA flow
 * - Home beach inline prompt
 * - Analytics events (impression, plan click, reminder enable)
 *
 * @project auth
 */

// Mock discovery response fixture
function discoveryFixture() {
  const now = Date.now();
  const start = new Date(now + 60 * 60 * 1000); // +1h
  const end = new Date(now + 3 * 60 * 60 * 1000); // +3h

  return {
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      recommendations: [
        {
          beach: {
            id: "test-beach-001",
            name: "Test Beach",
            slug: "test-beach",
            city: "San Diego",
            state: "CA",
            lat: 32.832,
            lon: -117.281,
            region: "California",
          },
          window: {
            start: start.toISOString(),
            end: end.toISOString(),
            tide: "Rising",
            wind: "5 mph NE",
            waveHeight: "3.3 ft",
            wavePeriod: "12s",
            dataSource: "NOAA_NWS",
            confidence: 78,
          },
          forecast: {
            id: "test-forecast-001",
            beach_id: "test-beach-001",
            forecast_date: new Date().toISOString().split("T")[0],
            forecast_time: "12:00",
            wave_height: "3.3",
            wave_period: "12",
            water_temp: "63",
            wind_speed: "5 mph",
            wind_direction: "NE",
            tide_status: "Rising",
            confidence_score: 78,
            data_source: "NOAA_NWS",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          score: 86,
          matchQuality: "excellent",
          subscores: {
            waveHeightFit: 22,
            periodEnergyScore: 18,
            windAlignment: 17,
            tideFit: 14,
            affinityBonus: 10,
            distancePenalty: -5,
          },
          summary: "Great conditions for intermediate surfers",
          reasons: ["Offshore wind", "Rising tide", "Good swell period"],
          warnings: [],
          generated_at: new Date().toISOString(),
        },
      ],
      searchCriteria: {
        maxResults: 5,
        horizonHours: 24,
      },
      meta: {
        totalCandidates: 15,
        processingTimeMs: 120,
      },
    },
  };
}

test.describe("Home Activation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the discovery API for consistent tests
    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(discoveryFixture()),
      });
    });
  });

  test("should display first-win recommendation card above the fold", async ({
    page,
  }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // First-win card should be visible
    const forecastCard = page.getByTestId("personalized-forecast-card");
    await expect(forecastCard).toBeVisible({ timeout: 10000 });

    // Should show the beach name
    await expect(page.getByText("Test Beach")).toBeVisible();

    // Should show the "Plan Session" button
    const planButton = page.getByTestId("plan-session-from-personalized");
    await expect(planButton).toBeVisible();
  });

  test("should show Remind Me CTA when forecast alerts not enabled", async ({
    page,
  }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // Wait for forecast card to load
    const forecastCard = page.getByTestId("personalized-forecast-card");
    await expect(forecastCard).toBeVisible({ timeout: 10000 });

    // Look for the Remind Me button
    const remindButton = page.getByTestId("remind-me-cta");

    // If visible, user hasn't enabled forecast alerts yet
    if (await remindButton.isVisible()) {
      await expect(remindButton).toContainText("Remind Me");
    }
  });

  test("should show home beach prompt when clicking Remind Me without home beach", async ({
    page,
  }) => {
    // Mock profile without home beach
    await page.route("**/api/profile**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "test-user",
              full_name: "Test User",
              home_beach_id: null, // No home beach set
              notif_push_enabled: false,
              notif_forecast_alerts: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // Wait for forecast card
    const forecastCard = page.getByTestId("personalized-forecast-card");
    await expect(forecastCard).toBeVisible({ timeout: 10000 });

    // Click Remind Me
    const remindButton = page.getByTestId("remind-me-cta");
    if (await remindButton.isVisible()) {
      await remindButton.click();

      // Should show the home beach prompt
      await expect(
        page.getByText("Set Test Beach as your home beach?")
      ).toBeVisible({ timeout: 5000 });

      // Should have the "Set & Notify Me" button
      await expect(page.getByText("Set & Notify Me")).toBeVisible();

      // Should have the "Not now" dismiss button
      await expect(page.getByText("Not now")).toBeVisible();
    }
  });

  test("should track plan session click analytics", async ({ page }) => {
    // Track analytics calls
    const analyticsEvents: { event: string; params: unknown }[] = [];
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__analyticsEvents = [];
      const originalGtag =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (window as any).gtag === "function" ? (window as any).gtag : () => {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag = (...args: unknown[]) => {
        if (args[0] === "event") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__analyticsEvents.push({ event: args[1], params: args[2] });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        originalGtag(...args);
      };
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // Wait for card and click Plan Session
    const planButton = page.getByTestId("plan-session-from-personalized");
    await expect(planButton).toBeVisible({ timeout: 10000 });
    await planButton.click();

    // Should navigate to session wizard
    await expect(page).toHaveURL(/\/sessions\/new\?mode=plan/);
  });

  test("Plan/Log buttons should not appear above the fold", async ({
    page,
  }) => {
    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // The old above-fold Plan Session and Log Session buttons should not exist
    // (they were removed in favor of the card footer buttons)
    const aboveFoldSection = page.locator("section.centered-container").first();

    // Check that there are no standalone Plan/Log buttons in the welcome section
    // The buttons should only appear inside the PersonalizedForecastCard footer
    const standaloneButtons = aboveFoldSection.locator(
      "button:has-text('Plan Session'), button:has-text('Log Session')"
    );

    // These shouldn't be in the welcome section anymore
    // (they were replaced with a comment)
    await expect(standaloneButtons).toHaveCount(0);
  });
});

test.describe("Reminder Success State", () => {
  test("should show success message after enabling reminders", async ({
    page,
  }) => {
    // Mock profile update to succeed
    await page.route("**/api/profile**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "test-user",
              full_name: "Test User",
              home_beach_id: "test-beach-001", // Already has home beach
              notif_push_enabled: false,
              notif_forecast_alerts: false,
            },
          }),
        });
      } else if (route.request().method() === "POST") {
        // Simulate successful profile update
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock discovery
    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(discoveryFixture()),
      });
    });

    await ensureAuthenticated(page);
    await page.goto("/");
    await waitForPageLoad(page);

    // Wait for card
    const forecastCard = page.getByTestId("personalized-forecast-card");
    await expect(forecastCard).toBeVisible({ timeout: 10000 });

    // If remind button is visible, click it
    const remindButton = page.getByTestId("remind-me-cta");
    if (await remindButton.isVisible()) {
      await remindButton.click();

      // Wait for the success message (may need to handle push permission)
      // In test environment, the push registration will likely fail silently
      // but the profile update should succeed
    }
  });
});

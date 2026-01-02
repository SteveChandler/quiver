import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  ensureAuthenticated,
} from './utils/test-helpers';

/**
 * Personalized Home Forecast Tests
 *
 * Tests the personalized forecast recommendation card on the home page
 * with deterministic API stubs for reliability and deeper component coverage.
 *
 * @project auth
 */

function removeSurfDiscoveryCacheInitScript() {
  // Runs in the browser context before any app code executes
  try {
    const prefix = "quiver_discovery_";
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

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
            id: "11111111-1111-4111-8111-111111111111",
            name: "Marine Street Beach",
            slug: "marine-street-beach",
            city: "La Jolla",
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
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            beach_id: "11111111-1111-4111-8111-111111111111",
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
            waveHeightFit: 20,
            periodEnergyScore: 16,
            windAlignment: 14,
            tideFit: 10,
            affinityBonus: 6,
            distancePenalty: 0,
          },
          summary: "Great window with clean wind and rising tide.",
          reasons: ["Rising tide", "Clean winds", "Solid period"],
          warnings: [],
          generated_at: new Date().toISOString(),
        },
        {
          beach: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Windansea Beach",
            slug: "windansea-beach",
            city: "La Jolla",
            state: "CA",
            lat: 32.831,
            lon: -117.281,
            region: "California",
          },
          window: {
            start: start.toISOString(),
            end: end.toISOString(),
            tide: "High Slack",
            wind: "7 mph E",
            waveHeight: "3.0 ft",
            wavePeriod: "11s",
            dataSource: "NOAA_NWS",
            confidence: 70,
          },
          forecast: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            beach_id: "22222222-2222-4222-8222-222222222222",
            forecast_date: new Date().toISOString().split("T")[0],
            forecast_time: "12:00",
            wave_height: "3.0",
            wave_period: "11",
            water_temp: "63",
            wind_speed: "7 mph",
            wind_direction: "E",
            tide_status: "High Slack",
            confidence_score: 70,
            data_source: "NOAA_NWS",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          score: 74,
          matchQuality: "good",
          subscores: {
            waveHeightFit: 18,
            periodEnergyScore: 14,
            windAlignment: 12,
            tideFit: 9,
            affinityBonus: 0,
            distancePenalty: 0,
          },
          summary: "Another solid option with mellow winds.",
          reasons: ["Good tide", "Low wind"],
          warnings: [],
          generated_at: new Date().toISOString(),
        },
      ],
      searchCriteria: {
        maxResults: 6,
      },
      metadata: {
        totalBeachesConsidered: 50,
        successfulForecasts: 50,
        partialSuccess: false,
        failedBeaches: 0,
        staleBeaches: 0,
        generated_at: new Date().toISOString(),
      },
    },
  };
}

function insightsFixture() {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      matchPercent: 72,
      label: "Great",
      reasonBullets: ["Matches your preferred wave height", "Light offshore wind"],
      similarSessions: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          beachName: "Ocean Beach",
          beachId: "33333333-3333-4333-8333-333333333333",
          sessionDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          rating: 4,
          waveHeight: 3.5,
          wavePeriod: 12,
          windSpeed: 6,
          boardName: "Fish",
          boardType: "fish",
          similarityScore: 81,
        },
      ],
      boardTip: "Your Fish has been your best board in similar sessions.",
      sessionCount: 10,
      state: "ready",
    },
  };
}

function enhancedForecastFixture(beachId: string) {
  const today = new Date().toISOString().split("T")[0];
  const nowIso = new Date().toISOString();
  return {
    success: true,
    timestamp: nowIso,
    data: {
      forecasts: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          beach_id: beachId,
          forecast_date: today,
          forecast_time: "12:00",
          wave_height: "3.0",
          wave_period: "12",
          water_temp: "63",
          wind_speed: "6 mph",
          wind_direction: "NE",
          tide_status: "Rising",
          tide_height: "2.1",
          confidence_score: 75,
          data_source: "NOAA_NWS",
          weather_condition: "Clear",
          created_at: nowIso,
          updated_at: nowIso,
        },
      ],
    },
  };
}

test.describe('Personalized Home Forecast', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(removeSurfDiscoveryCacheInitScript);

    await page.route("**/api/surf/discover**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(discoveryFixture()),
      });
    });

    await page.route("**/api/surf/insights**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(insightsFixture()),
      });
    });

    await page.route("**/api/forecasts/update-enhanced**", async (route) => {
      const url = new URL(route.request().url());
      const beachId = url.searchParams.get("beachId") || "unknown";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(enhancedForecastFixture(beachId)),
      });
    });

    // Ensure user is authenticated
    await ensureAuthenticated(page);

    // Navigate to home page
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test("renders PersonalizedForecastCard with insights and key subcomponents", async ({
    page,
  }) => {
    const card = page.getByTestId("personalized-forecast-card");
    await expect(card).toBeVisible({ timeout: 30_000 });

    // Core heading and beach name should render deterministically.
    await expect(card).toContainText("Your Best Spot Today");
    await expect(card).toContainText("Marine Street Beach");

    // Best window section renders with the expected tiles/labels.
    const bestWindow = page.getByTestId("best-window");
    await expect(bestWindow).toBeVisible({ timeout: 30_000 });
    await expect(bestWindow).toContainText("Best Window");
    await expect(bestWindow).toContainText("Time");
    await expect(bestWindow).toContainText("Tide");
    await expect(bestWindow).toContainText("Wind");
    await expect(bestWindow).toContainText("Confidence");

    // Insights KPI tile shows label + percent.
    const forYouTile = page.getByTestId("personalized-forecast-for-you-tile");
    await expect(forYouTile).toBeVisible({ timeout: 30_000 });
    await expect(forYouTile).toContainText("For You");
    await expect(forYouTile).toContainText("72% Match");

    // Share button is present (smoke for clickability).
    const shareButton = page.getByTestId("personalized-forecast-share");
    await expect(shareButton).toBeVisible({ timeout: 30_000 });
    await expect(shareButton).toBeEnabled();

    // Similar sessions CTA present in summary section.
    const viewSimilar = page.getByTestId("personalized-forecast-view-similar-sessions");
    await expect(viewSimilar).toBeVisible({ timeout: 30_000 });
  });

  test("opens SimilarSessionsDrawer from For You tile and summary CTA", async ({
    page,
  }) => {
    const forYouTile = page.getByTestId("personalized-forecast-for-you-tile");
    await expect(forYouTile).toBeVisible({ timeout: 30_000 });

    // 1) Open via KPI tile.
    // The tile is only clickable once insights are loaded and similar sessions exist.
    await expect(forYouTile).toHaveAttribute("role", "button", { timeout: 15_000 });
    await forYouTile.click();
    const drawerTitle = page.getByRole("heading", { name: /similar past sessions/i });
    await expect(drawerTitle).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/current forecast/i)).toBeVisible();
    await expect(page.getByText(/\(4\/5\)/)).toBeVisible();
    await expect(page.getByText(/81% match/i)).toBeVisible();
    await expect(page.getByText("Fish", { exact: true })).toBeVisible();

    // Close.
    await page.getByRole("button", { name: /^close$/i }).first().click();
    await expect(drawerTitle).not.toBeVisible({ timeout: 10_000 });

    // 2) Open via summary CTA.
    const viewSimilar = page.getByTestId("personalized-forecast-view-similar-sessions");
    await expect(viewSimilar).toBeVisible({ timeout: 10_000 });
    await viewSimilar.click();
    await expect(drawerTitle).toBeVisible({ timeout: 10_000 });
  });

  test('Plan Session CTA navigates with prefilled params', async ({ page }) => {
    const plan = page.getByTestId("plan-session-from-personalized");
    await expect(plan).toBeVisible({ timeout: 30_000 });
    await plan.click();

    // Includes prefilled params from the recommendation.
    await page.waitForURL(/\/sessions\/new\?/, { timeout: 20_000 });
    await expect(page).toHaveURL(/mode=plan/);
    await expect(page).toHaveURL(/beach=11111111-1111-4111-8111-111111111111/);
    await expect(page).toHaveURL(/beachName=Marine\+Street\+Beach/);
    await expect(page).toHaveURL(/step=3/);
  });

  test('View Forecast CTA navigates to beach page with tracking param', async ({
    page,
  }) => {
    const viewForecast = page.getByRole("button", { name: /view forecast/i });
    await expect(viewForecast).toBeVisible({ timeout: 30_000 });
    await viewForecast.click();

    await expect(page).toHaveURL(/from=home_personalized/, { timeout: 20_000 });
    await expect(page).toHaveURL(
      /marine-street-beach|11111111-1111-4111-8111-111111111111/,
      { timeout: 20_000 }
    );
  });
});

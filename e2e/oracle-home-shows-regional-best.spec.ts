import { test, expect } from "./fixtures/auth-fixture";
import type { Page } from "@playwright/test";
import {
  waitForPageLoad,
  ensureAuthenticated,
} from './utils/test-helpers';
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from './utils/error-detection';
import {
  createCanonicalSessionDecisionFixture,
} from "./fixtures/major-event-recommendation-hold";

/**
 * Regional-best hero on the Oracle home screen — integration smoke test.
 *
 * The detailed semantics (home != topRec → drive subtitle + HomeBeachCard;
 * home === topRec → both hidden; activity feed follows hero) are pinned
 * in the unit tests at `__tests__/components/oracle/oracle-home-screen.test.tsx`
 * under "regional-best hero (...)". Those unit tests render the full
 * OracleHomeScreen tree against deterministic mocks of useOracleData,
 * which is the only reliable way to control `homeBeach` in tests
 * without round-tripping the auth user's actual DB row.
 *
 * This e2e is the complementary integration smoke: it verifies the
 * authenticated home loads without errors when we fulfill the discovery
 * API with a real-shaped fixture, and that the OracleHero (banner role)
 * paints. Failing here means the Oracle home is broken end-to-end —
 * something the unit tests cannot catch.
 *
 * @project auth
 */

const TOP_REC_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const HOME_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const TOP_REC_CANDIDATE_ID = "recommendation:oracle-e2e-top";
const LA_JOLLA = { latitude: 32.8473, longitude: -117.275 };

type OracleGeolocationWindow = Window & {
  __quiverGeolocationRequestCount?: number;
};

function installGeolocationRequestCounter(): void {
  const oracleWindow = window as OracleGeolocationWindow;
  const geolocation = navigator.geolocation;
  const getCurrentPosition = geolocation.getCurrentPosition.bind(geolocation);

  oracleWindow.__quiverGeolocationRequestCount = 0;
  Object.defineProperty(geolocation, "getCurrentPosition", {
    configurable: true,
    value: (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ): void => {
      oracleWindow.__quiverGeolocationRequestCount =
        (oracleWindow.__quiverGeolocationRequestCount ?? 0) + 1;
      getCurrentPosition(success, error, options);
    },
  });
}

async function readGeolocationRequestCount(
  page: Page,
): Promise<number> {
  return page.evaluate(() => {
    const oracleWindow = window as OracleGeolocationWindow;
    return oracleWindow.__quiverGeolocationRequestCount ?? 0;
  });
}

function discoveryFixture() {
  const now = Date.now();
  const start = new Date(now + 60 * 60 * 1000);
  const end = new Date(now + 3 * 60 * 60 * 1000);

  // The Rock @ Oceanside (regional best)
  const topRec = {
    recommendationId: TOP_REC_CANDIDATE_ID,
    beach: {
      id: TOP_REC_BEACH_ID,
      name: "The Rock",
      slug: "the-rock-oceanside",
      city: "Oceanside",
      state: "CA",
      lat: 33.205,
      lon: -117.395,
      region: "California",
    },
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      tide: "Rising",
      wind: "5 mph NE",
      waveHeight: "3-4 ft",
      wavePeriod: "13s",
      dataSource: "NOAA_NWS",
      confidence: 82,
      timezone: "America/Los_Angeles",
    },
    forecast: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      beach_id: TOP_REC_BEACH_ID,
      forecast_date: new Date().toISOString().split("T")[0],
      forecast_time: "12:00",
      wave_height: "3-4ft",
      wave_period: "13",
      water_temp: "62",
      wind_speed: "5",
      wind_direction: "NE",
      tide_height: "2.8",
      tide_status: "Rising",
      confidence_score: 82,
      data_source: "NOAA_NWS",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    score: 88,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 22,
      periodEnergyScore: 18,
      windAlignment: 16,
      tideFit: 11,
      affinityBonus: 6,
      personalizationBonus: 0,
      distancePenalty: -5,
    },
    summary: "Clean WNW swell, light NE winds",
    reasons: ["Strong period", "Offshore winds"],
    warnings: [],
    waveHeightBadge: "3-4ft",
    distanceMiles: 19,
    generated_at: new Date().toISOString(),
  };

  // OB Pier @ San Diego (lower-scored)
  const homeRec = {
    beach: {
      id: HOME_BEACH_ID,
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      city: "San Diego",
      state: "CA",
      lat: 32.749,
      lon: -117.252,
      region: "California",
    },
    window: { ...topRec.window, waveHeight: "1-2 ft" },
    forecast: {
      ...topRec.forecast,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      beach_id: HOME_BEACH_ID,
      wave_height: "1-2ft",
      wind_direction: "W",
      data_source: "CDIP",
    },
    score: 60,
    matchQuality: "fair",
    subscores: {
      waveHeightFit: 14,
      periodEnergyScore: 12,
      windAlignment: 14,
      tideFit: 10,
      affinityBonus: 8,
      personalizationBonus: 0,
      distancePenalty: -2,
    },
    summary: "Soft and small at the pier",
    reasons: ["Small WSW swell"],
    warnings: [],
    waveHeightBadge: "1-2ft",
    distanceMiles: 0,
    generated_at: new Date().toISOString(),
  };

  return {
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      recommendations: [topRec, homeRec],
      searchCriteria: { maxResults: 6 },
      metadata: {
        totalBeachesConsidered: 30,
        successfulForecasts: 30,
        partialSuccess: false,
        failedBeaches: 0,
        staleBeaches: 0,
        generated_at: new Date().toISOString(),
      },
      regionalCall: "Local sandbars holding lined-up WNW lines.",
      recommendationAvailability: {
        state: "available",
        holdEpoch: "enforce:resolved:before-major-event-e2e",
      },
      sessionDecision: createCanonicalSessionDecisionFixture({
        phase: "available",
        candidateId: TOP_REC_CANDIDATE_ID,
        beachId: TOP_REC_BEACH_ID,
        beachName: topRec.beach.name,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        timezone: topRec.window.timezone,
        forecastId: topRec.forecast.id,
        forecastAt: start.toISOString(),
      }),
    },
  };
}

function clearOracleCacheInitScript() {
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

test.describe('Oracle home — regional-best hero', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.addInitScript(clearOracleCacheInitScript);
    await ensureAuthenticated(page);

    await page.route('**/api/surf/discover**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(discoveryFixture()),
      });
    });

    // The Oracle hero hits /api/surf/call once the hero beach resolves;
    // our fixture beach IDs aren't in prod, so default that endpoint to
    // a benign empty payload to keep the network-error guard happy.
    await page.route('**/api/surf/call**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: 'Oracle home regional-best hero',
    });
  });

  test('OracleHero renders the topRec from the discovery fixture (smoke)', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // OracleHero is a <section role="banner"> — disambiguate from the
    // app-level <header role="banner">.
    const hero = page.locator('section[role="banner"]');
    await expect(hero).toBeVisible({ timeout: 20_000 });

    // The fixture's topRec is "The Rock". When the auth user's actual
    // home beach is The Rock, the legacy override would still render
    // The Rock, so this assertion is a smoke check on hero data
    // pipeline integrity rather than the override removal itself.
    await expect(hero).toContainText('The Rock');
  });

  test('drive subtitle and HomeBeachCard testids exist in the rendered tree when applicable', async ({
    page,
  }) => {
    // This test cannot reliably control the auth user's `homeBeach`
    // (it's a "use server" action result, not an HTTP route we can
    // intercept). We assert non-failure: when the user's real home
    // beach matches a recommendation in the fixture and is NOT the
    // topRec, the new UI shows up; when it doesn't match, the new UI
    // stays hidden. Both are valid post-refactor states. The unit
    // tests at __tests__/components/oracle/oracle-home-screen.test.tsx
    // cover the strict semantic assertions.
    await page.goto('/');
    await waitForPageLoad(page);

    const hero = page.locator('section[role="banner"]');
    await expect(hero).toBeVisible({ timeout: 20_000 });

    // Both testids must render at most once — never duplicated.
    // Validates the new components don't accidentally double-mount.
    const subtitleCount = await page
      .getByTestId('hero-drive-subtitle')
      .count();
    expect(subtitleCount).toBeLessThanOrEqual(1);

    const homeCardCount = await page.getByTestId('home-beach-card').count();
    expect(homeCardCount).toBeLessThanOrEqual(1);

    // The HomeBeachCard and drive subtitle are gated on the same
    // `showHomeCard` boolean. They must stay in sync: card count must
    // be ≤ subtitle count (i.e. card cannot exist without subtitle).
    expect(homeCardCount).toBeLessThanOrEqual(subtitleCount);
  });

  test('requests browser GPS only after Use my location is activated', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(LA_JOLLA);
    await page.addInitScript(installGeolocationRequestCounter);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hero = page.locator('section[role="banner"]');
    await expect(hero).toBeVisible({ timeout: 20_000 });

    const useMyLocation = page.getByRole('button', {
      name: 'Use my location',
    });
    await expect(useMyLocation).toBeVisible();
    expect(await readGeolocationRequestCount(page)).toBe(0);

    const gpsDiscoveryRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === '/api/surf/discover' &&
        url.searchParams.get('lat') === LA_JOLLA.latitude.toString() &&
        url.searchParams.get('lon') === LA_JOLLA.longitude.toString()
      );
    });

    await useMyLocation.click();
    await gpsDiscoveryRequest;

    await expect
      .poll(() => readGeolocationRequestCount(page))
      .toBe(1);
    await expect(useMyLocation).toHaveCount(0);
  });
});

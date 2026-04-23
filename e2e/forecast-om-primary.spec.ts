/**
 * OM-primary wave-height selector — E2E invariants
 *
 * Verifies that the OM-primary selector (lib/utils/wave-height-selector.ts)
 * drives the displayed wave-height on a beach page. Before the selector
 * shipped, La Jolla Shores sometimes rendered "1.5 ft" while the raw
 * Open-Meteo significant-wave-height for the same slot was >2m — because
 * the v3 ML correction was overshoot-compensating in the wrong direction.
 *
 * This suite runs on CI against dev (BASE_URL=https://dev.quiversurf.app)
 * where a seeded OM-primary row exists on La Jolla Shores. It should NOT
 * be executed against production.
 *
 * @project auth
 */

import { test, expect, Route } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from "./utils/error-detection";
import { waitForPageLoad } from "./utils/test-helpers";

const LA_JOLLA_SHORES_SLUG = "la-jolla-shores";
const LA_JOLLA_SHORES_URL = `/california/san-diego/${LA_JOLLA_SHORES_SLUG}`;

// Match "N ft" or "N-M ft" rendered inside a <WaveHeightDisplay>. The card
// surfaces face-height feet and we extract the numeric value (or range
// midpoint) for threshold assertions.
function parseFeet(rendered: string | null): number | null {
  if (!rendered) return null;
  const rangeMatch = rendered.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return (low + high) / 2;
    }
  }
  const singleMatch = rendered.match(/(\d+(?:\.\d+)?)/);
  if (!singleMatch) return null;
  const n = Number(singleMatch[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mock the PostgREST enhanced_forecasts query for La Jolla Shores with an
 * OM-primary row (wave_height_om >= 0.95m). The selector should swap to
 * the OM-derived value regardless of what the legacy wave_height string
 * contains.
 */
async function mockOmPrimaryForecast(
  route: Route,
  omHeightMeters: number,
  fallbackWaveHeight: string,
) {
  const nowISO = new Date().toISOString();
  const body = [
    {
      id: "mock-om-primary-lajolla",
      beach_id: "d291411d-d331-4bf1-ad1a-302da3c69de0",
      forecast_at: nowISO,
      wave_height: fallbackWaveHeight,
      wave_height_om: omHeightMeters,
      wave_period: "12s",
      wave_direction: "WSW",
      wind_speed: "5 mph",
      wind_direction: "N",
      wind_direction_deg: 0,
      water_temp: "64 F",
      air_temperature: "62 F",
      tide_status: "Rising",
      tide_height: "3.2 ft",
      next_tide_time: null,
      next_tide_type: null,
      next_tide_height: null,
      weather_condition: "Clear",
      swell_1_height: "2.0 ft",
      swell_1_period: "12s",
      swell_1_direction: "WSW",
      swell_2_height: null,
      swell_2_period: null,
      swell_2_direction: null,
      wind_wave_height: null,
      wind_wave_period: null,
      wind_wave_direction: null,
      confidence_score: 80,
      data_source: "OM-primary-test",
      created_at: nowISO,
      updated_at: nowISO,
      is_ml_calibrated: false,
      ml_corrected_height: null,
    },
  ];
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("OM-primary wave-height selector", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "OM-primary selector",
    });
  });

  test("renders > 2.5 ft at La Jolla Shores when OM wave_height_om >= 2.0m (selector fires)", async ({
    page,
  }) => {
    // Intercept enhanced_forecasts PostgREST calls and return a row with a
    // clearly-big OM Hs (2.1m = ~6.9 ft). The selector should override the
    // legacy wave_height string.
    await page.route(/enhanced_forecasts/i, async (route) => {
      await mockOmPrimaryForecast(route, 2.1, "1.5 ft");
    });

    await page.goto(LA_JOLLA_SHORES_URL);
    await waitForPageLoad(page);

    // Settle deferred data fetches (forecast builder, scored, etc.)
    // eslint-disable-next-line playwright/no-wait-for-timeout -- forecast panels hydrate after page-level settle
    await page.waitForTimeout(1500);

    // Prefer the dedicated testid if present; otherwise fall back to any
    // element containing " ft" in the forecast area. The selector assertion
    // is what we care about, not the exact DOM hook.
    const heightLocator = page
      .getByTestId("wave-height-display")
      .or(page.locator('text=/\\d+(\\.\\d+)?\\s*ft/'))
      .first();
    await expect(heightLocator).toBeVisible({ timeout: 10_000 });

    const text = await heightLocator.textContent();
    const feet = parseFeet(text);
    expect(feet, `rendered="${text}"`).not.toBeNull();
    // Pre-fix regression showed ~1.5 ft; post-fix should be derived from
    // 2.1m ≈ 6.9 ft. Assert comfortably above the 2.5 ft floor.
    expect(feet!).toBeGreaterThan(2.5);
  });

  test("falls back to wave_height string when OM <0.5m (sub-gate)", async ({
    page,
  }) => {
    // Small-wave path: OM 0.4m is below the 0.95m gate — selector returns
    // the existing NOAA/CDIP-derived wave_height string ("1.8 ft").
    await page.route(/enhanced_forecasts/i, async (route) => {
      await mockOmPrimaryForecast(route, 0.4, "1.8 ft");
    });

    await page.goto(LA_JOLLA_SHORES_URL);
    await waitForPageLoad(page);

    // eslint-disable-next-line playwright/no-wait-for-timeout -- forecast panels hydrate after page-level settle
    await page.waitForTimeout(1500);

    const anyFt = page.locator('text=/\\d+(\\.\\d+)?\\s*ft/').first();
    await expect(anyFt).toBeVisible({ timeout: 10_000 });

    const text = await anyFt.textContent();
    const feet = parseFeet(text);
    expect(feet, `rendered="${text}"`).not.toBeNull();
    // Fallback "1.8 ft" means the selector kept hands off — NOT the OM
    // 0.4m -> 1.3 ft derivation, which would overshoot.
    expect(feet!).toBeLessThan(2.5);
  });

  test("renders > 2.5 ft at the gate boundary (OM = 0.95m selector fires)", async ({
    page,
  }) => {
    // Gate-boundary case: 0.95m -> exactly 3.1 ft. Still above the 2.5 ft
    // threshold that pins the pre-fix "1.5 ft" regression out of the test.
    await page.route(/enhanced_forecasts/i, async (route) => {
      await mockOmPrimaryForecast(route, 0.95, "1.2 ft");
    });

    await page.goto(LA_JOLLA_SHORES_URL);
    await waitForPageLoad(page);

    // eslint-disable-next-line playwright/no-wait-for-timeout -- forecast panels hydrate after page-level settle
    await page.waitForTimeout(1500);

    const anyFt = page.locator('text=/\\d+(\\.\\d+)?\\s*ft/').first();
    await expect(anyFt).toBeVisible({ timeout: 10_000 });

    const text = await anyFt.textContent();
    const feet = parseFeet(text);
    expect(feet, `rendered="${text}"`).not.toBeNull();
    // 0.95m -> 3.1 ft should replace the 1.2 ft fallback.
    expect(feet!).toBeGreaterThan(2.5);
  });
});

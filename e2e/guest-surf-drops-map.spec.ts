/**
 * Guest Surf Drops map overlay smoke.
 *
 * Uses network fixtures for the Surf Drops/QR/Amenities overlay APIs so this
 * spec does not need to write Surf Drop rows into the shared dev Supabase.
 * It still boots the real /map page and real Mapbox layer stack, then verifies
 * the Surf Drops DOM markers can mount, toggle off/on, and route by drop UUID.
 *
 * @project guest
 */

import { test, expect, type Page } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from './utils/error-detection';
import { dismissMapEntryOverlay } from './utils/map-helpers';
import { TIMEOUTS } from './fixtures/test-data';

const DROP_ID = '11111111-2222-3333-4444-555555555555';
const SHARE_SLUG = 'A2K7N9PQRS';
const BEACH_ID = '01330afc-00d3-461b-88f3-b173774766f4';

const beachFixture = {
  id: BEACH_ID,
  name: 'Blacks',
  slug: 'blacks',
  lat: 32.8759,
  lon: -117.2533,
  city: 'San Diego',
  state: 'CA',
  country: 'USA',
};

async function stubSurfDropOverlayApis(page: Page): Promise<void> {
  await page.route('**/api/beaches/nearby**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [beachFixture] }),
    });
  });

  await page.route(/.*\/api\/beaches(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { beaches: [beachFixture] } }),
    });
  });

  await page.route('**/api/forecasts/bulk**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          forecasts: { [BEACH_ID]: 3 },
          displayForecasts: { [BEACH_ID]: { label: '2-3 ft', kind: 'range' } },
          waterTemps: { [BEACH_ID]: '64' },
          conditionScores: { [BEACH_ID]: 72 },
          conditionSummaries: { [BEACH_ID]: 'FAIR' },
          swellPartitions: {},
          swellPartitionTimeline: {},
        },
      }),
    });
  });

  await page.route('**/api/surf-drops/map**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          drops: [
            {
              id: DROP_ID,
              share_slug: SHARE_SLUG,
              location_type: 'custom_pin',
              lat: 32.749,
              lon: -117.253,
              beach_id: null,
              spot_name: null,
              general_area: 'North County SD',
              exact_label: 'Secret stairs',
              starts_at: '2099-07-02T14:00:00.000Z',
              ends_at: '2099-07-02T15:00:00.000Z',
              audience: 'mutuals',
              creator: {
                id: 'user-1',
                display_name: 'Maya',
                avatar_url: null,
              },
              participants_count: 2,
            },
          ],
        },
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/qr-venues/map**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { venues: [] },
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/amenities**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { amenities: [] },
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Surf Drops map overlay', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await stubSurfDropOverlayApis(page);
    await page.addInitScript(() => {
      window.localStorage.removeItem('quiver.map.layers.v1');
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: 'Surf Drops map overlay',
      // Guest map loads can emit expected auth/session probes; the assertions
      // below are scoped to the overlay contract.
      checkConsole: false,
    });
  });

  test('renders Surf Drop markers above the map and preserves the swell canvas while toggling', async ({ page }) => {
    await page.goto('/map?search=Blacks', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: TIMEOUTS.long });
    await dismissMapEntryOverlay(page);

    await expect(page.getByTestId('layer-legend')).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    await expect(page.locator('canvas.mapboxgl-canvas').first()).toBeVisible({
      timeout: TIMEOUTS.long,
    });

    const marker = page.locator(
      `[data-testid="surf-drop-marker"][data-drop-id="${DROP_ID}"]`,
    );
    await expect(marker).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(marker).toHaveAttribute('data-share-slug', SHARE_SLUG);

    await page.getByTestId('layer-legend-toggle-drops').uncheck();
    await expect(marker).toHaveCount(0, { timeout: TIMEOUTS.medium });
    await expect(page.locator('canvas.mapboxgl-canvas').first()).toBeVisible();

    await page.getByTestId('layer-legend-toggle-drops').check();
    await expect(marker).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(page.locator('canvas.mapboxgl-canvas').first()).toBeVisible();

    await marker.click();
    await expect(page).toHaveURL(new RegExp(`/auth/sign-in\\?redirectTo=.*${DROP_ID}`), {
      timeout: TIMEOUTS.long,
    });
  });
});

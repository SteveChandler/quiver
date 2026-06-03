import { expect, test } from '@playwright/test';
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from './utils/error-detection';
import { dismissMapEntryOverlay } from './utils/map-helpers';

type BeachCoordinate = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
};

function expectValidLatLon(beach: BeachCoordinate): void {
  expect(Number.isFinite(beach.lat), `${beach.name} lat`).toBe(true);
  expect(Number.isFinite(beach.lon), `${beach.name} lon`).toBe(true);
  expect(beach.lat, `${beach.name} lat range`).toBeGreaterThanOrEqual(-90);
  expect(beach.lat, `${beach.name} lat range`).toBeLessThanOrEqual(90);
  expect(beach.lon, `${beach.name} lon range`).toBeGreaterThanOrEqual(-180);
  expect(beach.lon, `${beach.name} lon range`).toBeLessThanOrEqual(180);
}

test.describe('Map coordinate API contracts', () => {
  test('GET /api/beaches returns public beaches with current lat/lon coordinates', async ({
    request,
  }) => {
    const response = await request.get('/api/beaches');
    const json = await response.json();
    const beaches = json.data?.beaches as BeachCoordinate[] | undefined;

    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(beaches)).toBe(true);
    expect(beaches?.length ?? 0).toBeGreaterThan(0);

    for (const beach of beaches ?? []) {
      expect(beach).toHaveProperty('lat');
      expect(beach).toHaveProperty('lon');
      expect(beach).not.toHaveProperty('latitude');
      expect(beach).not.toHaveProperty('longitude');
      expectValidLatLon(beach);
    }
  });

  test('GET /api/beaches/nearby accepts lat/lon and returns valid nearby coordinates', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/beaches/nearby?lat=32.8473&lon=-117.275&limit=5'
    );
    const json = await response.json();
    const beaches = json.data as BeachCoordinate[] | undefined;

    expect(response.status()).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(beaches)).toBe(true);
    expect(beaches?.length ?? 0).toBeGreaterThan(0);
    expect(beaches?.length ?? 0).toBeLessThanOrEqual(5);

    for (const beach of beaches ?? []) {
      expectValidLatLon(beach);
    }
  });
});

test.describe('Map coordinate browser smoke', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page, context }) => {
    errorCapture = setupErrorDetection(page);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: 'Map coordinate browser smoke',
    });
  });

  test('map renders canvas and visible markers without invalid marker styles', async ({
    page,
  }) => {
    await page.goto('/map?search=blacks', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await dismissMapEntryOverlay(page);

    await expect(page.getByTestId('map-view')).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas, canvas').first()).toBeVisible({
      timeout: 15000,
    });

    const markers = page.getByTestId('beach-marker');
    await expect(markers.first()).toBeVisible({ timeout: 15000 });

    const markerStyles = await markers.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('style') ?? '')
    );

    expect(markerStyles.length).toBeGreaterThan(0);
    for (const style of markerStyles.slice(0, 20)) {
      expect(style).not.toContain('NaN');
      expect(style).not.toContain('Infinity');
    }
  });
});

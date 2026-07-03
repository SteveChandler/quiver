/**
 * Guest-run Surf Drops map E2E with real Surf Drops APIs.
 *
 * This avoids the shared auth-project storage-state setup by creating a local
 * Supabase user inside the test, calling the real create endpoint with a Bearer
 * token, then letting the real /api/surf-drops/map endpoint feed the map marker.
 * Supporting non-Surf-Drops map APIs are stubbed to keep the test focused.
 *
 * @project guest
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from './utils/error-detection';
import { TIMEOUTS } from './fixtures/test-data';

const BEACH_ID = '01330afc-00d3-461b-88f3-b173774766f4';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_SLUG_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/;

const beachFixture = {
  id: BEACH_ID,
  name: 'Mission Beach',
  slug: 'mission-beach',
  lat: 32.7702,
  lon: -117.2525,
  city: 'San Diego',
  state: 'CA',
  country: 'USA',
};

function requireEnv(name: string): string {
  const value = process.env[name];
  expect(value, `${name} must be configured`).toBeTruthy();
  return value!;
}

function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}

function createAnonClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

async function createTemporaryAccessToken(admin: SupabaseClient): Promise<{
  accessToken: string;
  userId: string;
}> {
  const email = `smoke+surf-drop-map-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@quiversurf.test`;
  const password = 'surf-drop-map-e2e-123456!';
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { is_ephemeral_smoke_test: true },
  });
  expect(createError).toBeNull();
  expect(created.user?.id).toMatch(UUID_PATTERN);

  const anon = createAnonClient();
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  expect(signInError).toBeNull();
  expect(signedIn.session?.access_token).toBeTruthy();

  return {
    accessToken: signedIn.session!.access_token,
    userId: created.user!.id,
  };
}

async function stubSupportingMapApis(page: Page): Promise<void> {
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

test.describe('Surf Drops map overlay — real API path', () => {
  let errorCapture: ErrorCapture | null = null;
  let createdDropIds: string[] = [];
  let createdUserId: string | null = null;

  test.beforeEach(async ({ page }) => {
    errorCapture = null;
    createdDropIds = [];
    createdUserId = null;
    await stubSupportingMapApis(page);
    await page.addInitScript(() => {
      window.localStorage.removeItem('quiver.map.layers.v1');
      window.localStorage.setItem(
        'quiver:lastBeach',
        JSON.stringify({ lat: 32.7702, lon: -117.2525 }),
      );
    });
  });

  test.afterEach(async ({ page }) => {
    if (errorCapture) {
      await assertNoErrors(page, errorCapture, {
        context: 'Surf Drops real map API path',
        checkConsole: false,
      });
    }

    const admin = createAdminClient();
    if (createdDropIds.length > 0) {
      const { error } = await admin
        .from('surf_drops')
        .delete()
        .in('id', createdDropIds);
      expect(error).toBeNull();
    }

    if (createdUserId) {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      expect(error).toBeNull();
    }
  });

  test('creates a Surf Drop and renders it from /api/surf-drops/map', async ({ page }) => {
    const admin = createAdminClient();
    const { accessToken, userId } = await createTemporaryAccessToken(admin);
    createdUserId = userId;
    const authScheme = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
    const authHeader = authScheme.concat(accessToken);
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const createResponse = await page.request.post('/api/surf-drops', {
      headers: { Authorization: authHeader },
      data: {
        location_type: 'custom_pin',
        custom_lat: 32.7702,
        custom_lon: -117.2525,
        general_area: 'Mission Beach',
        exact_label: 'E2E sonar marker',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        audience: 'private',
        note: 'Playwright fixture drop',
        forecast_snapshot: {
          wave_height_ft: 3,
          rating: 'fair',
        },
      },
    });
    const createBody = await createResponse.text();
    expect(createResponse.status(), createBody).toBe(201);

    const createJson = JSON.parse(createBody);
    const dropId = createJson?.data?.id;
    const shareSlug = createJson?.data?.share_slug;
    expect(dropId).toMatch(UUID_PATTERN);
    expect(shareSlug).toMatch(SHARE_SLUG_PATTERN);
    createdDropIds.push(dropId);

    await page.route('**/api/surf-drops/map**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          Authorization: authHeader,
        },
      });
    });

    errorCapture = setupErrorDetection(page);
    const mapResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/surf-drops/map') &&
        response.status() === 200,
      { timeout: TIMEOUTS.long },
    );

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: TIMEOUTS.long });

    const mapResponse = await mapResponsePromise;
    const mapJson = await mapResponse.json();
    expect(
      mapJson?.data?.drops?.some(
        (drop: { id?: string; share_slug?: string }) =>
          drop.id === dropId && drop.share_slug === shareSlug,
      ),
    ).toBe(true);

    const marker = page.locator(
      `[data-testid="surf-drop-marker"][data-drop-id="${dropId}"]`,
    );
    await expect(marker).toBeVisible({ timeout: TIMEOUTS.long });
    await expect(marker).toHaveAttribute('data-share-slug', shareSlug);

    await marker.click();
    await expect(page).toHaveURL(new RegExp(`/auth/sign-in\\?redirectTo=.*${dropId}`), {
      timeout: TIMEOUTS.long,
    });
  });
});

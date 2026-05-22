import { test, expect, type Page, type Route } from '@playwright/test';
import { TEST_BEACHES, VIEWPORTS } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { assertNoErrors, setupErrorDetection, type ErrorCapture } from './utils/error-detection';

type AlertConditions = Record<string, number | string | undefined>;

interface AlertRule {
  id: string;
  user_id: string;
  beach_id: string;
  name: string;
  preset_type: string | null;
  conditions: AlertConditions;
  notify_email: boolean;
  notify_push: boolean;
  enabled: boolean;
  last_matched_at: string | null;
  auto_created_at: string | null;
  created_at: string;
  updated_at: string;
  beaches: {
    name: string;
    slug: string | null;
    timezone: string;
  } | null;
}

interface AlertPayload {
  beach_id?: string;
  name?: string;
  preset_type?: string | null;
  conditions?: AlertConditions;
  notify_email?: boolean;
  notify_push?: boolean;
  enabled?: boolean;
}

interface AlertRouteHarness {
  createPayloads: AlertPayload[];
  patchPayloads: AlertPayload[];
  deleteRuleIds: string[];
  beachDetailFetches: string[];
  timeline: string[];
}

const BOLSA_BEACH = {
  id: 'beach-1',
  name: 'Bolsa Chica',
  slug: 'bolsa-chica',
  city: 'Huntington Beach',
  state: 'CA',
  lat: 33.695,
  lon: -118.049,
  timezone: 'America/Los_Angeles',
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 35,
  aspect_deg: 225,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  preferred_tide_direction: 'rising',
  swell_window_center_deg: 210,
  swell_window_halfwidth_deg: 55,
};

const INITIAL_CONDITION_RULE: AlertRule = {
  id: 'rule-1',
  user_id: 'user-1',
  beach_id: BOLSA_BEACH.id,
  name: 'Small clean longboard waves - Bolsa Chica',
  preset_type: null,
  conditions: {
    swell_height_min: 1,
    swell_height_max: 3,
    wind_speed_max_kt: 5,
  },
  notify_email: false,
  notify_push: true,
  enabled: true,
  last_matched_at: null,
  auto_created_at: null,
  created_at: '2026-05-21T12:00:00.000Z',
  updated_at: '2026-05-21T12:00:00.000Z',
  beaches: {
    name: BOLSA_BEACH.name,
    slug: BOLSA_BEACH.slug,
    timezone: BOLSA_BEACH.timezone,
  },
};

const SIMILARITY_RULE: AlertRule = {
  ...INITIAL_CONDITION_RULE,
  id: 'similarity-rule',
  name: 'Similarity match - Bolsa Chica',
  preset_type: 'similarity_match',
};

function readPayload(route: Route): AlertPayload {
  const postData = route.request().postData();
  if (!postData) return {};
  return JSON.parse(postData) as AlertPayload;
}

async function installAlertRoutes(page: Page): Promise<AlertRouteHarness> {
  let rules: AlertRule[] = [
    { ...INITIAL_CONDITION_RULE },
    { ...SIMILARITY_RULE },
  ];
  const harness: AlertRouteHarness = {
    createPayloads: [],
    patchPayloads: [],
    deleteRuleIds: [],
    beachDetailFetches: [],
    timeline: [],
  };

  await page.route('**/api/alerts/rules', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: rules }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = readPayload(route);
      harness.createPayloads.push(payload);
      harness.timeline.push('create');

      const createdRule: AlertRule = {
        ...INITIAL_CONDITION_RULE,
        id: `created-${harness.createPayloads.length}`,
        name: payload.name ?? INITIAL_CONDITION_RULE.name,
        preset_type: payload.preset_type ?? null,
        conditions: payload.conditions ?? {},
        notify_email: payload.notify_email ?? false,
        notify_push: payload.notify_push ?? true,
        beach_id: payload.beach_id ?? BOLSA_BEACH.id,
      };
      rules = [createdRule, ...rules];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: createdRule }),
      });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/alerts/rules/rule-1', async (route) => {
    const method = route.request().method();

    if (method === 'PATCH') {
      const payload = readPayload(route);
      harness.patchPayloads.push(payload);
      harness.timeline.push('patch');
      rules = rules.map((rule) =>
        rule.id === 'rule-1'
          ? {
              ...rule,
              ...payload,
              conditions: payload.conditions ?? rule.conditions,
              updated_at: '2026-05-21T13:00:00.000Z',
            }
          : rule
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: rules.find((rule) => rule.id === 'rule-1') }),
      });
      return;
    }

    if (method === 'DELETE') {
      harness.deleteRuleIds.push('rule-1');
      harness.timeline.push('delete');
      rules = rules.filter((rule) => rule.id !== 'rule-1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'rule-1' } }),
      });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/beaches/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: BOLSA_BEACH.id,
            name: BOLSA_BEACH.name,
            slug: BOLSA_BEACH.slug,
            city: BOLSA_BEACH.city,
            state: BOLSA_BEACH.state,
          },
        ],
      }),
    });
  });

  await page.route('**/api/beaches/beach-1', async (route) => {
    harness.beachDetailFetches.push(BOLSA_BEACH.id);
    harness.timeline.push('beach-detail');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { beach: BOLSA_BEACH } }),
    });
  });

  return harness;
}

async function openAlertsPage(page: Page): Promise<void> {
  await page.goto('/alerts');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Condition alerts' })).toBeVisible();
}

async function openCreateDialog(page: Page): Promise<void> {
  await page.getByPlaceholder('Search Bolsa, Huntington...').fill('Bolsa');
  const result = page
    .getByTestId('alert-beach-results')
    .getByRole('button', { name: /Bolsa Chica/i });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByTestId('alert-editor-dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create alert' })).toBeVisible();
}

async function captureAlertsVisual(page: Page, path: string): Promise<void> {
  await page.addStyleTag({
    content: `
      [aria-label="Open Next.js Dev Tools"],
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog],
      #nextjs__container_errors_label {
        display: none !important;
      }
    `,
  });
  await page.evaluate(() => {
    for (const button of Array.from(document.querySelectorAll('button'))) {
      const label = button.getAttribute('aria-label') ?? button.textContent ?? '';
      const style = window.getComputedStyle(button);
      if (/Open Next\.js Dev Tools|^N$/i.test(label.trim()) && style.position === 'fixed') {
        button.style.display = 'none';
      }
    }
  });
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
  });
}

test.describe('Condition alerts management', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Condition alerts management' });
  });

  test('renders grouped condition rules and keeps similarity alerts out of the manager', async ({ page }) => {
    await installAlertRoutes(page);
    await openAlertsPage(page);

    await expect(page.getByRole('heading', { name: BOLSA_BEACH.name, exact: true })).toBeVisible();
    await expect(page.getByTestId('alert-rule-rule-1')).toContainText('1-3 ft');
    await expect(page.getByTestId('alert-rule-rule-1')).toContainText('<= 5 kt wind');
    await expect(page.getByText('Push on')).toBeVisible();
    await expect(page.getByText('Similarity match - Bolsa Chica')).toHaveCount(0);
  });

  test('creates a longboard custom alert after fetching full beach metadata', async ({ page }) => {
    const routes = await installAlertRoutes(page);
    await openAlertsPage(page);
    await openCreateDialog(page);

    const dialog = page.getByTestId('alert-editor-dialog');
    await expect(dialog.getByLabel('Alert name')).toHaveValue(
      'Small clean longboard waves - Bolsa Chica'
    );
    await expect(dialog.getByPlaceholder('min ft')).toHaveValue('1');
    await expect(dialog.getByPlaceholder('max ft')).toHaveValue('3');
    await expect(dialog.getByPlaceholder('max kt')).toHaveValue('5');
    await expect(dialog.getByRole('button', { name: 'Push' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(dialog.getByRole('button', { name: 'Email' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await page.getByTestId('alert-editor-save').click();

    await expect.poll(() => routes.createPayloads.length).toBe(1);
    const payload = routes.createPayloads[0];
    expect(routes.beachDetailFetches).toEqual([BOLSA_BEACH.id]);
    expect(routes.timeline.indexOf('beach-detail')).toBeLessThan(
      routes.timeline.indexOf('create')
    );
    expect(payload).toMatchObject({
      beach_id: BOLSA_BEACH.id,
      name: 'Small clean longboard waves - Bolsa Chica',
      preset_type: null,
      notify_push: true,
      notify_email: false,
      conditions: {
        swell_height_min: 1,
        swell_height_max: 3,
        wind_speed_max_kt: 5,
      },
    });
  });

  test('edits, pauses, and deletes condition rules through the alert endpoints', async ({ page }) => {
    const routes = await installAlertRoutes(page);
    await openAlertsPage(page);

    const row = page.getByTestId('alert-rule-rule-1');
    await row.getByRole('button', { name: 'Pause alert' }).click();
    await expect.poll(() => routes.patchPayloads.length).toBe(1);
    expect(routes.patchPayloads[0]).toEqual({ enabled: false });
    await expect(row).toContainText('Paused');

    await row.getByRole('button', { name: 'Edit alert' }).click();
    await expect(page.getByRole('heading', { name: 'Edit alert' })).toBeVisible();
    await expect(routes.beachDetailFetches).toEqual([BOLSA_BEACH.id]);

    const dialog = page.getByTestId('alert-editor-dialog');
    await dialog.getByLabel('Alert name').fill('Tiny clean runners - Bolsa Chica');
    await page.getByTestId('alert-editor-save').click();

    await expect.poll(() => routes.patchPayloads.length).toBe(2);
    expect(routes.patchPayloads[1]).toMatchObject({
      name: 'Tiny clean runners - Bolsa Chica',
      notify_push: true,
      notify_email: false,
      conditions: {
        swell_height_min: 1,
        swell_height_max: 3,
        wind_speed_max_kt: 5,
      },
    });

    page.once('dialog', async (browserDialog) => {
      expect(browserDialog.type()).toBe('confirm');
      expect(browserDialog.message()).toContain('Tiny clean runners - Bolsa Chica');
      await browserDialog.accept();
    });
    await row.getByRole('button', { name: 'Delete alert' }).click();
    await expect.poll(() => routes.deleteRuleIds).toEqual(['rule-1']);
    await expect(page.getByTestId('alert-rule-rule-1')).toHaveCount(0);
  });

  test('blocks impossible wave ranges before saving', async ({ page }) => {
    const routes = await installAlertRoutes(page);
    await openAlertsPage(page);
    await openCreateDialog(page);

    const dialog = page.getByTestId('alert-editor-dialog');
    await dialog.getByPlaceholder('min ft').fill('4');
    await dialog.getByPlaceholder('max ft').fill('2');
    await page.getByTestId('alert-editor-save').click();

    await expect(dialog).toContainText('Minimum wave height must be below the maximum.');
    expect(routes.createPayloads).toHaveLength(0);
  });

  test('keeps the alerts manager visually stable on desktop and mobile', async ({ page }) => {
    await installAlertRoutes(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await openAlertsPage(page);

    await expect(page.getByRole('button', { name: 'Create alert' })).toBeVisible();
    await expect(page.getByRole('heading', { name: BOLSA_BEACH.name, exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
      )
      .toBe(true);

    await captureAlertsVisual(page, 'test-results/alerts-management-desktop.png');

    await page.setViewportSize(VIEWPORTS.mobile);
    await expect(page.getByRole('heading', { name: 'Condition alerts' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
      )
      .toBe(true);

    await captureAlertsVisual(page, 'test-results/alerts-management-mobile.png');
  });
});

test.describe('Beach detail alert entry point', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.route('**/api/alerts/rules', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'created-from-beach-detail' } }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach detail alert entry point' });
  });

  test('opens the alert preset dialog from the beach detail CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1159, height: 653 });
    await navigateToBeach(page, TEST_BEACHES.blacks);
    const alertButton = page.getByRole('button', { name: /^set up alerts$/i });
    const directionsButton = page.getByRole('button', { name: /^get directions$/i });
    const sessionsTab = page.getByRole('tab', { name: /^sessions$/i });
    await expect(alertButton).toBeVisible();
    await expect(directionsButton).toBeVisible();
    await expect(sessionsTab).toBeVisible();

    const [sessionsBox, alertBox, directionsBox] = await Promise.all([
      sessionsTab.boundingBox(),
      alertButton.boundingBox(),
      directionsButton.boundingBox(),
    ]);
    expect(sessionsBox).not.toBeNull();
    expect(alertBox).not.toBeNull();
    expect(directionsBox).not.toBeNull();
    expect(sessionsBox!.x + sessionsBox!.width).toBeLessThanOrEqual(alertBox!.x);
    expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(directionsBox!.x);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
      )
      .toBe(true);

    await alertButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /^Blacks Beach$/i })).toBeVisible();
    await expect(dialog.getByText('Condition watch')).toBeVisible();
  });
});

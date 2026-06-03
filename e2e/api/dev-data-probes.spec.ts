/**
 * Dev-only live data probes.
 *
 * Opt in with:
 * RUN_INFRA_TESTS=true TEST_ENV=dev BASE_URL=https://dev.quiversurf.app npx playwright test e2e/api/dev-data-probes.spec.ts --workers=1
 *
 * @project auth
 */

import { expect, test, type APIRequestContext } from '@playwright/test';
import { createIsolatedApiContext } from '../utils/api-request-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const IS_DEV_TARGET =
  process.env.TEST_ENV === 'dev' || BASE_URL.includes('dev.quiversurf.app');
const GUARDRAIL_FLAG = 'south_oc_sano_shadow_guardrail';
const TARGET_SANO_SLUGS = [
  'lower-trestles',
  'old-mans-sano',
  'san-onofre-state-beach',
] as const;

type BeachListRow = {
  id: string;
  name: string;
  slug: string | null;
};

type BeachDetail = BeachListRow & {
  features?: string[] | null;
};

type ForecastRow = {
  forecast_at?: string | null;
  wave_height?: string | null;
  raw_forecast?: {
    wave_height_provenance?: {
      south_oc_sano_guardrail?: {
        zone?: string;
        branch?: string;
        station_ids_used?: string[];
      };
    };
  } | null;
};
type SouthOcSanoGuardrail = NonNullable<
  NonNullable<ForecastRow['raw_forecast']>['wave_height_provenance']
>['south_oc_sano_guardrail'];

function requireDevTarget(): void {
  if (!IS_DEV_TARGET) {
    throw new Error(
      'Not implemented: dev data probes require TEST_ENV=dev and BASE_URL=https://dev.quiversurf.app.'
    );
  }
}

function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function expectOptionalGuardrailShape(guardrail: SouthOcSanoGuardrail): void {
  if (!guardrail) return;

  expect(guardrail.zone).toBe('south_oc_sano_shadow_zone');
  expect(typeof guardrail.branch).toBe('string');
  expect(Array.isArray(guardrail.station_ids_used)).toBe(true);
}

async function fetchBeaches(api: APIRequestContext): Promise<BeachListRow[]> {
  const response = await api.get('/api/beaches');
  const json = await response.json();

  expect(response.status()).toBe(200);
  expect(json.success).toBe(true);
  expect(Array.isArray(json.data?.beaches)).toBe(true);

  return json.data.beaches as BeachListRow[];
}

test.describe('Dev deployed data probes @infra @dev', () => {
  let api: APIRequestContext;

  test.beforeEach(async ({ playwright }, testInfo) => {
    requireDevTarget();
    api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
  });

  test.afterEach(async () => {
    await api?.dispose();
  });

  test('forecast accuracy page requires live metrics instead of building state', async () => {
    const response = await api.get('/forecast-accuracy');
    const html = await response.text();
    const text = visibleText(html);

    expect(response.status()).toBe(200);
    expect(text).toContain('Forecast accuracy receipts.');
    expect(text).toContain('Validated pairs');
    expect(text).toContain('Quiver MAE');
    expect(text).toContain('Top Beaches by Accuracy Improvement');
    expect(text).not.toContain('Accuracy rows are being verified.');
    expect(text).not.toContain('Forecast accuracy metrics building');
    expect(text).not.toContain('Accuracy rows are building; Quiver is not claiming lift yet.');
  });

  test('South OC/Sano beaches expose guardrail flag and usable forecasts', async () => {
    const beaches = await fetchBeaches(api);

    for (const slug of TARGET_SANO_SLUGS) {
      const beach = beaches.find((candidate) => candidate.slug === slug);
      expect(beach, `resolved ${slug} from /api/beaches`).toBeTruthy();

      const detailResponse = await api.get(`/api/beaches/${beach?.id}`);
      const detailJson = await detailResponse.json();
      const detail = detailJson.data?.beach as BeachDetail | undefined;

      expect(detailResponse.status(), `${slug} detail status`).toBe(200);
      expect(detailJson.success, `${slug} detail success`).toBe(true);
      expect(detail?.features, `${slug} feature flags`).toContain(GUARDRAIL_FLAG);

      const forecastResponse = await api.get('/api/forecasts/update-enhanced', {
        params: {
          beachId: beach?.id ?? '',
          days: '1',
          allowStale: 'display',
        },
      });
      const forecastJson = await forecastResponse.json();
      const forecasts = forecastJson.data?.forecasts as ForecastRow[] | undefined;
      const firstForecast = forecasts?.[0];
      const guardrail =
        firstForecast?.raw_forecast?.wave_height_provenance?.south_oc_sano_guardrail;

      expect(forecastResponse.status(), `${slug} forecast status`).toBe(200);
      expect(forecastJson.success, `${slug} forecast success`).toBe(true);
      expect(forecastJson.data?.metadata?.missing, `${slug} forecast missing`).toBe(false);
      expect(Array.isArray(forecasts), `${slug} forecast array`).toBe(true);
      expect(forecasts?.length ?? 0, `${slug} forecast count`).toBeGreaterThan(0);
      expect(firstForecast?.forecast_at, `${slug} forecast_at`).toMatch(
        /^\d{4}-\d{2}-\d{2}T/
      );
      expect(firstForecast?.wave_height, `${slug} wave_height`).toMatch(/flat|\d/i);

      expectOptionalGuardrailShape(guardrail);
    }
  });
});

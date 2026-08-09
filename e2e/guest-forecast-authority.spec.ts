import { expect, test } from "@playwright/test";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

interface PublicBeach {
  id: string;
  slug: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface BeachesResponse {
  data?: {
    beaches?: PublicBeach[];
    count?: number;
  };
}

interface ForecastResponse {
  success?: boolean;
  data?: {
    days?: number;
    forecasts?: Array<{
      id?: string | null;
      beach_id?: string | null;
      forecast_at?: string | null;
      wave_height?: string | number | null;
      water_temp?: string | number | null;
      confidence_score?: number | null;
      data_source?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    }>;
    metadata?: {
      missing?: boolean;
      stale?: boolean;
      lastUpdated?: string;
    };
  };
}

const EXPECTED_PUBLIC_BEACH_COUNT = 346;
const REQUESTED_FORECAST_DAYS = 3;
const HORIZON_TOLERANCE_HOURS = 6;
const FORECAST_CADENCE_HOURS = 3;
const FORECAST_CADENCE_TOLERANCE_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function extractSitemapPaths(xml: string): Set<string> {
  const paths = new Set<string>();

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(decodeXml(match[1]));
    paths.add(url.pathname);
  }

  return paths;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  let nextIndex = 0;
  const results: R[] = new Array(items.length);

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => run(),
    ),
  );

  return results;
}

function assertPublicBeachInventory(beaches: PublicBeach[]): void {
  expect(beaches.length).toBe(EXPECTED_PUBLIC_BEACH_COUNT);
  expect(new Set(beaches.map((beach) => beach.id)).size).toBe(beaches.length);
  expect(beaches.every((beach) => beach.id && beach.name)).toBe(true);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidWaveHeight(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value !== 'string') return false;
  const match = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:ft|feet)?$/i.exec(
    value.trim(),
  );
  if (!match) return false;
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  return Number.isFinite(low) && Number.isFinite(high) && low >= 0 && high >= low;
}

function isValidTemperature(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  return /^-?\d+(?:\.\d+)?\s*°?\s*[FC]?$/i.test(value.trim());
}

function validateForecastRows(
  beach: PublicBeach,
  payload: ForecastResponse,
  status: number,
  now: number,
): string[] {
  const label = beach.slug ?? beach.id;
  const failures: string[] = [];
  const forecasts = payload.data?.forecasts ?? [];
  const forecastTimes = forecasts.map((forecast) => Date.parse(forecast.forecast_at ?? ''));
  const lastUpdated = Date.parse(payload.data?.metadata?.lastUpdated ?? '');

  if (status !== 200) failures.push(`${label}: HTTP ${status}`);
  if (payload.success !== true) failures.push(`${label}: success was not true`);
  if (payload.data?.days !== REQUESTED_FORECAST_DAYS) {
    failures.push(`${label}: days was ${String(payload.data?.days)}`);
  }
  if (payload.data?.metadata?.missing !== false) failures.push(`${label}: forecast missing`);
  if (payload.data?.metadata?.stale !== false) failures.push(`${label}: forecast stale`);
  if (forecasts.length === 0) failures.push(`${label}: no forecast rows`);

  const invalidTimestampCount = forecastTimes.filter((time) => !Number.isFinite(time)).length;
  if (invalidTimestampCount > 0) {
    failures.push(`${label}: ${invalidTimestampCount} invalid forecast timestamps`);
  }
  const outOfOrder = forecastTimes.some((time, index) => (
    index > 0 && time < forecastTimes[index - 1]
  ));
  if (outOfOrder) failures.push(`${label}: forecast rows are not ordered`);
  if (new Set(forecastTimes).size !== forecasts.length) {
    failures.push(`${label}: duplicate forecast timestamps`);
  }

  const rowIds = forecasts.map((forecast) => forecast.id);
  if (!rowIds.every(isNonEmptyString)) failures.push(`${label}: missing forecast row id`);
  if (new Set(rowIds).size !== rowIds.length) failures.push(`${label}: duplicate forecast row ids`);

  forecasts.forEach((forecast, index) => {
    const rowLabel = `${label}: row ${index}`;
    if (forecast.beach_id !== beach.id) {
      failures.push(`${rowLabel} belongs to ${String(forecast.beach_id)}, expected ${beach.id}`);
    }
    for (const field of ['wave_height', 'water_temp', 'confidence_score'] as const) {
      if (!Object.prototype.hasOwnProperty.call(forecast, field)) {
        failures.push(`${rowLabel} missing ${field}`);
      }
    }
    if (!isValidWaveHeight(forecast.wave_height)) {
      failures.push(`${rowLabel} invalid wave_height`);
    }
    if (!isValidTemperature(forecast.water_temp)) {
      failures.push(`${rowLabel} invalid water_temp`);
    }
    if (
      typeof forecast.confidence_score !== 'number'
      || !Number.isFinite(forecast.confidence_score)
      || forecast.confidence_score < 0
      || forecast.confidence_score > 100
    ) {
      failures.push(`${rowLabel} invalid confidence_score`);
    }
    if (!isNonEmptyString(forecast.data_source)) {
      failures.push(`${rowLabel} missing data_source`);
    }
    if (!Number.isFinite(Date.parse(forecast.created_at ?? ''))) {
      failures.push(`${rowLabel} invalid created_at`);
    }
    if (!Number.isFinite(Date.parse(forecast.updated_at ?? ''))) {
      failures.push(`${rowLabel} invalid updated_at`);
    }
  });

  const horizonStart = now - HORIZON_TOLERANCE_HOURS * HOUR_MS;
  const horizonEnd = now + REQUESTED_FORECAST_DAYS * 24 * HOUR_MS;
  const horizonTimes = forecastTimes.filter((time) => (
    Number.isFinite(time) && time >= horizonStart && time <= horizonEnd
  ));
  const coverageBuckets = Array.from({ length: REQUESTED_FORECAST_DAYS }, (_, dayIndex) => {
    const bucketStart = now + dayIndex * 24 * HOUR_MS;
    const bucketEnd = now + (dayIndex + 1) * 24 * HOUR_MS;
    return horizonTimes.filter((time) => time >= bucketStart && time < bucketEnd).length;
  });
  coverageBuckets.forEach((count, dayIndex) => {
    if (count === 0) failures.push(`${label}: no forecast coverage in day ${dayIndex + 1}`);
  });

  const futureTimes = horizonTimes.filter((time) => time >= now).sort((a, b) => a - b);
  const maxAllowedGap = (FORECAST_CADENCE_HOURS + FORECAST_CADENCE_TOLERANCE_HOURS) * HOUR_MS;
  if (futureTimes.length > 0 && futureTimes[0] - now > maxAllowedGap) {
    failures.push(`${label}: first forecast starts more than 4h from now`);
  }
  const sparseGap = futureTimes.findIndex((time, index) => (
    index > 0 && time - futureTimes[index - 1] > maxAllowedGap
  ));
  if (sparseGap > 0) {
    failures.push(
      `${label}: forecast gap exceeds ${FORECAST_CADENCE_HOURS + FORECAST_CADENCE_TOLERANCE_HOURS}h`,
    );
  }
  const maxFutureTime = futureTimes.at(-1) ?? Number.NaN;
  if (maxFutureTime < now + (REQUESTED_FORECAST_DAYS * 24 - HORIZON_TOLERANCE_HOURS) * HOUR_MS) {
    failures.push(`${label}: forecast horizon ends too early`);
  }

  if (!Number.isFinite(lastUpdated)) failures.push(`${label}: invalid metadata lastUpdated`);
  if (lastUpdated > now + 5 * 60 * 1000) failures.push(`${label}: metadata lastUpdated is in the future`);

  return failures;
}

test.describe("Forecast authority API contracts", () => {
  test("serves a fresh three-day forecast for every public beach @requires-data", async ({
    request,
  }) => {
    test.setTimeout(120_000);

    const beachesResponse = await request.get("/api/beaches");
    expect(beachesResponse.status()).toBe(200);
    const beachesPayload = (await beachesResponse.json()) as BeachesResponse;
    const beaches = beachesPayload.data?.beaches ?? [];
    assertPublicBeachInventory(beaches);
    expect(beachesPayload.data?.count).toBe(beaches.length);

    const validationStart = Date.now();
    const validationResults = await mapWithConcurrency(beaches, 8, async (beach) => {
      try {
        const forecastResponse = await request.get(
          "/api/forecasts/update-enhanced",
          { params: { beachId: beach.id, days: String(REQUESTED_FORECAST_DAYS) } },
        );
        const forecastPayload = (await forecastResponse.json()) as ForecastResponse;
        return validateForecastRows(
          beach,
          forecastPayload,
          forecastResponse.status(),
          validationStart,
        );
      } catch (error) {
        return [`${beach.slug ?? beach.id}: ${error instanceof Error ? error.message : String(error)}`];
      }
    });
    const failures = validationResults.flat();

    expect(validationResults).toHaveLength(EXPECTED_PUBLIC_BEACH_COUNT);
    expect(failures).toEqual([]);

    test.info().annotations.push({
      type: "forecast-authority",
      description: `Fresh three-day forecasts validated for ${beaches.length} public beaches`,
    });
  });

  test("publishes every public beach with a canonical sitemap forecast page @requires-data", async ({
    request,
  }) => {
    const beachesResponse = await request.get("/api/beaches");
    expect(beachesResponse.status()).toBe(200);

    const beachesPayload = (await beachesResponse.json()) as BeachesResponse;
    const beaches = beachesPayload.data?.beaches ?? [];
    assertPublicBeachInventory(beaches);
    expect(beachesPayload.data?.count).toBe(beaches.length);

    const canonicalPaths = beaches.map((beach) => buildBeachUrl(beach));
    expect(canonicalPaths.every((path) => !path.startsWith("/beach/"))).toBe(true);
    expect(new Set(canonicalPaths).size).toBe(EXPECTED_PUBLIC_BEACH_COUNT);

    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBe(200);
    const sitemapPaths = extractSitemapPaths(await sitemapResponse.text());
    const missingPaths = canonicalPaths.filter((path) => !sitemapPaths.has(path));

    test.info().annotations.push({
      type: "forecast-authority",
      description: `Public beaches: ${beaches.length}; canonical sitemap entries: ${sitemapPaths.size}; missing: ${missingPaths.length}`,
    });

    expect(missingPaths).toEqual([]);
  });
});

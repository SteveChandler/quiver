/**
 * Surfline Parity API Tests
 *
 * Opt-in live comparison between Quiver's public forecast API and Surfline's
 * LOTUS wave endpoint. Kept out of the default suite because Surfline's
 * endpoint is third-party, undocumented, and can be blocked independently of
 * Quiver health.
 *
 * Run with:
 * RUN_INFRA_TESTS=true RUN_SURFLINE_PARITY=1 BASE_URL=https://dev.quiversurf.app npx playwright test e2e/api/surfline-parity.spec.ts --workers=1
 *
 * @project auth
 */

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createIsolatedApiContext } from "../utils/api-request-helpers";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RUN_SURFLINE_PARITY = process.env.RUN_SURFLINE_PARITY === "1";

type ComparisonRelation = "exact" | "similar";

type QuiverForecastRow = {
  forecast_at?: string | null;
  wave_height?: string | null;
};

type SurflineWaveRow = {
  timestamp?: number;
  surf?: {
    min?: number;
    max?: number;
    raw?: {
      min?: number;
      max?: number;
    };
  };
};

type ForecastRange = {
  minFt: number;
  maxFt: number;
  midpointFt: number;
};

type SurflineParityTarget = {
  quiverName: string;
  quiverBeachId: string;
  surflineName: string;
  surflineSpotId: string;
  relation: ComparisonRelation;
  maxMidpointDeltaFt: number;
  maxTimestampDeltaHours: number;
};

const SURFLINE_PARITY_TARGETS: SurflineParityTarget[] = [
  {
    quiverName: "Blacks Beach",
    quiverBeachId: "01330afc-00d3-461b-88f3-b173774766f4",
    surflineName: "Blacks Beach",
    surflineSpotId: "5842041f4e65fad6a770883b",
    relation: "exact",
    maxMidpointDeltaFt: 2.5,
    maxTimestampDeltaHours: 4,
  },
  {
    quiverName: "Windansea",
    quiverBeachId: "6f42d47d-215b-47cb-ac14-b83bf8c2a797",
    surflineName: "Blacks Beach",
    surflineSpotId: "5842041f4e65fad6a770883b",
    relation: "similar",
    maxMidpointDeltaFt: 3.5,
    maxTimestampDeltaHours: 4,
  },
  {
    quiverName: "Huntington Beach Pier Southside",
    quiverBeachId: "025cfc18-8357-49d6-994e-e0abf0a16f6d",
    surflineName: "Huntington Beach Pier Southside",
    surflineSpotId: "5842041f4e65fad6a77088ed",
    relation: "exact",
    maxMidpointDeltaFt: 4,
    maxTimestampDeltaHours: 4,
  },
  {
    quiverName: "Huntington Beach Pier",
    quiverBeachId: "071db1df-b5ee-4af6-a022-ea8a09667cbe",
    surflineName: "Huntington Beach Pier Northside",
    surflineSpotId: "5842041f4e65fad6a7708827",
    relation: "similar",
    maxMidpointDeltaFt: 3.5,
    maxTimestampDeltaHours: 4,
  },
  {
    quiverName: "Huntington Beach Pier Northside",
    quiverBeachId: "72726bcb-bed0-4b76-8336-f90d7fb57159",
    surflineName: "Huntington Beach Pier Northside",
    surflineSpotId: "5842041f4e65fad6a7708827",
    relation: "exact",
    maxMidpointDeltaFt: 4,
    maxTimestampDeltaHours: 4,
  },
  {
    quiverName: "The Wedge",
    quiverBeachId: "c2c7cc01-4920-4fd9-941c-68df6b46ced0",
    surflineName: "The Wedge",
    surflineSpotId: "5842041f4e65fad6a77088a9",
    relation: "exact",
    maxMidpointDeltaFt: 3.5,
    maxTimestampDeltaHours: 4,
  },
];
const RELATION_LABELS: Record<ComparisonRelation, string> = {
  exact: "exact",
  similar: "similar-beach",
};

function parseQuiverWaveHeight(value: string | null | undefined): ForecastRange | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "flat") {
    return { minFt: 0, maxFt: 0, midpointFt: 0 };
  }

  const values = normalized
    .match(/\d+(?:\.\d+)?/g)
    ?.map((part) => Number(part))
    .filter((part) => Number.isFinite(part));

  if (!values || values.length === 0) return null;

  const minFt = values[0];
  const maxFt = values.length > 1 ? values[1] : values[0];
  return {
    minFt,
    maxFt,
    midpointFt: (minFt + maxFt) / 2,
  };
}

function parseSurflineWave(row: SurflineWaveRow): ForecastRange | null {
  const displayedMin = row.surf?.min;
  const displayedMax = row.surf?.max;
  const min = Number.isFinite(displayedMin) ? displayedMin : row.surf?.raw?.min;
  const max = Number.isFinite(displayedMax) ? displayedMax : row.surf?.raw?.max;

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return {
    minFt: min as number,
    maxFt: max as number,
    midpointFt: ((min as number) + (max as number)) / 2,
  };
}

function findNearestQuiverForecast(
  forecasts: QuiverForecastRow[],
  surflineTimestampMs: number,
): { forecast: QuiverForecastRow; range: ForecastRange; deltaHours: number } | null {
  const candidates = forecasts.flatMap((forecast) => {
    const forecastAt = forecast.forecast_at ? Date.parse(forecast.forecast_at) : Number.NaN;
    const range = parseQuiverWaveHeight(forecast.wave_height);
    if (!Number.isFinite(forecastAt) || !range) return [];

    return [
      {
        forecast,
        range,
        deltaHours: Math.abs(forecastAt - surflineTimestampMs) / (60 * 60 * 1000),
      },
    ];
  });

  return candidates.sort((a, b) => a.deltaHours - b.deltaHours)[0] ?? null;
}

function buildSurflineWaveUrl(spotId: string): string {
  const url = new URL("https://services.surfline.com/kbyg/spots/forecasts/wave");
  url.searchParams.set("spotId", spotId);
  url.searchParams.set("days", "1");
  url.searchParams.set("intervalHours", "1");
  url.searchParams.set("units[waveHeight]", "FT");
  return url.toString();
}

async function readSurflineWaveResponse(
  page: Page,
  spotId: string,
): Promise<{ status: number; body: string }> {
  const response = await page.goto(buildSurflineWaveUrl(spotId), {
    waitUntil: "domcontentloaded",
  });
  const body = (await page.locator("body").textContent()) ?? "";

  return {
    status: response?.status() ?? 0,
    body,
  };
}

async function fetchQuiverForecasts(
  request: APIRequestContext,
  target: SurflineParityTarget,
): Promise<QuiverForecastRow[]> {
  const response = await request.get("/api/forecasts/update-enhanced", {
    params: {
      beachId: target.quiverBeachId,
      days: "1",
      allowStale: "display",
    },
  });

  expect(response.status(), `${target.quiverName} Quiver forecast status`).toBe(200);

  const payload = await response.json();
  expect(payload.success, `${target.quiverName} Quiver success wrapper`).toBe(true);
  expect(payload.data?.metadata?.missing, `${target.quiverName} Quiver forecast missing`).toBe(false);
  expect(Array.isArray(payload.data?.forecasts), `${target.quiverName} Quiver forecasts array`).toBe(true);

  return payload.data.forecasts as QuiverForecastRow[];
}

async function fetchSurflineWave(
  page: Page,
  target: SurflineParityTarget,
): Promise<{ range: ForecastRange; timestampMs: number }> {
  const response = await readSurflineWaveResponse(page, target.surflineSpotId);

  let payload: any = null;
  try {
    payload = JSON.parse(response.body);
  } catch {
    payload = null;
  }

  expect(
    response.status,
    `${target.quiverName} -> ${target.surflineName} Surfline LOTUS status; body=${response.body.slice(0, 160)}`,
  ).toBe(200);

  const waves = payload?.data?.wave as SurflineWaveRow[] | undefined;
  expect(Array.isArray(waves), `${target.surflineName} Surfline wave rows`).toBe(true);

  const row = waves?.find((candidate) => parseSurflineWave(candidate));
  expect(row, `${target.surflineName} Surfline comparable wave row`).toBeTruthy();

  const timestampSeconds = row?.timestamp;
  expect(Number.isFinite(timestampSeconds), `${target.surflineName} Surfline timestamp`).toBe(true);

  const range = parseSurflineWave(row as SurflineWaveRow);
  expect(range, `${target.surflineName} Surfline wave range`).toBeTruthy();

  return {
    range: range as ForecastRange,
    timestampMs: (timestampSeconds as number) * 1000,
  };
}

async function createSurflinePage(browserContext: BrowserContext): Promise<Page> {
  const page = await browserContext.newPage();
  const response = await page.goto(
    `https://www.surfline.com/surf-report/blacks/${SURFLINE_PARITY_TARGETS[0].surflineSpotId}`,
    { waitUntil: "domcontentloaded" },
  );

  expect(response?.status(), "Surfline browser handshake page status").toBe(200);

  const probe = await readSurflineWaveResponse(page, SURFLINE_PARITY_TARGETS[0].surflineSpotId);
  expect(
    probe.status,
    `Surfline LOTUS endpoint should be reachable after browser handshake; body=${probe.body.slice(0, 160)}`,
  ).toBe(200);

  return page;
}

test.describe("Surfline parity API @infra", () => {
  let quiverRequest: APIRequestContext;
  let surflineContext: BrowserContext;
  let surflinePage: Page;

  test.beforeAll(async ({ browser }) => {
    if (!RUN_SURFLINE_PARITY) return;

    surflineContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    surflinePage = await createSurflinePage(surflineContext);
  });

  test.beforeEach(async ({ playwright }, testInfo) => {
    if (!RUN_SURFLINE_PARITY) {
      throw new Error(
        "Not implemented: live Surfline parity requires RUN_SURFLINE_PARITY=1.",
      );
    }

    quiverRequest = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
      storageState: { cookies: [], origins: [] },
    });
  });

  test.afterEach(async () => {
    await quiverRequest?.dispose();
  });

  test.afterAll(async () => {
    await surflinePage?.close();
    await surflineContext?.close();
  });

  for (const target of SURFLINE_PARITY_TARGETS) {
    test(`${target.quiverName} tracks ${target.relation} Surfline beach ${target.surflineName}`, async () => {
      const [quiverForecasts, surfline] = await Promise.all([
        fetchQuiverForecasts(quiverRequest, target),
        fetchSurflineWave(surflinePage, target),
      ]);

      const nearest = findNearestQuiverForecast(quiverForecasts, surfline.timestampMs);
      expect(nearest, `${target.quiverName} time-aligned Quiver forecast`).toBeTruthy();
      expect(
        nearest?.deltaHours,
        `${target.quiverName} forecast is close enough to Surfline timestamp`,
      ).toBeLessThanOrEqual(target.maxTimestampDeltaHours);

      const midpointDeltaFt = Math.abs((nearest?.range.midpointFt ?? 0) - surfline.range.midpointFt);
      const relationLabel = RELATION_LABELS[target.relation];

      console.log(
        [
          `[surfline-parity] ${target.quiverName} (${relationLabel})`,
          `Quiver=${nearest?.range.minFt.toFixed(1)}-${nearest?.range.maxFt.toFixed(1)}ft`,
          `Surfline ${target.surflineName}=${surfline.range.minFt.toFixed(1)}-${surfline.range.maxFt.toFixed(1)}ft`,
          `midpointDelta=${midpointDeltaFt.toFixed(2)}ft`,
          `timeDelta=${nearest?.deltaHours.toFixed(2)}h`,
        ].join(" | "),
      );

      expect(
        midpointDeltaFt,
        `${target.quiverName} midpoint should stay within ${target.maxMidpointDeltaFt}ft of ${target.surflineName}`,
      ).toBeLessThanOrEqual(target.maxMidpointDeltaFt);
    });
  }

  test("comparison set includes exact and similar beach mappings", async () => {
    const relations = new Set(SURFLINE_PARITY_TARGETS.map((target) => target.relation));

    expect(relations.has("exact")).toBe(true);
    expect(relations.has("similar")).toBe(true);
    expect(SURFLINE_PARITY_TARGETS.length).toBeGreaterThanOrEqual(5);
  });
});

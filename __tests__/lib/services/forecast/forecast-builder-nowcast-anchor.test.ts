/**
 * @jest-environment node
 *
 * Unit tests for nowcast-anchor gating in ForecastBuilder.
 *
 * Two-window design:
 *   - NOWCAST_WINDOW_MS (±1.5h) — which forecast rows the anchor is allowed to override
 *   - ANCHOR_FRESHNESS_MS (6h)  — how old an observation can be and still count as ground truth
 *
 * Rationale for accepting stale obs: when the forecast is demonstrably wrong
 * (NOAA ghost-swell case), a 4h-old buoy reading is still materially closer
 * to reality than the forecast. Swells don't swing 100% in 6h.
 */

import { ForecastBuilder, shouldApplyNowcastAnchor } from "@/lib/services/forecast/forecast-builder";
import type { NowcastAnchor } from "@/lib/services/observations/nowcast-anchor.types";
import type { Beach } from "@/types/database";

const FROZEN_NOW = new Date("2026-04-19T15:00:00Z").getTime();

function makeAnchor(overrides: Partial<NowcastAnchor> = {}): NowcastAnchor {
  return {
    beachId: "beach-x",
    stationId: "46258",
    observedAt: "2026-04-19T14:56:00Z", // 4 min ago
    waveHeightM: 0.8,
    wavePeriodS: 14,
    waveDirectionDeg: 197,
    ...overrides,
  };
}

describe("shouldApplyNowcastAnchor", () => {
  test("false when beach.features is null", () => {
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: null,
        anchor: makeAnchor(),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("false when beach.features lacks observation_anchor flag", () => {
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["something-else"],
        anchor: makeAnchor(),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("false when anchor is missing", () => {
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: undefined,
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("false when forecast row is beyond ±1.5h of now", () => {
    const threeHoursLater = FROZEN_NOW + 3 * 60 * 60 * 1000;
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor(),
        forecastAtMs: threeHoursLater,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("false when observation is older than the 6h freshness cap", () => {
    const sevenHoursAgo = new Date(FROZEN_NOW - 7 * 60 * 60 * 1000).toISOString();
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor({ observedAt: sevenHoursAgo }),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("true when fresh anchor + forecast row is within nowcast window", () => {
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor(),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(true);
  });

  test("true with a 4-hour-stale anchor (CDIP-via-IOOS common case)", () => {
    const fourHoursAgo = new Date(FROZEN_NOW - 4 * 60 * 60 * 1000).toISOString();
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor({ observedAt: fourHoursAgo }),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(true);
  });

  test("true at exactly the 1.5h forecast-window boundary (inclusive)", () => {
    const ninetyMinLater = FROZEN_NOW + 90 * 60 * 1000;
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor(),
        forecastAtMs: ninetyMinLater,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(true);
  });

  test("false on malformed observedAt timestamp", () => {
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor({ observedAt: "not-a-date" }),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });

  test("false when observation timestamp is in the future (clock skew / bad data)", () => {
    const tenMinAhead = new Date(FROZEN_NOW + 10 * 60 * 1000).toISOString();
    expect(
      shouldApplyNowcastAnchor({
        beachFeatures: ["observation_anchor"],
        anchor: makeAnchor({ observedAt: tenMinAhead }),
        forecastAtMs: FROZEN_NOW,
        nowMs: FROZEN_NOW,
      }),
    ).toBe(false);
  });
});

/**
 * End-to-end verification that the anchor actually wins over NOAA components.
 *
 * Regression guard for the blocker caught in code review: passing NOAA
 * components alongside the anchor made the decomposed transform sum over
 * NOAA energies and silently discard the anchor height. These tests run
 * the full ForecastBuilder → real wave-formatters path and assert the
 * resulting `wave_height` string differs materially between the
 * flag-on and flag-off paths, driven by the anchor input when on.
 */
describe("ForecastBuilder nowcast anchor output", () => {
  const NOAA_HS_M = 2.8; // ghost-swell-like NOAA forecast
  const ANCHOR_HS_M = 0.6; // observed ground truth, much lower

  function makeTestBeach(features: string[]): Beach {
    return {
      id: "beach-test",
      name: "Test Beach",
      lat: 32.76,
      lon: -117.25,
      center_lat: 32.76,
      center_lng: -117.25,
      features,
      swell_window_center_deg: 240,
      swell_window_halfwidth_deg: 120,
      terrain_enabled: false,
      shoaling_factors: null,
      deepwater_decay_factor: null,
      swell_access_factors: null,
      wind_exposure_factors: null,
      timezone: "America/Los_Angeles",
    } as unknown as Beach;
  }

  function makeBuilder(): ForecastBuilder {
    return new ForecastBuilder({
      getWaveDirectionText: () => "SW",
      getTideStatusAtTime: () => "Rising",
      getTideHeightAtTime: () => 3.5,
      getNextTideFromTime: () => null,
      getDataQualityScore: () => 85,
    });
  }

  function makeWaveData(nowIso: string) {
    return {
      lat: 32.76,
      lng: -117.25,
      data_source: "NOAA_NWS" as const,
      forecast: [
        {
          timestamp: nowIso,
          forecast_at: nowIso,
          significant_wave_height: NOAA_HS_M,
          peak_wave_period: 12,
          peak_wave_direction: 240,
          swell_1_height: 2.6,
          swell_1_period: 12,
          swell_1_direction: 240,
          swell_2_height: 1.4,
          swell_2_period: 13,
          swell_2_direction: 290,
          wind_wave_height: 1.0,
          wind_wave_period: 6,
          wind_wave_direction: 270,
          data_source: "NOAA_NWS" as const,
        },
      ],
    };
  }

  function extractFt(waveHeight: string | null): number {
    if (!waveHeight) throw new Error(`wave_height is null`);
    const match = waveHeight.match(/([\d.]+)/);
    if (!match) throw new Error(`could not parse wave_height: ${waveHeight}`);
    return parseFloat(match[1]);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-19T15:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("anchor height drives output when gate passes", async () => {
    const nowIso = new Date().toISOString();
    const builder = makeBuilder();

    const withAnchor = await builder.buildForecasts({
      beach: makeTestBeach(["observation_anchor"]),
      waveData: makeWaveData(nowIso),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      nowcastAnchor: {
        beachId: "beach-test",
        stationId: "46258",
        observedAt: nowIso,
        waveHeightM: ANCHOR_HS_M,
        wavePeriodS: 14,
        waveDirectionDeg: 240,
      },
    });

    const withoutAnchor = await builder.buildForecasts({
      beach: makeTestBeach([]),
      waveData: makeWaveData(nowIso),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      nowcastAnchor: {
        beachId: "beach-test",
        stationId: "46258",
        observedAt: nowIso,
        waveHeightM: ANCHOR_HS_M,
        wavePeriodS: 14,
        waveDirectionDeg: 240,
      },
    });

    const anchoredFt = extractFt(withAnchor[0].wave_height);
    const forecastFt = extractFt(withoutAnchor[0].wave_height);

    // Sanity: anchor input is <25% of NOAA input — output must reflect that.
    // A silent-discard bug (the blocker) would make these nearly equal.
    expect(anchoredFt).toBeLessThan(forecastFt * 0.65);
    expect(forecastFt).toBeGreaterThan(5); // NOAA 2.8m Hs → ~6-10 ft face
    expect(anchoredFt).toBeLessThan(4); // 0.6m anchor → ~1-3 ft face
  });

  test("anchor ignored when feature flag absent", async () => {
    const nowIso = new Date().toISOString();
    const builder = makeBuilder();

    const result = await builder.buildForecasts({
      beach: makeTestBeach([]),
      waveData: makeWaveData(nowIso),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      nowcastAnchor: {
        beachId: "beach-test",
        stationId: "46258",
        observedAt: nowIso,
        waveHeightM: ANCHOR_HS_M,
        wavePeriodS: 14,
        waveDirectionDeg: 240,
      },
    });

    // Without the feature flag, NOAA model Hs (2.8m) flows through untouched.
    const ft = extractFt(result[0].wave_height);
    expect(ft).toBeGreaterThan(5);
  });

  test("anchor ignored for forecast rows outside the ±1.5h window", async () => {
    const nowIso = new Date().toISOString();
    const builder = makeBuilder();

    // Row index 1 = +3h ahead, outside NOWCAST_WINDOW_MS (±1.5h).
    const futureIso = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const wave = makeWaveData(nowIso);
    wave.forecast.push({ ...wave.forecast[0], timestamp: futureIso, forecast_at: futureIso });

    const result = await builder.buildForecasts({
      beach: makeTestBeach(["observation_anchor"]),
      waveData: wave,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      nowcastAnchor: {
        beachId: "beach-test",
        stationId: "46258",
        observedAt: nowIso,
        waveHeightM: ANCHOR_HS_M,
        wavePeriodS: 14,
        waveDirectionDeg: 240,
      },
    });

    // Row 0 (now) is anchored; row 1 (+3h) is not.
    const nowFt = extractFt(result[0].wave_height);
    const futureFt = extractFt(result[1].wave_height);
    expect(nowFt).toBeLessThan(futureFt * 0.65);
  });
});

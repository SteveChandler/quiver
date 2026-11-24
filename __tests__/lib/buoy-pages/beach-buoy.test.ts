/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { loadBeachBuoy, type BeachBuoyPayload } from "@/lib/buoy-pages/beach-buoy";
import { createFixtureSource } from "@/lib/buoy-pages/dev-fixture-source";
import type { BuoyPageSource } from "@/lib/buoy-pages/source";
import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";

// The newest capture in the fixtures is 2026-11-11T03:26Z (46225).
const NOW = new Date("2026-11-11T03:46:00Z");
const BEACH_ID = "5a0e0e0e-1111-4222-8333-944444444444";

function source(overrides: Partial<BuoyPageSource> = {}): BuoyPageSource {
  return { ...createFixtureSource({ nowMs: NOW.getTime() }), ...overrides };
}

async function payload(src: BuoyPageSource = source(), now: Date = NOW): Promise<BeachBuoyPayload> {
  const result = await loadBeachBuoy(src, BEACH_ID, now);
  if (result.kind !== "found") throw new Error(`expected found, got ${result.kind}`);
  return result.payload;
}

/** Real response body from a BUOY_PAGES_FIXTURES=1 run; quiver-native copies this file unchanged. */
const SHARED_FIXTURE = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "__tests__", "fixtures", "ndbc-wave-stations", "buoy-pages", "beach-buoy-response.json"),
    "utf8",
  ),
) as { success: boolean; data: BeachBuoyPayload };

function keysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.length > 0 ? [keysDeep(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, keysDeep((value as Record<string, unknown>)[key])]));
  }
  return typeof value;
}

describe("loadBeachBuoy", () => {
  it("returns the forecast buoy with now, reading, trend and 48 h history", async () => {
    const data = await payload();
    expect(data.relation).toBe("forecast_station");
    expect(data.station).toMatchObject({
      id: "ndbc:46225",
      slug: "torrey-pines-outer-ca-46225",
      sourceStationId: "46225",
      hasSwellSplit: true,
      countryCode: "US",
      license: "public-domain-us-gov",
    });
    expect(data.station.webUrl).toMatch(/\/buoys\/station\/torrey-pines-outer-ca-46225$/);
    expect(data.status).toBe("fresh");
    expect(data.observedAt).toBe("2026-11-11T03:26:00.000Z");
    expect(data.now).toMatchObject({ waveHeightM: 1.4, swellHeightM: 1.0, dominantPeriodS: 13 });
    expect(data.reading).toMatch(/^Long-period groundswell leads: 3\.3 ft at 13 s from the W/);
    expect(data.trend?.direction).toBe("steady");
    expect(data.history.length).toBeGreaterThan(40);
    expect(data.history.length).toBeLessThanOrEqual(49);
    const first = Date.parse(data.history[0].t);
    expect(NOW.getTime() - first).toBeLessThanOrEqual(49 * 3600 * 1000);
    expect(Object.keys(data.history[0]).sort()).toEqual(["dpd", "hs", "swH", "swP", "t", "wwH"]);
  });

  it("takes now, observedAt and reading from one row: the split row when the newest wave row has none", async () => {
    const base = createFixtureSource({ nowMs: NOW.getTime() });
    const latest = await base.getLatestObservation("ndbc:46225");
    const split = latest.latestWave as WaveStationObservationRow;
    // A 15-minute latest_obs row 20 minutes later, before .spec adds its split.
    const noSplit: WaveStationObservationRow = {
      ...split,
      observed_at: "2026-11-11T03:46:00.000Z",
      wave_height_m: 1.7,
      swell_height_m: null,
      swell_period_s: null,
      swell_direction_deg: null,
      wind_wave_height_m: null,
      wind_wave_period_s: null,
      wind_wave_direction_deg: null,
      water_temp_c: 18.1,
    };
    const src = source({
      getLatestObservation: async () => ({ latestWave: noSplit, latestAny: noSplit }),
      getObservationHistory: async (id, hours) => [...(await base.getObservationHistory(id, hours)), noSplit],
    });
    const data = await payload(src, new Date("2026-11-11T03:50:00Z"));
    expect(data.observedAt).toBe(split.observed_at);
    expect(data.now?.waveHeightM).toBe(split.wave_height_m);
    expect(data.now?.swellHeightM).toBe(split.swell_height_m);
    expect(data.now?.waterTempC).toBe(split.water_temp_c);
    expect(data.reading).toMatch(/^Long-period groundswell leads: 3\.3 ft/);
  });

  it("has no now, reading or trend when the buoy is offline", async () => {
    const data = await payload(source(), new Date("2026-12-20T00:00:00Z"));
    expect(data.status).toBe("offline");
    expect(data.observedAt).toBeNull();
    expect(data.now).toBeNull();
    expect(data.reading).toBeNull();
    expect(data.trend).toBeNull();
  });

  it("keeps the reading but drops the trend while stale", async () => {
    const data = await payload(source(), new Date("2026-11-11T09:00:00Z"));
    expect(data.status).toBe("stale");
    expect(data.reading).not.toMatch(/last 6 hours/);
    expect(data.trend).toBeNull();
  });

  it("passes beach-not-found and no-station through", async () => {
    await expect(loadBeachBuoy(source({ getStationForBeach: async () => ({ kind: "no-station" }) }), BEACH_ID, NOW))
      .resolves.toEqual({ kind: "no-station" });
    await expect(loadBeachBuoy(source({ getStationForBeach: async () => ({ kind: "beach-not-found" }) }), BEACH_ID, NOW))
      .resolves.toEqual({ kind: "beach-not-found" });
  });

  it("matches the response fixture shared with the native app", async () => {
    expect(SHARED_FIXTURE.success).toBe(true);
    expect(keysDeep(await payload())).toEqual(keysDeep(SHARED_FIXTURE.data));
  });
});

/**
 * @jest-environment node
 *
 * Daily Call on hourly bridged rows. PB Point on Tue 2026-10-27: prod tide rows and series
 * (6.59 ft high at 09:47 PDT, band 2–4 ft), with one clean groundswell and light offshore wind so
 * the tide band is the only cap. On the 3-hourly grid the 11 AM → 2 PM step falls 6.3 → 2.0 ft,
 * through the whole band, so the refiner reads both window edges off the 2 ft floor and the window
 * collapses: no call. Bridged, 1 PM is the first hour back in the band and the call starts there.
 */

import fixture from "@/__tests__/fixtures/tide-swing-20261027.json";
import tideFixture from "@/__tests__/fixtures/tide-swing-20261027-tides.json";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoolBeach } from "@/lib/alerts/user-pool";
import { bridgeDailyCallRows, buildCandidates, type DailyCallProfile } from "@/lib/cron/daily-call-runner";
import { bridgeBeachForecastRows } from "@/lib/services/discovery/hourly-bridge-rows";
import { TideCache } from "@/lib/services/noaa-coops/tide-cache";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const HOUR_MS = 3_600_000;
const alertDate = "2026-10-27";
const now = new Date("2026-10-27T11:00:00.000Z");
const highAt = Date.parse("2026-10-27T16:47:00.000Z");
const beach = fixture.beaches["pb-point"] as unknown as Beach;
const pool: PoolBeach = { beach, relation: "home", distanceMiles: null };
const tides = tideFixture.tides["pb-point"];

const profile: DailyCallProfile = {
  id: "10000000-0000-4000-8000-000000000001",
  homeBeachId: beach.id,
  timezone: "America/Los_Angeles",
  dailyCallTime: "06:00",
  notifPushEnabled: true,
  notifForecastAlerts: true,
  experienceLevel: "intermediate",
  maxDriveMinutes: null,
  location: null,
  homeBeach: beach,
};

/** The day's real rows, tide fields untouched; swell and wind swapped for a clean offshore day. */
const rows: EnhancedForecastEntity[] = (fixture.forecasts["pb-point"] as unknown as EnhancedForecastEntity[])
  .map((row) => ({
    ...row,
    wave_height: "3.5 ft", wave_period: "13s", wave_direction: "SSW",
    swell_1_height: "4 ft", swell_1_period: "13s", swell_1_direction: "SSW",
    swell_2_height: null, swell_2_period: null, swell_2_direction: null,
    wind_wave_height: null, wind_wave_period: null, wind_wave_direction: null,
    wind_speed: "3 mph", wind_direction: "E", wind_direction_deg: 75,
    wave_height_om: 1.1, wave_period_om: 13, wave_direction_om: 200,
    swell_height_om: 1.1, swell_period_om: 13, swell_direction_om: 200, wind_wave_height_om: 0,
  }));

interface Query {
  table: string;
  select: () => Query;
  in: () => Query;
  eq: () => Query;
  gte: (column: string, value: string) => Query;
  lt: (column: string, value: string) => Query;
  order: () => Query;
  range: () => Query;
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function client() {
  const tables: string[] = [];
  const from = jest.fn((table: string) => {
    tables.push(table);
    let start = -Infinity;
    let end = Infinity;
    const query: Query = {
      table,
      select: () => query,
      in: () => query,
      eq: () => query,
      gte: (_column, value) => { start = Date.parse(value); return query; },
      lt: (_column, value) => { end = Date.parse(value); return query; },
      order: () => query,
      range: () => query,
      then: (resolve) => resolve({
        data: table === "enhanced_forecasts"
          ? rows.filter((row) => Date.parse(row.forecast_at) >= start && Date.parse(row.forecast_at) < end)
          : tides
            .filter((sample) => Date.parse(sample.ts) >= start && Date.parse(sample.ts) < end)
            .map((sample) => ({
              beach_id: beach.id, ts: sample.ts, tide_ft: sample.ft, tide_height_m: null,
              source: sample.src, station_id: null, created_at: null,
            })),
        error: null,
      }),
    };
    return query;
  });
  return { supabase: { from } as unknown as SupabaseClient<Database>, tables };
}

async function build() {
  const { supabase, tables } = client();
  const result = await buildCandidates(supabase, new TideCache(), {
    profile, pool: [pool], timezone: "America/Los_Angeles", alertDate, now,
  });
  return { result, tables };
}

const flags = ["HOURLY_BRIDGE_ENABLED", "HOURLY_BRIDGE_SURFACES", "TIDE_SWING_ENABLED"] as const;
const saved = Object.fromEntries(flags.map((name) => [name, process.env[name]]));

function setFlags(values: Partial<Record<(typeof flags)[number], string>>): void {
  for (const name of flags) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
}

afterEach(() => setFlags({}));
afterAll(() => setFlags(saved as Partial<Record<(typeof flags)[number], string>>));

/** The first series hour after the high back under the band max. */
const backInBandAt = Date.parse(tides.find((sample) =>
  Date.parse(sample.ts) > highAt && sample.ft <= (beach.preferred_tide_ft_max ?? Infinity))!.ts);

describe("daily call on hourly bridged rows", () => {
  it("keeps today's 3-hourly result with the flag off: the band-crossing step collapses the window", async () => {
    setFlags({ HOURLY_BRIDGE_SURFACES: "daily-call" });
    const { result, tables } = await build();
    expect(tables).toEqual(["enhanced_forecasts", "tide_forecasts"]);
    expect(result).toEqual({ candidates: [], hadForecasts: true, noInWindowRowCount: 0 });
  });

  it("starts the window after the tide-capped high, from the first bridged hour back in the band", async () => {
    setFlags({ HOURLY_BRIDGE_ENABLED: "true", HOURLY_BRIDGE_SURFACES: "daily-call" });
    const { result, tables } = await build();
    // The tide series loaded for the window refiner is the one the bridge reads.
    expect(tables).toEqual(["enhanced_forecasts", "tide_forecasts"]);
    expect(result.noInWindowRowCount).toBe(0);
    expect(result.candidates).toHaveLength(1);
    const [candidate] = result.candidates as Array<typeof result.candidates[number] & { sourceForecast: EnhancedForecastEntity }>;
    const start = Date.parse(candidate.window.start);
    expect(start).toBeGreaterThan(highAt);
    expect(start).toBe(backInBandAt);
    expect(Date.parse(candidate.window.end)).toBeGreaterThan(start);
    // The 1 PM hour exists only as a bridged row; the call may stand on it.
    expect(backInBandAt % (3 * HOUR_MS)).not.toBe(0);
    expect(candidate.physicalScore).toBeGreaterThanOrEqual(70);
    expect(candidate.sessionDecision).toMatchObject({ verdict: "go" });
  });

  it("is off for other surfaces' flags", async () => {
    setFlags({ HOURLY_BRIDGE_ENABLED: "true", HOURLY_BRIDGE_SURFACES: "discover,week-scout,scored" });
    const bridged = bridgeDailyCallRows(rows, beach, "America/Los_Angeles", null, {
      startMs: Date.parse("2026-10-27T12:00:00Z"), endMs: Date.parse("2026-10-28T03:00:00Z"),
    });
    expect(bridged).toBe(rows);
  });
});

describe("bridgeDailyCallRows", () => {
  const day = { startMs: Date.parse("2026-10-27T12:00:00Z"), endMs: Date.parse("2026-10-28T03:00:00Z") };
  const series = tides.map((sample) => ({ at: sample.ts, heightFt: sample.ft }));
  const bridgedHours = (out: EnhancedForecastEntity[]): string[] => out
    .filter((row) => row.raw_forecast?.hourly_bridge)
    .map((row) => new Date(row.forecast_at).toISOString().slice(11, 13));

  beforeEach(() => setFlags({ HOURLY_BRIDGE_ENABLED: "true", HOURLY_BRIDGE_SURFACES: "daily-call" }));

  it("bridges only hours that overlap usable light, with the series tide", () => {
    // Sunrise is just after 14Z (07:03 PDT), so first light is 13:33Z: the 13Z hour (6 AM PDT)
    // overlaps it and is bridged, as is every gap hour up to sunset.
    const out = bridgeDailyCallRows(rows, beach, "America/Los_Angeles", series, day);
    expect(bridgedHours(out)).toEqual(["13", "14", "16", "17", "19", "20", "22", "23"]);
    expect(out.filter((row) => row.raw_forecast?.hourly_bridge)
      .every((row) => row.raw_forecast?.hourly_bridge?.tide_source === "series")).toBe(true);
    // Stored rows are all kept, in order.
    expect(out.filter((row) => !row.raw_forecast?.hourly_bridge)).toEqual(
      rows.map((row) => expect.objectContaining({ id: row.id })));
  });

  it("bridges the 6 AM PDT hour the same as discovery's usable-light rule", () => {
    // PB Point's sun_times for the day, as discovery reads them.
    const sunTimes = {
      sunrises: [new Date("2026-10-27T14:03:00Z")],
      sunsets: [new Date("2026-10-28T00:56:00Z")],
    };
    const tide = series.map((sample) => ({ ts: sample.at, heightFt: sample.heightFt }));
    const discovery = bridgeBeachForecastRows(rows, { timezone: "America/Los_Angeles", tide, sunTimes, ...day });
    const dailyCall = bridgeDailyCallRows(rows, beach, "America/Los_Angeles", series, day);
    const sixAm = "2026-10-27T13:00:00.000Z";
    const at = (out: EnhancedForecastEntity[]): string[] =>
      out.map((row) => new Date(row.forecast_at).toISOString());
    expect(at(discovery)).toContain(sixAm);
    expect(at(dailyCall)).toContain(sixAm);
    expect(bridgedHours(dailyCall)).toEqual(bridgedHours(discovery));
  });

  it("bridges the whole day window without coordinates", () => {
    const out = bridgeDailyCallRows(rows, { lat: Number.NaN, lon: Number.NaN }, "America/Los_Angeles", series, day);
    expect(bridgedHours(out)).toEqual(["13", "14", "16", "17", "19", "20", "22", "23"]);
  });

  it("falls back to the rows' tide without a series", () => {
    const out = bridgeDailyCallRows(rows, beach, "America/Los_Angeles", null, day);
    expect(out.filter((row) => row.raw_forecast?.hourly_bridge)
      .every((row) => row.raw_forecast?.hourly_bridge?.tide_source === "row_lerp")).toBe(true);
  });
});

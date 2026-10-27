/**
 * @jest-environment node
 *
 * /api/forecasts/scored with HOURLY_BRIDGE_SURFACES=scored: the first 48 h of the response gains
 * bridged hourly slots between the stored 3-hourly rows, read from PB Point's prod rows and tide
 * series for 2026-10-27. Golden windows and hold candidates must end on each slot's own cadence.
 */

import { NextRequest } from "next/server";
import fixture from "@/__tests__/fixtures/tide-swing-20261027.json";
import tideFixture from "@/__tests__/fixtures/tide-swing-20261027-tides.json";
import type { EnhancedForecastEntity } from "@/types/forecast";

const HOUR_MS = 3_600_000;
const beach = fixture.beaches["pb-point"];
const BEACH_ID = beach.id;
const dayRows = fixture.forecasts["pb-point"] as unknown as EnhancedForecastEntity[];
const NOW = Date.parse("2026-10-27T11:30:00.000Z");

const mockEvaluateMajorEventHoldCandidates = jest.fn();
let mockAuthContext: { params: { beachId: string }; user: null; supabase: ReturnType<typeof supabaseFor> };

jest.mock("@ducanh2912/next-pwa", () => ({ __esModule: true, default: () => (config: unknown) => config }));
jest.mock("@sentry/nextjs", () => ({ withSentryConfig: (config: unknown) => config }));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) =>
      handler(request, mockAuthContext),
  };
});
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) => mockEvaluateMajorEventHoldCandidates(input),
}));
jest.mock("@/lib/profile/skill-level", () => ({ getProfileExperienceLevel: jest.fn(async () => "intermediate") }));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (rows: unknown[]) => rows),
}));
jest.mock("@/lib/services/observations/nowcast-anchor", () => ({ fetchLatestObservation: jest.fn(async () => null) }));
jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => {
  const actual = jest.requireActual("@/lib/services/discovery/window-selector/window-scorer");
  return { ...actual, scoreWindowConditionDetails: jest.fn(actual.scoreWindowConditionDetails) };
});

import { scoreWindowConditionDetails } from "@/lib/services/discovery/window-selector/window-scorer";

interface TideRow { beach_id: string; ts: string; tide_ft: number; tide_height_m: null; source: string; station_id: null; created_at: null }

const fixtureTides: TideRow[] = tideFixture.tides["pb-point"].map((sample) => ({
  beach_id: BEACH_ID, ts: sample.ts, tide_ft: sample.ft, tide_height_m: null,
  source: sample.src, station_id: null, created_at: null,
}));

/** `count` 3-hourly rows from `startIso`, cycling the day's real rows' fields. */
function gridRows(startIso: string, count: number): EnhancedForecastEntity[] {
  const startMs = Date.parse(startIso);
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(startMs + index * 3 * HOUR_MS).toISOString();
    return {
      ...dayRows[index % dayRows.length],
      id: `row-${index}`,
      forecast_at: at,
      forecast_date: at.slice(0, 10),
      forecast_time: at.slice(11, 19),
    };
  });
}

/** An hourly semidiurnal series over [startIso, startIso + hours). */
function syntheticTides(startIso: string, hours: number): TideRow[] {
  const startMs = Date.parse(startIso);
  return Array.from({ length: hours }, (_, index) => ({
    beach_id: BEACH_ID,
    ts: new Date(startMs + index * HOUR_MS).toISOString(),
    tide_ft: Math.round((2.5 + 3 * Math.sin((2 * Math.PI * index) / 12.42)) * 100) / 100,
    tide_height_m: null, source: "noaa", station_id: null, created_at: null,
  }));
}

function supabaseFor(rows: EnhancedForecastEntity[], tides: TideRow[] | Error) {
  const tableCalls: string[] = [];
  const tideRanges: Array<{ gte: string; lt: string }> = [];
  const beachChain = {
    select: () => beachChain,
    eq: () => beachChain,
    single: async () => ({ data: beach, error: null }),
  };
  const forecastChain = (() => {
    let start = -Infinity;
    let end = Infinity;
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: (_column: string, value: string) => { start = Date.parse(value); return chain; },
      lt: (_column: string, value: string) => { end = Date.parse(value); return chain; },
      order: () => chain,
      limit: jest.fn(async (limit: number) => ({
        data: rows.filter((row) => Date.parse(row.forecast_at) >= start && Date.parse(row.forecast_at) < end)
          .slice(0, limit),
        error: null,
      })),
    };
    return chain;
  })();
  const tideChain = () => {
    let gte = "";
    let lt = "";
    const chain = {
      select: () => chain,
      in: () => chain,
      gte: (_column: string, value: string) => { gte = value; return chain; },
      lt: (_column: string, value: string) => { lt = value; return chain; },
      order: () => chain,
      range: async () => {
        tideRanges.push({ gte, lt });
        if (tides instanceof Error) return { data: null, error: { message: tides.message } };
        return {
          data: tides.filter((row) => Date.parse(row.ts) >= Date.parse(gte) && Date.parse(row.ts) < Date.parse(lt)),
          error: null,
        };
      },
    };
    return chain;
  };
  return {
    tableCalls,
    tideRanges,
    forecastChain,
    from: jest.fn((table: string) => {
      tableCalls.push(table);
      if (table === "beaches") return beachChain;
      if (table === "tide_forecasts") return tideChain();
      return forecastChain;
    }),
  };
}

interface Slot { forecastAt: string; bridged: boolean; sourceSlotAt?: string; compositeScore: number | null; tideHeight: number }
interface Candidate { candidateId: string; startsAt: string; endsAt: string }

async function get(rows: EnhancedForecastEntity[], tides: TideRow[] | Error, query = "") {
  mockAuthContext = { params: { beachId: BEACH_ID }, user: null, supabase: supabaseFor(rows, tides) };
  const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
  const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}${query}`));
  const text = await response.text();
  const body = JSON.parse(text) as { data: { timeSlots: Slot[]; goldenWindows: Array<{ startTime: string; endTime: string }> } };
  const [[{ candidates }]] = mockEvaluateMajorEventHoldCandidates.mock.calls.slice(-1) as [[{ candidates: Candidate[] }]];
  return { response, body, bytes: Buffer.byteLength(text), candidates, supabase: mockAuthContext.supabase };
}

const flags = ["HOURLY_BRIDGE_ENABLED", "HOURLY_BRIDGE_SURFACES"] as const;
const saved = Object.fromEntries(flags.map((name) => [name, process.env[name]]));
let clock: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  clock = jest.spyOn(Date, "now").mockReturnValue(NOW);
  mockEvaluateMajorEventHoldCandidates.mockImplementation(({ candidates }: { candidates: Candidate[] }) =>
    Promise.resolve(candidates.map(({ candidateId }) => ({
      candidateId,
      evaluation: { outcome: "allow", holdIds: [], holdEpoch: "epoch" },
      recommendationAvailability: { state: "available", holdEpoch: "epoch" },
    }))));
  process.env.HOURLY_BRIDGE_ENABLED = "true";
  process.env.HOURLY_BRIDGE_SURFACES = "scored";
});

afterEach(() => clock.mockRestore());

afterAll(() => {
  for (const name of flags) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

const iso = (value: string): string => new Date(value).toISOString();

describe("scored forecast hourly bridge", () => {
  it("fills the hours between stored rows from the tide series and marks them", async () => {
    const { response, body, supabase } = await get(dayRows, fixtureTides);
    expect(response.status).toBe(200);
    // The hold boundary accepted the hourly bindings: scores survive.
    expect(body.data).toMatchObject({ recommendationAvailability: { state: "available" } });
    const slots = body.data.timeSlots;
    expect(slots.every((slot) => typeof slot.compositeScore === "number")).toBe(true);
    expect(slots).toHaveLength(13);
    expect(slots.filter((slot) => !slot.bridged).map((slot) => slot.forecastAt)).toEqual(dayRows.map((row) => row.forecast_at));
    expect(slots.filter((slot) => !slot.bridged).some((slot) => "sourceSlotAt" in slot)).toBe(false);
    const storedMs = dayRows.map((row) => Date.parse(row.forecast_at));
    // Each bridged hour names the stored row before it: the latest stored row 1–2 h earlier.
    expect(slots.filter((slot) => slot.bridged).map((slot) => [slot.forecastAt, slot.sourceSlotAt]))
      .toEqual(slots.filter((slot) => slot.bridged).map((slot) => {
        const atMs = Date.parse(slot.forecastAt);
        const source = Math.max(...storedMs.filter((ms) => ms < atMs));
        expect(atMs - source).toBeLessThan(3 * HOUR_MS);
        return [slot.forecastAt, dayRows[storedMs.indexOf(source)].forecast_at];
      }));
    // The 10 AM hour (17Z) reads the series at the high, not the chord of the 8 and 11 AM rows (6.1 ft).
    const tenAm = slots.find((slot) => slot.forecastAt === iso("2026-10-27T17:00:00Z"));
    const seriesAt17 = fixtureTides.find((row) => iso(row.ts) === iso("2026-10-27T17:00:00Z"))!.tide_ft;
    expect(tenAm?.tideHeight).toBe(Math.round(seriesAt17 * 10) / 10);
    expect(tenAm?.tideHeight).toBeGreaterThan(6.5);
    // One tide read, one hour either side of the 48 h span from the start of the response.
    expect(supabase.tideRanges).toEqual([{
      gte: new Date(NOW - HOUR_MS).toISOString(),
      lt: new Date(NOW + 24 * HOUR_MS + HOUR_MS).toISOString(),
    }]);
  });

  it("ends hold candidates and golden windows on each slot's own cadence, the stored tail on 3 h", async () => {
    const good = new Set(["13", "14", "15", "23", "00"]);
    jest.mocked(scoreWindowConditionDetails).mockImplementation((forecast) => ({
      ...jest.requireActual("@/lib/services/discovery/window-selector/window-scorer")
        .scoreWindowConditionDetails(forecast, beach, "intermediate"),
      score: good.has(new Date(forecast.forecast_at).toISOString().slice(11, 13)) ? 70 : 40,
    }));
    const { body, candidates } = await get(dayRows, fixtureTides);
    const slotEnds = new Map(candidates.filter((c) => c.candidateId.startsWith("scored-slot:"))
      .map((c) => [iso(c.startsAt), iso(c.endsAt)]));
    expect(slotEnds.get(iso("2026-10-27T12:00:00Z"))).toBe(iso("2026-10-27T13:00:00Z"));
    expect(slotEnds.get(iso("2026-10-27T13:00:00Z"))).toBe(iso("2026-10-27T14:00:00Z"));
    expect(slotEnds.get(iso("2026-10-27T23:00:00Z"))).toBe(iso("2026-10-28T00:00:00Z"));
    // The last stored row follows a bridged hour but is still in effect for its 3-hour step.
    expect(slotEnds.get(iso("2026-10-28T00:00:00Z"))).toBe(iso("2026-10-28T03:00:00Z"));
    expect(body.data.goldenWindows.map(({ startTime, endTime }) => [iso(startTime), iso(endTime)])).toEqual([
      [iso("2026-10-27T13:00:00Z"), iso("2026-10-27T16:00:00Z")],
      [iso("2026-10-27T23:00:00Z"), iso("2026-10-28T03:00:00Z")],
    ]);
    const goldenCandidates = candidates.filter((c) => c.candidateId.startsWith("scored-golden:"));
    expect(goldenCandidates.map((c) => [iso(c.startsAt), iso(c.endsAt)])).toEqual([
      [iso("2026-10-27T13:00:00Z"), iso("2026-10-27T16:00:00Z")],
      [iso("2026-10-27T23:00:00Z"), iso("2026-10-28T03:00:00Z")],
    ]);
  });

  it("withholds only the bridged hour a hold blocks", async () => {
    const blockedAt = iso("2026-10-27T13:00:00Z");
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(({ candidates }: { candidates: Candidate[] }) =>
      Promise.resolve(candidates.map(({ candidateId, startsAt }) => iso(startsAt) === blockedAt && candidateId.startsWith("scored-slot:")
        ? {
            candidateId,
            evaluation: { outcome: "explicit_none", reasonCode: "major_event_hold", holdIds: ["hold"], expiresAt: "2026-10-27T14:00:00.000Z", holdEpoch: "epoch" },
            recommendationAvailability: { state: "none", reasonCode: "major_event_hold", expiresAt: "2026-10-27T14:00:00.000Z", holdEpoch: "epoch" },
          }
        : {
            candidateId,
            evaluation: { outcome: "allow", holdIds: [], holdEpoch: "epoch" },
            recommendationAvailability: { state: "available", holdEpoch: "epoch" },
          })));
    const { body } = await get(dayRows, fixtureTides);
    const slots = body.data.timeSlots;
    expect(slots.filter((slot) => slot.compositeScore === null).map((slot) => iso(slot.forecastAt))).toEqual([blockedAt]);
    expect(slots.find((slot) => iso(slot.forecastAt) === blockedAt)?.bridged).toBe(true);
  });

  it("still covers 24 h on the default response, keeping all 8 stored rows", async () => {
    const rows = gridRows("2026-10-27T12:00:00Z", 12);
    const { body, candidates, supabase } = await get(rows, syntheticTides("2026-10-27T10:00:00Z", 40));
    expect(supabase.forecastChain.limit).toHaveBeenCalledWith(8);
    const slots = body.data.timeSlots;
    expect(slots.filter((slot) => !slot.bridged).map((slot) => slot.forecastAt)).toEqual(rows.slice(0, 8).map((row) => row.forecast_at));
    expect(slots).toHaveLength(22);
    const last = candidates.filter((c) => c.candidateId.startsWith("scored-slot:")).at(-1);
    expect(Date.parse(last?.endsAt ?? "") - Date.parse(rows[0].forecast_at)).toBe(24 * HOUR_MS);
  });

  it("bridges only the first 48 h of a 14-day response and drops no stored row", async () => {
    const start = "2026-10-27T06:00:00Z";
    const rows = gridRows(start, 116);
    const { body, bytes } = await get(rows, syntheticTides("2026-10-27T00:00:00Z", 15 * 24), "?range=14day");
    const slots = body.data.timeSlots;
    const stored = slots.filter((slot) => !slot.bridged);
    const responseStart = NOW - 8 * HOUR_MS;
    expect(stored.map((slot) => slot.forecastAt)).toEqual(rows
      .filter((row) => Date.parse(row.forecast_at) >= responseStart && Date.parse(row.forecast_at) < NOW + 14 * 24 * HOUR_MS)
      .map((row) => row.forecast_at));
    // 48 h from 03:30Z holds the stored rows 06Z…03Z two days on: 15 gaps of two hours each.
    const bridged = slots.filter((slot) => slot.bridged);
    expect(bridged.length).toBe(30);
    expect(Math.max(...bridged.map((slot) => Date.parse(slot.forecastAt)))).toBeLessThan(responseStart + 48 * HOUR_MS);

    expect(slots.every((slot) => typeof slot.compositeScore === "number")).toBe(true);

    process.env.HOURLY_BRIDGE_ENABLED = "false";
    const off = await get(rows, syntheticTides("2026-10-27T00:00:00Z", 15 * 24), "?range=14day");
    expect(off.body.data.timeSlots).toHaveLength(stored.length);
    // A slot is ~0.8 KB: 30 bridged slots on 114 stored add about a quarter (91.5 → 115.2 KB here).
    expect(bytes / off.bytes).toBeLessThan(1.3);
  });

  it("issues no tide read and marks no slot with the flag off", async () => {
    process.env.HOURLY_BRIDGE_SURFACES = "discover,week-scout,daily-call";
    const { body, supabase } = await get(dayRows, fixtureTides);
    expect(supabase.tableCalls).not.toContain("tide_forecasts");
    expect(body.data.timeSlots.map((slot) => slot.bridged)).toEqual(dayRows.map(() => false));
  });

  it("stays 3-hourly when the tide read fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { response, body } = await get(dayRows, new Error("statement timeout"));
    expect(response.status).toBe(200);
    expect(body.data.timeSlots.map((slot) => slot.forecastAt)).toEqual(dayRows.map((row) => row.forecast_at));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tide series read failed"), expect.anything());
    warn.mockRestore();
  });
});

// Round-trips JSON like the real data cache, so a Map or Date in the cached value fails a test.
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: (...args: unknown[]) => Promise<unknown>) =>
    async (...args: unknown[]) => JSON.parse(JSON.stringify(await fn(...args)))),
}));
jest.mock("@/lib/alerts/swell-events/early-look", () => ({
  ...jest.requireActual("@/lib/alerts/swell-events/early-look"),
  fetchWamDays: jest.fn(),
}));
jest.mock("@/lib/alerts/swell-events/detector", () => {
  const actual = jest.requireActual("@/lib/alerts/swell-events/detector");
  return { ...actual, detectBeachSwellEvents: jest.fn(actual.detectBeachSwellEvents) };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import { detectBeachSwellEvents } from "@/lib/alerts/swell-events/detector";
import {
  buildRegionEvents,
  confidenceFor,
  rateRegionEvents,
  type InternalRegionEvent,
  type RatingRow,
  type RegionBuild,
} from "@/lib/alerts/swell-events/regional";
import {
  fetchWamDays,
  historyLine,
  regionModelBuoy,
  type WamDay,
} from "@/lib/alerts/swell-events/early-look";
import type { Database } from "@/types/database";
import {
  FLAT,
  NOW,
  TIMEZONE,
  dayRows,
  localDate,
  localIso as localIsoOf,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";

const REGION = "San Diego";
/** Monday 2026-09-28, three days after NOW. */
const EVENT_DAY = 3;
const DAYS = Array.from({ length: 14 }, (_, index) => index - 2);
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const STORM: PartitionSpec = { heightFt: 7, periodS: 9, direction: 270 };
const SWELL: PartitionSpec = { heightFt: 5, periodS: 15, direction: 270 };

interface Surf {
  wave: string | null;
  wind: string;
}

// Intermediate scores on the storm day (9 s period, tide unknown), from scoreNativeConditionInputs.
const SURF = {
  good79: { wave: "2-3ft", wind: "1 mph" },
  good75: { wave: "2-3ft", wind: "3 mph" },
  good72: { wave: "2-3ft", wind: "5 mph" },
  fair66: { wave: "2-3ft", wind: "8 mph" },
  fair63: { wave: "3-4ft", wind: "10 mph" },
  fair57: { wave: "1-2ft", wind: "3 mph" },
  fair55: { wave: "2-3ft", wind: "14 mph" },
  rideable48: { wave: "1-2ft", wind: "8 mph" },
  meh39: { wave: "0-1ft", wind: "3 mph" },
  blownOut: { wave: "1-2ft", wind: "20 mph" },
  // FAIR (57) for an intermediate; above a beginner's 4 ft ceiling.
  fourToFive: { wave: "4-5ft", wind: "3 mph" },
} satisfies Record<string, Surf>;

let nextId = 0;
function beach(name: string, overrides: Record<string, unknown> = {}) {
  nextId += 1;
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    lat: 32.6 + nextId * 0.05,
    lon: -117.25,
    aspect_deg: 270,
    swell_window_center_deg: 270 as number | null,
    swell_window_halfwidth_deg: 30 as number | null,
    swell_access_factors: null,
    terrain_enabled: false,
    shoaling_factors: null,
    deepwater_decay_factor: null,
    wind_offshore_deg: 90,
    ...overrides,
  };
}
type TestBeach = ReturnType<typeof beach>;

function rowsFor(
  beachId: string,
  options: {
    storm?: boolean | PartitionSpec;
    swell?: boolean | PartitionSpec;
    surf?: Surf;
    surfAt?: (hour: number) => Surf;
    /** Days the event is in the water; the first is its peak. */
    eventDays?: number[];
    surfOn?: (day: number, hour: number) => Surf;
  } = {},
): Array<Record<string, unknown>> {
  const storm = options.storm === true ? STORM : options.storm || null;
  const swell = options.swell === true ? SWELL : options.swell || null;
  const eventDays = options.eventDays ?? [EVENT_DAY];
  return DAYS.flatMap((day) => {
    const eventDay = eventDays.includes(day);
    const primary = (eventDay && (storm ?? swell)) || FLAT;
    const secondary = eventDay && storm && swell ? swell : null;
    return dayRows(day, primary, { noonBumpFt: day === eventDays[0] ? 0.5 : 0, secondary }).map((row, index) => {
      const surf = options.surfOn?.(day, HOURS[index]) ?? options.surfAt?.(HOURS[index]) ?? options.surf ?? SURF.good75;
      return {
        ...row,
        beach_id: beachId,
        wave_height: surf.wave,
        wave_period: null,
        wind_speed: surf.wind,
        tide_height: null,
        tide_status: null,
        data_source: "open-meteo",
      };
    });
  });
}

function client(beaches: TestBeach[], rows: Array<Record<string, unknown>>): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      let ids: string[] | null = null;
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        or: () => query,
        gte: () => query,
        lt: () => query,
        order: () => query,
        in: (_column: string, values: string[]) => {
          ids = values;
          return query;
        },
        range: async (start: number, end: number) => {
          const source = table === "beaches"
            ? beaches
            : rows.filter((row) => !ids || ids.includes(String(row.beach_id)));
          return { data: source.slice(start, end + 1), error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
}

function build(beaches: TestBeach[], rows: Array<Record<string, unknown>>) {
  return buildRegionEvents({ client: client(beaches, rows), region: REGION, now: NOW, timezone: TIMEZONE });
}

function buildAt(beaches: TestBeach[], rows: Array<Record<string, unknown>>, now: Date) {
  return buildRegionEvents({ client: client(beaches, rows), region: REGION, now, timezone: TIMEZONE });
}

function ratingRow(day: number, hour: number, surf: Surf): RatingRow {
  return {
    forecast_at: localIsoOf(day, hour),
    wave_height: surf.wave,
    wave_period: null,
    wind_speed: surf.wind,
    tide_height: null,
    tide_status: null,
    swell_1_period: "9s",
  } as RatingRow;
}

/** A region build by hand, for rating rules that detection fixtures can't shape. */
function builtWith(event: Partial<InternalRegionEvent>, rows: RatingRow[]): RegionBuild {
  const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")].map((item) => ({
    id: item.id,
    name: item.name,
    lat: item.lat,
    lon: item.lon,
    swell_window_center_deg: item.swell_window_center_deg,
    swell_window_halfwidth_deg: item.swell_window_halfwidth_deg,
  }));
  return {
    region: REGION,
    timezone: TIMEZONE,
    buoy: null,
    wamDays: null,
    beaches,
    rowsByBeach: { [beaches[0].id]: rows },
    events: [{
      key: `${REGION}:W:${localDate(EVENT_DAY)}:s`,
      kind: "storm",
      source: "forecast",
      directionDeg: 270,
      directionLabel: "W",
      periodS: 9,
      arrivalAt: localIsoOf(EVENT_DAY, 0),
      peakAt: localIsoOf(EVENT_DAY, 12),
      fadeAt: localIsoOf(EVENT_DAY + 1, 0),
      peakLocalDate: localDate(EVENT_DAY),
      offshoreFt: "8 ft",
      history: null,
      ...event,
    }],
  };
}

function wamDays(overrides: Record<number, Partial<WamDay>>): WamDay[] {
  return Array.from({ length: 16 }, (_, offset) => ({
    localDate: localDate(offset),
    maxHsM: 1,
    peakAt: `${localDate(offset)}T20:00:00.000Z`,
    periodS: 14,
    directionDeg: 270,
    ...overrides[offset],
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 0;
  jest.mocked(fetchWamDays).mockResolvedValue(null);
});

describe("buildRegionEvents + rateRegionEvents", () => {
  it("(a) groups one storm seen by three beaches into one event, rated at the requested beach", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));
    const events = rateRegionEvents(built, { beachId: beaches[1].id, skill: "intermediate", now: NOW });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "storm",
      source: "forecast",
      confidence: "on_the_way",
      leadDays: EVENT_DAY,
      peakLocalDate: localDate(EVENT_DAY),
      directionLabel: "W",
      periodS: 9,
      offshoreFt: "8 ft",
      history: null,
    });
    expect(events[0].key).toMatch(/:s$/);
    expect(events[0].here).toMatchObject({
      beachId: beaches[1].id,
      beachName: "Sunset Cliffs",
      label: "GOOD",
      faceFt: "2-3 ft",
      exposure: "open",
      reason: null,
    });
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      ["region-swell-events", "v2", REGION, "2026-09-25"],
      { revalidate: 10800 },
    );
  });

  it("(b) keeps a swell and a storm on the same day as two events", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true, swell: true })));
    const events = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(events.map((event) => event.kind).sort()).toEqual(["storm", "swell"]);
    expect(events.every((event) => event.peakLocalDate === localDate(EVENT_DAY))).toBe(true);
    const storm = events.find((event) => event.kind === "storm")!;
    const swell = events.find((event) => event.kind === "swell")!;
    expect(storm.key).toBe(`${REGION}:W:${localDate(EVENT_DAY)}:s`);
    expect(swell.key).toBe(`${REGION}:W:${localDate(EVENT_DAY)}`);
    expect(swell.periodS).toBe(15);
  });

  it("(b) never groups a storm with a swell close enough in direction and period to join it", async () => {
    // 10 s and 12 s from 270 the same day: one groupEvents call would fold the swell into the storm.
    const storm10: PartitionSpec = { heightFt: 7, periodS: 10, direction: 270 };
    const swell12: PartitionSpec = { heightFt: 5, periodS: 12, direction: 270 };
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const rows = [
      ...rowsFor(beaches[0].id, { storm: storm10 }),
      ...rowsFor(beaches[1].id, { storm: storm10 }),
      ...rowsFor(beaches[2].id, { swell: swell12 }),
    ];
    const built = await build(beaches, rows);
    const events = rateRegionEvents(built, { beachId: beaches[2].id, skill: "intermediate", now: NOW });

    expect(events.map((event) => [event.kind, event.periodS]).sort()).toEqual([["storm", 10], ["swell", 12]]);
  });

  it("keeps keys unique when two swells share a direction band and peak day", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    // rowsFor only places partitions (`storm` in swell_1, `swell` in swell_2): both are swell-class here.
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: { heightFt: 5, periodS: 12, direction: 270 },
      swell: { heightFt: 5, periodS: 17, direction: 270 },
    }));
    const events = rateRegionEvents(await build(beaches, rows), { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(events.map((event) => [event.kind, event.periodS]).sort()).toEqual([["swell", 12], ["swell", 17]]);
    expect(new Set(events.map((event) => event.key)).size).toBe(2);
    expect(events.map((event) => event.key).sort()).toEqual([`${REGION}:W:${localDate(EVENT_DAY)}`, `${REGION}:W:${localDate(EVENT_DAY)}.2`]);
  });

  it("(c) gives a beach with no swell window the event, with exposure unknown", async () => {
    const noWindow = beach("Mission Beach", { swell_window_center_deg: null, swell_window_halfwidth_deg: null });
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), noWindow];
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));
    const events = rateRegionEvents(built, { beachId: noWindow.id, skill: "intermediate", now: NOW });

    expect(events).toHaveLength(1);
    expect(events[0].here).toMatchObject({
      beachId: noWindow.id,
      label: "GOOD",
      exposure: null,
      reason: "exposure unknown",
    });
    // "exposure unknown" stays on the beach's own line; its working row carries no reason.
    expect(events[0].working.find((rating) => rating.beachId === noWindow.id))
      .toMatchObject({ label: "GOOD", exposure: null, reason: null });
  });

  it("(c) checks wind and size before exposure unknown on a not-working beach with no swell window", async () => {
    const windy = beach("Mission Beach", { swell_window_center_deg: null, swell_window_halfwidth_deg: null });
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), windy];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === windy.id ? SURF.blownOut : SURF.good75,
    }));
    const [event] = rateRegionEvents(await build(beaches, rows), { beachId: windy.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "MEH", exposure: null, reason: "blown out" });
    expect(event.notWorking).toEqual([expect.objectContaining({ beachId: windy.id, reason: "blown out" })]);
  });

  it("leaves out a beach with no usable wave height instead of calling it blown out", async () => {
    const missing = beach("No Height");
    const zero = beach("Zero Height");
    const beaches = [missing, zero, beach("Ocean Beach"), beach("Sunset Cliffs")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === missing.id
        ? { wave: null, wind: "3 mph" }
        : item.id === zero.id ? { wave: "0.0 ft", wind: "3 mph" } : SURF.good75,
    }));
    const built = await build(beaches, rows);

    for (const target of [missing, zero]) {
      const [event] = rateRegionEvents(built, { beachId: target.id, skill: "intermediate", now: NOW });
      expect(event.here).toBeNull();
      const listed = [...event.working, ...event.notWorking].map((rating) => rating.beachId);
      expect(listed).not.toContain(missing.id);
      expect(listed).not.toContain(zero.id);
    }
  });

  it("warns and keeps the region when one beach's detection throws", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const broken = beach("Broken");
    const beaches = [broken, beach("Ocean Beach"), beach("Sunset Cliffs")];
    jest.mocked(detectBeachSwellEvents).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));

    expect(warn).toHaveBeenCalledWith("[regional] detection failed", { beachId: broken.id, error: "Error: boom" });
    expect(built.events).toHaveLength(1);
    warn.mockRestore();
  });

  it("(d) lists working beaches GOOD before FAIR, by score, at most 5, never RIDEABLE or MEH", async () => {
    const surfByName: Record<string, Surf> = {
      "Fair 63": SURF.fair63,
      "Meh 39": SURF.meh39,
      "Good 72": SURF.good72,
      "Fair 55": SURF.fair55,
      "Good 79": SURF.good79,
      "Rideable 48": SURF.rideable48,
      "Fair 66": SURF.fair66,
      "Blown Out": SURF.blownOut,
      "Good 75": SURF.good75,
      "Fair 57": SURF.fair57,
    };
    const beaches = Object.keys(surfByName).map((name) => beach(name));
    const rows = beaches.flatMap((item) => rowsFor(item.id, { storm: true, surf: surfByName[item.name] }));
    const built = await build(beaches, rows);
    const [event] = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.working.map((rating) => [rating.beachName, rating.label])).toEqual([
      ["Good 79", "GOOD"],
      ["Good 75", "GOOD"],
      ["Good 72", "GOOD"],
      ["Fair 66", "FAIR"],
      ["Fair 63", "FAIR"],
    ]);
    expect(event.working.every((rating) => rating.reason === null)).toBe(true);
    // Every daylight hour scores the same, so the window is the whole day: 6 AM to the 6 PM row's end.
    expect(event.working[0].window).toBe("Mon 6 AM–7 PM");
    // RIDEABLE and MEH beaches here match none of the four reasons; only the wind-limited one is listed.
    expect(event.notWorking.map((rating) => [rating.beachName, rating.label, rating.reason])).toEqual([
      ["Blown Out", "MEH", "blown out"],
    ]);
  });

  it("(d) takes the window from the longest run of hours at the beach's label", async () => {
    const peaky = beach("Windansea");
    const rows = rowsFor(peaky.id, {
      storm: true,
      surfAt: (hour) => (hour === 9 || hour === 12 ? SURF.good79 : SURF.fair66),
    });
    const built = await build([peaky, beach("Ocean Beach"), beach("Sunset Cliffs")], rows);
    const [event] = rateRegionEvents(built, { beachId: peaky.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "GOOD", window: "Mon 9 AM–3 PM" });
  });

  it("(d) ends a run on the day's last row one row spacing later, capped at the end of daylight", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    // Without the 6 PM row the 3 PM row is the last of the day: it counts for its 3-hour slot.
    const noSixPm = localIsoOf(EVENT_DAY, 18);
    const rows = beaches.flatMap((item) => rowsFor(item.id, { storm: true }))
      .filter((row) => !(row.beach_id === beaches[0].id && row.forecast_at === noSixPm));
    const [event] = rateRegionEvents(await build(beaches, rows), { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.here?.window).toBe("Mon 6 AM–6 PM");
    // The 6 PM row's slot is cut at 7 PM, where daylight ends.
    expect(event.working.find((rating) => rating.beachId === beaches[1].id)?.window).toBe("Mon 6 AM–7 PM");
  });

  it("(e) gives a sheltered beach scoring MEH the reason small, sheltered", async () => {
    const sheltered = beach("La Jolla Cove", { swell_window_center_deg: 90 });
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), sheltered];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === sheltered.id ? SURF.meh39 : SURF.good75,
    }));
    const built = await build(beaches, rows);
    const [event] = rateRegionEvents(built, { beachId: sheltered.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "MEH", exposure: "shadowed", reason: "small, sheltered" });
    expect(event.notWorking).toEqual([expect.objectContaining({ beachId: sheltered.id, reason: "small, sheltered" })]);
  });

  it("(f) shows a WAM peak 12 days out as an early look with open beaches LIKELY", async () => {
    const open = beach("Ocean Beach");
    const sheltered = beach("La Jolla Cove", { swell_window_center_deg: 90 });
    const beaches = [open, beach("Sunset Cliffs"), sheltered];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({
      11: { maxHsM: 1.2 },
      12: { maxHsM: 2.6, periodS: 9 },
      13: { maxHsM: 1.2 },
    }));
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id)));
    const events = rateRegionEvents(built, { beachId: sheltered.id, skill: "intermediate", now: NOW });
    const buoy = regionModelBuoy(beaches)!;

    expect(buoy.id).toBe("46266");
    expect(fetchWamDays).toHaveBeenCalledWith(buoy, TIMEZONE);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "storm",
      source: "wam",
      confidence: "early_look",
      leadDays: 12,
      peakLocalDate: localDate(12),
      directionLabel: "W",
      periodS: 9,
      arrivalAt: null,
      fadeAt: null,
      offshoreFt: "9 ft",
      history: historyLine(buoy, 2.6, TIMEZONE),
      notWorking: [],
    });
    expect(events[0].key).toMatch(/:s$/);
    expect(events[0].working.map((rating) => [rating.beachName, rating.label, rating.window])).toEqual([
      ["Ocean Beach", "LIKELY", null],
      ["Sunset Cliffs", "LIKELY", null],
    ]);
    expect(events[0].here).toMatchObject({ label: "EARLY LOOK", exposure: "shadowed", reason: "small, sheltered" });
    expect(built.buoy).toEqual({ id: "46266", name: buoy.name });
  });

  it("adds the buoy history line when WAM covers the event's peak day", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ [EVENT_DAY]: { maxHsM: 3.2, periodS: 9 } }));
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));
    const [event] = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    const expected = historyLine(regionModelBuoy(beaches)!, 3.2, TIMEZONE);
    expect(expected).not.toBeNull();
    expect(event.history).toBe(expected);
  });

  it("puts the buoy history line on only the biggest event of a peak day", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ [EVENT_DAY]: { maxHsM: 3.2, periodS: 9 } }));
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: { heightFt: 9, periodS: 9, direction: 270 },
      swell: { heightFt: 4, periodS: 15, direction: 270 },
    }));
    const built = await build(beaches, rows);
    const events = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });
    const storm = events.find((event) => event.kind === "storm")!;
    const swell = events.find((event) => event.kind === "swell")!;

    expect(events.map((event) => event.peakLocalDate)).toEqual([localDate(EVENT_DAY), localDate(EVENT_DAY)]);
    expect(Number.parseFloat(storm.offshoreFt!)).toBeGreaterThan(Number.parseFloat(swell.offshoreFt!));
    expect(storm.history).toBe(historyLine(regionModelBuoy(beaches)!, 3.2, TIMEZONE));
    expect(storm.history).not.toBeNull();
    expect(swell.history).toBeNull();
  });

  it("puts the history line on the swell when the swell is the biggest event of its day", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ [EVENT_DAY]: { maxHsM: 3.2, periodS: 9 } }));
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: { heightFt: 7, periodS: 9, direction: 270 },
      swell: { heightFt: 12, periodS: 15, direction: 270 },
    }));
    const events = rateRegionEvents(await build(beaches, rows), { beachId: beaches[0].id, skill: "intermediate", now: NOW });
    const storm = events.find((event) => event.kind === "storm")!;
    const swell = events.find((event) => event.kind === "swell")!;

    expect(events).toHaveLength(2);
    expect(Number.parseFloat(swell.offshoreFt!)).toBeGreaterThan(Number.parseFloat(storm.offshoreFt!));
    expect(swell.history).not.toBeNull();
    expect(storm.history).toBeNull();
  });

  it("gives a lone event on its day the history line, as before", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ [EVENT_DAY]: { maxHsM: 3.2, periodS: 9 }, 12: { maxHsM: 2.6, periodS: 9 } }));
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));

    const byDate = Object.fromEntries(built.events.map((event) => [event.peakLocalDate, event.history]));
    expect(byDate[localDate(EVENT_DAY)]).not.toBeNull();
    expect(byDate[localDate(12)]).not.toBeNull();
  });

  it("(h) lets a beginner skill turn a FAIR beach into too big for most", async () => {
    const big = beach("Blacks");
    const beaches = [big, beach("Ocean Beach"), beach("Sunset Cliffs")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === big.id ? SURF.fourToFive : SURF.good75,
    }));
    const built = await build(beaches, rows);

    const [intermediate] = rateRegionEvents(built, { beachId: big.id, skill: "intermediate", now: NOW });
    expect(intermediate.here).toMatchObject({ label: "FAIR", faceFt: "4-5 ft", reason: null });
    expect(intermediate.working.map((rating) => rating.beachId)).toContain(big.id);

    const [beginner] = rateRegionEvents(built, { beachId: big.id, skill: "beginner", now: NOW });
    expect(beginner.here).toMatchObject({ label: "MEH", reason: "too big for most" });
    expect(beginner.working.map((rating) => rating.beachId)).not.toContain(big.id);
    expect(beginner.notWorking).toEqual([expect.objectContaining({ beachId: big.id, reason: "too big for most" })]);
  });
});

describe("rateRegionEvents lists", () => {
  it("names one not-working beach per reason before repeating a reason, at most 3", async () => {
    const surfByName: Record<string, Surf> = {
      "Blown A": SURF.blownOut,
      "Blown B": { wave: "1-2ft", wind: "25 mph" },
      // Above an intermediate's 6 ft ceiling: MEH, scored lowest of the four.
      Big: { wave: "7-8ft", wind: "3 mph" },
      Sheltered: SURF.meh39,
    };
    const beaches = Object.keys(surfByName).map((name) => beach(name, name === "Sheltered" ? { swell_window_center_deg: 90 } : {}));
    const rows = beaches.flatMap((item) => rowsFor(item.id, { storm: true, surf: surfByName[item.name] }));
    const built = await build(beaches, rows);
    const [event] = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.notWorking.map((rating) => [rating.beachName, rating.reason])).toEqual([
      ["Blown A", "blown out"],
      ["Big", "too big for most"],
      ["Sheltered", "small, sheltered"],
    ]);
  });

  it("shows a stored single-value height as the app's range and scores the stored number", async () => {
    // Prod stores "2.3 ft": scored at 2.3 ft it is FAIR (63); at the range's 3 ft top it would be GOOD.
    const plain = beach("Plain Height");
    const beaches = [plain, beach("Ocean Beach"), beach("Sunset Cliffs")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === plain.id ? { wave: "2.3 ft", wind: "3 mph" } : SURF.good75,
    }));
    const [event] = rateRegionEvents(await build(beaches, rows), { beachId: plain.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "FAIR", faceFt: "2-3 ft" });
  });

  it("judges the weakest component as a share of its ceiling, not in raw points", async () => {
    // 9 mph: 8.9 of 25 wind points (36%) sits above the tide's 7 of 10 in raw points but below it as a share.
    const breezy = beach("Breezy");
    const beaches = [breezy, beach("Ocean Beach"), beach("Sunset Cliffs")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === breezy.id ? { wave: "1-2ft", wind: "9 mph" } : SURF.good75,
    }));
    const [event] = rateRegionEvents(await build(beaches, rows), { beachId: breezy.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "RIDEABLE", reason: "blown out" });
  });

  it("calls a face over the skill's ideal range too big when size is the weakest part, even inside its band", async () => {
    // 6 ft is the top of an intermediate's acceptable band, so it scores in band with no size points.
    const top = beach("Top Of Range");
    const beaches = [top, beach("Ocean Beach"), beach("Sunset Cliffs")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, {
      storm: true,
      surf: item.id === top.id ? { wave: "5-6ft", wind: "3 mph" } : SURF.good75,
    }));
    const [event] = rateRegionEvents(await build(beaches, rows), { beachId: top.id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "MEH", faceFt: "5-6 ft", reason: "too big for most" });
  });

  it("drops an event once it has faded, counting lead days from the request's now", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));
    const day = 24 * 60 * 60 * 1000;

    const twoDaysOn = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: new Date(NOW.getTime() + 2 * day) });
    expect(twoDaysOn.map((event) => event.leadDays)).toEqual([EVENT_DAY - 2]);
    expect(rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: new Date(NOW.getTime() + 4 * day) }))
      .toEqual([]);
  });
});

describe("event window rating", () => {
  const twoDayStorm = (beachId: string, surfOn?: (day: number, hour: number) => Surf) =>
    rowsFor(beachId, { storm: true, eventDays: [EVENT_DAY, EVENT_DAY + 1], surfOn });

  it("rates a beach across the event's whole window, not only its peak day", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const rows = beaches.flatMap((item) => twoDayStorm(item.id, (day) => (day === EVENT_DAY + 1 ? SURF.good79 : SURF.fair66)));
    const built = await build(beaches, rows);
    const [event] = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: NOW });

    expect(event).toMatchObject({
      peakLocalDate: localDate(EVENT_DAY),
      arrivalAt: localIsoOf(EVENT_DAY, 0),
      fadeAt: localIsoOf(EVENT_DAY + 2, 0),
    });
    expect(event.here).toMatchObject({ label: "GOOD", window: "Tue 6 AM–7 PM" });
    // Only daylight rows inside the event's window are kept for rating.
    const daylight = [6, 9, 12, 15, 18];
    expect(built.rowsByBeach[beaches[0].id].map((row) => row.forecast_at)).toEqual([
      ...daylight.map((hour) => localIsoOf(EVENT_DAY, hour)),
      ...daylight.map((hour) => localIsoOf(EVENT_DAY + 1, hour)),
    ]);
  });

  it("leaves out hours before arrival and from the fade on, even on the peak day", () => {
    const built = builtWith(
      { arrivalAt: localIsoOf(EVENT_DAY, 9), fadeAt: localIsoOf(EVENT_DAY, 15) },
      [
        ratingRow(EVENT_DAY, 6, SURF.good79),
        ratingRow(EVENT_DAY, 9, SURF.fair66),
        ratingRow(EVENT_DAY, 12, SURF.fair63),
        ratingRow(EVENT_DAY, 15, SURF.good79),
        ratingRow(EVENT_DAY, 18, SURF.good79),
      ],
    );
    const [event] = rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "FAIR", window: "Mon 9 AM–3 PM" });
  });

  it("uses peak − 12 h to peak + 24 h when the event has no arrival or fade", () => {
    const built = builtWith(
      { arrivalAt: null, fadeAt: null },
      [
        ratingRow(EVENT_DAY - 1, 18, SURF.good79),
        ratingRow(EVENT_DAY, 6, SURF.fair66),
        ratingRow(EVENT_DAY + 1, 6, SURF.fair66),
        ratingRow(EVENT_DAY + 1, 9, SURF.good75),
        ratingRow(EVENT_DAY + 1, 15, SURF.good79),
      ],
    );
    const [event] = rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({ label: "GOOD", window: "Tue 9 AM–12 PM" });
  });

  it("ends a run at the end of its day instead of joining daylight across the night", () => {
    const built = builtWith(
      { fadeAt: localIsoOf(EVENT_DAY + 2, 0) },
      [
        ratingRow(EVENT_DAY, 12, SURF.fair66),
        ratingRow(EVENT_DAY, 15, SURF.good79),
        ratingRow(EVENT_DAY, 18, SURF.good79),
        ratingRow(EVENT_DAY + 1, 6, SURF.good79),
        ratingRow(EVENT_DAY + 1, 9, SURF.good79),
        ratingRow(EVENT_DAY + 1, 12, SURF.fair66),
      ],
    );
    const [event] = rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: NOW });

    // Two runs of two rows; the earlier wins the tie, and its 6 PM row stops at 7 PM.
    expect(event.here).toMatchObject({ label: "GOOD", window: "Mon 3–7 PM" });
  });

  it("rates an event still in the water from its remaining hours, not hours already past", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const rows = beaches.flatMap((item) => twoDayStorm(item.id, (day) => (day === EVENT_DAY ? SURF.good79 : SURF.fair66)));
    const built = await build(beaches, rows);
    const [event] = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: new Date(localIsoOf(EVENT_DAY + 1, 8)) });

    expect(event.here).toMatchObject({ label: "FAIR", window: "Tue 9 AM–7 PM" });
  });

  it("gives each rated beach the instants of the same run its window string names", () => {
    const built = builtWith(
      { fadeAt: localIsoOf(EVENT_DAY + 2, 0) },
      [
        ratingRow(EVENT_DAY, 12, SURF.fair66),
        ratingRow(EVENT_DAY, 15, SURF.good79),
        ratingRow(EVENT_DAY, 18, SURF.good79),
        ratingRow(EVENT_DAY + 1, 6, SURF.good79),
        ratingRow(EVENT_DAY + 1, 9, SURF.good79),
        ratingRow(EVENT_DAY + 1, 12, SURF.fair66),
      ],
    );
    const [event] = rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: NOW });

    // The earlier of two tied runs; its 6 PM row stops at 7 PM, where daylight ends.
    expect(event.here).toMatchObject({
      window: "Mon 3–7 PM",
      windowStartAt: localIsoOf(EVENT_DAY, 15),
      windowEndAt: localIsoOf(EVENT_DAY, 19),
    });
    // A working row keeps the bounds but, as before, no reason.
    expect(event.working).toEqual([expect.objectContaining({
      beachId: built.beaches[0].id,
      reason: null,
      window: "Mon 3–7 PM",
      windowStartAt: localIsoOf(EVENT_DAY, 15),
      windowEndAt: localIsoOf(EVENT_DAY, 19),
    })]);
  });

  it("gives a mid-day run's end as the next row's instant", () => {
    const built = builtWith(
      {},
      [
        ratingRow(EVENT_DAY, 6, SURF.fair66),
        ratingRow(EVENT_DAY, 9, SURF.good79),
        ratingRow(EVENT_DAY, 12, SURF.good79),
        ratingRow(EVENT_DAY, 15, SURF.fair66),
      ],
    );
    const [event] = rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: NOW });

    expect(event.here).toMatchObject({
      window: "Mon 9 AM–3 PM",
      windowStartAt: localIsoOf(EVENT_DAY, 9),
      windowEndAt: localIsoOf(EVENT_DAY, 15),
    });
  });

  it("leaves the window bounds null on an early look's ratings", async () => {
    const sheltered = beach("La Jolla Cove", { swell_window_center_deg: 90 });
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), sheltered];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ 12: { maxHsM: 2.6, periodS: 9 } }));
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id)));
    const [event] = rateRegionEvents(built, { beachId: sheltered.id, skill: "intermediate", now: NOW });

    expect(event.source).toBe("wam");
    const ratings = [event.here!, ...event.working];
    expect(ratings).toHaveLength(3);
    for (const rating of ratings) {
      expect(rating).toMatchObject({ window: null, windowStartAt: null, windowEndAt: null });
    }
  });
});

describe("event currency", () => {
  it("keeps an event still in the water after its peak day, at 0 lead days", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, { storm: true, eventDays: [EVENT_DAY, EVENT_DAY + 1] }));
    const now = new Date(localIsoOf(EVENT_DAY + 1, 8));
    const built = await buildAt(beaches, rows, now);
    const events = rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now });

    expect(events).toEqual([expect.objectContaining({
      kind: "storm",
      peakLocalDate: localDate(EVENT_DAY),
      leadDays: 0,
      confidence: "on_the_way",
    })]);
  });

  it("re-checks a cached event at serve time: kept until it fades, then dropped", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const rows = beaches.flatMap((item) => rowsFor(item.id, { storm: true, eventDays: [EVENT_DAY, EVENT_DAY + 1] }));
    const built = await build(beaches, rows);
    const rate = (iso: string) => rateRegionEvents(built, { beachId: beaches[0].id, skill: "intermediate", now: new Date(iso) });

    expect(built.events[0].fadeAt).toBe(localIsoOf(EVENT_DAY + 2, 0));
    expect(rate(localIsoOf(EVENT_DAY + 1, 17)).map((event) => event.leadDays)).toEqual([0]);
    // Past the last daylight row it has nothing left to show, though it hasn't faded yet.
    expect(rate(localIsoOf(EVENT_DAY + 1, 20))).toEqual([]);
    expect(rate(localIsoOf(EVENT_DAY + 2, 1))).toEqual([]);
  });

  it("keeps an event without a fade until 12 h after its peak", () => {
    const built = builtWith({ source: "wam", arrivalAt: null, fadeAt: null }, []);
    const rate = (iso: string) => rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: new Date(iso) });

    expect(rate(localIsoOf(EVENT_DAY, 23)).map((event) => event.leadDays)).toEqual([0]);
    expect(rate(localIsoOf(EVENT_DAY + 1, 1))).toEqual([]);
  });
});

describe("events with nothing left to show today", () => {
  const rate = (built: RegionBuild, iso: string) =>
    rateRegionEvents(built, { beachId: built.beaches[0].id, skill: "intermediate", now: new Date(iso) });
  const peakDayRows = [9, 12, 15, 18].map((hour) => ratingRow(EVENT_DAY, hour, SURF.good75));

  it("drops a forecast event whose peak has passed and whose window has no daylight row left", () => {
    expect(rate(builtWith({}, peakDayRows), localIsoOf(EVENT_DAY, 20))).toEqual([]);
  });

  it("keeps the same event while a daylight row today is still ahead", () => {
    const [event] = rate(builtWith({}, peakDayRows), localIsoOf(EVENT_DAY, 16));

    expect(event.here).toMatchObject({ label: "GOOD", window: "Mon 6–7 PM" });
  });

  it("keeps an event that still has a rating on a beach other than the requested one", () => {
    const built = builtWith({}, []);
    built.rowsByBeach[built.beaches[1].id] = peakDayRows;
    const [event] = rate(built, localIsoOf(EVENT_DAY, 16));

    expect(event.here).toBeNull();
    expect(event.working.map((rating) => rating.beachName)).toEqual(["Sunset Cliffs"]);
  });

  it("keeps a future event even when no row has a usable height", () => {
    const built = builtWith({}, [ratingRow(EVENT_DAY, 12, { wave: null, wind: "3 mph" })]);
    const [event] = rate(built, NOW.toISOString());

    expect(event).toMatchObject({ leadDays: EVENT_DAY, here: null, working: [], notWorking: [] });
  });

  it("leaves an early look alone once its peak has passed", () => {
    const built = builtWith({ source: "wam", arrivalAt: null, fadeAt: null }, []);
    const [event] = rate(built, localIsoOf(EVENT_DAY, 20));

    expect(event).toMatchObject({ source: "wam", leadDays: 0, here: { label: "LIKELY" } });
  });
});

describe("small regions", () => {
  it("skips the WAM fetch for a region with fewer than 3 beaches", async () => {
    const beaches = [beach("Lone Point"), beach("Second Cove")];
    jest.mocked(fetchWamDays).mockResolvedValue(wamDays({ 12: { maxHsM: 2.6, periodS: 9 } }));
    const built = await build(beaches, beaches.flatMap((item) => rowsFor(item.id, { storm: true })));

    expect(fetchWamDays).not.toHaveBeenCalled();
    expect(built.buoy).toBeNull();
    expect(built.events.every((event) => event.source === "forecast")).toBe(true);
  });
});

describe("confidenceFor", () => {
  it("(g) maps lead days to the global bands", () => {
    expect(confidenceFor(0)).toBe("on_the_way");
    expect(confidenceFor(4)).toBe("on_the_way");
    expect(confidenceFor(5)).toBe("likely");
    expect(confidenceFor(9)).toBe("likely");
    expect(confidenceFor(10)).toBe("early_look");
    expect(confidenceFor(14)).toBe("early_look");
  });
});

/** @jest-environment node */
import {
  countyTransitions, formatRainAdvisoryTime, metarTransitions, rainEventRegion,
  rainAdvisoryEndsLabel, rainAdvisoryExpiresAt,
  type RainAdvisoryEvent,
} from "@/lib/services/water-quality/rain-advisory-events";

const day0 = "2026-10-12T18:00:00.000Z";
const day2 = "2026-10-14T18:00:00.000Z";
const id = "11111111-1111-4111-8111-111111111111";
function active(overrides: Partial<RainAdvisoryEvent> = {}): RainAdvisoryEvent {
  return { id, region: "huntington_newport", source: "metar_runoff", status: "active",
    started_at: day0, last_rain_at: day0, expires_at: "2026-10-15T18:00:00.000Z",
    ended_at: null, end_reason: null, sources: {}, created_at: day0, updated_at: day0, ...overrides };
}

it("opens on rain, extends to the last wet hour, and ends only on complete dry confirmation", () => {
  const opened = metarTransitions({ region: "huntington_newport", windowEnd: day0, totalIn: 0.3,
    lastRainAt: day0, dryConfirmed: false, stations: ["KLGB", "KSNA"] }, null);
  expect(opened[0]).toMatchObject({ kind: "open", event: { started_at: day0,
    expires_at: "2026-10-15T18:00:00.000Z" } });
  const extended = metarTransitions({ region: "huntington_newport", windowEnd: day2, totalIn: 0.25,
    lastRainAt: "2026-10-14T17:00:00.000Z", dryConfirmed: false, stations: ["KLGB", "KSNA"] }, active());
  expect(extended).toEqual([{ kind: "extend", id, last_rain_at: "2026-10-14T17:00:00.000Z",
    expires_at: "2026-10-17T17:00:00.000Z" }]);
  const continued = active({ last_rain_at: "2026-10-14T17:00:00.000Z", expires_at: "2026-10-17T17:00:00.000Z" });
  const dry = (windowEnd: string, dryConfirmed: boolean) => ({ region: continued.region, windowEnd,
    totalIn: 0, lastRainAt: null, dryConfirmed, stations: ["KLGB", "KSNA"] });
  expect(metarTransitions(dry("2026-10-17T16:00:00.000Z", true), continued)).toEqual([]);
  expect(metarTransitions(dry(continued.expires_at, true), continued)).toEqual([
    { kind: "end", id, ended_at: continued.expires_at, end_reason: "dry_72h" },
  ]);
  expect(metarTransitions(dry("2026-10-20T00:00:00.000Z", false), continued)).toEqual([]);
});

it("keeps San Diego County owned and preserves its 72 hour streak floor", () => {
  const county = active({ region: "san_diego", source: "county_general", last_rain_at: null });
  expect(metarTransitions({ region: "san_diego", windowEnd: day0, totalIn: 1,
    lastRainAt: day0, dryConfirmed: false, stations: ["KSAN"] }, null)).toEqual([]);
  expect(countyTransitions({ runFetchedAt: day0, general: true, streakStartedAt: day0,
    sanDiegoRainAt: null }, null, null)[0]).toMatchObject({ kind: "open",
      event: { started_at: day0, last_rain_at: null, expires_at: county.expires_at } });
  expect(metarTransitions({ region: "san_diego", windowEnd: day2, totalIn: 0.1,
    lastRainAt: day2, dryConfirmed: false, stations: ["KSAN"] }, county)).toEqual([
    { kind: "extend", id, last_rain_at: day2, expires_at: "2026-10-17T18:00:00.000Z" },
  ]);
  expect(countyTransitions({ runFetchedAt: day2, general: false, streakStartedAt: null,
    sanDiegoRainAt: null }, county, county)).toEqual([
    { kind: "end", id, ended_at: day2, end_reason: "county_lifted" },
  ]);
  const ended = active({ region: "san_diego", source: "county_general", status: "ended", ended_at: day2,
    end_reason: "county_lifted" });
  expect(countyTransitions({ runFetchedAt: day2, general: true, streakStartedAt: day0,
    sanDiegoRainAt: null }, null, ended)).toEqual([]);
  expect(countyTransitions({ runFetchedAt: "2026-10-15T00:00:00.000Z", general: true,
    streakStartedAt: day0, sanDiegoRainAt: "2026-10-14T19:00:00.000Z" }, null, ended)[0])
    .toMatchObject({ kind: "open", event: { started_at: "2026-10-14T19:00:00.000Z",
      sources: { county: { reopened_after_event_id: id } } } });
  expect(rainAdvisoryExpiresAt("county_general", day2, day0)).toBe("2026-10-17T18:00:00.000Z");
});

it("formats advisory times in California time", () => {
  expect(formatRainAdvisoryTime("2026-10-16T13:00:00Z")).toBe("Fri 6 AM");
  expect(formatRainAdvisoryTime("2026-10-16T21:05:00Z")).toBe("Fri 2:05 PM");
  expect(rainAdvisoryEndsLabel("2026-10-16T13:00:00Z", new Date("2026-10-15T00:00:00Z")))
    .toBe("ends Fri 6 AM if dry");
  expect(rainAdvisoryEndsLabel("2026-10-16T13:00:00Z", new Date("2026-10-16T13:00:00Z"))).toBeNull();
});

it("opens San Diego's own gauge event beside the County's", () => {
  expect(rainEventRegion("san_diego")).toBe("san_diego_gauges");
  expect(rainEventRegion("huntington_newport")).toBe("huntington_newport");
  expect(metarTransitions({ region: "san_diego_gauges", windowEnd: day0, totalIn: 0.23,
    lastRainAt: "2026-10-12T15:00:00.000Z", dryConfirmed: false, stations: ["KSAN"] }, null)[0])
    .toMatchObject({ kind: "open", event: { region: "san_diego_gauges", source: "metar_runoff",
      expires_at: "2026-10-15T15:00:00.000Z" } });
});

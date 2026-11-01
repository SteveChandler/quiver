/** @jest-environment node */
jest.mock("next/cache", () => ({ unstable_cache: jest.fn((fn: unknown) => fn) }));

import type { InternalRegionEvent, RatingRow, RegionBeach, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { narrateRegionEvents, type NarrativeEdition } from "@/lib/alerts/swell-events/regional-narrative";
import { rateRegionEvents } from "@/lib/alerts/swell-events/regional-rating";
import { buildEventCandidates, storyEventsFromRegion } from "@/lib/services/discovery/week-scout-story-candidates";
import { buildRegionGateContext, windBucket } from "@/lib/services/discovery/week-scout-story-region-gate";
import { STORY_SAMPLE_VERSION } from "@/lib/services/discovery/week-scout-story-source";
import type { StoryArtifact, StoryCandidate, StoryInput, StoryWrittenSentence } from "@/lib/services/discovery/week-scout-story-types";
import type { RegionSwellEvent } from "@/types/region-swell-events";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const TIMEZONE = "America/Los_Angeles";
const TODAY = "2026-10-27";
// Tuesday 8 AM in San Diego.
const NOW = new Date("2026-10-27T15:00:00Z");
const SURF = {
  good75: { wave: "2-3ft", wind: "3 mph" },
  good72: { wave: "2-3ft", wind: "5 mph" },
  fair55: { wave: "2-3ft", wind: "14 mph" },
  meh39: { wave: "0-1ft", wind: "3 mph" },
  blownOut: { wave: "1-2ft", wind: "20 mph" },
};
type Surf = (typeof SURF)[keyof typeof SURF];

function beach(id: string, name: string, centerDeg: number): RegionBeach {
  return { id, name, lat: 32.8, lon: -117.2, swell_window_center_deg: centerDeg, swell_window_halfwidth_deg: 20 };
}

/** Daylight rows (9 AM, noon, 3 PM) on each of twelve days from Wednesday. */
function rows(surf: Surf): RatingRow[] {
  return Array.from({ length: 12 }, (_, day) => [16, 19, 22].map((hour) => ({
    forecast_at: new Date(Date.UTC(2026, 9, 28 + day, hour)).toISOString(), wave_height: surf.wave, wave_period: null,
    wind_speed: surf.wind, tide_height: null, tide_status: null, swell_1_period: "9s",
  }) as RatingRow)).flat();
}

function regionEvent(key: string, directionDeg: number, periodS: number, arrivalAt: string, peakAt: string, fadeAt: string | null,
  overrides: Partial<InternalRegionEvent> = {}): InternalRegionEvent {
  return {
    key, kind: "swell", source: "forecast", directionDeg, directionLabel: "X", periodS, arrivalAt, peakAt, fadeAt,
    peakLocalDate: new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(peakAt)),
    offshoreFt: "5 ft", history: null, memberCount: 4, ...overrides,
  };
}

// SSW groundswell: arrives Thursday, peaks Friday, fades Saturday. W storm: arrives Saturday, peaks Sunday, fades Monday.
const SSW = regionEvent("San Diego:SSW:2026-10-30", 202, 13.4, "2026-10-29T15:00:00Z", "2026-10-30T19:00:00Z", "2026-10-31T19:00:00Z");
const STORM = regionEvent("San Diego:W:2026-11-01:s", 270, 7, "2026-10-31T15:00:00Z", "2026-11-01T19:00:00Z", "2026-11-02T19:00:00Z",
  { kind: "storm", directionLabel: "W" });
const EARLY = regionEvent("San Diego:W:2026-11-09", 270, 15, "2026-11-09T20:00:00Z", "2026-11-09T20:00:00Z", null,
  { source: "wam", arrivalAt: null, memberCount: 0 });
const SSW_KEY = "4-4-2026-10-30";
const STORM_KEY = "6-2-2026-11-01-s";
// To the SSW: Ocean Beach, Blacks and Windansea open, La Jolla Shores partial, Sunset Cliffs shadowed.
// To the W: only Sunset Cliffs open.
const BEACHES = [beach("a", "Ocean Beach", 202), beach("b", "Blacks", 202), beach("c", "La Jolla Shores", 232),
  beach("d", "Sunset Cliffs", 292), beach("e", "Windansea", 202)];
const SURF_BY_BEACH: Record<string, Surf> = { a: SURF.good75, b: SURF.fair55, c: SURF.good72, d: SURF.meh39, e: SURF.blownOut };

const BUILD: RegionBuild = {
  region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null, beaches: BEACHES, events: [SSW, STORM, EARLY],
  rowsByBeach: Object.fromEntries(BEACHES.map((item) => [item.id, rows(SURF_BY_BEACH[item.id])])),
};

/** Rated for Sunset Cliffs, which isn't the region's first beach: the input's card lines for the storm leave it out. */
function rated(): RegionSwellEvent[] {
  return rateRegionEvents(BUILD, { beachId: "d", skill: "intermediate", now: NOW });
}

/** The server's card lines as the morning's input carries them. */
function cardFacts(): StoryCandidate[] {
  const { all } = storyEventsFromRegion(BUILD, TODAY);
  return buildEventCandidates(BUILD, all, buildRegionGateContext(BUILD, TODAY), NOW);
}

function edition(written: StoryWrittenSentence[], overrides: { editionDate?: string; copyFacts?: StoryCandidate[];
  selections?: string[]; artifact?: Partial<StoryArtifact>; sample?: string } = {}): NarrativeEdition {
  const editionDate = overrides.editionDate ?? TODAY;
  const copyFacts = overrides.copyFacts ?? cardFacts();
  const selections = overrides.selections ?? copyFacts.map((fact) => fact.id);
  const generatedAt = "2026-10-27T13:00:00.000Z";
  const input: StoryInput = {
    schemaVersion: 3, region: "San Diego", editionDate, sourcePublishedAt: "2026-10-27T12:00:00.000Z",
    validUntil: "2026-10-28T15:00:00.000Z", briefing: { schemaVersion: 3, editionDate, generatedAt, selections: [] }, copyFacts,
    beachNames: Object.fromEntries(BEACHES.map((item) => [item.id, item.name])),
    provenance: { sourceIds: [], sourceHashes: [], generationInputVersion: overrides.sample ?? STORY_SAMPLE_VERSION,
      representativeBeachIds: [], coverageDates: [] },
    inputHash: "input-hash",
  };
  const artifact: StoryArtifact = {
    artifactId: "artifact", schemaVersion: 3, region: "San Diego", editionDate, inputHash: input.inputHash,
    sourcePublishedAt: input.sourcePublishedAt, validUntil: input.validUntil, generationVersion: "week-scout-story-2", model: "gemma",
    briefing: { schemaVersion: 3, editionDate, generatedAt: "2026-10-27T13:05:00.000Z", selections, written }, provenance: input.provenance,
    ...overrides.artifact,
  };
  return { input, artifact };
}

function sentence(slot: string, text: string): StoryWrittenSentence {
  return { slot, basedOn: `event-${slot.split(":").slice(1).join("-")}`, text };
}

function byKey(events: RegionSwellEvent[], key: string): RegionSwellEvent {
  return events.find((event) => event.key === key)!;
}

/** Each listed beach's `why`, from the requested beach's row and the working and not-working rows. */
function whyByBeach(event: RegionSwellEvent): Record<string, string | null | undefined> {
  const listed = [event.here, ...event.working, ...event.notWorking].flatMap((rating) => (rating ? [rating] : []));
  return Object.fromEntries(listed.map((rating) => [rating.beachId, rating.why]));
}

const SSW_STORY = "A south-southwest long-period groundswell arrives Thursday, peaks Friday and fades Saturday.";
const STORM_STORY = "A west short-period storm swell arrives Saturday, peaks Sunday and fades Monday.";
const SSW_WHY = {
  a: "Faces the south-southwest groundswell dead on, with light wind in its window.",
  b: "Faces the south-southwest groundswell dead on, but it's breezy in its window.",
  c: "Partly sheltered from the south-southwest groundswell, with light wind in its window.",
  d: "Sheltered from the south-southwest groundswell, with light wind in its window.",
  // Blown out: its line says the wind is up.
  e: "Faces the south-southwest groundswell dead on, but the wind is up in its window.",
};
// Gemma's sentences: the passing ones claim only what their facts say, in their own words. A beach line keeps its degree word.
const SSW_WRITTEN = "South-southwest groundswell fills in Thursday, tops out Friday and backs off Saturday.";
const OCEAN_BEACH_WRITTEN = "Takes the south-southwest groundswell dead on, and the wind stays light.";

describe("narrateRegionEvents", () => {
  it("gives every forecast event its server story line when there is no edition today", () => {
    const events = narrateRegionEvents({ build: BUILD, rated: rated(), edition: null, now: NOW });

    expect(events.map((event) => [event.key, event.story])).toEqual([
      [SSW.key, SSW_STORY],
      [STORM.key, STORM_STORY],
      [EARLY.key, null],
    ]);
    expect(whyByBeach(byKey(events, SSW.key))).toEqual(SSW_WHY);
    // Every storm row reads its slot's server line, and Sunset Cliffs, which has no card line in the input, gets one too.
    const stormLines = new Map(cardFacts().filter((fact) => fact.slot.startsWith(`event:${STORM_KEY}:beach:`))
      .map((fact) => [fact.slot.split(":beach:")[1], fact.text]));
    expect(stormLines.has("d")).toBe(false);
    expect(whyByBeach(byKey(events, STORM.key))).toEqual({
      ...Object.fromEntries(stormLines),
      d: "Faces the west storm swell at an angle, with light wind in its window.",
    });
    // The early look has no story and no beach lines.
    const early = byKey(events, EARLY.key);
    expect(early.here).toMatchObject({ beachId: "d", why: null });
    expect(early.working.length).toBeGreaterThan(0);
    expect(early.working.every((rating) => rating.why === null)).toBe(true);
    expect(events.flatMap((event) => [event.story ?? "", ...Object.values(whyByBeach(event)).map((why) => why ?? "")])
      .every((text) => !/\d/.test(text))).toBe(true);
  });

  it("uses the PC sentence when it passes, and the server line for a slot whose sentence fails", () => {
    const written = [
      sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN),
      // Names a day the storm's fact doesn't.
      sentence(`event:${STORM_KEY}:story`, "A stormy west swell shows up Friday and tops out Sunday."),
      sentence(`event:${SSW_KEY}:beach:a`, OCEAN_BEACH_WRITTEN),
      // Names a direction Blacks' fact doesn't.
      sentence(`event:${SSW_KEY}:beach:b`, "Faces the west swell head on, but the wind is up."),
      // Drops La Jolla Shores' "partly": it is partly sheltered, not wide open.
      sentence(`event:${SSW_KEY}:beach:c`, "Wide open to the south-southwest, and the wind stays light."),
    ];

    const events = narrateRegionEvents({ build: BUILD, rated: rated(), edition: edition(written), now: NOW });

    expect(byKey(events, SSW.key).story).toBe(SSW_WRITTEN);
    expect(byKey(events, STORM.key).story).toBe(STORM_STORY);
    expect(whyByBeach(byKey(events, SSW.key))).toEqual({ ...SSW_WHY, a: OCEAN_BEACH_WRITTEN });
    expect(byKey(events, EARLY.key).story).toBeNull();
  });

  it("ignores yesterday's edition", () => {
    const written = [sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN), sentence(`event:${SSW_KEY}:beach:a`, OCEAN_BEACH_WRITTEN)];
    // Still within its validity, so only the day turns it away.
    const yesterday = edition(written, { editionDate: "2026-10-26" });
    expect(Date.parse(yesterday.artifact.validUntil)).toBeGreaterThan(NOW.getTime());

    const events = narrateRegionEvents({ build: BUILD, rated: rated(), edition: yesterday, now: NOW });

    expect(byKey(events, SSW.key).story).toBe(SSW_STORY);
    expect(whyByBeach(byKey(events, SSW.key))).toEqual(SSW_WHY);
  });

  it("ignores an edition that has expired, has no written sentences, sits on an old sample or a fixture, or isn't the region's", () => {
    const written = [sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN)];
    const editions = [
      edition(written, { artifact: { validUntil: "2026-10-27T14:59:59.000Z" } }),
      edition(written, { artifact: { generationVersion: "week-scout-story-1" } }),
      edition(written, { artifact: { sourcePublishedAt: "2026-10-27T15:00:01.000Z" } }),
      edition(written, { sample: "regional-swell-events-5" }),
      edition(written, { artifact: { region: "Orange County" } }),
    ];
    expect(narrateRegionEvents({ build: BUILD, rated: rated(), edition: edition(written), now: NOW })[0].story).toBe(SSW_WRITTEN);

    // A fixture input never reaches a reader.
    const fixture = edition(written);
    fixture.input = { ...fixture.input, provenance: { ...fixture.input.provenance, fixture: true } };
    editions.push(fixture);
    for (const item of editions) {
      expect(narrateRegionEvents({ build: BUILD, rated: rated(), edition: item, now: NOW })[0].story).toBe(SSW_STORY);
    }
  });

  it("serves the server line when the sentence's gate fails against this build or its slot wasn't selected", () => {
    const facts = cardFacts();
    // The PC's input saw the swell fade a day later than this build does.
    const moved = facts.map((fact) => (fact.slot === `event:${SSW_KEY}:story` && fact.gate.kind === "swell"
      ? { ...fact, gate: { ...fact.gate, fadeLocalDate: "2026-11-01" } } : fact));
    const written = [sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN), sentence(`event:${SSW_KEY}:beach:a`, OCEAN_BEACH_WRITTEN)];

    const gateMoved = narrateRegionEvents({ build: BUILD, rated: rated(), edition: edition(written, { copyFacts: moved }), now: NOW });
    expect(byKey(gateMoved, SSW.key).story).toBe(SSW_STORY);
    expect(whyByBeach(byKey(gateMoved, SSW.key)).a).toBe(OCEAN_BEACH_WRITTEN);

    const unselected = facts.filter((fact) => fact.slot !== `event:${SSW_KEY}:beach:a`).map((fact) => fact.id);
    const notSelected = narrateRegionEvents({ build: BUILD, rated: rated(), edition: edition(written, { selections: unselected }), now: NOW });
    expect(byKey(notSelected, SSW.key).story).toBe(SSW_WRITTEN);
    expect(whyByBeach(byKey(notSelected, SSW.key)).a).toBe(SSW_WHY.a);
  });

  it("keeps a written sentence to the first event under a shared story key, and words the second from its own direction", () => {
    // A south swell a little behind the SSW one: same sector, period band, peak day and kind, so the same story key.
    const south = regionEvent("San Diego:S:2026-10-30", 190, 13.9, "2026-10-29T15:00:00Z", "2026-10-30T21:00:00Z", "2026-10-31T19:00:00Z");
    const build: RegionBuild = { ...BUILD, events: [SSW, south] };
    const shared = rateRegionEvents(build, { beachId: "d", skill: "intermediate", now: NOW });
    const { all } = storyEventsFromRegion(build, TODAY);
    const facts = buildEventCandidates(build, all, buildRegionGateContext(build, TODAY), NOW);
    expect(facts.filter((fact) => fact.slot.endsWith(":story")).map((fact) => fact.slot)).toEqual([`event:${SSW_KEY}:story`]);

    const events = narrateRegionEvents({ build, rated: shared,
      edition: edition([sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN)], { copyFacts: facts }), now: NOW });

    expect(byKey(events, SSW.key).story).toBe(SSW_WRITTEN);
    expect(byKey(events, south.key).story).toBe("A south long-period groundswell arrives Thursday, peaks Friday and fades Saturday.");
    // La Jolla Shores is partly open to the SSW swell but sheltered from this one.
    expect(whyByBeach(byKey(events, SSW.key)).c).toBe(SSW_WHY.c);
    expect(whyByBeach(byKey(events, south.key)).c).toBe("Sheltered from the south groundswell, with light wind in its window.");
  });

  it("serves server lines, and never throws, for a malformed stored edition", () => {
    const written = [sentence(`event:${SSW_KEY}:story`, SSW_WRITTEN), sentence(`event:${SSW_KEY}:beach:a`, OCEAN_BEACH_WRITTEN)];
    const broken = edition(written);
    broken.input = { ...broken.input, copyFacts: undefined as never };
    // One bad candidate costs only its own slot.
    const facts = cardFacts().map((fact) => (fact.slot === `event:${SSW_KEY}:story` ? { ...fact, text: null as never } : fact));
    const warn = jest.spyOn(console, "warn");
    try {
      const events = narrateRegionEvents({ build: BUILD, rated: rated(), edition: broken, now: NOW });
      expect(byKey(events, SSW.key).story).toBe(SSW_STORY);
      expect(whyByBeach(byKey(events, SSW.key))).toEqual(SSW_WHY);

      const partial = narrateRegionEvents({ build: BUILD, rated: rated(), edition: edition(written, { copyFacts: facts }), now: NOW });
      expect(byKey(partial, SSW.key).story).toBe(SSW_STORY);
      expect(whyByBeach(byKey(partial, SSW.key)).a).toBe(OCEAN_BEACH_WRITTEN);
      // Once per call, however many slots fail.
      expect(warn.mock.calls.filter(([message]) => String(message).includes("story edition unusable"))).toHaveLength(2);
    } finally {
      warn.mockRestore();
    }
    expectConsoleWarnings([/story edition unusable/]);
  });

  it("takes a beach's wind from its rating's own hours, and never calls a blown-out beach light", () => {
    const row = (at: string, wave: string, wind: string): RatingRow => ({ forecast_at: at, wave_height: wave, wave_period: null,
      wind_speed: wind, tide_height: null, tide_status: null, swell_1_period: "9s" }) as RatingRow;
    const hourly = (day: string, hours: number[], wave: string, wind: string) => hours.map((hour) =>
      row(`2026-10-${day}T${String(hour).padStart(2, "0")}:00:00Z`, wave, wind));
    // k: FAIR Thursday at 14 mph, light the rest of the swell (event window light, its FAIR hours breezy).
    // h: Thursday hourly, one 20 mph hour (MEH, "blown out") ahead of six 5 mph hours; its MEH hours average about 7 mph.
    // m: light all through.
    const beaches = [beach("k", "Kellogg", 202), beach("h", "Horseshoe", 202), beach("m", "Marine Street", 202)];
    const build: RegionBuild = { ...BUILD, beaches, events: [SSW], rowsByBeach: {
      k: [...hourly("29", [16, 19, 22], "2-3ft", "14 mph"), ...hourly("30", [16, 19, 22], "0-1ft", "3 mph"),
        ...hourly("31", [16, 18], "0-1ft", "3 mph")],
      h: [...hourly("29", [16], "1-2ft", "20 mph"), ...hourly("29", [17, 18, 19, 20, 21, 22], "0-1ft", "5 mph")],
      m: rows(SURF.good75),
    } };
    const ratedHere = rateRegionEvents(build, { beachId: "k", skill: "intermediate", now: NOW });
    const ratings = new Map([ratedHere[0].here!, ...ratedHere[0].working, ...ratedHere[0].notWorking].map((item) => [item.beachId, item]));
    expect(ratings.get("k")).toMatchObject({ label: "FAIR", reason: null });
    expect(ratings.get("h")).toMatchObject({ label: "MEH", reason: "blown out" });
    const context = buildRegionGateContext(build, TODAY);
    expect(["k", "h", "m"].map((id) => context.wind(SSW_KEY, id))).toEqual(["light", "light", "light"]);
    const ownHours = (id: string) => {
      const rating = ratings.get(id)!;
      return windBucket(build.rowsByBeach[id], Date.parse(rating.windowStartAt!), Date.parse(rating.windowEndAt!));
    };
    expect(["k", "h", "m"].map(ownHours)).toEqual(["breezy", "light", "light"]);

    const { all } = storyEventsFromRegion(build, TODAY);
    const facts = buildEventCandidates(build, all, context, NOW);
    // Every beach line in the input claims the event window's light wind.
    expect(facts.filter((fact) => fact.slot.includes(":beach:")).map((fact) => fact.gate.kind === "beach" && [fact.gate.beachId, fact.gate.wind]))
      .toEqual([["k", "light"], ["m", "light"], ["h", "light"]]);
    const written = ["k", "h", "m"].map((id) => sentence(`event:${SSW_KEY}:beach:${id}`, OCEAN_BEACH_WRITTEN));
    const events = narrateRegionEvents({ build, rated: ratedHere, edition: edition(written, { copyFacts: facts }), now: NOW });

    expect(whyByBeach(events[0])).toEqual({
      // Breezy in its own FAIR hours: Gemma's light-wind line, true of the whole swell, isn't true of them.
      k: "Faces the south-southwest groundswell dead on, but it's breezy in its window.",
      // Its own hours average light, but the rating says blown out: the line says the wind is up, and Gemma's line falls back.
      h: "Faces the south-southwest groundswell dead on, but the wind is up in its window.",
      m: OCEAN_BEACH_WRITTEN,
    });
  });

  it("leaves the rated events it was given untouched", () => {
    const input = rated();
    const before = JSON.stringify(input);
    narrateRegionEvents({ build: BUILD, rated: input, edition: null, now: NOW });
    expect(JSON.stringify(input)).toBe(before);
  });
});

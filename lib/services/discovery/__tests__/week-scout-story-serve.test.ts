const mockActiveRegions = jest.fn();
const mockLatestEdition = jest.fn();
const mockLoadInput = jest.fn();
const mockLatestInput = jest.fn();
const mockBuildInput = jest.fn();
const mockLoadRegion = jest.fn();
jest.mock("@/lib/alerts/swell-events/regional", () => ({
  loadRegionForecastEvents: (...args: unknown[]) => mockLoadRegion(...args),
}));
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryEdition: (...args: unknown[]) => mockLatestEdition(...args),
  loadStoryInput: (...args: unknown[]) => mockLoadInput(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
}));
jest.mock("../week-scout-story-source", () => ({
  ...jest.requireActual("../week-scout-story-source"),
  buildStoryInput: (...args: unknown[]) => mockBuildInput(...args),
  StoryInputError: class StoryInputError extends Error {
    constructor(code: string, readonly status = 503) { super(code); }
  },
  STORY_SAMPLE_VERSION: "regional-swell-events-4",
}));

import { WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";
import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import type { CanonicalWeekScoutResponse } from "../week-scout";
import { bindFallbackStory, bindStory, loadAndBindStory, prepareStory, storyGateHolds, storyRegion } from "../week-scout-story-serve";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "../week-scout-story-types";
import { StoryInputError, storyEventsFromRegion } from "../week-scout-story-source";
import { buildStoryCandidates, storyEventKey } from "../week-scout-story-candidates";
import { addDays } from "../swell-briefing-input";

const HONOLULU = "Pacific/Honolulu";

/** A forecast event in south-shore's region build. */
function regionEvent(directionDeg: number, periodS: number, arrivalAt: string, peakAt: string, fadeAt: string | null,
  overrides: Partial<InternalRegionEvent> = {}): InternalRegionEvent {
  return {
    key: `south-shore:${directionDeg}:${peakAt}`, kind: "swell", source: "forecast", directionDeg, directionLabel: "W",
    periodS, arrivalAt, peakAt, fadeAt, peakLocalDate: new Intl.DateTimeFormat("en-CA", { timeZone: HONOLULU }).format(new Date(peakAt)),
    offshoreFt: "6 ft", history: null, memberCount: 3, ...overrides,
  };
}

function regionBuild(events: InternalRegionEvent[]): RegionBuild {
  return { region: "south-shore", timezone: HONOLULU, buoy: null, wamDays: null, beaches: [], rowsByBeach: {}, events };
}

// The region build's west groundswell: arrives Wednesday, peaks and fades Thursday.
const west = regionEvent(270, 15, "2026-07-15T18:00:00Z", "2026-07-16T18:00:00Z", "2026-07-16T23:00:00Z");
const regionOf = (events: InternalRegionEvent[] = [west], editionDate = "2026-07-15") => storyRegion(regionBuild(events), editionDate);

const baseInput = (): StoryInput => ({
  schemaVersion: 3, region: "south-shore", editionDate: "2026-07-15",
  sourcePublishedAt: "2026-07-15T12:00:00Z", validUntil: "2026-07-17T06:59:59Z", inputHash: "hash",
  briefing: { schemaVersion: 3, editionDate: "2026-07-15", generatedAt: "2026-07-15T12:00:00Z", selections: [] },
  provenance: { sourceIds: ["source"], sourceHashes: ["hash"], generationInputVersion: "1",
    representativeBeachIds: ["beach"], coverageDates: [] },
  copyFacts: [],
});

describe("live regional story binding", () => {
  it("serves a matched directional chapter and projects live picks without freshness fields", () => {
    const gate = { kind: "swell" as const, regionalEventKey: "6-5-2026-07-16", directionSector: 6,
      periodBand: 5, arrivalLocalDate: "2026-07-15", peakLocalDate: "2026-07-16", fadeLocalDate: "2026-07-16",
      confidence: "likely" as const, minimumBeaches: 2 };
    const input = baseInput();
    input.copyFacts = [
      { id: "cover", slot: "cover", text: "A west swell approaches.", gate },
      { id: "lead", slot: "story:lead", text: "The week builds.", gate },
      { id: "chapter", slot: "swell:6-5-2026-07-16", text: "Open breaks feel it first.", gate },
    ];
    const live = { ...WEEK_SCOUT_CONTRACT_FIXTURE, swells: [{
      eventKey: "current-event", directionDeg: 270, directionLabel: "W", periodS: 15,
      arrivalAt: "2026-07-15T18:00:00Z", peakAt: "2026-07-16T18:00:00Z",
      fadeAt: "2026-07-16T23:00:00Z", peakLocalDate: "2026-07-16", timezone: "Pacific/Honolulu",
      confidence: "likely", beaches: [{ exposureLabel: "open" }, { exposureLabel: "open" }],
    }] } as CanonicalWeekScoutResponse;
    const story = bindStory({ region: "south-shore", availability: "ready", input,
      selections: ["cover", "lead", "chapter"], live, regional: regionOf() });
    expect(story).toMatchObject({ availability: "ready", lead: "The week builds.",
      cover: { text: "A west swell approaches.", swells: [{ directionDeg: 270, periodS: 15 }] } });
    expect(story.days[0].pick).toMatchObject({ windowId: "window-a", verdict: "worth_it" });
    expect(JSON.stringify(story)).not.toMatch(/freshness|generatedAt|validUntil/);
    // The region build now peaks the swell Friday; the chart's swell alone proves nothing.
    const moved = regionOf([{ ...west, peakAt: "2026-07-17T18:00:00Z", peakLocalDate: "2026-07-17", fadeAt: null }]);
    expect(bindStory({ region: "south-shore", availability: "ready", input,
      selections: ["cover", "lead", "chapter"], live, regional: moved }).cover.text).toBeNull();
    expect(bindStory({ region: "south-shore", availability: "ready", input,
      selections: ["cover", "lead", "chapter"], live }).cover.text).toBeNull();
  });

  it("requires complete safe coverage for a quiet week and refuses held or missing days", () => {
    const dates = WEEK_SCOUT_CONTRACT_FIXTURE.days.map((day) => day.localDate);
    const gate = { kind: "quiet" as const, fromDate: dates[0], toDate: dates[6], completeDates: dates };
    const input = baseInput();
    input.copyFacts = [{ id: "cover", slot: "cover", text: "A quiet week.", gate },
      { id: "quiet", slot: `quiet:${dates[0]}..${dates[6]}`, text: "No clear pulse.", gate }];
    const live = { ...WEEK_SCOUT_CONTRACT_FIXTURE,
      days: WEEK_SCOUT_CONTRACT_FIXTURE.days.map((day) => ({ ...day, bestDayWindow: null })), swells: [],
      coverage: { expiresAt: "2026-07-22T00:00:00Z", days: dates.map((date) => ({
        localDate: date, eligible: 1, evaluated: 1, missing: 0, excluded: null,
        buckets: [{ bucket: "morning", eligible: 1, evaluated: 1, missing: 0, noWindow: 1, held: 0 }],
      })) },
    } as CanonicalWeekScoutResponse;
    expect(storyGateHolds(gate, live)).toBe(true);
    expect(bindStory({ region: "south-shore", availability: "ready", input,
      selections: ["cover", "quiet"], live }).chapters).toHaveLength(1);
    live.coverage!.days[2].buckets[0].held = 1;
    expect(storyGateHolds(gate, live)).toBe(false);
    expect(bindStory({ region: "south-shore", availability: "ready", input,
      selections: ["cover", "quiet"], live }).availability).toBe("unavailable");
  });
});


describe("deterministic fallback and live gates", () => {
  const now = new Date("2026-07-15T13:00:00Z");
  const region = "south-shore";
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { region }, error: null }) }) }) }) };
  const live = (): CanonicalWeekScoutResponse => {
    const response = JSON.parse(JSON.stringify(WEEK_SCOUT_CONTRACT_FIXTURE)) as CanonicalWeekScoutResponse;
    response.swells = [{
      eventKey: "event", directionDeg: 270, directionLabel: "W", periodS: 15,
      arrivalAt: "2026-07-15T18:00:00Z", peakAt: "2026-07-16T18:00:00Z",
      fadeAt: "2026-07-16T23:00:00Z", peakLocalDate: "2026-07-16", timezone: "Pacific/Honolulu",
      confidence: "likely", beaches: [
        { beachId: "a", exposureLabel: "open" }, { beachId: "b", exposureLabel: "open" },
        { beachId: "c", exposureLabel: "shadowed" },
      ],
    }] as CanonicalWeekScoutResponse["swells"];
    return response;
  };
  const swellGate = { kind: "swell" as const, regionalEventKey: "6-5-2026-07-16", directionSector: 6,
    periodBand: 5, arrivalLocalDate: "2026-07-15", peakLocalDate: "2026-07-16", fadeLocalDate: "2026-07-16",
    confidence: "likely" as const, minimumBeaches: 2 };
  const input = (): StoryInput => {
    const value = baseInput();
    value.copyFacts = [
      { id: "cover", slot: "cover", text: "Specific cover.", gate: swellGate, rank: 0 },
      { id: "cover-alt", slot: "cover", text: "Second cover.", gate: swellGate, rank: 1 },
      { id: "lead", slot: "story:lead", text: "Specific lead.", gate: swellGate, rank: 2 },
      { id: "bad-day", slot: "day:2026-07-15", text: "Wrong wind.", rank: 3,
        gate: { kind: "day", localDate: "2026-07-15", bucket: "evening", reason: "light_wind" } },
      { id: "good-day", slot: "day:2026-07-15", text: "Light morning wind.", rank: 4,
        gate: { kind: "day", localDate: "2026-07-15", bucket: "morning", reason: "light_wind" } },
    ];
    value.provenance.generationInputVersion = "regional-swell-events-4";
    return value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveRegions.mockResolvedValue([{ region, timezone: "Pacific/Honolulu" }]);
    mockLatestEdition.mockResolvedValue(null);
    mockLatestInput.mockResolvedValue(null);
    mockBuildInput.mockImplementation(async () => input());
    mockLoadInput.mockResolvedValue(input());
    mockLoadRegion.mockResolvedValue(regionBuild([west]));
  });

  it("selects first passing candidate per slot, omitting failed gates", () => {
    const story = bindFallbackStory(region, input(), live(), regionOf());
    expect(story).toMatchObject({ availability: "ready", cover: { text: "Specific cover." },
      lead: "Specific lead.", chapters: [{ slot: "day:2026-07-15", text: "Light morning wind." }] });
    const missingCover = input();
    missingCover.copyFacts.filter((fact) => fact.slot === "cover").forEach((fact) => {
      fact.gate = { ...swellGate, periodBand: 4 };
    });
    // No input cover names the region's first event, so the cover is composed from that event.
    expect(bindFallbackStory(region, missingCover, live(), regionOf())).toMatchObject({
      availability: "ready", cover: { text: "A long-period groundswell from the west arrives Wednesday and peaks Thursday." }, lead: "Specific lead.",
    });
  });

  it("builds a no-write fallback without an edition", async () => {
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(story.availability).toBe("ready");
    expect(story.cover.text).toBe("Specific cover.");
    expect(mockBuildInput).toHaveBeenCalledWith(expect.objectContaining({ region, persist: false }));
    await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(mockBuildInput).toHaveBeenCalledTimes(1);
  });

  it("starts the regional build before the live forecast is ready", async () => {
    const date = "2026-07-24";
    mockBuildInput.mockResolvedValue({ ...input(), editionDate: date });
    const bind = await prepareStory({ client: client as never, homeBeachId: "home",
      startLocalDate: date, now: new Date(`${date}T13:00:00Z`) });
    expect(mockBuildInput).toHaveBeenCalledTimes(1);
    expect(mockLoadRegion).toHaveBeenCalledWith({ client, region, now: new Date(`${date}T13:00:00Z`), timezone: HONOLULU });
    expect((await bind(live())).region).toBe(region);
    expect(mockBuildInput).toHaveBeenCalledTimes(1);
  });

  it("omits unmatched regional swell copy without rebuilding for a user's swells", async () => {
    const cached = input();
    cached.briefing.generatedAt = "2026-07-15T12:30:00Z";
    cached.copyFacts.filter((fact) => fact.gate.kind === "swell").forEach((fact) => {
      fact.gate = { ...swellGate, arrivalLocalDate: "2026-07-14" };
    });
    cached.copyFacts.push({ id: "swell", slot: "swell:6-5-2026-07-16", text: "Wrong regional swell.",
      gate: { ...swellGate, arrivalLocalDate: "2026-07-14" } });
    cached.copyFacts.push({ id: "exposure", slot: "swell:6-5-2026-07-16:exposure", text: "Wrong exposure.",
      gate: { kind: "exposure", regionalEventKey: swellGate.regionalEventKey,
        directionSector: 6, exposure: "open", minimumBeaches: 2 } });
    mockLatestInput.mockResolvedValue(cached);
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(story).toMatchObject({ availability: "ready", cover: { text: "A long-period groundswell from the west arrives Wednesday and peaks Thursday." },
      lead: "The west pulse builds from Wednesday into Thursday." });
    expect(story.chapters.every((chapter) => !chapter.slot.startsWith("swell:"))).toBe(true);
    expect(mockBuildInput).not.toHaveBeenCalled();
  });

  it("shares one regional build across concurrent users and does not read forecasts again", async () => {
    const day = new Date("2026-07-19T13:00:00Z");
    const countedClient = { from: jest.fn((_table: string) => client.from()) };
    mockBuildInput.mockImplementation(async ({ client: db }: { client: typeof countedClient }) => {
      for (let index = 0; index < 34; index++) db.from("enhanced_forecasts");
      return { ...input(), editionDate: "2026-07-19" };
    });
    const otherUser = live();
    otherUser.swells = [];
    await Promise.all([live(), otherUser].map((response) => loadAndBindStory({
      client: countedClient as never, homeBeachId: "home", live: response,
      startLocalDate: "2026-07-19", now: day,
    })));
    expect(mockBuildInput).toHaveBeenCalledTimes(1);
    expect(mockBuildInput).toHaveBeenCalledWith({ client: countedClient, region, now: day, persist: false });
    expect(countedClient.from.mock.calls.filter(([table]) => table === "enhanced_forecasts")).toHaveLength(34);
  });

  it.each(["story_source_stale", "story_coverage_sparse", "story_no_candidates"])(
    "caches a %s failure across requests without repeating database reads", async (code) => {
      const date = ({ story_source_stale: "2026-07-20", story_coverage_sparse: "2026-07-21",
        story_no_candidates: "2026-07-22" } as Record<string, string>)[code];
      const countedClient = { from: jest.fn((_table: string) => client.from()) };
      mockBuildInput.mockImplementation(async ({ client: db }: { client: typeof countedClient }) => {
        for (let index = 0; index < 34; index++) db.from("enhanced_forecasts");
        throw new (StoryInputError as unknown as new (code: string, status: number) => Error)(code, 409);
      });
      const stories = await Promise.all([0, 1].map(() => loadAndBindStory({
        client: countedClient as never, homeBeachId: "home", live: live(),
        startLocalDate: date, now: new Date(`${date}T13:00:00Z`),
      })));
      expect(stories.map((story) => story.availability)).toEqual(["unavailable", "unavailable"]);
      expect(mockBuildInput).toHaveBeenCalledTimes(1);
      expect(countedClient.from.mock.calls.filter(([table]) => table === "enhanced_forecasts")).toHaveLength(34);
    });

  it("retries a transient read failure on the next request instead of caching it", async () => {
    const date = "2026-07-23";
    mockBuildInput.mockRejectedValueOnce(
      new (StoryInputError as unknown as new (code: string, status: number) => Error)("story_forecast_read_failed", 503),
    ).mockResolvedValueOnce({ ...input(), editionDate: date });
    const request = () => loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: date, now: new Date(`${date}T13:00:00Z`) }).catch(() => null);
    await request();
    await request();
    expect(mockBuildInput).toHaveBeenCalledTimes(2);
  });

  it("caches under the region's edition date when the user's start date differs", async () => {
    const day = new Date("2026-07-18T13:00:00Z");
    mockBuildInput.mockResolvedValue({ ...input(), editionDate: "2026-07-18" });
    const first = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-17", now: day });
    await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-18", now: day });
    expect(first.availability).toBe("unavailable");
    expect(mockLatestInput).toHaveBeenNthCalledWith(1, client, region, "2026-07-18");
    expect(mockBuildInput).toHaveBeenCalledTimes(1);
  });

  it("drops a later event's weekday even when its region gate holds", () => {
    const regional = regionOf([west, regionEvent(270, 15, "2026-07-17T18:00:00Z", "2026-07-18T18:00:00Z", null)]);
    const inputWithLater = input();
    inputWithLater.copyFacts.unshift({ id: "wrong-cover", slot: "cover", text: "Saturday arrives.", rank: -1,
      gate: { ...swellGate, regionalEventKey: "6-5-2026-07-18", arrivalLocalDate: "2026-07-17",
        peakLocalDate: "2026-07-18", fadeLocalDate: null } });
    expect(bindFallbackStory(region, inputWithLater, live(), regional).cover.text).toBe("Specific cover.");
    expect(bindStory({ region, availability: "ready", input: inputWithLater,
      selections: ["wrong-cover", "lead"], live: live(), regional }).availability).toBe("unavailable");
  });

  it("pins the cover to the region's first in-week event, past one that already peaked", () => {
    const response = live();
    response.swells!.unshift({ ...response.swells![0], eventKey: "outside-week",
      arrivalAt: "2026-07-22T18:00:00Z", peakAt: "2026-07-23T18:00:00Z",
      peakLocalDate: "2026-07-23", fadeAt: null });
    const passed = regionEvent(275, 18, "2026-07-12T18:00:00Z", "2026-07-13T18:00:00Z", "2026-07-14T06:00:00Z");
    const story = bindFallbackStory(region, input(), response, regionOf([passed, west]));
    expect(story.cover.swells[0].eventKey).toBe("event");
    expect(story.cover.text).toBe("Specific cover.");
  });

  it("covers a later regional event when the earliest one has left the region build", () => {
    const signals = Array.from({ length: 7 }, (_, index) => ({
      localDate: addDays("2026-07-15", index), complete: true, sampleBeaches: 3, meanHeightFt: 3,
      directionDeg: 270, periodS: 15, sourceSeries: "enhanced_forecasts:south-shore",
      forecastRevision: "2026-07-15T12:00:00Z",
    }));
    const event = { directionDeg: 270, periodS: 15, arrivalAt: "2026-07-15T18:00:00Z",
      peakAt: "2026-07-16T18:00:00Z", fadeAt: "2026-07-16T23:00:00Z", timezone: "Pacific/Honolulu",
      confidence: "on_the_radar" as const, minimumBeaches: 2, kind: "swell" as const, regionalKey: "south-shore:W:2026-07-16" };
    // A same-day spike that peaked this morning: the input still has it, the current region build does not.
    const spike = { ...event, directionDeg: 275, periodS: 18, arrivalAt: "2026-07-15T17:00:00Z",
      peakAt: "2026-07-15T20:00:00Z", fadeAt: "2026-07-15T23:00:00Z" };
    const value = baseInput();
    value.copyFacts = buildStoryCandidates(signals, region, [spike, event]);
    expect(new Set(value.copyFacts.map((fact) => fact.id)).size).toBe(value.copyFacts.length);
    const story = bindFallbackStory(region, value, live(), regionOf());
    expect(story.cover.text).toBe("A long-period groundswell from the west reaches south-shore Wednesday and peaks Thursday.");
    expect(story.lead).toBe("The west pulse builds from Wednesday into Thursday.");
    expect(story.chapters.map((chapter) => chapter.slot)).toContain("swell:6-5-2026-07-16");
    expect(JSON.stringify(story)).not.toContain("6-6-2026-07-15");

    // A fade a day later than the region's keeps the cover, which names no fade, but not the fade chapter.
    const lateFade = { ...value, copyFacts: buildStoryCandidates(signals, region,
      [spike, { ...event, fadeAt: "2026-07-17T23:00:00Z" }]) };
    const faded = bindFallbackStory(region, lateFade, live(), regionOf());
    expect(faded.cover.text).toBe(story.cover.text);
    expect(faded.lead).toBe(story.lead);
    expect(faded.chapters.some((chapter) => /easing/.test(chapter.text))).toBe(false);

    const onlySpike = { ...value, copyFacts: buildStoryCandidates(signals, region, [spike]) };
    // With only the passed spike offered, the cover comes from the region's first event and names no region.
    expect(bindFallbackStory(region, onlySpike, live(), regionOf())).toMatchObject({
      cover: { text: "A long-period groundswell from the west arrives Wednesday and peaks Thursday." },
      lead: story.lead,
    });
  });

  it("never lets a cover name a compass point the region event has drifted off", () => {
    const value = baseInput();
    value.copyFacts = [{ id: "sw-cover", slot: "cover", text: "Southwest cover.", rank: 0,
      gate: { ...swellGate, regionalEventKey: "5-5-2026-07-16", directionSector: 5, directionIndex: 10,
        periodBand: 5, fadeLocalDate: null } }];
    // 213.7° keeps the sector-five key but rounds to south-southwest, not the southwest the sentence names.
    const drifted = regionOf([{ ...west, directionDeg: 213.7 }]);
    const story = bindFallbackStory(region, value, live(), drifted);
    expect(story.cover.text).toBe("A long-period groundswell from the south-southwest arrives Wednesday and peaks Thursday.");
    expect(story.lead).toBe("The south-southwest pulse builds from Wednesday into Thursday.");
    expect(bindStory({ region, availability: "ready", input: value, selections: ["sw-cover"],
      live: live(), regional: drifted }).availability).toBe("unavailable");
  });

  it("says an event that already arrived is in the water rather than arriving", () => {
    const regional = regionOf([{ ...west, arrivalAt: "2026-07-14T18:00:00Z" }]);
    expect(bindFallbackStory(region, baseInput(), live(), regional).cover.text)
      .toBe("A long-period groundswell from the west is already in the water and peaks Thursday.");
  });

  it("composes headlines without digits and within the native length limit", () => {
    const regional = regionOf([{ ...west, directionDeg: 293, periodS: 9.4 }]);
    const story = bindFallbackStory("Santa Cruz County North Coast", baseInput(), live(), regional);
    for (const text of [story.cover.text, story.lead]) {
      expect(text).toEqual(expect.any(String));
      expect(text!).not.toMatch(/\d/);
      expect(text!.length).toBeLessThanOrEqual(240);
    }
    expect(story.cover.text).toContain("west-northwest");
    expect(story.cover.text).toContain("short-period windswell");
  });

  it("serves a repeated day body only once", () => {
    const issued = input();
    issued.copyFacts.push(
      { id: "day-a", slot: "day:2026-07-15", text: "On Wednesday, the onshore fills in by midday.", gate: swellGate },
      { id: "day-b", slot: "day:2026-07-16", text: "On Thursday, the onshore fills in by midday.", gate: swellGate },
    );
    const story = bindStory({ region, availability: "ready", input: issued,
      selections: ["cover", "lead", "day-a", "day-b"], live: live(), regional: regionOf() });
    expect(story.chapters).toEqual([{ slot: "day:2026-07-15", text: "On Wednesday, the onshore fills in by midday." }]);
  });

  it("serves a verified wind pattern through the turn slot", () => {
    const response = live();
    const template = response.days[0].bestDayWindow!;
    const patternDays = response.days.slice(0, 3).map((day) => {
      const morning = { ...template, id: `${day.localDate}-morning`,
        forecast: { ...template.forecast, windDirection: "NE" } };
      day.windows = [morning, { ...morning, id: `${day.localDate}-midday`, bucket: "midday",
        forecast: { ...morning.forecast, windDirection: "SW" } }];
      return { kind: "wind" as const, localDate: day.localDate, bucket: "midday" as const,
        fromBucket: "morning" as const, fromWindClass: "offshore" as const, windClass: "onshore" as const,
        forecastRevision: "rev", beachId: morning.beachId, fromDirection: "NE", toDirection: "SW" };
    });
    const issued = input();
    issued.copyFacts.push({ id: "pattern", slot: "story:turn", text: "Mornings stay cleaner on several days; the onshore fills in by midday.",
      gate: { kind: "wind_pattern", days: patternDays } });
    const story = bindStory({ region, availability: "ready", input: issued,
      selections: ["cover", "lead", "pattern"], live: response, regional: regionOf() });
    expect(story.turn).toBe("Mornings stay cleaner on several days; the onshore fills in by midday.");
    expect(story.chapters).toEqual([]);
  });

  it("keeps a valid published edition ahead of the fallback", async () => {
    const issued = input();
    const artifact: StoryArtifact = {
      artifactId: "artifact", schemaVersion: 3, region, editionDate: issued.editionDate,
      inputHash: issued.inputHash, sourcePublishedAt: issued.sourcePublishedAt, validUntil: issued.validUntil,
      generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: "worker",
      briefing: { ...issued.briefing, generatedAt: now.toISOString(), selections: ["cover-alt", "lead"] },
      provenance: issued.provenance,
    };
    mockLatestEdition.mockResolvedValue(artifact);
    mockLoadInput.mockResolvedValue(issued);
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(story.cover.text).toBe("Second cover.");
    expect(mockBuildInput).not.toHaveBeenCalled();
  });

  it("does not serve a published edition with the old generic candidate set", async () => {
    const old = input();
    old.provenance.generationInputVersion = "representative-latitude-spread-2";
    old.copyFacts.push({ id: "day-2026-07-15-morning", slot: "day:2026-07-15",
      text: "Wednesday's morning window has light wind and a safe shot at the surf.",
      gate: { kind: "day", localDate: "2026-07-15", bucket: "morning", reason: "light_wind" } });
    mockLatestEdition.mockResolvedValue({ schemaVersion: 3, editionDate: "2026-07-15",
      validUntil: old.validUntil, sourcePublishedAt: old.sourcePublishedAt, inputHash: old.inputHash });
    mockLoadInput.mockResolvedValue(old);
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(story.chapters.some((chapter) => chapter.text.includes("safe shot at the surf"))).toBe(false);
  });

  it("rechecks wind, tide, change, day and origin gates against the chart, never swell, exposure or beach", () => {
    const response = live();
    const window = response.days[0].bestDayWindow!;
    response.days[0].windows.push({ ...window, id: "afternoon", bucket: "midday",
      forecast: { ...window.forecast, windDirection: "SW" } });
    response.days[1].bestDayWindow = { ...window, id: "tomorrow", conditionScore: 60 };
    // The charted swell matches every field of these, but only the region build proves them.
    expect(storyGateHolds(swellGate, response)).toBe(false);
    expect(storyGateHolds({ kind: "exposure", regionalEventKey: swellGate.regionalEventKey,
      directionSector: 6, exposure: "open", minimumBeaches: 2,
      beaches: [{ beachId: "a", exposure: "open" }, { beachId: "c", exposure: "shadowed" }] }, response)).toBe(false);
    expect(storyGateHolds({ kind: "beach", regionalEventKey: swellGate.regionalEventKey, beachId: "a",
      exposure: "open", wind: "light" }, response)).toBe(false);
    expect(storyGateHolds({ kind: "wind", localDate: "2026-07-15", bucket: "midday",
      fromBucket: "morning", fromWindClass: "offshore", windClass: "onshore", forecastRevision: "rev",
      beachId: window.beachId, fromDirection: "NE", toDirection: "SW" }, response)).toBe(true);
    expect(storyGateHolds({ kind: "tide", localDate: "2026-07-15", bucket: "morning",
      tidePhase: "rising", windowOrder: "opens", forecastRevision: "rev", beachId: window.beachId }, response)).toBe(true);
    expect(storyGateHolds({ kind: "change", fromDate: "2026-07-15", toDate: "2026-07-16",
      direction: "worse", minimumScoreChange: 15, sourceSeries: "regional" }, response)).toBe(true);
    expect(storyGateHolds({ kind: "day", localDate: "2026-07-15", bucket: "morning", reason: "light_wind" }, response)).toBe(true);
    expect(storyGateHolds({ kind: "origin", regionalEventKey: swellGate.regionalEventKey,
      sourceAreaId: "x", sourceLat: 0, sourceLon: 0, trackRevision: "x", arrivalOrder: 0,
      confidence: "likely" }, response)).toBe(false);
    window.forecast.windSpeed = "18 mph";
    expect(storyGateHolds({ kind: "day", localDate: "2026-07-15", bucket: "morning", reason: "light_wind" }, response)).toBe(false);
  });

  it("keeps the story ready with a storm-first week and puts the storm on the cover", async () => {
    const storm = regionEvent(270, 7, "2026-07-15T18:00:00Z", "2026-07-16T18:00:00Z", "2026-07-17T06:00:00Z",
      { kind: "storm", memberCount: 5 });
    const later = regionEvent(300, 15, "2026-07-18T18:00:00Z", "2026-07-19T18:00:00Z", null);
    const build = regionBuild([storm, later]);
    mockLoadRegion.mockResolvedValue(build);
    const { week } = storyEventsFromRegion(build, "2026-07-15");
    const key = storyEventKey(week[0]);
    expect(key).toBe("6-2-2026-07-16-s");
    const signals = Array.from({ length: 7 }, (_, index) => ({
      localDate: addDays("2026-07-15", index), complete: true, sampleBeaches: 3, meanHeightFt: 4,
      directionDeg: 270, periodS: 7, sourceSeries: "enhanced_forecasts:south-shore", forecastRevision: "2026-07-15T12:00:00Z",
    }));
    const issued = input();
    issued.copyFacts = buildStoryCandidates(signals, region, week);
    const artifact: StoryArtifact = {
      artifactId: "artifact", schemaVersion: 3, region, editionDate: issued.editionDate,
      inputHash: issued.inputHash, sourcePublishedAt: issued.sourcePublishedAt, validUntil: issued.validUntil,
      generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: "worker",
      briefing: { ...issued.briefing, generatedAt: now.toISOString(), selections: [`cover-pulse-${key}`, `lead-pulse-${key}`] },
      provenance: issued.provenance,
    };
    mockLatestEdition.mockResolvedValue(artifact);
    mockLoadInput.mockResolvedValue(issued);
    // The chart's default detector never runs for storms: only the later groundswell is charted.
    const response = live();
    Object.assign(response.swells![0], { eventKey: "later", directionDeg: 300, directionLabel: "WNW",
      arrivalAt: "2026-07-18T18:00:00Z", peakAt: "2026-07-19T18:00:00Z", peakLocalDate: "2026-07-19", fadeAt: null });
    const cover = "A stormy short-period swell from the west reaches south-shore Wednesday and peaks Thursday.";
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: response,
      startLocalDate: "2026-07-15", now });
    expect(story).toMatchObject({ availability: "ready", cover: { text: cover },
      lead: "The west pulse builds from Wednesday into Thursday." });
    expect(mockBuildInput).not.toHaveBeenCalled();
    // Without an edition, the fallback leads with the storm too.
    expect(bindFallbackStory(region, issued, response, storyRegion(build, "2026-07-15"))).toMatchObject({
      availability: "ready", cover: { text: cover },
    });
  });

  it("shows the event's server line with the new day when its peak moved after the PC run", async () => {
    // The PC's edition and the cached input both claim Thursday's peak; the region build now peaks the swell Friday.
    const issued = input();
    issued.briefing.generatedAt = "2026-07-15T12:30:00Z";
    mockLatestEdition.mockResolvedValue({
      artifactId: "artifact", schemaVersion: 3, region, editionDate: issued.editionDate,
      inputHash: issued.inputHash, sourcePublishedAt: issued.sourcePublishedAt, validUntil: issued.validUntil,
      generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: "worker",
      briefing: { ...issued.briefing, generatedAt: now.toISOString(), selections: ["cover", "lead"] },
      provenance: issued.provenance,
    } satisfies StoryArtifact);
    mockLoadInput.mockResolvedValue(issued);
    mockLatestInput.mockResolvedValue(issued);
    mockLoadRegion.mockResolvedValue(regionBuild([
      { ...west, peakAt: "2026-07-17T18:00:00Z", peakLocalDate: "2026-07-17", fadeAt: "2026-07-17T23:00:00Z" }]));
    const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
      startLocalDate: "2026-07-15", now });
    expect(story).toMatchObject({ availability: "ready",
      cover: { text: "A long-period groundswell from the west arrives Wednesday and peaks Friday." },
      lead: "The west pulse builds from Wednesday into Friday." });
    expect(JSON.stringify([story.cover.text, story.lead, story.chapters])).not.toMatch(/Thursday|Specific/);
    expect(mockBuildInput).not.toHaveBeenCalled();
  });

  it("fails swell gates closed when the region build read fails, without throwing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mockLoadRegion.mockRejectedValue(new Error("Failed to load region beaches: timeout"));
      const story = await loadAndBindStory({ client: client as never, homeBeachId: "home", live: live(),
        startLocalDate: "2026-07-15", now });
      // The chart still shows the swell, but nothing proves a swell sentence: only the day line is served.
      expect(story).toMatchObject({ availability: "ready", cover: { text: null }, lead: null,
        chapters: [{ slot: "day:2026-07-15", text: "Light morning wind." }] });
      expect(warn).toHaveBeenCalledWith("[week-scout-story] region gate read failed",
        { region, error: "Error: Failed to load region beaches: timeout" });
    } finally {
      warn.mockRestore();
    }
  });
});

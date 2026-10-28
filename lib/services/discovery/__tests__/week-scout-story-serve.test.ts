const mockActiveRegions = jest.fn();
const mockLatestEdition = jest.fn();
const mockLoadInput = jest.fn();
const mockLatestInput = jest.fn();
const mockBuildInput = jest.fn();
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryEdition: (...args: unknown[]) => mockLatestEdition(...args),
  loadStoryInput: (...args: unknown[]) => mockLoadInput(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
}));
jest.mock("../week-scout-story-source", () => ({
  buildStoryInput: (...args: unknown[]) => mockBuildInput(...args),
  StoryInputError: class StoryInputError extends Error {},
  STORY_SAMPLE_VERSION: "regional-swell-events-3",
}));

import { WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";
import type { CanonicalWeekScoutResponse } from "../week-scout";
import { bindFallbackStory, bindStory, loadAndBindStory, storyGateHolds } from "../week-scout-story-serve";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "../week-scout-story-types";
import { StoryInputError } from "../week-scout-story-source";

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
      selections: ["cover", "lead", "chapter"], live });
    expect(story).toMatchObject({ availability: "ready", lead: "The week builds.",
      cover: { text: "A west swell approaches.", swells: [{ directionDeg: 270, periodS: 15 }] } });
    expect(story.days[0].pick).toMatchObject({ windowId: "window-a", verdict: "worth_it" });
    expect(JSON.stringify(story)).not.toMatch(/freshness|generatedAt|validUntil/);
    live.swells![0].confidence = "on_the_radar";
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
    value.provenance.generationInputVersion = "regional-swell-events-3";
    return value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveRegions.mockResolvedValue([{ region, timezone: "Pacific/Honolulu" }]);
    mockLatestEdition.mockResolvedValue(null);
    mockLatestInput.mockResolvedValue(null);
    mockBuildInput.mockImplementation(async () => input());
    mockLoadInput.mockResolvedValue(input());
  });

  it("selects first passing candidate per slot, omitting failed gates", () => {
    const story = bindFallbackStory(region, input(), live());
    expect(story).toMatchObject({ availability: "ready", cover: { text: "Specific cover." },
      lead: "Specific lead.", chapters: [{ slot: "day:2026-07-15", text: "Light morning wind." }] });
    const missingCover = input();
    missingCover.copyFacts.filter((fact) => fact.slot === "cover").forEach((fact) => {
      fact.gate = { ...swellGate, periodBand: 4 };
    });
    expect(bindFallbackStory(region, missingCover, live())).toMatchObject({
      availability: "ready", cover: { text: null }, lead: "Specific lead.",
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
    expect(story).toMatchObject({ availability: "ready", cover: { text: null }, lead: null });
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
        throw new StoryInputError(code);
      });
      const stories = await Promise.all([0, 1].map(() => loadAndBindStory({
        client: countedClient as never, homeBeachId: "home", live: live(),
        startLocalDate: date, now: new Date(`${date}T13:00:00Z`),
      })));
      expect(stories.map((story) => story.availability)).toEqual(["unavailable", "unavailable"]);
      expect(mockBuildInput).toHaveBeenCalledTimes(1);
      expect(countedClient.from.mock.calls.filter(([table]) => table === "enhanced_forecasts")).toHaveLength(34);
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

  it("drops a different swell's weekday even when its live gate matches another card", () => {
    const response = live();
    response.swells!.push({ ...response.swells![0], eventKey: "later", arrivalAt: "2026-07-17T18:00:00Z",
      peakAt: "2026-07-18T18:00:00Z", peakLocalDate: "2026-07-18", fadeAt: null });
    const inputWithLater = input();
    inputWithLater.copyFacts.unshift({ id: "wrong-cover", slot: "cover", text: "Saturday arrives.", rank: -1,
      gate: { ...swellGate, regionalEventKey: "6-5-2026-07-18", arrivalLocalDate: "2026-07-17",
        peakLocalDate: "2026-07-18", fadeLocalDate: null } });
    expect(bindFallbackStory(region, inputWithLater, response).cover.text).toBe("Specific cover.");
    expect(bindStory({ region, availability: "ready", input: inputWithLater,
      selections: ["wrong-cover", "lead"], live: response }).availability).toBe("unavailable");
  });

  it("compares against the first projected cover swell", () => {
    const response = live();
    response.swells!.unshift({ ...response.swells![0], eventKey: "outside-week",
      arrivalAt: "2026-07-22T18:00:00Z", peakAt: "2026-07-23T18:00:00Z",
      peakLocalDate: "2026-07-23", fadeAt: null });
    const story = bindFallbackStory(region, input(), response);
    expect(story.cover.swells[0].eventKey).toBe("event");
    expect(story.cover.text).toBe("Specific cover.");
  });

  it("serves a repeated day body only once", () => {
    const issued = input();
    issued.copyFacts.push(
      { id: "day-a", slot: "day:2026-07-15", text: "On Wednesday, the onshore fills in by midday.", gate: swellGate },
      { id: "day-b", slot: "day:2026-07-16", text: "On Thursday, the onshore fills in by midday.", gate: swellGate },
    );
    const story = bindStory({ region, availability: "ready", input: issued,
      selections: ["cover", "lead", "day-a", "day-b"], live: live() });
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
      selections: ["cover", "lead", "pattern"], live: response });
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

  it("rechecks exposure, wind, tide, change, day and origin gates", () => {
    const response = live();
    const window = response.days[0].bestDayWindow!;
    response.days[0].windows.push({ ...window, id: "afternoon", bucket: "midday",
      forecast: { ...window.forecast, windDirection: "SW" } });
    response.days[1].bestDayWindow = { ...window, id: "tomorrow", conditionScore: 60 };
    expect(storyGateHolds(swellGate, response)).toBe(true);
    expect(storyGateHolds({ ...swellGate, directionIndex: 12, periodClass: "long" }, response)).toBe(true);
    expect(storyGateHolds({ ...swellGate, directionIndex: 11 }, response)).toBe(false);
    expect(storyGateHolds({ ...swellGate, periodClass: "short" }, response)).toBe(false);
    expect(storyGateHolds({ kind: "exposure", regionalEventKey: swellGate.regionalEventKey,
      directionSector: 6, exposure: "open", minimumBeaches: 2,
      beaches: [{ beachId: "a", exposure: "open" }, { beachId: "c", exposure: "shadowed" }] }, response)).toBe(true);
    expect(storyGateHolds({ kind: "exposure", regionalEventKey: swellGate.regionalEventKey,
      directionSector: 6, exposure: "open", minimumBeaches: 2,
      beaches: [{ beachId: "c", exposure: "open" }] }, response)).toBe(false);
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
});

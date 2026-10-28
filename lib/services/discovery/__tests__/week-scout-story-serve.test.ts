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
}));

import { WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";
import type { CanonicalWeekScoutResponse } from "../week-scout";
import { bindFallbackStory, bindStory, loadAndBindStory, storyGateHolds } from "../week-scout-story-serve";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "../week-scout-story-types";

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
    value.provenance.generationInputVersion = "representative-latitude-spread-2";
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

import type { InternalRegionEvent, RatingRow, RegionBeach, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { addDays } from "../swell-briefing-input";
import {
  beachLineText, buildEventCandidates, buildStoryCandidates, eventStory, eventStoryText, storyEventKey, storyEventsFromRegion,
  type BeachLineFacts, type RegionalDaySignal, type RegionalSwellEvent,
} from "../week-scout-story-candidates";
import { CLOSED_WORD_SETS } from "../week-scout-story-claims";
import { buildRegionGateContext, regionGateHolds } from "../week-scout-story-region-gate";
import { assertStoryArtifactMatchesInput } from "../week-scout-story-validate";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "../week-scout-story-types";

const start = "2026-10-27";
const days = (height: number | null = 1): RegionalDaySignal[] => Array.from({ length: 7 }, (_, index) => ({
  localDate: addDays(start, index), complete: true, sampleBeaches: 3,
  meanHeightFt: height, directionDeg: 270, periodS: 15,
  sourceSeries: "enhanced_forecasts:coast", forecastRevision: "2026-10-27T12:00:00Z",
}));
const event = (periodS = 13.4): RegionalSwellEvent => ({ directionDeg: 202, periodS,
  arrivalAt: "2026-10-31T18:00:00Z", peakAt: "2026-11-01T18:00:00Z",
  fadeAt: "2026-11-02T18:00:00Z", timezone: "America/Los_Angeles",
  confidence: "likely", minimumBeaches: 3, kind: "swell", regionalKey: "San Diego:SSW:2026-11-01" });

describe("regional Week Scout story candidates", () => {
  it("refuses sparse coverage and uncertain pulses instead of calling them quiet", () => {
    const sparse = days(); sparse[3].complete = false;
    expect(buildStoryCandidates(sparse)).toEqual([]);
    const uncertain = days(3); uncertain.forEach((day) => { day.directionDeg = null; });
    expect(buildStoryCandidates(uncertain)).toEqual([]);
  });

  it("writes specific San Diego swell and exposure copy from regional evidence", () => {
    const signals = days(3);
    signals.forEach((day) => { day.directionDeg = 202; day.periodS = 15; });
    signals[3].meanHeightFt = 5;
    signals[5].exposedBeaches = { "4-4-2026-11-01": [
      { beachId: "a", beachName: "Ocean Beach", exposure: "open", qualityScore: 70 },
      { beachId: "b", beachName: "Blacks", exposure: "open", qualityScore: 60 },
      { beachId: "c", beachName: "La Jolla Shores", exposure: "shadowed", qualityScore: 40 },
    ] };
    signals[3].wind = { bucket: "midday", fromBucket: "morning", fromWindClass: "offshore",
      windClass: "onshore", selectorConfirmed: true, turnConfirmed: true, beachId: "a",
      fromDirection: "90", toDirection: "270" };
    const facts = buildStoryCandidates(signals, "San Diego", [event()]);
    expect(facts.find((fact) => fact.slot === "cover")?.gate).toMatchObject({
      kind: "swell", arrivalLocalDate: "2026-10-31", peakLocalDate: "2026-11-01", directionSector: 4,
    });
    expect(facts.find((fact) => fact.slot === "cover")?.text).toContain("south-southwest reaches San Diego Saturday and peaks Sunday");
    expect(facts.find((fact) => fact.gate.kind === "exposure")?.text).toContain("Ocean Beach and Blacks");
    expect(facts.find((fact) => fact.gate.kind === "wind")?.text).toContain("onshore fills in");
    expect(facts.some((fact) => fact.gate.kind === "exposure")).toBe(true);
    expect(facts.some((fact) => fact.gate.kind === "origin")).toBe(false);
    expect(facts.every((fact) => !/\d/.test(fact.text) && fact.text.length <= 240)).toBe(true);
    expect(new Set(facts.filter((fact) => fact.slot === "cover").map((fact) => fact.text)).size).toBe(2);
    expect(facts.some((fact) => fact.id === "cover-pulse-other-period" || fact.id.startsWith("day-"))).toBe(false);
  });

  it("uses event arrival after Wednesday's height gate and classifies periods", () => {
    const signals = days(1);
    signals[1].meanHeightFt = 2;
    const long = buildStoryCandidates(signals, "San Diego", [event()]);
    expect(long.find((fact) => fact.slot === "cover")?.text).toBe(
      "A long-period groundswell from the south-southwest reaches San Diego Saturday and peaks Sunday.");
    expect(long.filter((fact) => /southwest/.test(fact.text)).every((fact) => /south-southwest/.test(fact.text))).toBe(true);
    expect(buildStoryCandidates(signals, "San Diego", [event(11)]).find((fact) => fact.slot === "cover")?.text)
      .toContain("mid-period swell");
    expect(buildStoryCandidates(signals, "San Diego", [event(9)]).find((fact) => fact.slot === "cover")?.text)
      .toContain("short-period windswell");
  });

  it("calls a storm stormy: short-period under ten seconds, mid-period from ten", () => {
    const signals = days(3);
    const storm = (periodS: number): RegionalSwellEvent => ({ ...event(periodS), kind: "storm" });
    const short = buildStoryCandidates(signals, "San Diego", [storm(7)]);
    expect(storyEventKey(storm(7))).toBe("4-2-2026-11-01-s");
    expect(short.find((fact) => fact.slot === "cover")?.text).toBe(
      "A stormy short-period swell from the south-southwest reaches San Diego Saturday and peaks Sunday.");
    expect(short.find((fact) => fact.id === "swell-4-2-2026-11-01-s")?.text).toContain("The stormy short-period swell arrives Saturday");
    // "Stormy" leads the direction wherever a sentence names both.
    expect(short.find((fact) => fact.id === "cover-pulse-alt-4-2-2026-11-01-s")?.text).toBe(
      "San Diego gets a stormy south-southwest short-period swell by Saturday, with the most swell Sunday.");
    expect(buildStoryCandidates(signals, "San Diego", [storm(10)]).find((fact) => fact.slot === "cover")?.text)
      .toContain("stormy mid-period swell");
    expect(buildStoryCandidates(signals, "San Diego", [storm(14)]).find((fact) => fact.slot === "cover")?.text)
      .toContain("stormy mid-period swell");
  });

  it("writes keyed copy for every in-week event, earliest peak first, and leaves the fade off cover and lead", () => {
    const spike = { ...event(18), directionDeg: 275, arrivalAt: "2026-10-27T17:00:00Z",
      peakAt: "2026-10-27T20:00:00Z", fadeAt: "2026-10-28T06:00:00Z" };
    const facts = buildStoryCandidates(days(3), "San Diego", [event(), spike]);
    expect(new Set(facts.map((fact) => fact.id)).size).toBe(facts.length);
    expect(facts.filter((fact) => fact.slot === "cover").map((fact) => fact.id)).toEqual([
      "cover-pulse-6-6-2026-10-27", "cover-pulse-alt-6-6-2026-10-27",
      "cover-pulse-4-4-2026-11-01", "cover-pulse-alt-4-4-2026-11-01"]);
    for (const fact of facts.filter((item) => item.slot === "cover" || item.slot === "story:lead")) {
      expect(fact.gate).toMatchObject({ kind: "swell", fadeLocalDate: null });
    }
    expect(facts.find((fact) => fact.id === "swell-4-4-2026-11-01")?.gate)
      .toMatchObject({ fadeLocalDate: "2026-11-02" });
  });

  it("does not name a peak or fade weekday outside the seven-day story", () => {
    const outside = { ...event(), arrivalAt: "2026-11-02T18:00:00Z",
      peakAt: "2026-11-03T18:00:00Z", fadeAt: "2026-11-04T18:00:00Z" };
    const swellFacts = buildStoryCandidates(days(3), "San Diego", [outside])
      .filter((fact) => fact.gate.kind === "swell");
    expect(swellFacts.find((fact) => fact.slot === "cover")?.text)
      .toContain("reaches San Diego Monday and peaks next week");
    expect(swellFacts.map((fact) => fact.text).join(" ")).not.toMatch(/Tuesday|Wednesday/);
    // Phrasings that open with the day or follow "by" are dropped rather than read "next week is the peak".
    expect(swellFacts.some((fact) => fact.id.startsWith("cover-pulse-alt"))).toBe(false);
    expect(swellFacts.some((fact) => /^next week|by earlier|^earlier/.test(fact.text))).toBe(false);
  });

  it("ranks exposure by peak-day quality, then beach name", () => {
    const signals = days(3);
    const ranked = [
      { beachId: "a", beachName: "First Open", exposure: "open" as const, qualityScore: 10 },
      { beachId: "b", beachName: "Home Open", exposure: "open" as const, qualityScore: 60 },
      { beachId: "c", beachName: "Best Open", exposure: "open" as const, qualityScore: 90 },
      { beachId: "d", beachName: "First Shadow", exposure: "shadowed" as const, qualityScore: 20 },
      { beachId: "e", beachName: "Home Shadow", exposure: "shadowed" as const, qualityScore: 80 },
    ];
    signals[5].exposedBeaches = { "4-4-2026-11-01": ranked };
    expect(buildStoryCandidates(signals, "San Diego", [event()]).find((fact) => fact.gate.kind === "exposure")?.text)
      .toContain("Best Open and Home Open face this swell better than Home Shadow");
    ranked.push(
      { beachId: "f", beachName: "Alpha Open", exposure: "open", qualityScore: 90 },
      { beachId: "g", beachName: "Alpha Shadow", exposure: "shadowed", qualityScore: 80 },
    );
    expect(buildStoryCandidates(signals, "San Diego", [event()]).find((fact) => fact.gate.kind === "exposure")?.text)
      .toContain("Alpha Open and Best Open face this swell better than Alpha Shadow");
  });

  it("collapses a repeated wind turn into one turn and prioritizes change, then tide", () => {
    const signals = days(1);
    signals.forEach((day) => { day.wind = { bucket: "midday", fromBucket: "morning", fromWindClass: "offshore",
      windClass: "onshore", selectorConfirmed: true, turnConfirmed: true }; });
    signals[1].tide = { bucket: "morning", tidePhase: "rising", windowOrder: "opens", selectorConfirmed: true, orderingConfirmed: true };
    const facts = buildStoryCandidates(signals);
    expect(facts.find((fact) => fact.id === "turn-wind-pattern")?.text).toContain("Mornings stay cleaner");
    expect(facts.some((fact) => fact.gate.kind === "wind")).toBe(false);
    expect(facts.find((fact) => fact.slot === `day:${signals[1].localDate}`)?.gate.kind).toBe("tide");
    signals[6].wind = { ...signals[6].wind!, bucket: "evening", fromWindClass: "onshore", windClass: "offshore" };
    const mixed = buildStoryCandidates(signals);
    expect(mixed.some((fact) => fact.id === "turn-wind-pattern")).toBe(true);
    expect(mixed.filter((fact) => fact.gate.kind === "wind").map((fact) => fact.slot))
      .toEqual([`day:${signals[6].localDate}`, `day:${signals[6].localDate}`]);
  });

  it("gates wind and tide on selector evidence, change on comparable scores, and quiet on complete days", () => {
    const quiet = days();
    expect(buildStoryCandidates(quiet).some((fact) => fact.gate.kind === "quiet")).toBe(true);
    quiet[1].wind = { bucket: "morning", fromWindClass: "onshore", windClass: "offshore", selectorConfirmed: false, turnConfirmed: true };
    quiet[1].tide = { bucket: "morning", tidePhase: "rising", windowOrder: "opens", selectorConfirmed: false, orderingConfirmed: true };
    expect(buildStoryCandidates(quiet).some((fact) => fact.gate.kind === "wind" || fact.gate.kind === "tide")).toBe(false);
    quiet[1].wind.selectorConfirmed = true;
    quiet[1].tide.selectorConfirmed = true;
    quiet[0].qualityScore = 30; quiet[1].qualityScore = 50;
    const facts = buildStoryCandidates(quiet);
    expect(facts.some((fact) => fact.gate.kind === "wind")).toBe(true);
    expect(facts.some((fact) => fact.gate.kind === "tide")).toBe(true);
    expect(facts.some((fact) => fact.gate.kind === "change")).toBe(true);
  });
});

describe("story artifact candidate validation", () => {
  const now = new Date("2026-10-27T13:00:00Z");
  const facts = buildStoryCandidates(days(3), "coast", [{ ...event(15), directionDeg: 270,
    arrivalAt: "2026-10-27T18:00:00Z", peakAt: "2026-10-27T23:00:00Z", fadeAt: null }]);
  const input: StoryInput = {
    schemaVersion: 3, region: "coast", editionDate: start, inputHash: "hash",
    sourcePublishedAt: "2026-10-27T12:00:00Z", validUntil: "2026-10-29T06:59:59Z",
    briefing: { schemaVersion: 3, editionDate: start, generatedAt: "2026-10-27T12:00:00Z", selections: [] },
    copyFacts: facts,
    beachNames: { beach: "Ocean Beach" },
    provenance: { sourceIds: ["source"], sourceHashes: ["revision"], generationInputVersion: "1",
      representativeBeachIds: ["beach"], coverageDates: days().map((day) => day.localDate) },
  };
  const artifact = (): StoryArtifact => ({
    artifactId: "artifact", schemaVersion: 3, region: input.region, editionDate: input.editionDate,
    inputHash: input.inputHash, sourcePublishedAt: input.sourcePublishedAt, validUntil: input.validUntil,
    generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: "local-model",
    briefing: { ...input.briefing, generatedAt: now.toISOString(), selections: facts.filter((fact) =>
      /^(cover-pulse|lead-pulse)-\d/.test(fact.id) || fact.id === "swell-6-5-2026-10-27").map((fact) => fact.id) },
    provenance: input.provenance,
  });

  it("accepts issued IDs in order, then refuses omitted lead, text injection and duplicate slots", () => {
    expect(() => assertStoryArtifactMatchesInput(artifact(), input, now)).not.toThrow();
    const missing = artifact(); missing.briefing.selections.splice(1, 1);
    expect(() => assertStoryArtifactMatchesInput(missing, input, now)).toThrow("required_slot_missing");
    const injected = artifact(); (injected.briefing as unknown as Record<string, unknown>).text = "invented";
    expect(() => assertStoryArtifactMatchesInput(injected, input, now)).toThrow("briefing_values_altered");
    const extra = artifact(); (extra as unknown as Record<string, unknown>).privateText = "invented";
    expect(() => assertStoryArtifactMatchesInput(extra, input, now)).toThrow("artifact_values_altered");
    const duplicate = artifact(); duplicate.briefing.selections.push(facts[0].id);
    expect(() => assertStoryArtifactMatchesInput(duplicate, input, now)).toThrow("duplicate_candidate");
  });

  it("accepts up to 200 selections, one per slot", () => {
    const lines = Array.from({ length: 201 }, (_, index) => ({ id: `event-line-${index}`, slot: `event:line-${index}:story`,
      text: "A west swell arrives.", gate: facts[0].gate }));
    const wide = { ...input, copyFacts: [...facts, ...lines] };
    const picked = (count: number): StoryArtifact => {
      const value = artifact();
      value.briefing.selections = [...value.briefing.selections, ...lines.slice(0, count - value.briefing.selections.length).map((line) => line.id)];
      return value;
    };
    expect(picked(200).briefing.selections).toHaveLength(200);
    expect(() => assertStoryArtifactMatchesInput(picked(200), wide, now)).not.toThrow();
    expect(() => assertStoryArtifactMatchesInput(picked(201), wide, now)).toThrow("selections_invalid");
  });

  it("accepts written with week-scout-story-2 and rejects it with -1", () => {
    const withWritten = (version: string, written: unknown): StoryArtifact => {
      const value = artifact();
      value.generationVersion = version;
      (value.briefing as unknown as Record<string, unknown>).written = written;
      return value;
    };
    const selected = facts.filter((fact) => artifact().briefing.selections.includes(fact.id));
    // Claims are checked when the story is served, not here: a digit is structurally fine.
    const lines = selected.map((fact) => ({ slot: fact.slot, basedOn: fact.id, text: "Gemma's line peaks at 8 feet." }));
    const refusal = (version: string, written: unknown): string => {
      try { assertStoryArtifactMatchesInput(withWritten(version, written), input, now); return "accepted"; } catch (error) {
        return (error as Error).message;
      }
    };
    expect(refusal("week-scout-story-2", lines)).toBe("accepted");
    expect(refusal("week-scout-story-2", [])).toBe("accepted");
    const plain = artifact(); plain.generationVersion = "week-scout-story-2";
    expect(() => assertStoryArtifactMatchesInput(plain, input, now)).not.toThrow();
    expect(refusal("week-scout-story-1", lines)).toBe("written_not_allowed");
    expect(refusal("week-scout-story-3", lines)).toBe("generation_version_unsupported");
    expect(refusal("week-scout-story-2", null)).toBe("written_invalid");
    expect(refusal("week-scout-story-2", [{ ...lines[0], text: 7 }])).toBe("written_invalid");
    expect(refusal("week-scout-story-2", [{ ...lines[0], tone: "hype" }])).toBe("written_invalid");
    expect(refusal("week-scout-story-2", [{ ...lines[0], text: "x".repeat(241) }])).toBe("written_too_long");
    const unselected = facts.find((fact) => !artifact().briefing.selections.includes(fact.id))!;
    expect(refusal("week-scout-story-2", [{ slot: unselected.slot, basedOn: unselected.id, text: "Line." }])).toBe("written_not_selected");
    expect(refusal("week-scout-story-2", [{ ...lines[0], slot: lines[1].slot }])).toBe("written_slot_mismatch");
    expect(refusal("week-scout-story-2", [lines[0], lines[0]])).toBe("written_duplicate_slot");
  });
});

describe("event and beach lines the card shows", () => {
  const TIMEZONE = "America/Los_Angeles";
  const TODAY = "2026-10-27";
  // Tuesday 8 AM in San Diego.
  const NOW = new Date("2026-10-27T15:00:00Z");
  // Intermediate scores at a nine-second period with the tide unknown, as in the rating tests.
  const SURF = {
    good75: { wave: "2-3ft", wind: "3 mph" },
    good72: { wave: "2-3ft", wind: "5 mph" },
    fair55: { wave: "2-3ft", wind: "14 mph" },
    meh39: { wave: "0-1ft", wind: "3 mph" },
    blownOut: { wave: "1-2ft", wind: "20 mph" },
  };
  type Surf = (typeof SURF)[keyof typeof SURF];

  /** A beach whose swell window is centred on `centerDeg`, twenty degrees either side. */
  function beach(id: string, name: string, centerDeg: number): RegionBeach {
    return { id, name, lat: 32.8, lon: -117.2, swell_window_center_deg: centerDeg, swell_window_halfwidth_deg: 20 };
  }

  /** Daylight rows (9 AM, noon, 3 PM) on each of `days` days from Wednesday. */
  function rows(surf: Surf, days = 6): RatingRow[] {
    return Array.from({ length: days }, (_, day) => [16, 19, 22].map((hour) => ({
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

  function regionBuild(beaches: RegionBeach[], surf: Record<string, Surf>, events: InternalRegionEvent[]): RegionBuild {
    return { region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null, beaches, events,
      rowsByBeach: Object.fromEntries(beaches.map((item) => [item.id, rows(surf[item.id] ?? SURF.good75, 12)])) };
  }

  function eventLines(build: RegionBuild) {
    const events = storyEventsFromRegion(build, TODAY).all;
    const context = buildRegionGateContext(build, TODAY);
    return { events, context, facts: buildEventCandidates(build, events, context, NOW) };
  }

  const beachesOf = (facts: ReturnType<typeof buildEventCandidates>, key: string): string[] =>
    facts.filter((fact) => fact.slot.startsWith(`event:${key}:beach:`)).map((fact) => fact.slot.split(":beach:")[1]).sort();

  // SSW groundswell: arrives Thursday, peaks Friday, fades Saturday. W storm: arrives Saturday, peaks Sunday, fades Monday.
  const ssw = regionEvent("San Diego:SSW:2026-10-30", 202, 13.4, "2026-10-29T15:00:00Z", "2026-10-30T19:00:00Z", "2026-10-31T19:00:00Z");
  const storm = regionEvent("San Diego:W:2026-11-01:s", 270, 7, "2026-10-31T15:00:00Z", "2026-11-01T19:00:00Z", "2026-11-02T19:00:00Z",
    { kind: "storm", directionLabel: "W" });
  const early = regionEvent("San Diego:W:2026-11-09:s", 270, 9, "2026-11-09T20:00:00Z", "2026-11-09T20:00:00Z", null,
    { kind: "storm", source: "wam", arrivalAt: null, memberCount: 0 });
  // To the SSW: Ocean Beach, Blacks and Windansea open, La Jolla Shores partial, Sunset Cliffs shadowed.
  // To the W: only Sunset Cliffs open.
  const BEACHES = [beach("a", "Ocean Beach", 202), beach("b", "Blacks", 202), beach("c", "La Jolla Shores", 232),
    beach("d", "Sunset Cliffs", 292), beach("e", "Windansea", 202)];
  const SURF_BY_BEACH = { a: SURF.good75, b: SURF.fair55, c: SURF.good72, d: SURF.meh39, e: SURF.blownOut };

  it("writes one story line per forecast event and one line per rated beach, without digits", () => {
    const build = regionBuild(BEACHES, SURF_BY_BEACH, [ssw, storm, early]);
    const { context, facts } = eventLines(build);

    // The WAM early look is not a forecast event and gets no line.
    expect(facts.filter((fact) => fact.slot.endsWith(":story")).map((fact) => [fact.slot, fact.text, fact.rank])).toEqual([
      ["event:4-4-2026-10-30:story", "A south-southwest long-period groundswell arrives Thursday, peaks Friday and fades Saturday.", 0],
      ["event:6-2-2026-11-01-s:story", "A stormy west short-period swell arrives Saturday, peaks Sunday and fades Monday.", 0],
    ]);
    expect(facts.find((fact) => fact.slot === "event:4-4-2026-10-30:story")?.gate).toEqual({
      kind: "swell", regionalEventKey: "4-4-2026-10-30", directionSector: 4, directionIndex: 9, periodBand: 4, periodClass: "long",
      arrivalLocalDate: "2026-10-29", peakLocalDate: "2026-10-30", fadeLocalDate: "2026-10-31", confidence: "locked", minimumBeaches: 3,
    });
    // SSW: Ocean Beach (here, GOOD), La Jolla Shores (GOOD) and Blacks (FAIR) work; Windansea is blown out and
    // Sunset Cliffs sheltered. W: Sunset Cliffs is open but small, so it is neither working nor given a reason.
    expect(beachesOf(facts, "4-4-2026-10-30")).toEqual(["a", "b", "c", "d", "e"]);
    expect(beachesOf(facts, "6-2-2026-11-01-s")).toEqual(["a", "b", "c", "e"]);
    expect(facts.every((fact) => !/\d/.test(fact.text) && fact.text.length <= 240)).toBe(true);
    expect(new Set(facts.map((fact) => fact.id)).size).toBe(facts.length);
    // Every line is one the region build proves today.
    expect(facts.map((fact) => regionGateHolds(fact.gate, context))).toEqual(facts.map(() => true));
  });

  it("names the beach's exposure to the event's direction in its line", () => {
    const { facts } = eventLines(regionBuild(BEACHES, SURF_BY_BEACH, [ssw, storm]));
    const line = (key: string, beachId: string) => facts.find((fact) => fact.slot === `event:${key}:beach:${beachId}`);
    const swellKey = "4-4-2026-10-30";
    expect(line(swellKey, "a")?.text).toBe("Faces the south-southwest groundswell dead on, with light wind in its window.");
    expect(line(swellKey, "a")?.gate).toEqual({ kind: "beach", regionalEventKey: swellKey, beachId: "a", directionIndex: 9,
      periodClass: "long", exposure: "open", facing: "direct", wind: "light" });
    expect(line(swellKey, "b")?.text).toBe("Faces the south-southwest groundswell dead on, but it's breezy in its window.");
    expect(line(swellKey, "b")?.gate).toMatchObject({ exposure: "open", wind: "breezy" });
    expect(line(swellKey, "e")?.text).toBe("Faces the south-southwest groundswell dead on, but the wind is up in its window.");
    expect(line(swellKey, "e")?.gate).toMatchObject({ exposure: "open", wind: "windy" });
    expect(line(swellKey, "c")?.text).toBe("Partly sheltered from the south-southwest groundswell, with light wind in its window.");
    expect(line(swellKey, "c")?.gate).toMatchObject({ exposure: "partial", facing: null });
    expect(line(swellKey, "d")?.text).toBe("Sheltered from the south-southwest groundswell, with light wind in its window.");
    // The same beach, open to one event, is sheltered from the other's direction.
    expect(line("6-2-2026-11-01-s", "b")?.text).toBe("Sheltered from the west storm swell, and it's breezy in its window.");
    expect(line("6-2-2026-11-01-s", "b")?.gate).toMatchObject({ directionIndex: 12, periodClass: "short", exposure: "shadowed",
      facing: null, wind: "breezy" });
  });

  it("varies a beach's line with the swell's kind and period class, and across beaches with how they face it and their wind", () => {
    const facts: BeachLineFacts = { direction: "west", kind: "swell", periodClass: "long", exposure: "open", facing: "direct", wind: "light" };
    // One open, light-wind beach across four events from the west.
    expect([
      beachLineText(facts),
      beachLineText({ ...facts, periodClass: "mid" }),
      beachLineText({ ...facts, periodClass: "short" }),
      beachLineText({ ...facts, kind: "storm", periodClass: "short" }),
    ]).toEqual([
      "Faces the west groundswell dead on, with light wind in its window.",
      "Faces the west mid-period swell straight on, with light wind in its window.",
      "Faces the west windswell straight on, with light wind in its window.",
      "Faces the west storm swell head on, with light wind in its window.",
    ]);
    // Beaches in one event: how squarely they face it, and their wind.
    expect(beachLineText({ ...facts, facing: "angled" })).toBe("Faces the west groundswell at an angle, with light wind in its window.");
    expect(beachLineText({ ...facts, wind: "breezy" })).not.toBe(beachLineText({ ...facts, wind: "windy" }));
    // A partly sheltered beach never reads "cleaner", whatever its wind.
    for (const wind of ["light", "breezy", "windy"] as const) {
      expect(beachLineText({ ...facts, exposure: "partial", facing: null, wind })).not.toMatch(/clean|small/);
    }
    expect(beachLineText({ ...facts, exposure: "partial", facing: null, wind: "windy" }))
      .toBe("Partly sheltered from the west groundswell, and the wind is up in its window.");
  });

  it("words every claim in a beach line from the claim checker's closed word sets", () => {
    // What's left after the direction and every closed-set phrase come out carries no claim a rewrite could invert.
    const glue = new Set(["the", "from", "with", "in", "its", "window", "but", "and", "it's", "swell", "wind"]);
    const claims = Object.values(CLOSED_WORD_SETS).flat().flat().sort((a, b) => b.length - a.length);
    for (const kind of ["swell", "storm"] as const) {
      for (const periodClass of ["long", "mid", "short"] as const) {
        for (const [exposure, facing] of [["open", "direct"], ["open", "angled"], ["partial", null], ["shadowed", null]] as const) {
          for (const wind of ["light", "breezy", "windy"] as const) {
            let rest = beachLineText({ direction: "south-southwest", kind, periodClass, exposure, facing, wind }).toLowerCase()
              .replace("south-southwest", " ");
            for (const claim of claims) rest = rest.replace(new RegExp(`(?<![a-z])${claim}(?![a-z])`, "g"), " ");
            expect(rest.split(/[\s,.]+/).filter((word) => word && !glue.has(word))).toEqual([]);
          }
        }
      }
    }
  });

  it("caps beach lines at eight per event", () => {
    // Five GOOD beaches outrank the first region beach (FAIR), and four blown-out beaches fill the three not-working rows:
    // nine beaches listed, eight lines, and the first region beach keeps its own.
    const beaches = [beach("a-here", "Here", 202),
      ...["b", "c", "d", "e", "f"].map((id) => beach(id, `Good ${id}`, 202)),
      ...["w", "x", "y", "z"].map((id) => beach(id, `Blown ${id}`, 202))];
    const surf: Record<string, Surf> = { "a-here": SURF.fair55,
      ...Object.fromEntries(["b", "c", "d", "e", "f"].map((id) => [id, SURF.good75])),
      ...Object.fromEntries(["w", "x", "y", "z"].map((id) => [id, SURF.blownOut])) };
    const { facts } = eventLines(regionBuild(beaches, surf, [ssw]));
    const listed = beachesOf(facts, "4-4-2026-10-30");
    expect(listed).toHaveLength(8);
    expect(listed).toEqual(expect.arrayContaining(["a-here", "b", "c", "d", "e", "f"]));
  });

  it("stays under 200 facts for a 57-beach region with six events", () => {
    const beaches = Array.from({ length: 57 }, (_, index) => beach(`beach-${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
      `Beach ${index}`, [202, 232, 270, 292][index % 4]));
    const surf = Object.fromEntries(beaches.map((item, index) => [item.id, [SURF.good75, SURF.fair55, SURF.blownOut, SURF.meh39][index % 4]]));
    // Six events across twelve days, each with its own direction or day.
    const events = [0, 2, 4, 6, 8, 10].map((day, index) => {
      const at = (offset: number) => new Date(Date.UTC(2026, 9, 28 + day + offset, 19)).toISOString();
      const directionDeg = [202, 270, 292, 232, 202, 270][index];
      return regionEvent(`San Diego:${index}`, directionDeg, 14, at(0), at(1), at(2));
    });
    const build = regionBuild(beaches, surf, events);
    const signals = days(3).map((day) => ({ ...day, sampleBeaches: 8 }));
    const { events: all, facts: eventFacts } = eventLines(build);
    const facts = [...buildStoryCandidates(signals, "San Diego", storyEventsFromRegion(build, TODAY).week), ...eventFacts];

    expect(all).toHaveLength(6);
    expect(facts.length).toBeLessThan(200);
    expect(new Set(facts.map((fact) => fact.id)).size).toBe(facts.length);
    for (const event of all) {
      const key = storyEventKey(event);
      expect(facts.filter((fact) => fact.slot === `event:${key}:story`)).toHaveLength(1);
      expect(beachesOf(facts, key)).toHaveLength(8);
    }
  });

  it("words days the region hasn't reached yet and days already behind it", () => {
    // Today Tuesday: a swell in the water since Sunday that peaked Monday, and one peaking a week from Thursday.
    const inWater = { directionDeg: 270, periodS: 11, arrivalAt: "2026-10-25T18:00:00Z", peakAt: "2026-10-26T18:00:00Z",
      fadeAt: "2026-10-28T18:00:00Z", timezone: TIMEZONE, confidence: "locked" as const, minimumBeaches: 3, kind: "swell" as const,
      regionalKey: "San Diego:W:2026-10-26" };
    expect(eventStoryText(inWater, TODAY)).toBe("A west mid-period swell is already in the water, peaked Monday and fades Wednesday.");
    const later = { ...inWater, directionDeg: 90, periodS: 8, arrivalAt: "2026-11-03T18:00:00Z", peakAt: "2026-11-05T18:00:00Z", fadeAt: null };
    expect(eventStoryText(later, TODAY)).toBe("An east short-period windswell arrives a week from today and peaks a week from Thursday.");
  });

  it("names each day once when arrival, peak and fade share one, and gates a fade only when it names one", () => {
    // Today Tuesday. Thursday is 2026-10-29, Friday 2026-10-30.
    const base = { directionDeg: 270, periodS: 7, timezone: TIMEZONE, confidence: "locked" as const, minimumBeaches: 3,
      kind: "storm" as const, regionalKey: "San Diego:W:2026-10-29:s" };
    const story = (arrivalAt: string, peakAt: string, fadeAt: string | null) => eventStory({ ...base, arrivalAt, peakAt, fadeAt }, TODAY);

    const arrivesAndPeaks = story("2026-10-29T15:00:00Z", "2026-10-29T20:00:00Z", "2026-10-30T20:00:00Z");
    expect(arrivesAndPeaks.text).toBe("A stormy west short-period swell arrives and peaks Thursday, then fades Friday.");
    expect(arrivesAndPeaks.gate.fadeLocalDate).toBe("2026-10-30");
    const comesAndGoes = story("2026-10-29T15:00:00Z", "2026-10-29T18:00:00Z", "2026-10-29T23:00:00Z");
    expect(comesAndGoes.text).toBe("A stormy west short-period swell comes and goes Thursday.");
    expect(comesAndGoes.gate.fadeLocalDate).toBe("2026-10-29");
    const fadesOnPeakDay = story("2026-10-29T15:00:00Z", "2026-10-30T16:00:00Z", "2026-10-30T23:00:00Z");
    expect(fadesOnPeakDay.text).toBe("A stormy west short-period swell arrives Thursday and peaks Friday.");
    expect(fadesOnPeakDay.gate).toMatchObject({ arrivalLocalDate: "2026-10-29", peakLocalDate: "2026-10-30", fadeLocalDate: null });
    const noFade = story("2026-10-29T15:00:00Z", "2026-10-29T20:00:00Z", null);
    expect(noFade.text).toBe("A stormy west short-period swell arrives and peaks Thursday.");
    expect(noFade.gate.fadeLocalDate).toBeNull();
    // Already in the water, fading the day it peaks: no fade clause.
    const inWater = story("2026-10-26T15:00:00Z", "2026-10-28T16:00:00Z", "2026-10-28T23:00:00Z");
    expect(inWater.text).toBe("A stormy west short-period swell is already in the water and peaks Wednesday.");
    expect(inWater.gate.fadeLocalDate).toBeNull();
    for (const item of [arrivesAndPeaks, comesAndGoes, fadesOnPeakDay, noFade, inWater]) {
      expect(item.text).not.toMatch(/same day/);
    }
    // A gate without a fade still holds when the build's fade moves; one that names a fade does not.
    const build: RegionBuild = { region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null, beaches: [], rowsByBeach: {},
      events: [regionEvent("San Diego:W:2026-10-30:s", 270, 7, "2026-10-29T15:00:00Z", "2026-10-30T16:00:00Z", "2026-10-31T16:00:00Z",
        { kind: "storm" })] };
    const context = buildRegionGateContext(build, TODAY);
    expect(regionGateHolds(fadesOnPeakDay.gate, context)).toBe(true);
    expect(regionGateHolds(arrivesAndPeaks.gate, context)).toBe(false);
  });
});

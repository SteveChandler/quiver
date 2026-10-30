import { addDays } from "../swell-briefing-input";
import { buildStoryCandidates, storyEventKey, type RegionalDaySignal, type RegionalSwellEvent } from "../week-scout-story-candidates";
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
    signals[5].exposedBeaches = [
      { beachId: "a", beachName: "Ocean Beach", exposure: "open", qualityScore: 70 },
      { beachId: "b", beachName: "Blacks", exposure: "open", qualityScore: 60 },
      { beachId: "c", beachName: "La Jolla Shores", exposure: "shadowed", qualityScore: 40 },
    ];
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
    signals[5].exposedBeaches = [
      { beachId: "a", beachName: "First Open", exposure: "open", qualityScore: 10 },
      { beachId: "b", beachName: "Home Open", exposure: "open", qualityScore: 60 },
      { beachId: "c", beachName: "Best Open", exposure: "open", qualityScore: 90 },
      { beachId: "d", beachName: "First Shadow", exposure: "shadowed", qualityScore: 20 },
      { beachId: "e", beachName: "Home Shadow", exposure: "shadowed", qualityScore: 80 },
    ];
    expect(buildStoryCandidates(signals, "San Diego", [event()]).find((fact) => fact.gate.kind === "exposure")?.text)
      .toContain("Best Open and Home Open face this swell better than Home Shadow");
    signals[5].exposedBeaches.push(
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
});

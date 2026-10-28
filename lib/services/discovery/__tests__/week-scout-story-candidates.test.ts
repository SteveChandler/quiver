import { addDays } from "../swell-briefing-input";
import { buildStoryCandidates, type RegionalDaySignal } from "../week-scout-story-candidates";
import { assertStoryArtifactMatchesInput } from "../week-scout-story-validate";
import { WEEK_SCOUT_STORY_GENERATION_VERSION, type StoryArtifact, type StoryInput } from "../week-scout-story-types";

const start = "2026-10-27";
const days = (height: number | null = 1): RegionalDaySignal[] => Array.from({ length: 7 }, (_, index) => ({
  localDate: addDays(start, index), complete: true, sampleBeaches: 3,
  meanHeightFt: height, directionDeg: 270, periodS: 15,
  sourceSeries: "enhanced_forecasts:coast", forecastRevision: "2026-10-27T12:00:00Z",
}));

describe("regional Week Scout story candidates", () => {
  it("refuses sparse coverage and uncertain pulses instead of calling them quiet", () => {
    const sparse = days(); sparse[3].complete = false;
    expect(buildStoryCandidates(sparse)).toEqual([]);
    const uncertain = days(3); uncertain.forEach((day) => { day.directionDeg = null; });
    expect(buildStoryCandidates(uncertain)).toEqual([]);
  });

  it("offers gated directional arrival, peak and exposure without unsourced origin", () => {
    const signals = days(3);
    signals[3].meanHeightFt = 5;
    signals[3].exposure = { kind: "open", sampleBeaches: 3 };
    const facts = buildStoryCandidates(signals);
    expect(facts.find((fact) => fact.slot === "cover")?.gate).toMatchObject({
      kind: "swell", arrivalLocalDate: start, peakLocalDate: addDays(start, 3), directionSector: 6,
    });
    expect(facts.some((fact) => fact.gate.kind === "exposure")).toBe(true);
    expect(facts.some((fact) => fact.gate.kind === "origin")).toBe(false);
    const withOrigin = buildStoryCandidates(signals, { sourceAreaId: "verified-area", sourceLat: -45,
      sourceLon: 170, trackRevision: "track-rev", arrivalOrder: 0,
      matchedRegionalEventKey: `6-5-${addDays(start, 3)}`, confidence: "likely" });
    expect(withOrigin.some((fact) => fact.gate.kind === "origin")).toBe(true);
    const invalidOrigin = buildStoryCandidates(signals, { sourceAreaId: "verified-area", sourceLat: 999,
      sourceLon: 170, trackRevision: "track-rev", arrivalOrder: 0,
      matchedRegionalEventKey: `6-5-${addDays(start, 3)}`, confidence: "likely" });
    expect(invalidOrigin.some((fact) => fact.gate.kind === "origin")).toBe(false);
    expect(facts.every((fact) => !/\d/.test(fact.text) && fact.text.length <= 240)).toBe(true);
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
  const facts = buildStoryCandidates(days(3));
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
    briefing: { ...input.briefing, generatedAt: now.toISOString(), selections: facts.slice(0, 3).map((fact) => fact.id) },
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

export const WEEK_SCOUT_STORY_SCHEMA_VERSION = 3 as const;
export const WEEK_SCOUT_STORY_GENERATION_VERSION = "week-scout-story-1";

export type StoryGate =
  | { kind: "swell"; regionalEventKey: string; directionSector: number; periodBand: number; arrivalLocalDate: string; peakLocalDate: string; fadeLocalDate: string | null; confidence: "on_the_radar" | "likely" | "locked"; minimumBeaches: number }
  | { kind: "origin"; regionalEventKey: string; sourceAreaId: string; sourceLat: number; sourceLon: number; trackRevision: string; arrivalOrder: number; confidence: "likely" | "locked" }
  | { kind: "exposure"; regionalEventKey: string; directionSector: number; exposure: "open" | "partial" | "shadowed"; minimumBeaches: number }
  | { kind: "wind"; localDate: string; bucket: "morning" | "midday" | "evening"; fromWindClass: "offshore" | "onshore"; windClass: "offshore" | "onshore"; forecastRevision: string }
  | { kind: "tide"; localDate: string; bucket: "morning" | "midday" | "evening"; tidePhase: string; windowOrder: "opens" | "closes"; forecastRevision: string }
  | { kind: "change"; fromDate: string; toDate: string; direction: "better" | "worse"; minimumScoreChange: number; sourceSeries: string }
  | { kind: "quiet"; fromDate: string; toDate: string; completeDates: string[] };

export interface StoryCandidate {
  id: string;
  slot: string;
  text: string;
  gate: StoryGate;
}

export interface StoryInput {
  schemaVersion: 3;
  region: string;
  editionDate: string;
  sourcePublishedAt: string;
  validUntil: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[] };
  copyFacts: StoryCandidate[];
  provenance: { sourceIds: string[]; sourceHashes: string[]; generationInputVersion: string; representativeBeachIds: string[]; coverageDates: string[]; coverage?: Array<{ localDate: string; sampleBeaches: number; rows: number }>; fixture?: boolean };
  inputHash: string;
}

export interface StoryArtifact {
  artifactId: string;
  schemaVersion: 3;
  region: string;
  editionDate: string;
  inputHash: string;
  sourcePublishedAt: string;
  validUntil: string;
  generationVersion: string;
  model: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[] };
  provenance: StoryInput["provenance"];
}

export interface StoryWire {
  schemaVersion: 3;
  region: string | null;
  availability: "ready" | "pending" | "outside_region" | "unavailable";
  cover: { text: string | null; swells: Array<{ eventKey: string; directionDeg: number; directionLabel: string; periodS: number; arrivalAt: string; peakAt: string }> };
  lead: string | null;
  turn: string | null;
  chapters: Array<{ slot: string; text: string }>;
  days: Array<{ localDate: string; pick: null | {
    windowId: string; beachId: string; bucket: "morning" | "midday" | "evening";
    verdict: "worth_it" | "maybe" | "skip" | null;
    personalVerdict?: "go" | "maybe" | "no";
    personalLabel?: "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH";
    conditionScore: number | null; displayWindowStart: string; displayWindowEnd: string;
    waveHeight: string | null;
  } }>;
}

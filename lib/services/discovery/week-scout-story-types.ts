export const WEEK_SCOUT_STORY_SCHEMA_VERSION = 3 as const;
export const WEEK_SCOUT_STORY_GENERATION_VERSION = "week-scout-story-1";
/** -1 selects candidates; -2 also sends a sentence Gemma wrote for some picks, checked when served. */
export const WEEK_SCOUT_STORY_GENERATION_VERSIONS = ["week-scout-story-1", "week-scout-story-2"] as const;

export type StoryGate =
  | { kind: "swell"; regionalEventKey: string; directionSector: number; directionIndex?: number; periodBand: number; periodClass?: "long" | "mid" | "short"; arrivalLocalDate: string; peakLocalDate: string; fadeLocalDate: string | null; confidence: "on_the_radar" | "likely" | "locked"; minimumBeaches: number }
  | { kind: "origin"; regionalEventKey: string; sourceAreaId: string; sourceLat: number; sourceLon: number; trackRevision: string; arrivalOrder: number; confidence: "likely" | "locked" }
  | { kind: "exposure"; regionalEventKey: string; directionSector: number; exposure: "open" | "partial" | "shadowed"; minimumBeaches: number; beaches?: Array<{ beachId: string; exposure: "open" | "partial" | "shadowed" }> }
  | { kind: "beach"; regionalEventKey: string; beachId: string; exposure: "open" | "partial" | "shadowed"; wind: "light" | "breezy" | "windy" }
  | { kind: "wind"; localDate: string; bucket: "morning" | "midday" | "evening"; fromWindClass: "offshore" | "onshore"; windClass: "offshore" | "onshore"; forecastRevision: string; beachId?: string; fromBucket?: "morning" | "midday" | "evening"; fromDirection?: string; toDirection?: string }
  | { kind: "wind_pattern"; days: Array<Extract<StoryGate, { kind: "wind" }>> }
  | { kind: "tide"; localDate: string; bucket: "morning" | "midday" | "evening"; tidePhase: string; windowOrder: "opens" | "closes"; forecastRevision: string; beachId?: string }
  | { kind: "change"; fromDate: string; toDate: string; direction: "better" | "worse"; minimumScoreChange: number; sourceSeries: string }
  | { kind: "day"; localDate: string; bucket: "morning" | "midday" | "evening"; reason: "light_wind" | "rising_tide" | "clean_window" }
  | { kind: "quiet"; fromDate: string; toDate: string; completeDates: string[] };

export interface StoryCandidate {
  id: string;
  slot: string;
  text: string;
  gate: StoryGate;
  rank?: number;
}

export interface StoryInput {
  schemaVersion: 3;
  region: string;
  editionDate: string;
  sourcePublishedAt: string;
  validUntil: string;
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[] };
  copyFacts: StoryCandidate[];
  /** Every region beach, id to name, so a rewritten sentence can be checked for beaches its fact doesn't name. */
  beachNames: Record<string, string>;
  provenance: { sourceIds: string[]; sourceHashes: string[]; generationInputVersion: string; representativeBeachIds: string[]; coverageDates: string[]; coverage?: Array<{ localDate: string; sampleBeaches: number; rows: number }>; fixture?: boolean };
  inputHash: string;
}

/** A sentence the PC wrote for one selected candidate; served only if it claims nothing its candidate doesn't. */
export interface StoryWrittenSentence {
  slot: string;
  basedOn: string;
  text: string;
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
  briefing: { schemaVersion: 3; editionDate: string; generatedAt: string; selections: string[]; written?: StoryWrittenSentence[] };
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

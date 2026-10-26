/**
 * Server-side mirror of the native `SwellBriefing` contract in
 * `quiver-native/src/features/swell-outlook/briefing-types.ts`.
 *
 * The native parser reads field by field and drops what it cannot read, so the
 * shape here is the one it accepts rather than the one it requires. Anything
 * stored must survive that parser: see `swell-briefing-validate.ts`.
 */

export interface BriefingSizeRange {
  min: number;
  max: number;
}

export interface BriefingBeachRef {
  /** A real `beaches.id` UUID. Slugs render a blank hero and a failed detail screen. */
  id: string;
  name: string;
}

export type BriefingFreshness = "fresh" | "aging" | "stale";
export type BriefingExposureKey = "south_facing" | "west_facing" | "northwest_facing";
export type BriefingWindKind = "offshore" | "onshore" | "cross" | "light_variable" | "unknown";
export type BriefingDayTrend = "flat" | "small" | "building" | "bigger" | "easing" | "uncertain";
export type BriefingAdvisoryKind = "weather" | "wind" | "hazard" | "info";

export interface BriefingPhoto {
  beachId: string;
  beachName: string;
  imageUrl: string | null;
}

export interface BriefingExposure {
  exposure: BriefingExposureKey;
  label: string;
  surfFt: BriefingSizeRange | null;
  surfLabel: string | null;
  beach: BriefingBeachRef | null;
}

export interface BriefingToday {
  date: string;
  exposures: BriefingExposure[];
  primaryDirectionDeg: number | null;
  primaryDirectionLabel: string | null;
  primaryPeriodS: number | null;
  call: string | null;
}

export interface BriefingWindPeriod {
  period: "am" | "pm";
  kind: BriefingWindKind;
  label: string;
  speedLabel: string | null;
  speedMph: number | null;
  directionDeg: number | null;
  surfFt: BriefingSizeRange | null;
  surfLabel: string | null;
}

export interface BriefingNext48Day {
  date: string;
  periods: BriefingWindPeriod[];
  note: string | null;
}

export interface BriefingWeekDay {
  date: string;
  surfFt: BriefingSizeRange | null;
  trend: BriefingDayTrend;
  label: string;
  uncertain: boolean;
  highlightLabel: string | null;
  caveat: string | null;
  beach: BriefingBeachRef | null;
}

export interface BriefingAdvisory {
  id: string;
  kind: BriefingAdvisoryKind;
  title: string;
  body: string;
  beach: BriefingBeachRef | null;
}

export interface SwellBriefing {
  editionDate: string;
  regionLabel: string;
  headline: string;
  generatedAt: string;
  dataAt: string;
  freshness: BriefingFreshness;
  photo: BriefingPhoto | null;
  today: BriefingToday;
  next48: BriefingNext48Day[];
  week: BriefingWeekDay[];
  advisories: BriefingAdvisory[];
}

/** Copy the model may choose between. Code keeps every measurement. */
export interface BriefingCopyFact {
  id: string;
  /** `headline`, `todayCall`, `next48:YYYY-MM-DD` or `week:YYYY-MM-DD`. */
  slot: string;
  text: string;
}

export interface SwellBriefingProvenance {
  sourceIds: string[];
  sourceHashes: string[];
  generationInputVersion: string;
  /** Marks a snapshot built from a development fixture; such a snapshot is never publishable. */
  fixture?: boolean;
}

export interface SwellBriefingInputSnapshot {
  schemaVersion: 1;
  userId: string;
  region: string;
  editionDate: string;
  sourcePublishedAt: string;
  validUntil: string;
  briefing: SwellBriefing;
  copyFacts: BriefingCopyFact[];
  provenance: SwellBriefingProvenance;
  inputHash: string;
}

export interface SwellBriefingArtifact {
  artifactId: string;
  schemaVersion: 1;
  userId: string;
  region: string;
  editionDate: string;
  inputHash: string;
  sourcePublishedAt: string;
  validUntil: string;
  generationVersion: string;
  model: string;
  briefing: SwellBriefing;
  provenance: SwellBriefingProvenance | null;
}

export interface SwellBriefingPublishResult {
  artifactId: string;
  created: boolean;
}

export const BRIEFING_COPY_SLOT_PREFIXES = ["next48:", "week:"] as const;
export const BRIEFING_FIXED_COPY_SLOTS = ["headline", "todayCall"] as const;
export const MAX_BRIEFING_COPY_FACTS = 100;
export const MAX_BRIEFING_COPY_LENGTH = 240;

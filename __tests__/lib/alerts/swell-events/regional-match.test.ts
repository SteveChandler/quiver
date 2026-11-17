/** @jest-environment node */
jest.mock("@/lib/alerts/swell-events/regional", () => ({ loadRegionForecastEvents: jest.fn() }));
jest.mock("@/lib/alerts/swell-events/regional-narrative", () => {
  const actual = jest.requireActual("@/lib/alerts/swell-events/regional-narrative");
  return { ...actual, loadRegionNarrativeEdition: jest.fn(async () => null) };
});

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadRegionForecastEvents, type InternalRegionEvent, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import { loadPushRegionStory, matchRegionEvent } from "@/lib/alerts/swell-events/regional-match";
import { loadRegionNarrativeEdition, prepareRegionNarration, regionEventStory, type NarrativeEdition } from "@/lib/alerts/swell-events/regional-narrative";
import { buildEventCandidates, storyEventsFromRegion } from "@/lib/services/discovery/week-scout-story-candidates";
import { buildRegionGateContext } from "@/lib/services/discovery/week-scout-story-region-gate";
import { STORY_SAMPLE_VERSION } from "@/lib/services/discovery/week-scout-story-source";
import type { StoryArtifact, StoryInput } from "@/lib/services/discovery/week-scout-story-types";
import type { Database } from "@/types/database";

const TIMEZONE = "America/Los_Angeles";
// Monday Nov 16, 2026, 10:00 PT.
const NOW = new Date("2026-11-16T18:00:00.000Z");
const SOLANA = "65d3a4de-1f4b-4a1d-8ce0-b5b67288ee08";
const OTHER = "5e72b79d-a12d-4cd3-8da4-b7b92069efbf";

function event(key: string, overrides: Partial<InternalRegionEvent> = {}): InternalRegionEvent {
  return {
    key, kind: "swell", source: "forecast", directionDeg: 202, directionLabel: "SSW", periodS: 17,
    arrivalAt: "2026-11-22T15:00:00.000Z", peakAt: "2026-11-23T18:00:00.000Z", fadeAt: "2026-11-25T18:00:00.000Z",
    peakLocalDate: "2026-11-23", offshoreFt: "2 ft", history: null, memberCount: 4, ...overrides,
  };
}

const SSW = event("San Diego:SSW:2026-11-23", { memberFaceFt: { [SOLANA]: 3.4 }, memberDirections: { [SOLANA]: 205 } });
const STORM = event("San Diego:W:2026-11-20:s", { kind: "storm", directionDeg: 270, directionLabel: "W", periodS: 8,
  arrivalAt: "2026-11-19T15:00:00.000Z", peakAt: "2026-11-20T17:00:00.000Z", fadeAt: "2026-11-21T03:00:00.000Z",
  peakLocalDate: "2026-11-20", memberFaceFt: { [OTHER]: 4 }, exposureDirectionDeg: 275 });
const build = (events: InternalRegionEvent[]): RegionBuild => ({ region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null,
  beaches: [], events, rowsByBeach: {} });
const push = (overrides: Partial<Parameters<typeof matchRegionEvent>[1]> = {}) => ({
  eventKey: `${SOLANA}:SSW:2026-11-23:p`, beachId: SOLANA, peakAt: "2026-11-23T21:00:00.000Z", directionDeg: 200, ...overrides,
});

describe("matchRegionEvent", () => {
  it("rule 1: the push beach is a member and the peaks are 24 hours apart or less", () => {
    expect(matchRegionEvent(build([SSW, STORM]), push())?.key).toBe(SSW.key);
    expect(matchRegionEvent(build([SSW]), push({ peakAt: "2026-11-24T18:00:00.000Z" }))?.key).toBe(SSW.key);
    expect(matchRegionEvent(build([SSW]), push({ peakAt: "2026-11-24T18:00:01.000Z" }))).toBeNull();
  });

  it("keeps the push's kind: a key ending in :s matches only a storm", () => {
    const storm = push({ eventKey: `${OTHER}:W:2026-11-20:s`, beachId: OTHER, peakAt: "2026-11-20T18:00:00.000Z", directionDeg: 268 });
    expect(matchRegionEvent(build([SSW, STORM]), storm)?.key).toBe(STORM.key);
    expect(matchRegionEvent(build([{ ...STORM, kind: "swell" }]), storm)).toBeNull();
    expect(matchRegionEvent(build([STORM]), { ...storm, eventKey: `${OTHER}:W:2026-11-20:p` })).toBeNull();
  });

  it("rule 2, only without a member match: the near-beach direction within 45 degrees", () => {
    const notMember = { ...SSW, memberFaceFt: {} };
    expect(matchRegionEvent(build([notMember]), push({ directionDeg: 245 }))?.key).toBe(SSW.key);
    expect(matchRegionEvent(build([notMember]), push({ directionDeg: 251 }))).toBeNull();
    // Without a member direction, the event's near-beach lead direction.
    const lead = { ...SSW, memberFaceFt: {}, memberDirections: {}, exposureDirectionDeg: 190 };
    expect(matchRegionEvent(build([lead]), push({ directionDeg: 235 }))?.key).toBe(SSW.key);
    expect(matchRegionEvent(build([lead]), push({ directionDeg: 236 }))).toBeNull();
  });

  it("stays template on two matches, on no match, and for an early look", () => {
    const twin = { ...SSW, key: "San Diego:SSW:2026-11-23.2" };
    expect(matchRegionEvent(build([SSW, twin]), push())).toBeNull();
    expect(matchRegionEvent(build([{ ...SSW, memberFaceFt: {} }, { ...twin, memberFaceFt: {} }]), push())).toBeNull();
    expect(matchRegionEvent(build([]), push())).toBeNull();
    expect(matchRegionEvent(build([{ ...SSW, source: "wam" }]), push())).toBeNull();
    // A member match wins over a direction match.
    expect(matchRegionEvent(build([{ ...twin, memberFaceFt: {} }, SSW]), push())?.key).toBe(SSW.key);
  });
});

/** Today's edition with one written sentence per given slot, over this build's own card candidates. */
function edition(region: RegionBuild, written: Record<string, string>): NarrativeEdition {
  const today = "2026-11-16";
  const copyFacts = buildEventCandidates(region, storyEventsFromRegion(region, today).all, buildRegionGateContext(region, today), NOW);
  const input: StoryInput = {
    schemaVersion: 3, region: "San Diego", editionDate: today, sourcePublishedAt: "2026-11-16T14:00:00.000Z",
    validUntil: "2026-11-17T15:00:00.000Z", briefing: { schemaVersion: 3, editionDate: today, generatedAt: "2026-11-16T14:00:00.000Z", selections: [] },
    copyFacts, beachNames: {}, inputHash: "input-hash",
    provenance: { sourceIds: [], sourceHashes: [], generationInputVersion: STORY_SAMPLE_VERSION, representativeBeachIds: [], coverageDates: [] },
  };
  const artifact: StoryArtifact = {
    artifactId: "artifact", schemaVersion: 3, region: "San Diego", editionDate: today, inputHash: input.inputHash,
    sourcePublishedAt: input.sourcePublishedAt, validUntil: input.validUntil, generationVersion: "week-scout-story-2", model: "gemma",
    briefing: { ...input.briefing, generatedAt: "2026-11-16T14:05:00.000Z", selections: copyFacts.map((fact) => fact.id),
      written: Object.entries(written).map(([slot, text]) => ({ slot, basedOn: copyFacts.find((fact) => fact.slot === slot)!.id, text })) },
    provenance: input.provenance,
  };
  return { input, artifact };
}

describe("push wording of the card sentence", () => {
  it("dates each day in the server sentence", () => {
    const narration = prepareRegionNarration({ build: build([SSW]), edition: null, now: NOW });
    expect(regionEventStory(narration, SSW.key, { datedDays: true })).toEqual({ storySource: "code",
      story: "A south-southwest long-period groundswell arrives Sunday Nov 22, peaks Monday Nov 23 and fades Wednesday Nov 25." });
    expect(regionEventStory(narration, SSW.key)).toEqual({ storySource: "code",
      story: "A south-southwest long-period groundswell arrives Sunday, peaks a week from today and fades a week from Wednesday." });
  });

  it("uses a written sentence only when it names no relative day", () => {
    const region = build([SSW, STORM]);
    const written = {
      "event:6-2-2026-11-20-s:story": "West storm swell shows up Thursday and peaks Friday.",
      "event:4-5-2026-11-23:story": "South-southwest groundswell shows up Sunday, peaks a week from today and fades a week from Wednesday.",
    };
    expect(Object.keys(written).every((slot) => edition(region, {}).input.copyFacts.some((fact) => fact.slot === slot))).toBe(true);
    const narration = prepareRegionNarration({ build: region, edition: edition(region, written), now: NOW });
    // The card serves both.
    expect(regionEventStory(narration, STORM.key)).toEqual({ story: written["event:6-2-2026-11-20-s:story"], storySource: "written" });
    expect(regionEventStory(narration, SSW.key)).toEqual({ story: written["event:4-5-2026-11-23:story"], storySource: "written" });
    // The push keeps the plain-weekday one and dates the other.
    expect(regionEventStory(narration, STORM.key, { datedDays: true }))
      .toEqual({ story: written["event:6-2-2026-11-20-s:story"], storySource: "written" });
    expect(regionEventStory(narration, SSW.key, { datedDays: true })).toEqual({ storySource: "code",
      story: "A south-southwest long-period groundswell arrives Sunday Nov 22, peaks Monday Nov 23 and fades Wednesday Nov 25." });
  });
});

describe("loadPushRegionStory", () => {
  const client = (row: { region: string | null; timezone: string | null } | null) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
  }) as unknown as SupabaseClient<Database>;
  const previous = process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST;
  afterEach(() => {
    if (previous === undefined) delete process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST;
    else process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = previous;
    jest.clearAllMocks();
  });

  it("returns the matched region swell's name, keys and dated server sentence", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(build([SSW, STORM]));
    const told = await loadPushRegionStory({ client: client({ region: "San Diego", timezone: TIMEZONE }), userId: "user", swell: push(), now: NOW });
    expect(told).toEqual({ regionEventKey: SSW.key, storyKey: "4-5-2026-11-23", storySource: "code",
      story: "A south-southwest long-period groundswell arrives Sunday Nov 22, peaks Monday Nov 23 and fades Wednesday Nov 25.",
      directionLabel: "SSW", kind: "swell", periodS: 17, peakAt: SSW.peakAt });
    expect(loadRegionForecastEvents).toHaveBeenCalledWith(expect.objectContaining({ region: "San Diego", timezone: TIMEZONE, now: NOW }));
  });

  it("reads the PC edition only for an account on a set story allowlist", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(build([SSW]));
    const beach = client({ region: "San Diego", timezone: TIMEZONE });
    delete process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST;
    await loadPushRegionStory({ client: beach, userId: "pilot", swell: push(), now: NOW });
    process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "someone-else";
    await loadPushRegionStory({ client: beach, userId: "pilot", swell: push(), now: NOW });
    expect(loadRegionNarrativeEdition).not.toHaveBeenCalled();
    process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "someone-else, pilot";
    await loadPushRegionStory({ client: beach, userId: "pilot", swell: push(), now: NOW });
    expect(loadRegionNarrativeEdition).toHaveBeenCalledTimes(1);
  });

  it("gives null for a beach with no region or no matching region swell", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(build([STORM]));
    expect(await loadPushRegionStory({ client: client({ region: null, timezone: null }), userId: "user", swell: push(), now: NOW })).toBeNull();
    expect(loadRegionForecastEvents).not.toHaveBeenCalled();
    expect(await loadPushRegionStory({ client: client({ region: "San Diego", timezone: TIMEZONE }), userId: "user", swell: push(), now: NOW }))
      .toBeNull();
  });
});

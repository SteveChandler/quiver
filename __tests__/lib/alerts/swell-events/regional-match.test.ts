/** @jest-environment node */
jest.mock("@/lib/alerts/swell-events/regional", () => ({ loadRegionForecastEvents: jest.fn() }));
jest.mock("@/lib/alerts/swell-events/regional-narrative", () => {
  const actual = jest.requireActual("@/lib/alerts/swell-events/regional-narrative");
  return { ...actual, loadRegionNarrativeEdition: jest.fn(async () => null) };
});

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadRegionForecastEvents, type InternalRegionEvent, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import { createPushStoryCache, loadPushRegionStory, matchRegionEvent } from "@/lib/alerts/swell-events/regional-match";
import { loadRegionNarrativeEdition, prepareRegionNarration, regionEventStory, type NarrativeEdition } from "@/lib/alerts/swell-events/regional-narrative";
import { buildEventCandidates, storyEventsFromRegion } from "@/lib/services/discovery/week-scout-story-candidates";
import { buildRegionGateContext } from "@/lib/services/discovery/week-scout-story-region-gate";
import { STORY_SAMPLE_VERSION } from "@/lib/services/discovery/week-scout-story-source";
import type { StoryArtifact, StoryInput } from "@/lib/services/discovery/week-scout-story-types";
import { namesSize } from "@/lib/services/discovery/week-scout-story-claims";
import { buildFirstSightingPayload } from "@/lib/alerts/swell-outlook/first-sighting";
import { outlookSwell } from "@/__tests__/helpers/outlook-swell";
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
      story: "A long-period SSW groundswell fills in Sun Nov 22, peaks Mon and fades Wed." });
    expect(regionEventStory(narration, SSW.key)).toEqual({ storySource: "code",
      story: "A south-southwest long-period groundswell arrives Sunday, peaks a week from today and fades a week from Wednesday." });
  });

  it("names a holiday peak by the holiday and short days after a dated one", () => {
    // Saturday Nov 21, 2026: the WNW groundswell that peaks on Thanksgiving.
    const saturday = new Date("2026-11-21T20:24:00.000Z");
    const wnw = event("San Diego:WNW:2026-11-26", { directionDeg: 292, directionLabel: "WNW",
      arrivalAt: "2026-11-25T16:00:00.000Z", peakAt: "2026-11-26T20:00:00.000Z", fadeAt: "2026-11-27T20:00:00.000Z", peakLocalDate: "2026-11-26" });
    const narration = prepareRegionNarration({ build: build([wnw]), edition: null, now: saturday });
    expect(regionEventStory(narration, wnw.key, { datedDays: true })).toEqual({ storySource: "code",
      story: "A long-period WNW groundswell fills in Wed Nov 25, peaks Thanksgiving Day and fades Fri." });
    // The card keeps its own words.
    expect(regionEventStory(narration, wnw.key).story).toBe("A west-northwest long-period groundswell arrives Wednesday, peaks Thursday and fades Friday.");
  });

  it("uses a written push sentence only when it names no day at all", () => {
    const region = build([SSW, STORM]);
    const STORM_SLOT = "event:6-2-2026-11-20-s:story";
    const SSW_SLOT = "event:4-5-2026-11-23:story";
    const written = (storm: string) => ({ [STORM_SLOT]: storm,
      [SSW_SLOT]: "South-southwest groundswell shows up Sunday, peaks a week from today and fades a week from Wednesday." });
    const narration = (storm: string) => prepareRegionNarration({ build: region, edition: edition(region, written(storm)), now: NOW });
    const weekdays = narration("West storm swell shows up Thursday and peaks Friday.");
    // The card serves both written sentences.
    expect(regionEventStory(weekdays, STORM.key)).toEqual({ story: "West storm swell shows up Thursday and peaks Friday.", storySource: "written" });
    expect(regionEventStory(weekdays, SSW.key).storySource).toBe("written");
    // A push can be read days later: a bare weekday, a short one or a relative day gives the server's dated sentence.
    const dated = { storySource: "code", story: "A short-period W storm swell fills in Thu Nov 19 and peaks Fri." };
    expect(regionEventStory(weekdays, STORM.key, { datedDays: true })).toEqual(dated);
    expect(regionEventStory(narration("West storm swell shows up Thu and peaks Fri."), STORM.key, { datedDays: true })).toEqual(dated);
    expect(regionEventStory(weekdays, SSW.key, { datedDays: true })).toEqual({ storySource: "code",
      story: "A long-period SSW groundswell fills in Sun Nov 22, peaks Mon and fades Wed." });
    // With no day word, the written sentence serves in the push too.
    const dayless = narration("A west storm swell is on the way.");
    expect(regionEventStory(dayless, STORM.key, { datedDays: true })).toEqual({ story: "A west storm swell is on the way.", storySource: "written" });
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
      story: "A long-period SSW groundswell fills in Sun Nov 22, peaks Mon and fades Wed.",
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

  it("builds a region and reads its edition once per run for two users there", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(build([SSW, STORM]));
    process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "pilot-a,pilot-b";
    const reads = jest.fn(async () => ({ data: { region: "San Diego", timezone: TIMEZONE }, error: null }));
    const counted = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: reads }) }) }) } as unknown as SupabaseClient<Database>;
    const cache = createPushStoryCache();
    const storm = push({ eventKey: `${OTHER}:W:2026-11-20:s`, beachId: OTHER, peakAt: "2026-11-20T18:00:00.000Z", directionDeg: 268 });
    const [first, second] = await Promise.all([
      loadPushRegionStory({ client: counted, userId: "pilot-a", swell: push(), now: NOW, cache }),
      loadPushRegionStory({ client: counted, userId: "pilot-b", swell: storm, now: NOW, cache }),
    ]);
    expect([first?.regionEventKey, second?.regionEventKey]).toEqual([SSW.key, STORM.key]);
    expect(loadRegionForecastEvents).toHaveBeenCalledTimes(1);
    expect(loadRegionNarrativeEdition).toHaveBeenCalledTimes(1);
    // A third push from the first beach reads nothing again.
    await loadPushRegionStory({ client: counted, userId: "pilot-a", swell: push(), now: NOW, cache });
    expect(reads).toHaveBeenCalledTimes(2);
    expect(loadRegionForecastEvents).toHaveBeenCalledTimes(1);
    // Without a shared cache, each call builds.
    await loadPushRegionStory({ client: counted, userId: "pilot-a", swell: push(), now: NOW });
    expect(loadRegionForecastEvents).toHaveBeenCalledTimes(2);
  });

  it("gives null for a beach with no region or no matching region swell", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(build([STORM]));
    expect(await loadPushRegionStory({ client: client({ region: null, timezone: null }), userId: "user", swell: push(), now: NOW })).toBeNull();
    expect(loadRegionForecastEvents).not.toHaveBeenCalled();
    expect(await loadPushRegionStory({ client: client({ region: "San Diego", timezone: TIMEZONE }), userId: "user", swell: push(), now: NOW }))
      .toBeNull();
  });

  describe("one size per push: the Solana Beach case", () => {
    // Four San Diego beaches open to the west-northwest, head-high on the peak day and overhead at the two biggest.
    const beaches: RegionBuild["beaches"] = ["Solana Beach", "Del Mar", "Cardiff", "Swami's"].map((name, index) => ({
      id: index === 0 ? SOLANA : `00000000-0000-4000-8000-00000000000${index}`, name, lat: 32.99 + index * 0.02, lon: -117.27,
      aspect_deg: null, wind_offshore_deg: null, wind_offshore_tol_deg: null, punchiness: null,
      swell_window_center_deg: 292, swell_window_halfwidth_deg: 40 }));
    const heights = ["5-6ft", "5-6ft", "7-8ft", "7-9ft"];
    const WNW = event("San Diego:NW:2026-11-17", { directionDeg: 292, directionLabel: "WNW", periodS: 14.9,
      arrivalAt: "2026-11-16T15:00:00.000Z", peakAt: "2026-11-17T18:00:00.000Z", fadeAt: "2026-11-18T18:00:00.000Z",
      peakLocalDate: "2026-11-17", offshoreFt: "7 ft" });
    const sized: RegionBuild = { ...build([WNW]), beaches, rowsByBeach: Object.fromEntries(beaches.map((beach, index) =>
      [beach.id, [16, 19, 22].map((hour) => ({ forecast_at: `2026-11-17T${hour}:00:00.000Z`, wave_height: heights[index],
        wave_period: "15", wind_speed: "5 mph", wind_direction: null, tide_height: null, tide_status: null, swell_1_period: "15s" }))])) };
    const solana = push({ eventKey: `${SOLANA}:WNW:2026-11-17:p`, peakAt: "2026-11-17T18:00:00.000Z", directionDeg: 290 });
    const load = (withoutSize?: boolean) => loadPushRegionStory({ client: client({ region: "San Diego", timezone: TIMEZONE }),
      userId: "user", swell: solana, now: NOW, ...(withoutSize === undefined ? {} : { withoutSize }) });

    it("leaves the regional size out of the sentence when the body states the beach's size", async () => {
      jest.mocked(loadRegionForecastEvents).mockResolvedValue(sized);
      const full = await load();
      expect(full?.story).toBe("A long-period WNW groundswell fills in Mon Nov 16, peaks Tue and fades Wed: "
        + "head-high at most spots, overhead at the standouts.");
      const bare = await load(true);
      expect(bare).toMatchObject({ storySource: "code",
        story: "A long-period WNW groundswell fills in Mon Nov 16, peaks Tue and fades Wed." });

      const outlook = outlookSwell({ id: solana.eventKey, eventKey: solana.eventKey, arrivalAt: WNW.arrivalAt, peakAt: WNW.peakAt,
        directionDeg: 290, directionLabel: "WNW", periodS: 14.9, faceHeightFt: { min: 3, max: 4 }, beach: { id: SOLANA, name: "Solana Beach" },
        beachCount: 1, sizeByOrientation: { southFacing: null, westFacing: null }, source: "unknown" });
      const { body } = buildFirstSightingPayload({ swell: outlook, timezone: TIMEZONE, now: NOW, storyPush: { story: bare } });
      expect(body).toBe("A long-period WNW groundswell fills in Mon Nov 16, peaks Tue and fades Wed. "
        + "Sets to 4 ft at Solana Beach.");
      // The beach line is the body's only size statement.
      expect(namesSize(body.replace("Sets to 4 ft at Solana Beach.", ""))).toBe(false);
    });

    it("drops a written sentence that states a size for the server's sentence without one", async () => {
      jest.mocked(loadRegionForecastEvents).mockResolvedValue(sized);
      process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "pilot";
      const written = (text: string): NarrativeEdition => edition(sized, { "event:6-4-2026-11-17:story": text });
      const withSize = "A west-northwest groundswell is on the way, head-high at most spots.";
      const plain = "A west-northwest groundswell is on the way.";
      const told = async (text: string, withoutSize: boolean) => {
        jest.mocked(loadRegionNarrativeEdition).mockResolvedValueOnce(written(text));
        return loadPushRegionStory({ client: client({ region: "San Diego", timezone: TIMEZONE }), userId: "pilot", swell: solana, now: NOW, withoutSize });
      };
      expect(await told(withSize, false)).toMatchObject({ story: withSize, storySource: "written" });
      expect(await told(withSize, true)).toMatchObject({ storySource: "code",
        story: "A long-period WNW groundswell fills in Mon Nov 16, peaks Tue and fades Wed." });
      expect(await told(plain, true)).toMatchObject({ story: plain, storySource: "written" });
    });
  });
});

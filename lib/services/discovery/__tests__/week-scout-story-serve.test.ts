import { WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";
import type { CanonicalWeekScoutResponse } from "../week-scout";
import { bindStory, storyGateHolds } from "../week-scout-story-serve";
import type { StoryInput } from "../week-scout-story-types";

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

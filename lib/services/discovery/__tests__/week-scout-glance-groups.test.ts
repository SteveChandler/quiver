import type { RegionalSwellEvent } from "../week-scout-story-candidates";
import { groupGlanceEvents, onGlanceStrip } from "../week-scout-glance-groups";
import { sizeWordsFor, type CandidateFacts } from "../week-scout-story-facts";
import { glanceSanDiego } from "./fixtures/glance-san-diego-2026-11-05";

const { today, timezone, stored, factsFor } = glanceSanDiego;

const westAt = (regionalKey: string, peakAt: string): RegionalSwellEvent => ({
  directionDeg: 270, periodS: 15, arrivalAt: peakAt, peakAt, fadeAt: null, timezone,
  confidence: "likely", minimumBeaches: 3, kind: "swell", regionalKey,
});

describe("groupGlanceEvents", () => {
  it("groups the Nov 13–14 west events as one system and keeps the SSW apart", () => {
    const groups = groupGlanceEvents(stored.filter((e) => e.peakAt >= "2026-11-13"), timezone, factsFor);
    expect(groups.map((g) => g.events.map((e) => e.regionalKey))).toEqual([["wnw-fri", "w-fri", "w-storm-sat"], ["ssw-sat"]]);
    expect(groups[0]).toMatchObject({ label: "west", noun: "swell", peakDate: "2026-11-13", fadeDate: "2026-11-15", confidence: "likely" });
    expect(groups[0].facts?.faceFt).toEqual({ min: 5, max: 6 });
    expect(groups[1]).toMatchObject({ label: "south-southwest", noun: "groundswell" });
  });

  it("keeps today's west and SSW apart (68° apart)", () => {
    expect(groupGlanceEvents(stored.slice(0, 2), timezone, factsFor)).toHaveLength(2);
  });

  it("does not chain: an event 30 h after a member but 40 h after the anchor starts its own group", () => {
    const anchor = westAt("anchor", "2026-11-08T00:00:00Z");
    const member = westAt("member", "2026-11-08T10:00:00Z");
    const third = westAt("third", "2026-11-09T16:00:00Z");
    const groups = groupGlanceEvents([third, member, anchor], timezone, () => null);
    expect(groups.map((g) => g.events.map((e) => e.regionalKey))).toEqual([["anchor", "member"], ["third"]]);
  });

  it("takes the standout range and words together from a non-lead member", () => {
    const lead = westAt("lead", "2026-11-08T00:00:00Z");
    const member = westAt("member", "2026-11-08T10:00:00Z");
    const leadFacts: CandidateFacts = { faceFt: { min: 4, max: 5 }, sizes: sizeWordsFor({ min: 4, max: 5 }), breaker: null,
      standoutFt: { min: 5, max: 6 }, standoutSizes: sizeWordsFor({ min: 5, max: 6 }) };
    const memberStandout = { min: 8, max: 10 };
    const memberFacts: CandidateFacts = { faceFt: { min: 2, max: 3 }, sizes: sizeWordsFor({ min: 2, max: 3 }), breaker: null,
      standoutFt: memberStandout, standoutSizes: sizeWordsFor(memberStandout) };
    const [group] = groupGlanceEvents([lead, member], timezone, (e) => e === lead ? leadFacts : memberFacts);
    expect(group.lead).toBe(lead);
    expect(group.facts).toMatchObject({ faceFt: leadFacts.faceFt, sizes: leadFacts.sizes });
    expect(group.facts?.standoutFt).toEqual(memberStandout);
    expect(group.facts?.standoutSizes).toEqual(sizeWordsFor(memberStandout));
    // A standout range without words never borrows the lead's words.
    const { standoutSizes: _words, ...bare } = memberFacts;
    const [unworded] = groupGlanceEvents([lead, member], timezone, (e) => e === lead ? leadFacts : bare);
    expect(unworded.facts?.standoutFt).toEqual(memberStandout);
    expect(unworded.facts).not.toHaveProperty("standoutSizes");
  });

  it("names the group by its biggest event, not its anchor", () => {
    const [west] = groupGlanceEvents(stored.filter((e) => e.peakAt >= "2026-11-13"), timezone, factsFor);
    expect(west.events[0].regionalKey).toBe("wnw-fri");
    expect(west.lead.regionalKey).toBe("w-fri");
    expect(west.label).toBe("west");
  });
});

describe("onGlanceStrip", () => {
  it("onGlanceStrip keeps day 14 and drops day 15 and a swell that faded yesterday", () => {
    expect(onGlanceStrip({ arrivalAt: null, peakAt: "2026-11-19T20:00:00Z", fadeAt: null }, today, timezone)).toBe(true);
    expect(onGlanceStrip({ arrivalAt: null, peakAt: "2026-11-20T20:00:00Z", fadeAt: null }, today, timezone)).toBe(false);
    expect(onGlanceStrip({ arrivalAt: "2026-11-02T20:00:00Z", peakAt: "2026-11-03T20:00:00Z", fadeAt: "2026-11-04T20:00:00Z" }, today, timezone)).toBe(false);
  });
});

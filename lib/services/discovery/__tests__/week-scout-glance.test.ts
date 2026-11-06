import type { RegionalSwellEvent } from "../week-scout-story-candidates";
import { sizeWordsFor, type CandidateFacts, type FaceRange } from "../week-scout-story-facts";
import { checkWrittenSentence } from "../week-scout-story-claims";
import type { InternalRegionEvent, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { buildGlance, glanceDay, glanceFromBuild, glanceWhen, MAX_GLANCE_SENTENCES, MAX_NEXT_GROUPS } from "../week-scout-glance";
import { MAX_GLANCE_SENTENCES as MAX_GLANCE_REWORDINGS } from "../week-scout-story-validate";
import { glanceSanDiego, glanceSanDiegoSentences as S } from "./fixtures/glance-san-diego-2026-11-05";

const { today, timezone, now, stored, factsFor } = glanceSanDiego;

const event = (regionalKey: string, directionDeg: number, arrivalAt: string, peakAt: string, fadeAt: string | null,
  confidence: RegionalSwellEvent["confidence"] = "locked"): RegionalSwellEvent => ({
  directionDeg, periodS: 16, arrivalAt, peakAt, fadeAt, timezone, confidence, minimumBeaches: 3, kind: "swell", regionalKey,
});

const sized = (faceFt: FaceRange, standoutFt?: FaceRange): CandidateFacts => ({
  faceFt, sizes: sizeWordsFor(faceFt), breaker: null,
  ...(standoutFt ? { standoutFt, standoutSizes: sizeWordsFor(standoutFt) } : {}),
});

const chest = (): CandidateFacts => sized({ min: 3, max: 5 });
const lockedPairFacts = (e: RegionalSwellEvent): CandidateFacts => e.regionalKey === "w-one" ? chest() : sized({ min: 5, max: 6 });

const tail = [{ key: "tail", directionDeg: 292, arrivalAt: null, peakAt: "2026-11-18T18:00:00Z", fadeAt: null }];

describe("glanceDay", () => {
  it("anchors each lead from today", () => {
    expect(glanceDay("2026-11-05", today)).toBe("today");
    expect(glanceDay("2026-11-06", today)).toBe("tomorrow");
    expect(glanceDay("2026-11-07", today)).toBe("Saturday");
    expect(glanceDay("2026-11-11", today)).toBe("Wednesday");
    expect(glanceDay("2026-11-12", today)).toBe("a week from today");
    expect(glanceDay("2026-11-13", today)).toBe("a week from Friday");
    expect(glanceDay("2026-11-18", today)).toBe("a week from Wednesday");
    expect(glanceDay("2026-11-19", today)).toBe("the week after next");
  });
});

describe("buildGlance", () => {
  it("caps the paragraph where the publish route caps its rewordings", () => {
    expect(MAX_GLANCE_REWORDINGS).toBe(MAX_GLANCE_SENTENCES);
  });

  it("reproduces the Nov 5 San Diego paragraph", () => {
    const glance = buildGlance({ stored, tail: [], timezone, today, now, todayCovered: true, factsFor });
    expect(glance.map((s) => s.text)).toEqual(S);
    expect(glance.map((s) => s.role)).toEqual(["today", "next", "next"]);
    expect(glance.map((s) => s.eventKeys)).toEqual([
      ["w-today", "ssw-today"], ["ssw-sun", "wnw-mon"], ["wnw-fri", "w-fri", "w-storm-sat", "ssw-sat"],
    ]);
    expect(glance.map((s) => s.facts?.faceFt)).toEqual([{ min: 3, max: 5 }, { min: 3, max: 5 }, { min: 5, max: 6 }]);
    expect(JSON.parse(glance[1].fingerprint)).toEqual(["glance-2", "next",
      ["south-southwest", "groundswell", "2026-11-08", "2026-11-08", "2026-11-09", "locked", true, "Sunday morning", "Sunday afternoon"],
      ["west-northwest", "mid-period swell", "2026-11-09", "2026-11-09", "2026-11-10", "locked", false, "Monday morning", "Monday afternoon"]]);
    expect(JSON.parse(glance[0].fingerprint).slice(2).map((group: unknown[]) => group.slice(7))).toEqual([[false, "this morning"], [false, "midday today"]]);
  });

  it("every code sentence passes the claim checker against itself and has no stray digit or 'from X into X'", () => {
    for (const s of buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor })) {
      expect(checkWrittenSentence(s.text, { text: s.text, facts: s.facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
      expect(s.text).not.toMatch(/\bfrom (\w+) into \1\b/);
      expect(s.text.replace(/\d+(?:-\d+)? ?ft/g, "")).not.toMatch(/\d/);
    }
  });

  it("every other template passes the claim checker against itself", () => {
    const shapes: Array<[RegionalSwellEvent[], (e: RegionalSwellEvent) => CandidateFacts | null]> = [
      [[event("w-past", 270, "2026-11-03T20:00:00Z", "2026-11-04T20:00:00Z", "2026-11-06T20:00:00Z")], chest],
      [[event("w-build", 270, "2026-11-04T20:00:00Z", "2026-11-07T20:00:00Z", "2026-11-09T20:00:00Z")], chest],
      [[event("w-build-likely", 270, "2026-11-04T20:00:00Z", "2026-11-11T20:00:00Z", null, "likely")], chest],
      [[event("w-build-radar", 270, "2026-11-04T20:00:00Z", "2026-11-17T20:00:00Z", null, "on_the_radar")], chest],
      [[event("w-tomorrow", 270, "2026-11-06T16:00:00Z", "2026-11-06T20:00:00Z", null)], chest],
      [[event("w-radar", 270, "2026-11-15T20:00:00Z", "2026-11-16T20:00:00Z", null, "on_the_radar"),
        event("s-radar", 180, "2026-11-16T20:00:00Z", "2026-11-17T20:00:00Z", null, "on_the_radar")], chest],
      [[event("w-far", 270, "2026-11-18T20:00:00Z", "2026-11-19T20:00:00Z", null, "likely")], chest],
      [[event("w-one", 270, "2026-11-07T20:00:00Z", "2026-11-08T20:00:00Z", null),
        event("s-two", 180, "2026-11-09T16:00:00Z", "2026-11-09T20:00:00Z", null)], lockedPairFacts],
    ];
    const texts: string[] = [];
    for (const [events, facts] of shapes) {
      for (const s of buildGlance({ stored: events, tail, timezone, today, now, todayCovered: false, factsFor: facts })) {
        texts.push(s.text);
        expect(checkWrittenSentence(s.text, { text: s.text, facts: s.facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
      }
    }
    expect(texts).toEqual([
      "A west groundswell peaked midday yesterday, chest-high at most spots, easing by tomorrow.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "A west groundswell is already in the water and peaks midday Saturday, chest-high at most spots, easing by Monday.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "A west groundswell is already in the water and looks likely to peak Wednesday, chest-high at most spots.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "A west groundswell is already in the water, with an early look at a peak a week from Tuesday, chest-high at most spots.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "A west groundswell arrives tomorrow morning and peaks around midday, chest-high at most spots.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "A week from Monday brings an early look at a west groundswell with a south groundswell behind it, chest-high at most spots.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      "The week after next looks likely to bring a west groundswell, chest-high at most spots.",
      "A west groundswell arrives midday Saturday and peaks midday Sunday, chest-high at most spots, then a south groundswell follows midday Monday.",
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
    ]);
  });

  it("adds the long-range sentence when nothing was skipped", () => {
    const glance = buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor });
    expect(glance.map((s) => s.text)).toEqual([...S,
      "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call."]);
    expect(glance[3]).toEqual({
      role: "long_range",
      text: "Further out, a west-northwest swell is on the radar for a week from Wednesday, too early to call.",
      fingerprint: JSON.stringify(["glance-2", "long_range", "west-northwest", "2026-11-18"]),
      facts: null,
      eventKeys: ["tail"],
    });
  });

  it("skips a tail event with no direction or one peaking before the last next group", () => {
    const early = { key: "early", directionDeg: 292, arrivalAt: null, peakAt: "2026-11-14T08:00:00Z", fadeAt: null };
    const blind = { key: "blind", directionDeg: null, arrivalAt: null, peakAt: "2026-11-17T18:00:00Z", fadeAt: null };
    const glance = buildGlance({ stored, tail: [early, blind, ...tail], timezone, today, now, todayCovered: true, factsFor });
    expect(glance.at(-1)?.eventKeys).toEqual(["tail"]);
  });

  it("puts the long range after a today group's peak, not only the last next group's", () => {
    const building = event("w-build", 270, "2026-11-04T20:00:00Z", "2026-11-15T20:00:00Z", null);
    const nine = { key: "tail-nine", directionDeg: 292, arrivalAt: null, peakAt: "2026-11-14T20:00:00Z", fadeAt: null };
    const glance = buildGlance({ stored: [building], tail: [nine], timezone, today, now, todayCovered: true, factsFor: chest });
    expect(glance.map((s) => s.role)).toEqual(["today"]);
    expect(glance.flatMap((s) => s.eventKeys)).not.toContain("tail-nine");
  });

  it("stops at four next groups and drops the long range", () => {
    const fifth = event("s-tue", 180, "2026-11-16T16:00:00Z", "2026-11-17T18:00:00Z", "2026-11-18T18:00:00Z", "likely");
    const glance = buildGlance({ stored: [...stored, fifth], tail, timezone, today, now, todayCovered: true, factsFor });
    expect(glance.map((s) => s.text)).toEqual(S);
    const nextKeys = glance.filter((s) => s.role === "next").flatMap((s) => s.eventKeys);
    expect(nextKeys).not.toContain("s-tue");
    const nextGroups = glance.filter((s) => s.role === "next").flatMap((s) => JSON.parse(s.fingerprint).slice(2));
    expect(nextGroups).toHaveLength(MAX_NEXT_GROUPS);
    expect(glance.map((s) => s.role)).not.toContain("long_range");
  });

  it("says so when nothing is in the water and today is covered", () => {
    const ahead = stored.filter((e) => e.arrivalAt >= "2026-11-06");
    const glance = buildGlance({ stored: ahead, tail: [], timezone, today, now, todayCovered: true, factsFor });
    expect(glance.map((s) => s.text)).toEqual([
      "No clear swell in the water today.",
      "A south-southwest groundswell arrives Sunday morning and peaks that afternoon, then a west-northwest mid-period swell follows Monday afternoon, both chest-high at most spots.",
      S[2],
    ]);
    expect(glance[0]).toMatchObject({ role: "today", facts: null, eventKeys: [] });
    const uncovered = buildGlance({ stored: ahead, tail: [], timezone, today, now, todayCovered: false, factsFor });
    expect(uncovered.map((s) => s.role)).toEqual(["next", "next"]);
  });

  it("returns [] for no events and an uncovered today", () => {
    expect(buildGlance({ stored: [], tail: [], timezone, today, now, todayCovered: false, factsFor })).toEqual([]);
  });

  it("writes today's groups even when today is not covered", () => {
    const glance = buildGlance({ stored: stored.slice(0, 2), tail: [], timezone, today, now, todayCovered: false, factsFor });
    expect(glance.map((s) => s.text)).toEqual([S[0]]);
  });

  it("says when a swell past its peak peaked", () => {
    const past = event("w-past", 270, "2026-11-03T20:00:00Z", "2026-11-04T20:00:00Z", "2026-11-06T20:00:00Z");
    const glance = buildGlance({ stored: [past], tail: [], timezone, today, now, todayCovered: true, factsFor: chest });
    // Nov 6 is the day after Nov 5, so the anchor table names it "tomorrow".
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell peaked midday yesterday, chest-high at most spots, easing by tomorrow."]);
  });

  describe("dates a today group by its members' peaks, not the anchor's", () => {
    const small = (e: RegionalSwellEvent): CandidateFacts => e.regionalKey.endsWith("anchor") ? sized({ min: 1, max: 2 }) : chest();
    const selfChecks = (text: string, facts: CandidateFacts | null): void => {
      expect(checkWrittenSentence(text, { text, facts: facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
    };

    it("peaks today when a bigger member peaks today though the anchor peaked yesterday", () => {
      const group = [event("w-anchor", 270, "2026-11-03T20:00:00Z", "2026-11-04T20:00:00Z", "2026-11-06T20:00:00Z"),
        event("w-big", 275, "2026-11-04T08:00:00Z", "2026-11-05T20:00:00Z", "2026-11-07T20:00:00Z")];
      const glance = buildGlance({ stored: group, tail: [], timezone, today, now, todayCovered: true, factsFor: small });
      expect(glance.map((s) => s.text)).toEqual(["A west groundswell peaks midday today, chest-high at most spots, easing by Saturday."]);
      selfChecks(glance[0].text, glance[0].facts);
      // The fingerprint still dates the group by its anchor.
      expect(JSON.parse(glance[0].fingerprint)[2][3]).toBe("2026-11-04");
    });

    it("says it peaked, at the latest member peak, only when every member has peaked", () => {
      const group = [event("w-anchor", 270, "2026-11-02T20:00:00Z", "2026-11-03T20:00:00Z", "2026-11-06T20:00:00Z"),
        event("w-big", 275, "2026-11-03T08:00:00Z", "2026-11-04T18:00:00Z", "2026-11-06T18:00:00Z")];
      const glance = buildGlance({ stored: group, tail: [], timezone, today, now, todayCovered: true, factsFor: small });
      expect(glance.map((s) => s.text)).toEqual(["A west groundswell peaked yesterday morning, chest-high at most spots, easing by tomorrow."]);
    });

    it("peaks on the earliest future member peak when none peaks today", () => {
      // 23:00 PST yesterday and 08:00 PST tomorrow, 33 h apart.
      const group = [event("w-anchor", 270, "2026-11-03T20:00:00Z", "2026-11-05T07:00:00Z", "2026-11-07T20:00:00Z"),
        event("w-big", 275, "2026-11-04T08:00:00Z", "2026-11-06T16:00:00Z", "2026-11-08T20:00:00Z")];
      const glance = buildGlance({ stored: group, tail: [], timezone, today, now, todayCovered: true, factsFor: small });
      expect(glance.map((s) => s.text)).toEqual([
        "A west groundswell is already in the water and peaks tomorrow morning, chest-high at most spots, easing by Sunday."]);
      selfChecks(glance[0].text, glance[0].facts);
    });

    it("pairs with another group peaking today on a member's peak", () => {
      const stored = [event("w-anchor", 270, "2026-11-03T20:00:00Z", "2026-11-04T20:00:00Z", "2026-11-06T20:00:00Z"),
        event("w-big", 275, "2026-11-04T08:00:00Z", "2026-11-05T20:00:00Z", "2026-11-07T20:00:00Z"),
        event("s-today", 180, "2026-11-04T08:00:00Z", "2026-11-05T18:00:00Z", "2026-11-07T18:00:00Z")];
      const glance = buildGlance({ stored, tail: [], timezone, today, now, todayCovered: true, factsFor: small });
      expect(glance.map((s) => s.text)).toEqual([
        "A west groundswell and a south groundswell both peak today, chest-high at most spots, easing by Saturday."]);
      selfChecks(glance[0].text, glance[0].facts);
    });
  });

  it("says no ease when the swell fades on the day it peaks", () => {
    // Peaks 10:00 and fades 20:00 PST tomorrow: never "peaks tomorrow, easing by tomorrow".
    const sameDay = event("w-same", 270, "2026-11-05T14:00:00Z", "2026-11-06T18:00:00Z", "2026-11-07T04:00:00Z");
    const glance = buildGlance({ stored: [sameDay], tail: [], timezone, today, now, todayCovered: true, factsFor: chest });
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell is already in the water and peaks tomorrow morning, chest-high at most spots."]);
    expect(checkWrittenSentence(glance[0].text, { text: glance[0].text, facts: glance[0].facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
  });

  it("leaves out a swell that faded earlier today, as the Swell Watch does", () => {
    // Fades 06:00 PST; at 14:00 PST it is still on today's strip but no longer in the water.
    const gone = event("w-gone", 270, "2026-11-04T08:00:00Z", "2026-11-04T20:00:00Z", "2026-11-05T14:00:00Z");
    const goneTail = { key: "tail-gone", directionDeg: 270, arrivalAt: null, peakAt: "2026-11-04T20:00:00Z", fadeAt: "2026-11-05T14:00:00Z" };
    const dawn = new Date("2026-11-05T13:00:00Z");
    const afternoon = new Date("2026-11-05T22:00:00Z");
    const args = { stored: [gone], tail: [goneTail], timezone, today, todayCovered: true, factsFor: chest };
    expect(buildGlance({ ...args, now: dawn }).flatMap((s) => s.eventKeys)).toContain("w-gone");
    const glance = buildGlance({ ...args, now: afternoon });
    expect(glance.map((s) => s.text)).toEqual(["No clear swell in the water today."]);
    expect(glance.flatMap((s) => s.eventKeys)).toEqual([]);
  });

  it("reads a swell peaking later as already in the water, and leaves out a null size", () => {
    const building = event("w-build", 270, "2026-11-04T20:00:00Z", "2026-11-07T20:00:00Z", "2026-11-09T20:00:00Z");
    const glance = buildGlance({ stored: [building], tail: [], timezone, today, now, todayCovered: true, factsFor: () => null });
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell is already in the water and peaks midday Saturday, easing by Monday."]);
  });

  it("dates by the region's local day near midnight", () => {
    const late = event("w-late", 270, "2026-11-08T20:00:00Z", "2026-11-09T07:30:00Z", null);
    const glance = buildGlance({ stored: [late], tail: [], timezone, today, now, todayCovered: false, factsFor: chest });
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell arrives midday Sunday and peaks that night, chest-high at most spots."]);
  });

  it("writes an early look without the standouts", () => {
    const radar = event("w-radar", 270, "2026-11-15T20:00:00Z", "2026-11-16T20:00:00Z", null, "on_the_radar");
    const glance = buildGlance({ stored: [radar], tail: [], timezone, today, now, todayCovered: false,
      factsFor: () => sized({ min: 3, max: 5 }, { min: 8, max: 10 }) });
    expect(glance.map((s) => s.text)).toEqual(["A week from Monday brings an early look at a west groundswell, chest-high at most spots."]);
  });

  describe("a locked pair of different sizes", () => {
    const pair = [event("w-one", 270, "2026-11-07T20:00:00Z", "2026-11-08T20:00:00Z", null),
      event("s-two", 180, "2026-11-09T16:00:00Z", "2026-11-09T20:00:00Z", null)];

    it("states only the lead's size", () => {
      const glance = buildGlance({ stored: pair, tail: [], timezone, today, now, todayCovered: false, factsFor: lockedPairFacts });
      expect(glance.map((s) => s.text)).toEqual([
        "A west groundswell arrives midday Saturday and peaks midday Sunday, chest-high at most spots, then a south groundswell follows midday Monday.",
      ]);
    });

    it("states no size when the lead has none", () => {
      const glance = buildGlance({ stored: pair, tail: [], timezone, today, now, todayCovered: false,
        factsFor: (e) => e.regionalKey === "w-one" ? null : sized({ min: 5, max: 6 }) });
      expect(glance.map((s) => s.text)).toEqual([
        "A west groundswell arrives midday Saturday and peaks midday Sunday, then a south groundswell follows midday Monday.",
      ]);
      expect(glance[0].facts).toBeNull();
    });
  });

  it("stops at six sentences and drops the long range", () => {
    const sizes: Record<string, CandidateFacts> = {
      "w-t": sized({ min: 1, max: 2 }), "s-t": sized({ min: 3, max: 5 }), "n-t": sized({ min: 5, max: 6 }),
    };
    const inWater = [
      event("w-t", 270, "2026-11-04T16:00:00Z", "2026-11-05T16:00:00Z", "2026-11-06T16:00:00Z"),
      event("s-t", 180, "2026-11-04T16:00:00Z", "2026-11-05T18:00:00Z", "2026-11-06T18:00:00Z"),
      event("n-t", 0, "2026-11-04T16:00:00Z", "2026-11-05T20:00:00Z", "2026-11-06T20:00:00Z"),
    ];
    // Peaks two days apart, so no two next groups share a sentence.
    const ahead = ["2026-11-07", "2026-11-09", "2026-11-11", "2026-11-13"].map((day, index) =>
      event(`next-${index}`, 270, `${day}T04:00:00Z`, `${day}T20:00:00Z`, null));
    const glance = buildGlance({ stored: [...inWater, ...ahead], tail, timezone, today, now, todayCovered: true, factsFor: (e) => sizes[e.regionalKey] ?? chest() });
    expect(glance).toHaveLength(MAX_GLANCE_SENTENCES);
    expect(glance.map((s) => s.role)).toEqual(["today", "today", "today", "next", "next", "next"]);
    expect(glance.flatMap((s) => s.eventKeys)).not.toContain("next-3");
  });

  describe("fingerprints ignore size", () => {
    const shifted = (by: number) => (e: RegionalSwellEvent): CandidateFacts | null => {
      const facts = factsFor(e);
      if (!facts?.faceFt) return facts;
      const move = (range: FaceRange): FaceRange => ({ min: range.min + by, max: range.max + by });
      return sized(move(facts.faceFt), facts.standoutFt ? move(facts.standoutFt) : undefined);
    };

    it("keeps every fingerprint when every range grows a foot", () => {
      const before = buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor });
      const after = buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor: shifted(1) });
      expect(after.map((s) => s.fingerprint)).toEqual(before.map((s) => s.fingerprint));
      expect(after.map((s) => s.text)).not.toEqual(before.map((s) => s.text));
    });

    it("keeps every fingerprint between two uniform sizes, 3–5 and 4–6", () => {
      const small = buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor: () => sized({ min: 3, max: 5 }) });
      const large = buildGlance({ stored, tail, timezone, today, now, todayCovered: true, factsFor: () => sized({ min: 4, max: 6 }) });
      expect(large.map((s) => s.fingerprint)).toEqual(small.map((s) => s.fingerprint));
      expect(large.map((s) => s.text)).not.toEqual(small.map((s) => s.text));
    });
  });
});

describe("glanceWhen", () => {
  it("words a day and part of the day as the Swell Watch card does", () => {
    const when = (at: string): string => glanceWhen(at, today, timezone);
    expect(when("2026-11-05T12:00:00Z")).toBe("early this morning");
    expect(when("2026-11-05T17:00:00Z")).toBe("this morning");
    expect(when("2026-11-05T20:00:00Z")).toBe("midday today");
    expect(when("2026-11-05T23:00:00Z")).toBe("this afternoon");
    expect(when("2026-11-06T03:00:00Z")).toBe("this evening");
    expect(when("2026-11-06T06:00:00Z")).toBe("tonight");
    expect(when("2026-11-06T17:00:00Z")).toBe("tomorrow morning");
    expect(when("2026-11-07T12:00:00Z")).toBe("early Saturday morning");
    expect(when("2026-11-08T20:00:00Z")).toBe("midday Sunday");
    expect(when("2026-11-05T06:00:00Z")).toBe("last night");
    expect(when("2026-11-04T23:00:00Z")).toBe("yesterday afternoon");
  });

  it("keeps the day alone past six days", () => {
    expect(glanceWhen("2026-11-12T20:00:00Z", today, timezone)).toBe("a week from today");
    expect(glanceWhen("2026-11-13T20:00:00Z", today, timezone)).toBe("a week from Friday");
  });
});

describe("buildGlance times", () => {
  const afternoon = new Date("2026-11-05T23:00:00Z");
  const morning = new Date("2026-11-05T16:00:00Z");
  const build = (events: RegionalSwellEvent[], at: Date) =>
    buildGlance({ stored: events, tail: [], timezone, today, now: at, todayCovered: true, factsFor: chest });
  const selfCheck = (texts: readonly { text: string; facts: CandidateFacts | null }[]): void => {
    for (const s of texts) {
      expect(checkWrittenSentence(s.text, { text: s.text, facts: s.facts ?? undefined }, [], ["San Diego"])).toEqual({ ok: true });
    }
  };

  it("says a swell that peaked this morning is easing", () => {
    const glance = build([event("w-am", 270, "2026-11-05T08:00:00Z", "2026-11-05T17:00:00Z", "2026-11-06T04:00:00Z")], afternoon);
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell peaked this morning and is easing, chest-high at most spots."]);
    selfCheck(glance);
  });

  it("says when a swell still ahead today peaks", () => {
    const glance = build([event("w-pm", 270, "2026-11-05T08:00:00Z", "2026-11-05T23:00:00Z", null)], morning);
    expect(glance.map((s) => s.text)).toEqual(["A west groundswell peaks this afternoon, chest-high at most spots."]);
    selfCheck(glance);
  });

  it("pairs two swells that both peaked this morning", () => {
    const glance = build([event("w-am", 270, "2026-11-05T08:00:00Z", "2026-11-05T17:00:00Z", "2026-11-06T04:00:00Z"),
      event("s-am", 180, "2026-11-05T08:00:00Z", "2026-11-05T18:00:00Z", "2026-11-06T04:00:00Z")], afternoon);
    expect(glance.map((s) => s.text)).toEqual([
      "A west groundswell and a south groundswell both peaked this morning and are easing, chest-high at most spots."]);
    selfCheck(glance);
  });

  it("never pairs a swell that peaked with one still ahead", () => {
    const glance = build([event("w-am", 270, "2026-11-05T08:00:00Z", "2026-11-05T17:00:00Z", "2026-11-06T04:00:00Z"),
      event("s-pm", 180, "2026-11-05T08:00:00Z", "2026-11-06T01:00:00Z", "2026-11-06T04:00:00Z")], afternoon);
    expect(glance.map((s) => s.text)).toEqual([
      "A west groundswell peaked this morning and is easing, chest-high at most spots.",
      "A south groundswell peaks this afternoon, chest-high at most spots."]);
  });

  it("says one time when a next swell arrives and peaks in the same part of a day", () => {
    const glance = build([event("w-sun", 270, "2026-11-08T22:00:00Z", "2026-11-08T23:30:00Z", null)], morning);
    expect(glance.map((s) => s.text)).toEqual(["No clear swell in the water today.",
      "A west groundswell arrives and peaks Sunday afternoon, chest-high at most spots."]);
  });

  it("changes the today fingerprint once the swell has peaked, so an old rewording stops serving", () => {
    const pm = [event("w-pm", 270, "2026-11-05T08:00:00Z", "2026-11-05T21:00:00Z", "2026-11-06T04:00:00Z")];
    const before = build(pm, morning)[0];
    const after = build(pm, afternoon)[0];
    expect(before.text).toBe("A west groundswell peaks midday today, chest-high at most spots.");
    expect(after.text).toBe("A west groundswell peaked midday today and is easing, chest-high at most spots.");
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it("changes a next fingerprint when the peak moves to another part of the same day", () => {
    const at = (peakAt: string) => build([event("w-sun", 270, "2026-11-08T16:00:00Z", peakAt, null)], morning).at(-1)!;
    expect(at("2026-11-08T23:00:00Z").fingerprint).not.toBe(at("2026-11-09T03:00:00Z").fingerprint);
  });
});

describe("glanceFromBuild", () => {
  const regionEvent = (key: string, peakAt: string, fadeAt: string): InternalRegionEvent => ({
    key, kind: "swell", source: "forecast", directionDeg: 270, directionLabel: "W", periodS: 16,
    arrivalAt: "2026-11-05T08:00:00Z", peakAt, fadeAt, peakLocalDate: "2026-11-05", offshoreFt: "4 ft", history: null, memberCount: 3,
  });

  it("leaves out a past-peak swell no beach can still rate, as the Swell Watch drops it", () => {
    const build = {
      region: "San Diego", timezone, buoy: null, wamDays: null, beaches: [], rowsByBeach: {},
      events: [regionEvent("gone", "2026-11-05T17:00:00Z", "2026-11-06T04:00:00Z"), regionEvent("ahead", "2026-11-06T01:00:00Z", "2026-11-06T04:00:00Z")],
    } as unknown as RegionBuild;
    const glance = glanceFromBuild(build, today, true, new Date("2026-11-05T23:00:00Z"));
    expect(glance.flatMap((s) => s.eventKeys)).toEqual(["ahead"]);
  });
});

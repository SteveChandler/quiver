import type { RegionalSwellEvent } from "../week-scout-story-candidates";
import { sizeWordsFor, type CandidateFacts } from "../week-scout-story-facts";
import { checkWrittenSentence } from "../week-scout-story-claims";
import { buildGlance } from "../week-scout-glance";
import { bindGlance, CERTAINTY_PHRASES, checkGlanceWording, type GlanceWritten } from "../week-scout-glance-wording";
import { glanceSanDiego, glanceSanDiegoSentences as S } from "./fixtures/glance-san-diego-2026-11-05";

const { today, timezone, stored, factsFor } = glanceSanDiego;
const region = "San Diego";
const build = (events: readonly RegionalSwellEvent[] = stored, facts = factsFor) =>
  buildGlance({ stored: events, tail: [], timezone, today, todayCovered: true, factsFor: facts });

const salad = "Expect crumbly, crumbling, crumbles, spilling, soft, mushy, or peaky waves.";
const reworded1 = "A fresh south-southwest groundswell arrives and peaks Sunday, and a west-northwest mid-period swell follows Monday, both chest-high at most spots.";
const reworded2 = "A week from Friday looks likely to bring a bigger west swell, with a south-southwest groundswell behind it, head-high at most spots and overhead at the standouts.";

describe("checkGlanceWording", () => {
  it("refuses the Nov 5 word salad", () => { expect(checkGlanceWording(salad, S[0]).ok).toBe(false); });

  it("accepts a plain rewording of S[1]", () => {
    expect(checkGlanceWording(reworded1, S[1])).toEqual({ ok: true });
  });

  it("accepts every code sentence against itself", () => {
    for (const s of S) expect(checkGlanceWording(s, s)).toEqual({ ok: true });
  });

  it("refuses a certainty change", () => {
    expect(checkGlanceWording(S[2].replace("looks likely to bring", "brings"), S[2])).toEqual({ ok: false, reason: "certainty" });
  });

  it("refuses 'bigger' the code sentence no longer says", () => {
    expect(checkGlanceWording(S[1].replace("A fresh", "A bigger, fresh"), S[1])).toEqual({ ok: false, reason: "bigger" });
  });

  it("refuses more than one feel-word entry, counting an entry's forms once", () => {
    expect(checkGlanceWording("Soft and peaky waves today.", "Waves today.")).toEqual({ ok: false, reason: "feel_words" });
    expect(checkGlanceWording("Crumbly, crumbling waves today.", "Waves today.")).toEqual({ ok: true });
    expect(checkGlanceWording("Lined up and closing out today.", "Waves today.")).toEqual({ ok: false, reason: "feel_words" });
  });

  it("refuses a stem used more often than the code sentence uses it", () => {
    expect(checkGlanceWording("Peaks build, then peaking waves.", "Waves peak.")).toEqual({ ok: false, reason: "repeated_word" });
    expect(checkGlanceWording("A groundswell and a groundswell.", S[0].replace(/, easing.*$/, "."))).toEqual({ ok: true });
    expect(checkGlanceWording("Waves and wave sets.", "Waves.")).toEqual({ ok: false, reason: "repeated_word" });
  });

  it("refuses a comma list of three or more", () => {
    expect(checkGlanceWording("Clean, glassy, and smooth.", "Clean.")).toEqual({ ok: false, reason: "adjective_list" });
    expect(checkGlanceWording("Clean, glassy smooth.", "Clean.")).toEqual({ ok: true });
  });

  it("matches certainty phrases longest first and as whole words", () => {
    expect(CERTAINTY_PHRASES).toEqual(["too early to call", "already in the water", "still in the water", "looks likely",
      "early look", "on the radar", "on the way", "likely", "due"]);
    expect(checkGlanceWording("Saturday looks likely.", "Saturday looks likely.")).toEqual({ ok: true });
    expect(checkGlanceWording("Saturday is likely.", "Saturday looks likely.")).toEqual({ ok: false, reason: "certainty" });
    expect(checkGlanceWording("A subdued, unlikely day.", "A day.")).toEqual({ ok: true });
    expect(checkGlanceWording("A swell is due.", "A swell.")).toEqual({ ok: false, reason: "certainty" });
  });
});

describe("bindGlance", () => {
  it("returns null for no sentences", () => { expect(bindGlance([], undefined, [], region)).toBeNull(); });

  it("serves the code text when nothing was written", () => {
    expect(bindGlance(build(), undefined, [], region)).toEqual({ sentences: [...S], source: ["code", "code", "code"] });
  });

  it("keeps a matching rewording, falls back one sentence when its fingerprint changed", () => {
    const original = build();
    const written: GlanceWritten[] = [
      { fingerprint: original[1].fingerprint, text: reworded1 },
      { fingerprint: original[2].fingerprint, text: reworded2 },
    ];
    expect(bindGlance(original, written, [], region)).toEqual({ sentences: [S[0], reworded1, reworded2], source: ["code", "written", "written"] });

    const rebuilt = build(stored.map((e) => e.regionalKey === "wnw-mon" ? { ...e, directionDeg: 250 } : e));
    expect(rebuilt[1].fingerprint).not.toBe(original[1].fingerprint);
    expect(rebuilt[2].fingerprint).toBe(original[2].fingerprint);
    expect(bindGlance(rebuilt, written, [], region)).toEqual({ sentences: [S[0], rebuilt[1].text, reworded2], source: ["code", "code", "written"] });
  });

  it("falls back when a size refresh breaks the written foot range", () => {
    const original = build();
    const variant = "A west groundswell and a south-southwest groundswell both peak today, 3-5 ft at most spots and overhead at the standouts, easing by Saturday.";
    const written: GlanceWritten[] = [{ fingerprint: original[0].fingerprint, text: variant }];
    expect(bindGlance(original, written, [], region)?.source[0]).toBe("written");

    const bigger = (e: RegionalSwellEvent): CandidateFacts | null => {
      const facts = factsFor(e);
      if (!facts || (e.regionalKey !== "w-today" && e.regionalKey !== "ssw-today")) return facts;
      const faceFt = { min: 4, max: 6 };
      return { ...facts, faceFt, sizes: sizeWordsFor(faceFt) };
    };
    const refreshed = build(stored, bigger);
    expect(refreshed[0].fingerprint).toBe(original[0].fingerprint);
    expect(checkWrittenSentence(variant, { text: refreshed[0].text, facts: refreshed[0].facts ?? undefined }, [], [region]))
      .toEqual({ ok: false, reason: "size" });
    const bound = bindGlance(refreshed, written, [], region);
    expect(bound?.source[0]).toBe("code");
    expect(bound?.sentences[0]).toBe(refreshed[0].text);
  });

  it("falls back on a wording refusal even when the claim check passes", () => {
    const original = build();
    const certain = S[2].replace("looks likely to bring", "brings");
    expect(checkWrittenSentence(certain, { text: S[2], facts: original[2].facts ?? undefined }, [], [region])).toEqual({ ok: true });
    const bound = bindGlance(original, [{ fingerprint: original[2].fingerprint, text: certain }], [], region);
    expect(bound?.source).toEqual(["code", "code", "code"]);
  });

  it("falls back on a non-string written text without throwing", () => {
    const original = build();
    const written = [{ fingerprint: original[0].fingerprint, text: 42 }] as unknown as GlanceWritten[];
    expect(bindGlance(original, written, [], region)?.source).toEqual(["code", "code", "code"]);
  });
});

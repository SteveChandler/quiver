import { checkWrittenSentence } from "../week-scout-story-claims";
import type { StoryCandidate } from "../week-scout-story-types";

const gate: StoryCandidate["gate"] = {
  kind: "swell", regionalEventKey: "6-2-2026-10-30-s", directionSector: 6, directionIndex: 12, periodBand: 2,
  periodClass: "short", arrivalLocalDate: "2026-10-29", peakLocalDate: "2026-10-30", fadeLocalDate: "2026-10-31",
  confidence: "likely", minimumBeaches: 3,
};
const fact = (text: string): StoryCandidate => ({ id: "event-6-2-2026-10-30-s-story", slot: "event:6-2-2026-10-30-s:story", text, gate });
// Task 3's example story line.
const storm = fact("A west stormy short-period swell arrives Thursday night, peaks Friday and fades Saturday.");
const BEACHES = ["Ocean Beach", "La Jolla", "La Jolla Shores", "North Beach", "Swami's", " "];
const check = (text: string, against: StoryCandidate = storm) => checkWrittenSentence(text, against, BEACHES);

describe("checkWrittenSentence", () => {
  it("accepts a rewrite that keeps the fact's days, direction and beaches", () => {
    expect(check("West storm swell rolls in Thursday night and peaks Friday.")).toEqual({ ok: true });
    expect(check("the west storm swell peaks friday.")).toEqual({ ok: true });
    const exposure = fact("Ocean Beach and La Jolla Shores face this swell better than Swami's, which sits in the shadow.");
    expect(check("Ocean Beach and La Jolla Shores take it head on; Swami's stays sheltered.", exposure)).toEqual({ ok: true });
    const compound = fact("A south-southwest long-period groundswell arrives Tuesday and peaks Wednesday.");
    expect(check("South-southwest groundswell, peaking Wednesday.", compound)).toEqual({ ok: true });
  });

  it("rejects a sentence that adds a weekday, a direction or a beach", () => {
    expect(check("West storm swell rolls in Wednesday night and peaks Friday.")).toEqual({ ok: false, reason: "weekday" });
    expect(check("Northwest storm swell rolls in Thursday night and peaks Friday.")).toEqual({ ok: false, reason: "direction" });
    expect(check("A westerly storm swell, then a southerly one by Friday.")).toEqual({ ok: false, reason: "direction" });
    expect(check("West storm swell peaks Friday at Ocean Beach.")).toEqual({ ok: false, reason: "beach" });
    // Compass words and beach names match longest first: a fact's compound never lends its parts.
    const compound = fact("A south-southwest long-period groundswell arrives Tuesday and peaks Wednesday.");
    expect(check("A south groundswell peaks Wednesday.", compound)).toEqual({ ok: false, reason: "direction" });
    const shores = fact("La Jolla Shores and Ocean Beach face this swell better than Swami's, which sits in the shadow.");
    expect(check("La Jolla and Ocean Beach take it head on.", shores)).toEqual({ ok: false, reason: "beach" });
    // A beach's name lends no direction: North Beach in the fact doesn't let the sentence say north.
    const north = fact("North Beach and Ocean Beach face this swell better than La Jolla, which sits in the shadow.");
    expect(check("North Beach and Ocean Beach catch the north swell; La Jolla doesn't.", north)).toEqual({ ok: false, reason: "direction" });
    expect(check("North Beach and Ocean Beach catch it; La Jolla doesn't.", north)).toEqual({ ok: true });
    // Nor does the region's name in a cover: "North Shore" is no north swell, and naming it is no beach claim.
    const cover = fact("A long-period groundswell from the west reaches North Shore Wednesday and peaks Thursday.");
    expect(checkWrittenSentence("A north swell reaches North Shore Thursday.", cover, BEACHES, ["North Shore"]))
      .toEqual({ ok: false, reason: "direction" });
    expect(checkWrittenSentence("The west groundswell reaches North Shore Thursday.", cover, BEACHES, ["North Shore"]))
      .toEqual({ ok: true });
  });

  it("rejects digits, YES/MAYBE/NO and the call", () => {
    expect(check("West storm swell peaks Friday at 8 feet.")).toEqual({ ok: false, reason: "digit" });
    expect(check("YES: the west storm swell peaks Friday.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("West storm swell peaks Friday, MAYBE.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("NO size until the west storm swell peaks Friday.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("Friday is the call for the west storm swell.")).toEqual({ ok: false, reason: "the_call" });
    expect(check("   ")).toEqual({ ok: false, reason: "empty" });
    expect(check(`West storm swell peaks Friday${"!".repeat(212)}`)).toEqual({ ok: false, reason: "too_long" });
    // Lowercase "no" is ordinary prose; native refuses only the uppercase verdict words.
    expect(check("West storm swell peaks Friday, with no wind to speak of.")).toEqual({ ok: true });
  });

  it("treats time qualifiers as claims: a sentence keeps every one its fact has and adds none", () => {
    const later = fact("A west long-period groundswell arrives a week from Wednesday and peaks a week from Thursday.");
    expect(check("A west groundswell peaks Thursday.", later)).toEqual({ ok: false, reason: "timing" });
    expect(check("A west groundswell peaks a week from Thursday.", later)).toEqual({ ok: true });
    expect(check("West storm swell rolls in tomorrow and peaks Friday.")).toEqual({ ok: false, reason: "timing" });
    const peaked = fact("A west mid-period swell is already in the water, peaked Monday and fades Tuesday.");
    expect(check("The west swell peaks Monday and fades Tuesday.", peaked)).toEqual({ ok: false, reason: "timing" });
    expect(check("The west swell peaked Monday and fades Tuesday.", peaked)).toEqual({ ok: true });
  });
});

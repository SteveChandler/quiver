import { COMPASS, WEEKDAY } from "../week-scout-story-candidates";
import {
  CLOSED_WORD_SETS, COMPASS_ABBREVIATIONS, NUMBER_WORDS, RELATIVE_TIME_WORDS, SIZE_ADJECTIVES, TIME_QUALIFIERS, WEEKDAY_ABBREVIATIONS,
  WEEK_FROM_DAYS, checkWrittenSentence,
} from "../week-scout-story-claims";
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
    expect(check("Ocean Beach and La Jolla Shores face it better; Swami's sits in the shadow.", exposure)).toEqual({ ok: true });
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

  it("reads compass and weekday abbreviations as the full word (R11)", () => {
    const west = fact("A west long-period groundswell arrives Wednesday and peaks Thursday.");
    expect(check("SSW groundswell peaks Thursday.", west)).toEqual({ ok: false, reason: "direction" });
    expect(check("W groundswell peaks Thursday.", west)).toEqual({ ok: true });
    const compound = fact("A south-southwest long-period groundswell arrives Tuesday and peaks Wednesday.");
    expect(check("SSW groundswell peaks Wednesday.", compound)).toEqual({ ok: true });
    expect(check("SW groundswell peaks Wednesday.", compound)).toEqual({ ok: false, reason: "direction" });
    const thursday = fact("The west pulse builds from Thursday.");
    expect(check("The west pulse builds from Fri.", thursday)).toEqual({ ok: false, reason: "weekday" });
    expect(check("The west pulse builds from THURS.", thursday)).toEqual({ ok: true });
    expect(check("The west pulse builds from SAT.", thursday)).toEqual({ ok: false, reason: "weekday" });
    // Lowercase words that spell an abbreviation are prose, not days.
    const dayless = fact("Faces the west swell straight on, with light wind in its window.");
    expect(check("Faces the west swell straight on while the sun is out and the wind sat down.", dayless)).toEqual({ ok: true });
  });

  it("refuses spelled-out sizes (R11)", () => {
    expect(check("West storm swell peaks Friday at eight feet.")).toEqual({ ok: false, reason: "number" });
    expect(check("A six-foot west storm swell peaks Friday.")).toEqual({ ok: false, reason: "number" });
    expect(check("West storm swell peaks Friday at twenty-two seconds.")).toEqual({ ok: false, reason: "number" });
    expect(check("West storm swell peaks Friday with wind under ten mph.")).toEqual({ ok: false, reason: "number" });
    // "one" is prose ("the one to watch"), and a beach's name lends no number.
    expect(check("West storm swell, the one to watch, peaks Friday.")).toEqual({ ok: true });
    const mile = fact("Seven Mile Beach takes the west swell head on.");
    expect(checkWrittenSentence("Seven Mile Beach gets the west swell head on.", mile, ["Seven Mile Beach"])).toEqual({ ok: true });
  });

  it("treats time qualifiers as claims: a sentence keeps every one its fact has and adds none", () => {
    const later = fact("A west long-period groundswell arrives a week from Wednesday and peaks a week from Thursday.");
    // "a week from Thursday" is one claim, so a bare Thursday is a weekday the fact never names.
    expect(check("A west groundswell peaks Thursday.", later)).toEqual({ ok: false, reason: "weekday" });
    expect(check("A west groundswell peaks a week from Thursday.", later)).toEqual({ ok: true });
    expect(check("West storm swell rolls in tomorrow and peaks Friday.")).toEqual({ ok: false, reason: "timing" });
    const peaked = fact("A west mid-period swell is already in the water, peaked Monday and fades Tuesday.");
    expect(check("The west swell peaks Monday and fades Tuesday.", peaked)).toEqual({ ok: false, reason: "timing" });
    expect(check("The west swell peaked Monday and fades Tuesday.", peaked)).toEqual({ ok: true });
  });

  it("reads \"a week from <day>\" as one claim and keeps the fact's order of days", () => {
    // Each of these passed before: the same weekdays and the same "a week from", in other places.
    const mixed = fact("A west long-period groundswell arrives Saturday and peaks a week from Thursday.");
    expect(check("A west groundswell arrives a week from Saturday and peaks Thursday.", mixed)).toEqual({ ok: false, reason: "weekday" });
    expect(check("A west groundswell arrives Saturday and peaks a week from Thursday.", mixed)).toEqual({ ok: true });
    const today = fact("An east short-period windswell arrives a week from today and peaks a week from Thursday.");
    expect(check("An east windswell arrives a week from Thursday.", today)).toEqual({ ok: true });
    expect(check("An east windswell arrives a week from Friday.", today)).toEqual({ ok: false, reason: "weekday" });

    const days = fact("A west long-period groundswell arrives Thursday, peaks Friday and fades Saturday.");
    expect(check("A west groundswell arrives Friday, peaks Thursday and fades Saturday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A west groundswell fades Saturday after peaking Friday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    // Leaving a day out keeps the order; abbreviations count where they stand.
    expect(check("A west groundswell peaks Friday and fades Saturday.", days)).toEqual({ ok: true });
    expect(check("A west groundswell peaks SAT, after Thursday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    const change = fact("The best regional window looks better on Friday than on Thursday.");
    expect(check("The best regional window looks better on Thursday than on Friday.", change)).toEqual({ ok: false, reason: "weekday_order" });
  });

  it("lets a sentence use a relative day or time of day only when its fact does", () => {
    const days = fact("A west long-period groundswell arrives Thursday, peaks Friday and fades Saturday.");
    for (const words of RELATIVE_TIME_WORDS) {
      expect([words, check(`A west groundswell peaks Friday, the ${words}.`, days)]).toEqual([words, { ok: false, reason: "timing" }]);
    }
    expect(check("A west groundswell peaks Friday and fades the next day.", days)).toEqual({ ok: false, reason: "timing" });
    expect(check("A west groundswell peaks Friday, best in the mornings.", days)).toEqual({ ok: false, reason: "timing" });
    // The storm fact says "Thursday night", so its rewrite may; "tonight" is a different claim.
    expect(check("West storm swell rolls in Thursday night.")).toEqual({ ok: true });
    expect(check("West storm swell rolls in tonight.")).toEqual({ ok: false, reason: "timing" });
    const wind = fact("Mornings stay cleaner through the week; the onshore fills in by midday.");
    expect(check("Clean mornings, then the onshore fills in by midday.", wind)).toEqual({ ok: true });
  });
});

describe("checkWrittenSentence closed word sets (R16)", () => {
  const dayless = fact("A west long-period groundswell arrives Wednesday and peaks Thursday.");

  it("refuses a closed-set word its fact doesn't use, naming the set", () => {
    const added: Array<[string, string]> = [
      ["A west groundswell peaks Thursday with offshore wind.", "wind"],
      ["A west groundswell peaks Thursday, onshore by noon.", "wind"],
      ["A better west groundswell peaks Thursday.", "comparison"],
      ["A west groundswell peaks Thursday on a low tide.", "tide"],
      ["A west groundswell peaks Thursday as the tide is rising.", "tide"],
      ["A west windswell peaks Thursday.", "period"],
      ["A stormy west swell peaks Thursday.", "period"],
      ["A west short-period swell peaks Thursday.", "period"],
      ["A west groundswell peaks Thursday; sheltered spots stay quiet.", "exposure"],
      ["A west groundswell peaks Thursday and hits some spots head-on.", "exposure"],
      ["A west groundswell peaks Thursday under light wind.", "wind_strength"],
      ["A glassy west groundswell peaks Thursday.", "wind_strength"],
      ["A west groundswell peaks Thursday, but the wind is up.", "wind_strength"],
    ];
    for (const [text, reason] of added) expect([text, check(text, dayless)]).toEqual([text, { ok: false, reason }]);
  });

  it("stops a rewrite from inverting a beach line", () => {
    const open = fact("Faces the west groundswell dead on, with light wind in its window.");
    expect(check("Faces the west groundswell dead on, with light wind.", open)).toEqual({ ok: true });
    expect(check("Sheltered from the west groundswell, with light wind.", open)).toEqual({ ok: false, reason: "exposure" });
    expect(check("Faces the west groundswell at an angle, with light wind.", open)).toEqual({ ok: false, reason: "exposure" });
    expect(check("Faces the west groundswell dead on, but the wind is up.", open)).toEqual({ ok: false, reason: "wind_strength" });
    expect(check("Faces the west groundswell dead on, but it gets windy.", open)).toEqual({ ok: false, reason: "wind_strength" });
    const windy = fact("Faces the west storm swell head on, but the wind is up in its window.");
    // Forms of one claim are one claim: "stormy" is "storm", "windy" is "the wind is up", "facing" is "faces".
    expect(check("Facing the stormy west swell head on, and windy.", windy)).toEqual({ ok: true });
    expect(check("Faces the west storm swell head on, with calm wind.", windy)).toEqual({ ok: false, reason: "wind_strength" });
  });

  it("refuses size words outright and widens the number ban", () => {
    for (const size of SIZE_ADJECTIVES) {
      expect([size, check(`A ${size} west groundswell peaks Thursday.`, dayless)]).toEqual([size, { ok: false, reason: "size" }]);
    }
    expect(check("A head high west groundswell peaks Thursday.", dayless)).toEqual({ ok: false, reason: "size" });
    for (const words of ["thirty", "a hundred", "a dozen", "half", "two meters", "a metre", "six inches", "an inch"]) {
      expect([words, check(`A west groundswell peaks Thursday at ${words}.`, dayless)]).toEqual([words, { ok: false, reason: "number" }]);
    }
    // A beach's name lends no size, and relative words stay prose.
    expect(checkWrittenSentence("Big Rock gets the west groundswell Thursday.", fact("Big Rock takes the west groundswell Thursday."),
      ["Big Rock"])).toEqual({ ok: true });
    expect(check("The west groundswell runs biggest Thursday.", dayless)).toEqual({ ok: true });
    // Lowercase "ssw" stays prose (R11 reads uppercase abbreviations only).
    expect(check("A west groundswell, not the ssw one, peaks Thursday.", dayless)).toEqual({ ok: true });
  });

  it("exports every set as data the worker mirrors", () => {
    expect(Object.keys(CLOSED_WORD_SETS)).toEqual(["wind", "comparison", "tide", "period", "exposure", "wind_strength"]);
    expect(Object.values(CLOSED_WORD_SETS).flat().every((forms) => forms.length > 0)).toBe(true);
  });
});

describe("checkWrittenSentence exported lists", () => {
  const dayless = fact("A west long-period groundswell arrives Wednesday and peaks Thursday.");

  it("refuses every number word and adds no time qualifier", () => {
    for (const word of NUMBER_WORDS) {
      expect([word, check(`A west groundswell peaks Thursday, ${word} of it.`, dayless)]).toEqual([word, { ok: false, reason: "number" }]);
    }
    for (const qualifier of TIME_QUALIFIERS) {
      expect([qualifier, check(`A west groundswell peaks Thursday, ${qualifier}.`, dayless)])
        .toEqual([qualifier, { ok: false, reason: "timing" }]);
    }
  });

  it("reads each \"a week from\" unit as its own day", () => {
    for (const unit of WEEK_FROM_DAYS) {
      const later = fact(`A west long-period groundswell peaks ${unit}.`);
      expect([unit, check(`A west groundswell peaks ${unit}.`, later)]).toEqual([unit, { ok: true }]);
      const bare = unit.replace("a week from ", "");
      expect([unit, check(`A west groundswell peaks ${bare}.`, later)])
        .toEqual([unit, { ok: false, reason: bare === "today" ? "timing" : "weekday" }]);
    }
  });

  it("reads each abbreviation as its full word", () => {
    COMPASS_ABBREVIATIONS.forEach((short, index) => {
      const named = fact(`A ${COMPASS[index]} long-period groundswell peaks Thursday.`);
      expect([short, check(`${short} groundswell peaks Thursday.`, named)]).toEqual([short, { ok: true }]);
    });
    for (const short of WEEKDAY_ABBREVIATIONS) {
      const day = WEEKDAY.find((name) => name.startsWith(short))!;
      const named = fact(`The west pulse builds from ${day}.`);
      expect([short, check(`The west pulse builds from ${short}.`, named)]).toEqual([short, { ok: true }]);
    }
  });
});

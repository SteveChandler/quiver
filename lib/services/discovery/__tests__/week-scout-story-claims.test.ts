import { readFileSync } from "fs";
import path from "path";

import {
  COMPASS, WEEKDAY, beachLineText, buildStoryCandidates, eventStoryText, storyEventKey, type RegionalDaySignal, type RegionalSwellEvent,
} from "../week-scout-story-candidates";
import {
  CLOSED_WORD_SETS, COMPASS_ABBREVIATIONS, DAY_PHRASES, DEGREE_WORDS, LIST_JOINERS, NEXT_WEEKDAYS, NUMBER_WORDS, PHASE_VERBS,
  RELATIVE_TIME_WORDS, SIZE_ADJECTIVES, TIME_QUALIFIERS, VERDICT_WORDS, WIND_STRENGTH_IMPLIES, WEEKDAY_ABBREVIATIONS, WEEK_FROM_DAYS, checkWrittenSentence,
} from "../week-scout-story-claims";
import type { StoryCandidate } from "../week-scout-story-types";

const gate: StoryCandidate["gate"] = {
  kind: "swell", regionalEventKey: "6-2-2026-10-30-s", directionSector: 6, directionIndex: 12, periodBand: 2,
  periodClass: "short", arrivalLocalDate: "2026-10-29", peakLocalDate: "2026-10-30", fadeLocalDate: "2026-10-31",
  confidence: "likely", minimumBeaches: 3,
};
const fact = (text: string): StoryCandidate => ({ id: "event-6-2-2026-10-30-s-story", slot: "event:6-2-2026-10-30-s:story", text, gate });
// Task 3's example story line.
const storm = fact("A west short-period storm swell arrives Thursday night, peaks Friday and fades Saturday.");
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
    // Main's "reaches North Shore Thursday" claimed Thursday's arrival; the fact arrives Wednesday (day–verb binding).
    expect(checkWrittenSentence("The west groundswell reaches North Shore Wednesday.", cover, BEACHES, ["North Shore"]))
      .toEqual({ ok: true });
  });

  it("gives the same answer on repeat calls with the cached name patterns", () => {
    const ocean = fact("Ocean Beach faces this swell better than La Jolla, which sits in the shadow.");
    for (let round = 0; round < 3; round += 1) {
      // With Swami's among the names it is a beach the fact doesn't name; without, it is prose.
      expect(checkWrittenSentence("Ocean Beach and Swami's face it better.", ocean, ["Ocean Beach", "La Jolla", "Swami's"]))
        .toEqual({ ok: false, reason: "beach" });
      expect(checkWrittenSentence("Ocean Beach and Swami's face it better.", ocean, ["Ocean Beach", "La Jolla"])).toEqual({ ok: true });
    }
  });

  it("rejects digits, YES/MAYBE/NO and the call", () => {
    expect(check("West storm swell peaks Friday at 8 feet.")).toEqual({ ok: false, reason: "digit" });
    expect(check("YES: the west storm swell peaks Friday.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("West storm swell peaks Friday, MAYBE.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("NO size until the west storm swell peaks Friday.")).toEqual({ ok: false, reason: "verdict_word" });
    // The card's labels are verdicts too, uppercase only: the band shows each user's own label (R27).
    for (const word of VERDICT_WORDS.filter((verdict) => !["YES", "MAYBE", "NO"].includes(verdict))) {
      expect([word, check(`West storm swell peaks Friday, ${word} at the points.`)]).toEqual([word, { ok: false, reason: "verdict_word" }]);
    }
    expect(check("West storm swell peaks Friday, EARLY  LOOK only.")).toEqual({ ok: false, reason: "verdict_word" });
    expect(check("West storm swell peaks Friday: a good, fair-sized day, likely the one.")).toEqual({ ok: true });
    expect(check("West storm swell peaks Friday at GOODWIN.")).toEqual({ ok: true });
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
    // Main's "arrives a week from Thursday" moved the arrival; the fact arrives a week from today (day–verb binding).
    expect(check("An east windswell peaks a week from Thursday.", today)).toEqual({ ok: true });
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
    for (const words of RELATIVE_TIME_WORDS.flat()) {
      expect([words, check(`A west groundswell peaks Friday, the ${words}.`, days)]).toEqual([words, { ok: false, reason: "timing" }]);
    }
    expect(check("A west groundswell peaks Friday and fades the next day.", days)).toEqual({ ok: false, reason: "timing" });
    expect(check("A west groundswell peaks Friday, best in the mornings.", days)).toEqual({ ok: false, reason: "timing" });
    // The storm fact says "Thursday night", so its rewrite may; "tonight" is a different claim.
    expect(check("West storm swell rolls in Thursday night.")).toEqual({ ok: true });
    expect(check("West storm swell rolls in tonight.")).toEqual({ ok: false, reason: "timing" });
    const wind = fact("Mornings stay cleaner through the week; the onshore fills in by midday.");
    expect(check("Clean mornings, then the onshore fills in by midday.", wind)).toEqual({ ok: true });
    // "noon" is "midday" (R24), not a new time of day; "afternoon" is still its own.
    expect(check("Mornings stay cleaner; the onshore fills in by noon.", wind)).toEqual({ ok: true });
    expect(check("Mornings stay cleaner; the onshore fills in by the afternoon.", wind)).toEqual({ ok: false, reason: "timing" });
    expect(check("A west groundswell peaks Friday at noon.", days)).toEqual({ ok: false, reason: "timing" });
  });
});

describe("checkWrittenSentence closed word sets (R16)", () => {
  const dayless = fact("A west long-period groundswell arrives Wednesday and peaks Thursday.");

  it("refuses a closed-set word its fact doesn't use, naming the set", () => {
    const added: Array<[string, string]> = [
      ["A west groundswell peaks Thursday with offshore wind.", "wind"],
      // Main's "onshore by noon" now refuses on "noon" first, as a time of day (timing).
      ["A west groundswell peaks Thursday, then turns onshore.", "wind"],
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

  it("reads the card's bare \"earlier\" as a day and a time qualifier (R24)", () => {
    const past = fact("A west mid-period swell is already in the water, peaked earlier and fades Monday.");
    // Each of these passed before: "earlier" was no claim.
    expect(check("A west swell is already in the water, peaked Monday and fades earlier.", past)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A west swell peaked Monday.", past)).toEqual({ ok: false, reason: "timing" });
    expect(check("The west swell already peaked earlier and fades Monday.", past)).toEqual({ ok: true });
    // "earlier in the week" stays one claim: a rewrite to "earlier this week" falls back (safely).
    const week = fact("A long-period groundswell from the west reaches San Diego earlier in the week and peaks Thursday.");
    expect(checkWrittenSentence("The west groundswell reaches San Diego earlier in the week.", week, BEACHES, ["San Diego"])).toEqual({ ok: true });
    expect(checkWrittenSentence("The west groundswell reaches San Diego earlier this week.", week, BEACHES, ["San Diego"]))
      .toEqual({ ok: false, reason: "timing" });
  });

  it("keeps the fact's wind words in its order (R24)", () => {
    const turn = fact("On Friday, the wind starts offshore, then turns onshore by midday.");
    expect(check("On Friday, the wind starts onshore, then turns offshore by midday.", turn)).toEqual({ ok: false, reason: "wind" });
    expect(check("Friday's offshore start turns onshore by midday.", turn)).toEqual({ ok: true });
    expect(check("Friday turns onshore by midday.", turn)).toEqual({ ok: true });
    const pattern = fact("Mornings stay onshore on several days; offshore wind cleans up by midday.");
    expect(check("Mornings stay offshore on several days; onshore wind cleans up by midday.", pattern)).toEqual({ ok: false, reason: "wind" });
    expect(check("Onshore mornings on several days, then offshore wind cleans up by midday.", pattern)).toEqual({ ok: true });
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

  it("reads each \"next <weekday>\" unit as its own day", () => {
    NEXT_WEEKDAYS.forEach((unit, index) => {
      const named = fact(`A west long-period groundswell peaks ${WEEKDAY[index]}.`);
      expect([unit, check(`A west groundswell peaks ${unit}.`, named)]).toEqual([unit, { ok: false, reason: "weekday" }]);
    });
    const friday = fact("A west long-period groundswell peaks Friday.");
    expect(check("A west groundswell peaks next Fri.", friday)).toEqual({ ok: false, reason: "weekday" });
    expect(check("A west groundswell peaks Fri, next to nothing before.", friday)).toEqual({ ok: true });
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

describe("checkWrittenSentence free prose and binding rules (R19)", () => {
  const days = fact("A west long-period groundswell arrives Thursday, peaks Friday and fades Saturday.");
  const sheltered = fact("Sheltered from the west groundswell, with light wind in its window.");
  const partly = fact("Partly sheltered from the west groundswell, with light wind in its window.");
  const open = fact("Faces the west groundswell dead on, with light wind in its window.");
  const region = (text: string, against: StoryCandidate) => checkWrittenSentence(text, against, BEACHES, ["North Shore"]);

  it("lets through any word outside the checked vocabularies", () => {
    const friday = fact("A west long-period groundswell arrives Friday, peaks Sunday and fades Wednesday.");
    expect(check("Arriving Friday, peaking Sunday and fading out by Wednesday.", friday)).toEqual({ ok: true });
    expect(check("West groundswell lands Thursday, tops out Friday and backs off Saturday.", days)).toEqual({ ok: true });
    expect(check("Takes the west groundswell dead on, and the wind stays light.", open)).toEqual({ ok: true });
    expect(check("Tucked away and sheltered from the west groundswell; the wind stays light.", sheltered)).toEqual({ ok: true });
    expect(check("Ocean Beach and La Jolla Shores face it better than Swami's, which sit in the shadows.",
      fact("Ocean Beach and La Jolla Shores face this swell better than Swami's, which sits in the shadow."))).toEqual({ ok: true });
    // A past tense is a time claim: "arrived" is kept exactly, like "peaked".
    expect(check("A west groundswell arrived Thursday.", days)).toEqual({ ok: false, reason: "timing" });
  });

  it("refuses the residual claim words its fact doesn't make", () => {
    const breezy = fact("Faces the west groundswell dead on, but it's breezy in its window.");
    const windy = fact("Faces the west groundswell dead on, but the wind is up in its window.");
    const added: Array<[string, StoryCandidate, string]> = [
      ["Exposed to the west groundswell, with light wind in its window.", sheltered, "exposure"],
      ["Wide open to the west groundswell, with light wind in its window.", sheltered, "exposure"],
      ["Catches the west groundswell, with light wind in its window.", sheltered, "exposure"],
      ["Faces the west groundswell dead on, but it's gusty in its window.", breezy, "wind_strength"],
      ["Faces the west groundswell dead on, but blown out in its window.", breezy, "wind_strength"],
      ["Faces the west groundswell dead on, with lighter wind in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, with calmer wind in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, but it's choppy in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, but bumpy in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, but messy in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, and clean in its window.", windy, "wind_strength"],
      // "the wind up" and "the wind picks up" are "windy".
      ["Faces the west groundswell dead on, the wind up in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, with the wind still up in its window.", open, "wind_strength"],
      ["Faces the west groundswell dead on, but the wind picks up.", open, "wind_strength"],
      ["Faces the west groundswell dead on, but the wind comes up later.", open, "wind_strength"],
      ["A west groundswell arrives at dawn Thursday and peaks Friday.", days, "timing"],
      ["A west groundswell peaks at noon Friday.", days, "timing"],
      ["A west groundswell arrives at midnight Thursday.", days, "timing"],
      ["A west groundswell peaks Friday and fades the following day.", days, "timing"],
      ["A west groundswell peaks next Friday.", days, "weekday"],
      ["A small west groundswell peaks Friday.", days, "size"],
      ["A massive west groundswell peaks Friday.", days, "size"],
      ["A west groundswell from thousands of miles away peaks Friday.", days, "number"],
    ];
    for (const [text, against, reason] of added) expect([text, check(text, against)]).toEqual([text, { ok: false, reason }]);
  });

  it("reads \"the wind picks up\" as windy on every beach line, and bare \"picks up\" as no claim", () => {
    const shelteredWindy = fact("Sheltered from the west groundswell, and the wind is up in its window.");
    const partlyWindy = fact("Partly sheltered from the west groundswell, and the wind is up in its window.");
    const openWindy = fact("Faces the west groundswell dead on, but the wind is up in its window.");
    expect(check("Sheltered from the west groundswell, and the wind picks up.", shelteredWindy)).toEqual({ ok: true });
    expect(check("Partly sheltered from the west groundswell, and the wind picks up.", partlyWindy)).toEqual({ ok: true });
    expect(check("Faces the west groundswell dead on, but the wind picks up.", openWindy)).toEqual({ ok: true });
    // "picks up" is no exposure claim (R27): it usually means a region receiving a swell.
    const cover = fact("A long-period groundswell from the west reaches San Diego Wednesday and peaks Thursday.");
    expect(checkWrittenSentence("San Diego picks up a west groundswell Wednesday that peaks Thursday.", cover, BEACHES, ["San Diego"]))
      .toEqual({ ok: true });
    expect(check("Catches the west groundswell, and the wind is up.", shelteredWindy)).toEqual({ ok: false, reason: "exposure" });
  });

  it("lets a candidate's wind strength license the claims it implies, on the candidate's side only (R27)", () => {
    const openWindy = fact("Faces the west groundswell dead on, but the wind is up in its window.");
    const openBreezy = fact("Faces the west groundswell dead on, but it's breezy in its window.");
    expect(check("Takes the west groundswell dead on, clean and glassy in its window.", open)).toEqual({ ok: true });
    expect(check("Takes the west groundswell dead on, with calm wind.", open)).toEqual({ ok: true });
    expect(check("Takes the west groundswell dead on, windy and choppy.", openWindy)).toEqual({ ok: true });
    expect(check("Takes the west groundswell dead on, but blown out and choppy.", openWindy)).toEqual({ ok: false, reason: "wind_strength" });
    expect(check("Takes the west groundswell dead on, but gusty and messy.", openWindy)).toEqual({ ok: true });
    expect(check("Takes the west groundswell dead on, a bit bumpy.", openBreezy)).toEqual({ ok: true });
    // Never across strengths, and never backwards: "clean" licenses no "light".
    expect(check("Takes the west groundswell dead on, but choppy.", open)).toEqual({ ok: false, reason: "wind_strength" });
    expect(check("Takes the west groundswell dead on, and clean.", openWindy)).toEqual({ ok: false, reason: "wind_strength" });
    expect(check("Takes the west groundswell dead on, but choppy.", openBreezy)).toEqual({ ok: false, reason: "wind_strength" });
    expect(check("Light wind on Friday.", fact("On Friday, the wind turns offshore and cleans up later."))).toEqual({ ok: false, reason: "wind_strength" });
    // Every key and value is a wind_strength claim's canonical form.
    const canonical = CLOSED_WORD_SETS.wind_strength.map((forms) => forms[0] as string);
    expect(Object.entries(WIND_STRENGTH_IMPLIES).flatMap(([key, values]) => [key, ...values]).filter((claim) => !canonical.includes(claim)))
      .toEqual([]);
  });

  it("reads the residual words as the claim they make", () => {
    // "catches", "exposed" and "wide open" are "faces": true of an open beach. The degree word still stays.
    expect(check("Catches the west groundswell dead on, with light wind.", open)).toEqual({ ok: true });
    expect(check("Wide open to the west groundswell dead on, and the wind stays light.", open)).toEqual({ ok: true });
    expect(check("Wide open to the west groundswell, and the wind stays light.", open)).toEqual({ ok: false, reason: "exposure" });
    // "cleaner" is "clean": the wind lines write "cleaner" and "cleans up" for one claim.
    const pattern = fact("Mornings stay cleaner through the week; the onshore fills in by midday.");
    expect(check("Clean mornings all week, then the onshore fills in by midday.", pattern)).toEqual({ ok: true });
    const turn = fact("On Friday, the wind turns offshore and cleans up later.");
    expect(check("On Friday the wind goes offshore and gets cleaner later.", turn)).toEqual({ ok: true });
    expect(check("On Friday the wind goes offshore and gets lighter later.", turn)).toEqual({ ok: false, reason: "wind_strength" });
  });

  it("binds the arrival forms to the day after them like \"arrives\"", () => {
    expect(check("West groundswell shows up Thursday, tops out Friday and backs off Saturday.", days)).toEqual({ ok: true });
    expect(check("West groundswell fills in Thursday and peaks Friday.", days)).toEqual({ ok: true });
    expect(check("A west groundswell rolls in Thursday and peaks Friday.", days)).toEqual({ ok: true });
    for (const verb of ["pushes in", "shows up", "rolls in", "rolling in"]) {
      expect([verb, check(`A west groundswell ${verb} Friday.`, days)]).toEqual([verb, { ok: false, reason: "weekday_order" }]);
    }
    // Their past forms are time claims, like "arrived".
    for (const verb of ["pushed in", "showed up", "rolled in"]) {
      expect([verb, check(`A west groundswell ${verb} Thursday.`, days)]).toEqual([verb, { ok: false, reason: "timing" }]);
    }
    // "starts" binds nothing: the lead's "Thursday starts ... toward a Friday peak" would pair it with Friday.
    const lead = fact("Thursday starts the west swell's run toward a Friday peak.");
    expect(check("Thursday starts the west swell's run toward a Friday peak.", lead)).toEqual({ ok: true });
    expect(check("The west swell arrives Friday.", lead)).toEqual({ ok: false, reason: "weekday_order" });
  });

  it("binds each day to the phase verbs before it in its clause", () => {
    expect(check("A west groundswell arrives Thursday and fades Friday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A west groundswell peaks Friday, then fades Saturday.", days)).toEqual({ ok: true });
    // Every phase verb since the clause's last day binds: "arrives and peaks Thursday" moves the arrival.
    const twoDay = fact("A west long-period groundswell arrives Wednesday and peaks Thursday.");
    expect(check("A west groundswell arrives and peaks Thursday.", twoDay)).toEqual({ ok: false, reason: "weekday_order" });
    const sameDay = fact("A west short-period storm swell arrives and peaks Thursday, then fades Friday.");
    expect(check("This west storm swell arrives and peaks Thursday, then fades Friday.", sameDay)).toEqual({ ok: true });
    expect(check("The west storm swell arrives Thursday.", sameDay)).toEqual({ ok: true });
    expect(check("The west storm swell arrives Thursday and peaks Friday.", sameDay)).toEqual({ ok: false, reason: "weekday_order" });
    const comesAndGoes = fact("A west short-period storm swell comes and goes Thursday.");
    expect(check("The west storm swell comes and goes Thursday.", comesAndGoes)).toEqual({ ok: true });
    // A phase verb with no day after it in its clause binds back to the day before it.
    expect(check("By Friday the west groundswell peaks, and it fades Saturday.", days)).toEqual({ ok: true });
    // The cover's "reaches" is an arrival and its "the most swell" a peak.
    const cover = fact("A long-period groundswell from the west reaches North Shore Wednesday and peaks Thursday.");
    expect(region("The west groundswell reaches North Shore Thursday.", cover)).toEqual({ ok: false, reason: "weekday_order" });
    expect(region("The west groundswell reaches North Shore Wednesday.", cover)).toEqual({ ok: true });
    const alt = fact("North Shore gets a west long-period groundswell by Wednesday, with the most swell Thursday.");
    expect(region("North Shore gets the most swell Wednesday.", alt)).toEqual({ ok: false, reason: "weekday_order" });
    expect(region("North Shore gets the most swell Thursday.", alt)).toEqual({ ok: true });
    // A relative day binds like a weekday.
    const later = fact("A long-period groundswell from the west reaches North Shore Monday and peaks next week.");
    expect(region("The west groundswell reaches North Shore next week.", later)).toEqual({ ok: false, reason: "weekday_order" });
    expect(region("The west groundswell peaks next week.", later)).toEqual({ ok: true });
    const today = fact("An east short-period windswell arrives a week from today and peaks a week from Thursday.");
    expect(check("An east windswell arrives a week from Thursday.", today)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("An east windswell peaks a week from Thursday.", today)).toEqual({ ok: true });
  });

  it("binds a phase verb after its day back to that day (R24)", () => {
    // Each of these passed before: the verb came after its day, so it bound none.
    expect(check("A west groundswell: Thursday peaks, Friday fades, Saturday arrives.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("By Thursday the west groundswell peaks, then fades Saturday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A Thursday peak, then it fades Saturday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A west groundswell arrives Thursday and fades.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("Thursday the west groundswell arrives, Friday it peaks.", days)).toEqual({ ok: true });
    // The lead-alt's "toward a Friday peak" pairs peak with Friday, so the plain rewrite passes and a moved arrival still fails.
    const leadAlt = fact("Thursday starts the west swell's run toward a Friday peak.");
    expect(check("The west swell's run starts Thursday and peaks Friday.", leadAlt)).toEqual({ ok: true });
    expect(check("A Thursday peak; the west swell's run starts Friday.", leadAlt)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("The west swell arrives Friday.", leadAlt)).toEqual({ ok: false, reason: "weekday_order" });
    // "fills in" is the wind lines' verb, no arrival (R27): moving it next to Friday is a true rewrite.
    const wind = fact("On Friday, the onshore fills in after the cleaner morning.");
    expect(check("On Friday, the onshore fills in after the cleaner morning.", wind)).toEqual({ ok: true });
    expect(check("The onshore fills in Friday after a cleaner morning.", wind)).toEqual({ ok: true });
    expect(check("The onshore filled in Friday after a cleaner morning.", wind)).toEqual({ ok: true });
  });

  it("gives a day with no phase verb of its own the previous day's verbs in its clause (R24)", () => {
    // Each of these passed before: the second day bound no verb.
    expect(check("A west groundswell arrives Thursday, peaks Friday and Saturday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    const sameDay = fact("A west short-period storm swell arrives and peaks Thursday, then fades Friday.");
    expect(check("A stormy west swell arrives Thursday and Friday.", sameDay)).toEqual({ ok: false, reason: "weekday_order" });
    // "builds from Thursday into Friday" pairs builds with both days, so "builds into Friday" passes.
    const lead = fact("The west pulse builds from Thursday into Friday.");
    expect(check("The west pulse builds into Friday.", lead)).toEqual({ ok: true });
    expect(check("The west pulse builds from Thursday into Friday.", lead)).toEqual({ ok: true });
    // Only within a clause: "shows up Thursday, tops out Friday" gives Friday nothing.
    expect(check("West groundswell shows up Thursday, tops out Friday and backs off Saturday.", days)).toEqual({ ok: true });
    // A day-only sentence binds nothing to pass on.
    const change = fact("The best regional window looks better on Friday than on Thursday.");
    expect(check("Friday's best window beats Thursday's.", change)).toEqual({ ok: true });
  });

  it("binds a trailing phase verb to every day listed before it (R26)", () => {
    // Each of these passed before: the trailing verb reached only the last day.
    expect(check("Thursday and Friday both peak.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("Thursday, Friday and Saturday all peak.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("Friday it peaks, and Saturday it fades.", days)).toEqual({ ok: true });
    // A comma-separated list of bare days carries the verb before it.
    expect(check("A west groundswell peaks Friday, Saturday.", days)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("A west groundswell peaks Friday, Saturday and Sunday.",
      fact("A west long-period groundswell arrives Thursday, peaks Friday, eases Saturday and fades Sunday.")))
      .toEqual({ ok: false, reason: "weekday_order" });
    // A clause with its own verb is no list: the clause rule still splits "arrives Thursday, peaks Friday".
    expect(check("A west groundswell arrives Thursday, peaks Friday.", days)).toEqual({ ok: true });
    expect(check("A west groundswell arrives Thursday, Friday it peaks.", days)).toEqual({ ok: true });
    // Days joined by other words are no list, so the lead-alt's "toward a Friday peak" never reaches Thursday.
    const leadAlt = fact("Thursday starts the west swell's run toward a Friday peak.");
    expect(check("The west swell peaks Thursday.", leadAlt)).toEqual({ ok: false, reason: "weekday_order" });
    expect(check("Thursday starts the west swell's run toward a Friday peak.", leadAlt)).toEqual({ ok: true });
  });

  it("keeps every degree word its fact has and adds none", () => {
    expect(check("Sheltered from the west groundswell, with light wind in its window.", partly)).toEqual({ ok: false, reason: "exposure" });
    expect(check("Partially sheltered from the west groundswell, with light wind.", partly)).toEqual({ ok: true });
    expect(check("Partly sheltered from the west groundswell, with light wind.", sheltered)).toEqual({ ok: false, reason: "exposure" });
    expect(check("Faces the west groundswell, with light wind in its window.", open)).toEqual({ ok: false, reason: "exposure" });
    expect(check("Faces the west groundswell head on, with light wind.", open)).toEqual({ ok: false, reason: "exposure" });
  });

  it("keeps the fact's beaches in its order", () => {
    const exposure = fact("Ocean Beach and La Jolla Shores face this swell better than Swami's, which sits in the shadow.");
    expect(check("Swami's and Ocean Beach face this swell better than La Jolla Shores, which sits in the shadow.", exposure))
      .toEqual({ ok: false, reason: "beach" });
    expect(check("Ocean Beach faces this swell better than Swami's.", exposure)).toEqual({ ok: true });
    const listed = fact("Ocean Beach faces this swell better than La Jolla Shores and Swami's, which sit in the shadow.");
    expect(check("La Jolla Shores faces this swell better than Ocean Beach and Swami's, which sit in the shadow.", listed))
      .toEqual({ ok: false, reason: "beach" });
  });

  it("exports the phase verbs and the degree words", () => {
    expect(Object.keys(PHASE_VERBS)).toEqual(["arrives", "peaks", "fades", "comes and goes", "builds", "eases"]);
    expect(DEGREE_WORDS).toEqual([["partly", "partially"], ["dead on"], ["at an angle", "angled"], ["head on"], ["straight on"]]);
  });

  it("lists every exported constant in the contract, string for string, for the worker to mirror", () => {
    const doc = readFileSync(path.join(__dirname, "../../../../docs/contracts/week-scout-story.md"), "utf8");
    const block = /```json claims\n([\s\S]*?)\n```/.exec(doc);
    expect(block).not.toBeNull();
    expect(JSON.parse(block![1])).toEqual({
      COMPASS, WEEKDAY, CLOSED_WORD_SETS, DEGREE_WORDS, PHASE_VERBS, TIME_QUALIFIERS, DAY_PHRASES, WEEK_FROM_DAYS, NEXT_WEEKDAYS,
      LIST_JOINERS, RELATIVE_TIME_WORDS, NUMBER_WORDS, SIZE_ADJECTIVES, VERDICT_WORDS, WIND_STRENGTH_IMPLIES, COMPASS_ABBREVIATIONS,
      WEEKDAY_ABBREVIATIONS,
    });
    // Every past phase form is a time qualifier.
    expect(Object.values(PHASE_VERBS).flat().filter((form) => /ed\b|built|went/.test(form))
      .filter((form) => !(TIME_QUALIFIERS as readonly string[]).includes(form))).toEqual([]);
  });
});

describe("every server line passes its own claim check", () => {
  const TODAY = "2026-10-27";
  const at = (offset: number) => new Date(Date.UTC(2026, 9, 27 + offset, 19)).toISOString();

  it("passes every beach line", () => {
    for (const direction of COMPASS) {
      for (const kind of ["swell", "storm"] as const) {
        for (const periodClass of ["long", "mid", "short"] as const) {
          for (const [exposure, facing] of [["open", "direct"], ["open", "angled"], ["partial", null], ["shadowed", null]] as const) {
            for (const wind of ["light", "breezy", "windy"] as const) {
              const text = beachLineText({ direction, kind, periodClass, exposure, facing, wind });
              expect([text, check(text, fact(text))]).toEqual([text, { ok: true }]);
            }
          }
        }
      }
    }
  });

  it("passes every event story line", () => {
    const offsets = [-8, -1, 0, 1, 3, 7, 9, 14];
    for (const directionDeg of [0, 202, 270, 315]) {
      for (const periodS of [7, 11, 15]) {
        for (const kind of ["swell", "storm"] as const) {
          for (const arrival of offsets) {
            for (const peak of offsets.filter((offset) => offset >= arrival)) {
              for (const fade of [null, ...offsets.filter((offset) => offset >= peak)]) {
                const event: RegionalSwellEvent = { directionDeg, periodS, kind, arrivalAt: at(arrival), peakAt: at(peak),
                  fadeAt: fade === null ? null : at(fade), timezone: "America/Los_Angeles", confidence: "likely", minimumBeaches: 3,
                  regionalKey: "San Diego:X" };
                const text = eventStoryText(event, TODAY);
                expect([text, check(text, fact(text))]).toEqual([text, { ok: true }]);
              }
            }
          }
        }
      }
    }
  });

  it("passes every Week Scout candidate", () => {
    const signals = (): RegionalDaySignal[] => Array.from({ length: 7 }, (_, index) => ({
      localDate: at(index).slice(0, 10), complete: true, sampleBeaches: 3, meanHeightFt: 3, directionDeg: 270, periodS: 15,
      sourceSeries: "enhanced_forecasts:coast", forecastRevision: "2026-10-27T12:00:00Z", qualityScore: 40 + index * 20,
      wind: { bucket: "midday", fromBucket: "morning", fromWindClass: index % 2 ? "offshore" : "onshore", windClass: index % 2 ? "onshore" : "offshore",
        selectorConfirmed: true, turnConfirmed: index < 4 },
      tide: { bucket: "morning", tidePhase: "rising", windowOrder: "opens", selectorConfirmed: true, orderingConfirmed: true },
    }));
    const offsets = [-1, 0, 1, 3, 6, 8];
    for (const kind of ["swell", "storm"] as const) {
      for (const arrival of offsets) {
        for (const peak of offsets.filter((offset) => offset >= arrival && offset >= 0 && offset <= 6)) {
          for (const fade of [null, ...offsets.filter((offset) => offset >= peak)]) {
            const event: RegionalSwellEvent = { directionDeg: 202, periodS: 13.4, kind, arrivalAt: at(arrival), peakAt: at(peak),
              fadeAt: fade === null ? null : at(fade), timezone: "America/Los_Angeles", confidence: "likely", minimumBeaches: 3,
              regionalKey: "San Diego:SSW" };
            const days = signals();
            days[peak].exposedBeaches = { [storyEventKey(event)]: [
              { beachId: "a", beachName: "Ocean Beach", exposure: "open", qualityScore: 70 },
              { beachId: "b", beachName: "La Jolla Shores", exposure: "open", qualityScore: 60 },
              { beachId: "c", beachName: "Swami's", exposure: "shadowed", qualityScore: 40 },
            ] };
            for (const candidate of [...buildStoryCandidates(days, "San Diego", [event]), ...buildStoryCandidates(days, "the coast", [event])]) {
              expect([candidate.text, checkWrittenSentence(candidate.text, candidate, BEACHES, ["San Diego", "the coast"])])
                .toEqual([candidate.text, { ok: true }]);
            }
          }
        }
      }
    }
  });

  it("passes the wind-pattern and quiet-week lines", () => {
    const texts: string[] = [];
    for (const windClass of ["onshore", "offshore"] as const) {
      for (const turning of [3, 7]) {
        const days: RegionalDaySignal[] = Array.from({ length: 7 }, (_, index) => ({
          localDate: at(index).slice(0, 10), complete: true, sampleBeaches: 3, meanHeightFt: 1, directionDeg: 270, periodS: 15,
          sourceSeries: "enhanced_forecasts:coast", forecastRevision: "2026-10-27T12:00:00Z",
          wind: { bucket: "midday", fromBucket: "morning", fromWindClass: windClass === "onshore" ? "offshore" : "onshore", windClass,
            selectorConfirmed: true, turnConfirmed: index < turning },
        }));
        for (const candidate of buildStoryCandidates(days, "San Diego")) {
          texts.push(candidate.text);
          expect([candidate.text, checkWrittenSentence(candidate.text, candidate, BEACHES, ["San Diego"])]).toEqual([candidate.text, { ok: true }]);
        }
      }
    }
    expect(texts).toEqual(expect.arrayContaining([
      "Mornings stay cleaner through the week; the onshore fills in by midday.",
      "Mornings stay onshore on several days; offshore wind cleans up by midday.",
      "No clear regional pulse through this stretch.",
    ]));
  });
});

describe("paraphrase table per server-copy shape (R27)", () => {
  // The self-checks can't catch binding bugs, so each server line's shape gets true rewrites and swaps.
  const TODAY = "2026-10-27";
  const at = (offset: number) => new Date(Date.UTC(2026, 9, 27 + offset, 19)).toISOString();
  const story = (arrival: number, peak: number, fade: number | null): string => eventStoryText({ directionDeg: 270, periodS: 15,
    kind: "swell", arrivalAt: at(arrival), peakAt: at(peak), fadeAt: fade === null ? null : at(fade), timezone: "America/Los_Angeles",
    confidence: "likely", minimumBeaches: 3, regionalKey: "San Diego:W" }, TODAY);
  const chapter = (): string => {
    const days: RegionalDaySignal[] = Array.from({ length: 7 }, (_, index) => ({ localDate: at(index).slice(0, 10), complete: true,
      sampleBeaches: 3, meanHeightFt: 3, directionDeg: 270, periodS: 15, sourceSeries: "s", forecastRevision: "r" }));
    const event: RegionalSwellEvent = { directionDeg: 270, periodS: 15, kind: "swell", arrivalAt: at(2), peakAt: at(3), fadeAt: at(4),
      timezone: "America/Los_Angeles", confidence: "likely", minimumBeaches: 3, regionalKey: "San Diego:W" };
    return buildStoryCandidates(days, "San Diego", [event]).find((candidate) => /^swell:[^:]+$/.test(candidate.slot) && !candidate.id.endsWith("-alt"))!.text;
  };
  type Shape = [name: string, text: string, expected: string, rewrites: string[], swaps: Array<[string, string]>];
  const shapes: Shape[] = [
    ["beach open, light", beachLineText({ direction: "west", kind: "swell", periodClass: "long", exposure: "open", facing: "direct", wind: "light" }),
      "Faces the west groundswell dead on, with light wind in its window.",
      ["Takes the west groundswell dead on, with light wind.", "Wide open to the west groundswell dead on, light and clean in its window.",
        "Catches the west groundswell dead on; the wind stays light."],
      [["Sheltered from the west groundswell, with light wind.", "exposure"], ["Faces the west groundswell dead on, but the wind is up.", "wind_strength"],
        ["Faces the south groundswell dead on, with light wind.", "direction"], ["Faces the west groundswell at an angle, light wind.", "exposure"]]],
    ["beach sheltered, breezy", beachLineText({ direction: "west", kind: "swell", periodClass: "long", exposure: "shadowed", facing: null, wind: "breezy" }),
      "Sheltered from the west groundswell, and it's breezy in its window.",
      ["Tucked away from the west groundswell, and breezy.", "Sheltered from the west groundswell; a bit bumpy with the breeze."],
      [["Exposed to the west groundswell, and breezy.", "exposure"], ["Sheltered from the west groundswell, with light wind.", "wind_strength"],
        ["Partly sheltered from the west groundswell, breezy.", "exposure"]]],
    ["beach partly sheltered, light", beachLineText({ direction: "west", kind: "swell", periodClass: "mid", exposure: "partial", facing: null, wind: "light" }),
      "Partly sheltered from the west mid-period swell, with light wind in its window.",
      ["Partly tucked away from the west mid-period swell, glassy in its window.", "Partially sheltered from the west mid-period swell; the wind stays light."],
      [["Sheltered from the west mid-period swell, light wind.", "exposure"], ["Partly sheltered from the west groundswell, light wind.", "period"],
        ["Partly sheltered from the west mid-period swell, but choppy.", "wind_strength"]]],
    ["beach blown out (windy)", beachLineText({ direction: "west", kind: "storm", periodClass: "short", exposure: "open", facing: "direct", wind: "windy" }),
      "Faces the west storm swell head on, but the wind is up in its window.",
      ["Takes the west storm swell head on, but the wind's up.", "Faces the west storm swell head on; windy and choppy."],
      [["Faces the west storm swell head on, with light wind.", "wind_strength"], ["Takes the west storm swell head on, but it's blown out.", "wind_strength"],
        ["Faces the west groundswell head on, windy.", "period"],
        ["Faces the west storm swell dead on, windy.", "exposure"]]],
    ["event story arrive, peak, fade", story(2, 3, 4), "A west long-period groundswell arrives Thursday, peaks Friday and fades Saturday.",
      ["West groundswell rolls in Thursday, tops out Friday and backs off Saturday.", "Thursday the west groundswell shows up, Friday it peaks, Saturday it fades.",
        "The west long-period groundswell arrives Thursday and peaks Friday."],
      [["West groundswell arrives Friday and peaks Saturday.", "weekday_order"], ["West groundswell arrives Thursday, then peaks and fades Friday.", "weekday_order"],
        ["Thursday and Friday both peak for the west groundswell.", "weekday_order"]]],
    ["event story same day", story(2, 2, 3), "A west long-period groundswell arrives and peaks Thursday, then fades Friday.",
      ["The west groundswell shows up and peaks Thursday, fading Friday.", "Thursday it arrives and peaks; Friday it fades."],
      [["The west groundswell arrives Thursday and peaks Friday.", "weekday_order"], ["The west groundswell peaks Thursday, Friday.", "weekday_order"],
        ["The west groundswell arrives Wednesday and peaks Thursday.", "weekday"]]],
    ["event story comes and goes", story(2, 2, 2), "A west long-period groundswell comes and goes Thursday.",
      ["The west groundswell comes and goes Thursday.", "Thursday the west groundswell comes and goes."],
      [["The west groundswell comes and goes Friday.", "weekday"], ["The west groundswell peaks Thursday.", "weekday_order"],
        ["The west groundswell rolls in Thursday.", "weekday_order"]]],
    ["Week Scout swell chapter", chapter(), "The long-period groundswell arrives Thursday and peaks Friday before easing Saturday.",
      ["The long-period groundswell shows up Thursday and peaks Friday, easing Saturday.", "Long-period groundswell: in Thursday, peaking Friday, easing off Saturday."],
      [["The long-period groundswell arrives Thursday and peaks Saturday.", "weekday_order"],
        ["The long-period groundswell arrives Thursday and fades Friday.", "weekday_order"],
        ["The long-period groundswell peaks Friday before easing Thursday.", "weekday_order"]]],
  ];

  it.each(shapes)("%s: true rewrites pass and swaps refuse", (_name, text, expected, rewrites, swaps) => {
    expect(text).toBe(expected);
    for (const rewrite of rewrites) expect([rewrite, check(rewrite, fact(text))]).toEqual([rewrite, { ok: true }]);
    for (const [swap, reason] of swaps) expect([swap, check(swap, fact(text))]).toEqual([swap, { ok: false, reason }]);
  });
});

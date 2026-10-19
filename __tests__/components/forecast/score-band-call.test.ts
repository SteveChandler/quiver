import { getCanonicalVerdictCall, getScoreCall, getSurfCallVerdictCall } from "@/components/forecast/score-band-call";
import { fairActionPhrase, FAIR_ACTION_PHRASES } from "@/lib/utils/fair-action-phrase";

describe("getCanonicalVerdictCall", () => {
  it("keeps the tier inside the verdict's band so the label never contradicts the call", () => {
    expect(getCanonicalVerdictCall("go", 91)).toEqual({ label: "GOOD", action: "Worth a surf" });
    expect(getCanonicalVerdictCall("go", 52)).toEqual({ label: "GOOD", action: "Worth a surf" });
    expect(getCanonicalVerdictCall("maybe", 88)).toEqual({ label: "FAIR", action: "Could be fun" });
    expect(getCanonicalVerdictCall("maybe", 44)).toEqual({ label: "RIDEABLE", action: "Slim pickings" });
    expect(getCanonicalVerdictCall("maybe", 12)).toEqual({ label: "RIDEABLE", action: "Slim pickings" });
    expect(getCanonicalVerdictCall("no", 90)).toEqual({ label: "MEH", action: "Skip it" });
  });

  it("falls back to the verdict's conservative tier without a score", () => {
    expect(getCanonicalVerdictCall("go", null).label).toBe("GOOD");
    expect(getCanonicalVerdictCall("maybe", Number.NaN).label).toBe("RIDEABLE");
    expect(getCanonicalVerdictCall("no", undefined).label).toBe("MEH");
  });

  it("only puts the positive tiers in the future tense", () => {
    expect(getCanonicalVerdictCall("go", 85, "upcoming").action).toBe("Worth planning");
    expect(getCanonicalVerdictCall("go", 72, "upcoming").action).toBe("Worth planning");
    expect(getCanonicalVerdictCall("maybe", 60, "upcoming").action).toBe("Could be fun");
    expect(getCanonicalVerdictCall("no", 10, "upcoming").action).toBe("Skip it");
  });

  it("never calls EPIC and never shouts while EPIC is off", () => {
    for (let score = 0; score <= 100; score += 1) {
      for (const tense of ["now", "upcoming"] as const) {
        const call = getCanonicalVerdictCall("go", score, tense);
        expect(call.label).not.toBe("EPIC");
        expect(call.action).not.toMatch(/!/);
      }
      expect(getScoreCall(score).label).not.toBe("EPIC");
      expect(getScoreCall(score).action).not.toMatch(/!/);
    }
  });
});


describe("FAIR phrase parity", () => {
  const parity: Array<{ beachId: string; instantIso: string; phrase: string }> = require("@/lib/utils/__fixtures__/fair-phrase-parity.json");

  it("exports the agreed phrase order", () => {
    expect(FAIR_ACTION_PHRASES).toEqual(["Could be fun", "Fair shot", "Decent shot"]);
  });

  it.each(parity)("matches $beachId at $instantIso", ({ beachId, instantIso, phrase }) => {
    expect(fairActionPhrase({ beachId, instantIso })).toBe(phrase);
    const identity = { beachId, instantIso };
    expect(getScoreCall(60, identity)).toEqual({ label: "FAIR", action: phrase });
    expect(getCanonicalVerdictCall("maybe", 60, "upcoming", identity).action).toBe(phrase);
    expect(getSurfCallVerdictCall("MAYBE", 60, "now", identity).action).toBe(phrase);
  });

  it("stays stable across rerenders, midnight and timezone representations", () => {
    const random = jest.spyOn(Math, "random").mockImplementation(() => { throw new Error("random phrase"); });
    try {
      for (let repeat = 0; repeat < 3; repeat += 1) {
        expect(fairActionPhrase({ beachId: "beach-blacks", instantIso: "2026-10-18T00:00:00Z" })).toBe("Decent shot");
        expect(fairActionPhrase({ beachId: "beach-blacks", instantIso: "2026-10-17T17:00:00-07:00" })).toBe("Decent shot");
        expect(fairActionPhrase({ beachId: "beach-blacks", instantIso: "2026-10-18T10:59:59.999Z" })).toBe("Decent shot");
        expect(fairActionPhrase({ beachId: "beach-blacks", instantIso: "2026-10-18T11:00:00Z" })).toBe("Could be fun");
      }
    } finally {
      random.mockRestore();
    }
  });

  it("hashes UTF-8 bytes, including non-ASCII beach ids", () => {
    expect(fairActionPhrase({ beachId: "海🌊", instantIso: "2026-10-17T15:00:00Z" })).toBe("Decent shot");
  });

  it("uses the first phrase when identity is absent", () => {
    expect(getScoreCall(60).action).toBe("Could be fun");
    expect(getScoreCall(60, { beachId: "scripps", instantIso: null }).action).toBe("Could be fun");
    expect(getScoreCall(60, { beachId: null, instantIso: "2026-10-17T15:00:00Z" }).action).toBe("Could be fun");
  });
});

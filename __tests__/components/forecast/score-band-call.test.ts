import { getCanonicalVerdictCall } from "@/components/forecast/score-band-call";

describe("getCanonicalVerdictCall", () => {
  it("keeps the tier inside the verdict's band so the label never contradicts the call", () => {
    expect(getCanonicalVerdictCall("go", 91)).toEqual({ label: "EPIC", action: "Go now!" });
    expect(getCanonicalVerdictCall("go", 52)).toEqual({ label: "GOOD", action: "Go surf!" });
    expect(getCanonicalVerdictCall("maybe", 88)).toEqual({ label: "FAIR", action: "Worth a look" });
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
    expect(getCanonicalVerdictCall("go", 85, "upcoming").action).toBe("Don't miss it");
    expect(getCanonicalVerdictCall("go", 72, "upcoming").action).toBe("Worth planning");
    expect(getCanonicalVerdictCall("maybe", 60, "upcoming").action).toBe("Worth a look");
    expect(getCanonicalVerdictCall("no", 10, "upcoming").action).toBe("Skip it");
  });
});

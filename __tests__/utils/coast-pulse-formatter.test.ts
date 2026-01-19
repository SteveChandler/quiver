import {
  getHeightAssessment,
  getHeightConditionNote,
  getPeriodLabel,
  getPeriodQuality,
  getSwellDirectionContext,
  getTempComfortLabel,
  formatWaterTemp,
  formatTideMessage,
} from "@/lib/utils/coast-pulse-formatter";
import { COASTAL_REGIONS } from "@/lib/constants/coastal-regions";

describe("getHeightAssessment", () => {
  it("returns 'Flat' for < 1ft", () => {
    expect(getHeightAssessment(0.5)).toBe("Flat");
    expect(getHeightAssessment(0)).toBe("Flat");
  });

  it("returns 'Ankle-to-knee' for 1-1.5ft", () => {
    expect(getHeightAssessment(1.0)).toBe("Ankle-to-knee");
    expect(getHeightAssessment(1.4)).toBe("Ankle-to-knee");
  });

  it("returns 'Knee-to-waist' for 1.5-2.5ft", () => {
    expect(getHeightAssessment(1.5)).toBe("Knee-to-waist");
    expect(getHeightAssessment(2.4)).toBe("Knee-to-waist");
  });

  it("returns 'Waist-to-chest' for 2.5-4ft", () => {
    expect(getHeightAssessment(2.5)).toBe("Waist-to-chest");
    expect(getHeightAssessment(3.9)).toBe("Waist-to-chest");
  });

  it("returns 'Head-high' for 4-6ft", () => {
    expect(getHeightAssessment(4.0)).toBe("Head-high");
    expect(getHeightAssessment(5.9)).toBe("Head-high");
  });

  it("returns 'Overhead' for 6-8ft", () => {
    expect(getHeightAssessment(6.0)).toBe("Overhead");
    expect(getHeightAssessment(7.9)).toBe("Overhead");
  });

  it("returns 'Double overhead' for 8-12ft", () => {
    expect(getHeightAssessment(8.0)).toBe("Double overhead");
    expect(getHeightAssessment(11.9)).toBe("Double overhead");
  });

  it("returns 'XXL' for > 12ft", () => {
    expect(getHeightAssessment(12.0)).toBe("XXL");
    expect(getHeightAssessment(20.0)).toBe("XXL");
  });
});

describe("getHeightConditionNote", () => {
  it("suggests SUP for flat conditions", () => {
    expect(getHeightConditionNote(0.5, 10)).toContain("SUP");
  });

  it("suggests longboards for small waves", () => {
    expect(getHeightConditionNote(1.2, 12)).toContain("longboard");
  });

  it("notes good size for mid-range", () => {
    expect(getHeightConditionNote(3.5, 14)).toContain("most surfers");
  });

  it("notes experts for big waves", () => {
    expect(getHeightConditionNote(10.0, 18)).toContain("expert");
  });

  it("notes favorable for knee-to-waist waves", () => {
    expect(getHeightConditionNote(2.0, 12)).toContain("longboards");
  });

  it("notes choppy for short-period mid-size", () => {
    expect(getHeightConditionNote(3.5, 8)).toContain("Choppy");
  });

  it("notes inconsistent for short-period head-high", () => {
    expect(getHeightConditionNote(5.0, 8)).toContain("Inconsistent");
  });

  it("notes solid for long-period head-high", () => {
    expect(getHeightConditionNote(5.0, 14)).toContain("Solid");
  });

  it("notes powerful for long-period overhead", () => {
    expect(getHeightConditionNote(7.0, 16)).toContain("Powerful");
  });

  it("notes dangerous for XXL waves", () => {
    expect(getHeightConditionNote(15.0, 18)).toContain("Dangerous");
  });
});

describe("getPeriodLabel", () => {
  it("returns 'Wind chop' for < 6s", () => {
    expect(getPeriodLabel(5)).toBe("Wind chop");
  });

  it("returns 'Short-period wind swell' for 6-9s", () => {
    expect(getPeriodLabel(6)).toBe("Short-period wind swell");
    expect(getPeriodLabel(8)).toBe("Short-period wind swell");
  });

  it("returns 'Mid-period swell' for 9-12s", () => {
    expect(getPeriodLabel(9)).toBe("Mid-period swell");
    expect(getPeriodLabel(11)).toBe("Mid-period swell");
  });

  it("returns 'Groundswell' for 12-15s", () => {
    expect(getPeriodLabel(12)).toBe("Groundswell");
    expect(getPeriodLabel(14)).toBe("Groundswell");
  });

  it("returns 'Long-period groundswell' for 15-18s", () => {
    expect(getPeriodLabel(15)).toBe("Long-period groundswell");
    expect(getPeriodLabel(17)).toBe("Long-period groundswell");
  });

  it("returns 'Deep-water groundswell' for > 18s", () => {
    expect(getPeriodLabel(18)).toBe("Deep-water groundswell");
    expect(getPeriodLabel(22)).toBe("Deep-water groundswell");
  });
});

describe("getPeriodQuality", () => {
  it("returns negative quality for wind chop", () => {
    expect(getPeriodQuality(5)).toBe("Bumpy, disorganized");
  });

  it("returns clean quality for groundswell", () => {
    expect(getPeriodQuality(14)).toBe("Clean lines, good shape expected");
  });

  it("returns excellent quality for deep-water swell", () => {
    expect(getPeriodQuality(20)).toContain("Excellent");
  });
});

describe("getSwellDirectionContext", () => {
  const socal = COASTAL_REGIONS.socal;
  const norcal = COASTAL_REGIONS.norcal;
  const eastFl = COASTAL_REGIONS["east-fl"];

  it("notes favorable direction for SoCal SW swell", () => {
    const context = getSwellDirectionContext("SW", socal);
    expect(context).toContain("south-facing");
  });

  it("notes direct hit for NorCal NW swell", () => {
    const context = getSwellDirectionContext("NW", norcal);
    expect(context).toContain("direct");
  });

  it("notes favorable for East Coast SE swell", () => {
    const context = getSwellDirectionContext("SE", eastFl);
    expect(context).toContain("east-facing");
  });

  it("notes shadowed for unfavorable direction", () => {
    const context = getSwellDirectionContext("N", socal);
    expect(context).toContain("shadow");
  });

  it("returns null for null direction", () => {
    expect(getSwellDirectionContext(null, socal)).toBeNull();
  });
});

describe("getTempComfortLabel", () => {
  it("returns 'cold' for < 50F", () => {
    expect(getTempComfortLabel(48)).toBe("cold");
  });

  it("returns 'chilly' for 50-55F", () => {
    expect(getTempComfortLabel(52)).toBe("chilly");
  });

  it("returns 'cool' for 55-60F", () => {
    expect(getTempComfortLabel(58)).toBe("cool");
  });

  it("returns 'mild' for 60-65F", () => {
    expect(getTempComfortLabel(63)).toBe("mild");
  });

  it("returns 'comfortable' for 65-70F", () => {
    expect(getTempComfortLabel(68)).toBe("comfortable");
  });

  it("returns 'warm' for 70-75F", () => {
    expect(getTempComfortLabel(72)).toBe("warm");
  });

  it("returns 'tropical' for > 75F", () => {
    expect(getTempComfortLabel(80)).toBe("tropical");
  });
});

describe("formatWaterTemp", () => {
  const socal = COASTAL_REGIONS.socal;

  it("includes temperature and comfort label", () => {
    const result = formatWaterTemp(63, socal, 6); // July
    expect(result).toContain("63°F");
    expect(result).toContain("mild");
  });

  it("adds seasonal context when significantly above average", () => {
    const result = formatWaterTemp(75, socal, 0); // January, avg 58
    expect(result).toContain("warm for January");
  });

  it("adds seasonal context when significantly below average", () => {
    const result = formatWaterTemp(60, socal, 7); // August, avg 70
    expect(result).toContain("cool for August");
  });

  it("omits seasonal context when typical", () => {
    const result = formatWaterTemp(68, socal, 6); // July, avg 68
    expect(result).not.toContain("for July");
  });
});

describe("formatTideMessage", () => {
  it("formats rising toward high", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 5.2,
      hoursUntil: 2,
      minsUntil: 15,
      currentHeight: 3.1,
      status: "Rising",
    });
    expect(result).toContain("Pushing in");
    expect(result).toContain("high in 2h 15m");
    expect(result).toContain("Beach breaks may back off");
  });

  it("formats near high tide", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 5.2,
      hoursUntil: 0,
      minsUntil: 20,
      currentHeight: 5.0,
      status: "Rising",
    });
    expect(result).toContain("Near high");
    expect(result).toContain("Fat and slow");
  });

  it("formats falling from high", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -0.5,
      hoursUntil: 4,
      minsUntil: 0,
      currentHeight: 3.5,
      status: "Falling",
    });
    expect(result).toContain("Draining out");
    expect(result).toContain("Reefs and points improving");
  });

  it("formats near low tide", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -0.5,
      hoursUntil: 0,
      minsUntil: 15,
      currentHeight: -0.3,
      status: "Falling",
    });
    expect(result).toContain("Near low");
    expect(result).toContain("shallow");
  });

  it("formats rising from low", () => {
    const result = formatTideMessage({
      nextTideName: "High Tide",
      nextTideHeight: 4.8,
      hoursUntil: 5,
      minsUntil: 0,
      currentHeight: 0.5,
      status: "Rising",
    });
    expect(result).toContain("Filling in");
    expect(result).toContain("Sandbars coming alive");
  });

  it("notes extremely low tide", () => {
    const result = formatTideMessage({
      nextTideName: "Low Tide",
      nextTideHeight: -1.5,
      hoursUntil: 0,
      minsUntil: 30,
      currentHeight: -1.2,
      status: "Falling",
    });
    expect(result).toContain("Extremely low");
  });
});

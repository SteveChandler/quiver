import { formatWaveRange, parseWaterTemp, getSeasonalWaterTemp } from "@/lib/npc/forecast-formatter";

describe("formatWaveRange", () => {
  it("formats wave height into range", () => {
    expect(formatWaveRange(3.5)).toBe("3-4ft");
    expect(formatWaveRange(5.0)).toBe("4-6ft");
  });

  it("characterizes the single-height arity used by NPC prose", () => {
    expect(formatWaveRange(0)).toBe("0-1ft");
    expect(formatWaveRange(2.49)).toBe("1-3ft");
  });
});



// ---------------------------------------------------------------------------
// Bug 3 & 4: Tide formatting — no double AM/PM suffix, correct High/Low type
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bug 5: Water temp parsing from DB text format
// ---------------------------------------------------------------------------
describe("parseWaterTemp", () => {
  it("parses a DB text value like '57°F'", () => {
    expect(parseWaterTemp("57°F")).toBe(57);
  });

  it("parses a DB text value like '62°F'", () => {
    expect(parseWaterTemp("62°F")).toBe(62);
  });

  it("returns null for null input", () => {
    expect(parseWaterTemp(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseWaterTemp("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseWaterTemp("N/A")).toBeNull();
  });

  it("handles values without degree symbol", () => {
    expect(parseWaterTemp("68")).toBe(68);
  });
});

// ---------------------------------------------------------------------------
// Bug 5: Seasonal fallback water temp — deterministic, not random
// ---------------------------------------------------------------------------
describe("getSeasonalWaterTemp", () => {
  it("returns a deterministic value (same result on repeated calls)", () => {
    const first = getSeasonalWaterTemp("socal");
    const second = getSeasonalWaterTemp("socal");
    expect(first).toBe(second);
  });

  it("returns a number within plausible range for norcal", () => {
    const temp = getSeasonalWaterTemp("norcal");
    expect(temp).toBeGreaterThanOrEqual(54);
    expect(temp).toBeLessThanOrEqual(58);
  });

  it("returns a number within plausible range for central", () => {
    const temp = getSeasonalWaterTemp("central");
    expect(temp).toBeGreaterThanOrEqual(56);
    expect(temp).toBeLessThanOrEqual(62);
  });

  it("returns a number within plausible range for socal", () => {
    const temp = getSeasonalWaterTemp("socal");
    expect(temp).toBeGreaterThanOrEqual(60);
    expect(temp).toBeLessThanOrEqual(70);
  });

  it("returns colder temps for norcal than socal", () => {
    expect(getSeasonalWaterTemp("norcal")).toBeLessThan(getSeasonalWaterTemp("socal"));
  });
});

// ---------------------------------------------------------------------------
// Bugs 2 & 7: Wind descriptions with offshore/onshore awareness
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bug 7: describeConditionsBriefly with wind awareness (via secondaryBeaches)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Opening tone logic in generateRegionalForecast
// ---------------------------------------------------------------------------

import {
  formatWaveRange,
  formatWindDescription,
  formatTimeOfDay,
  parseWaterTemp,
  getSeasonalWaterTemp,
  generateRegionalForecast,
  type RegionalForecastData,
} from "@/lib/npc/forecast-formatter";

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

describe("formatWindDescription", () => {
  it("describes calm conditions", () => {
    expect(formatWindDescription(2, "NW")).toContain("glassy");
  });
});

describe("formatTimeOfDay", () => {
  it("formats early morning as dawn patrol", () => {
    // 5:30am PT = 13:30 UTC; formatTimeOfDay uses getUTCHours()-8 for PT conversion
    const date = new Date("2026-01-13T13:30:00Z");
    expect(formatTimeOfDay(date)).toBe("dawn patrol");
  });
});

// ---------------------------------------------------------------------------
// Bug 3 & 4: Tide formatting — no double AM/PM suffix, correct High/Low type
// ---------------------------------------------------------------------------
describe("generateRegionalForecast tide formatting", () => {
  function makeData(
    overrides: Partial<RegionalForecastData["primaryBeach"]>
  ): RegionalForecastData {
    return {
      region: "socal",
      primaryBeach: {
        id: "beach-1",
        name: "Scripps",
        waveHeight: 4,
        wavePeriod: 12,
        windSpeed: 5,
        windDirection: "E",
        windOffshoreDeg: 270,
        tideTime: null,
        tideHeight: 1.5,
        tideType: null,
        tideAt: null,
        waterTemp: 65,
        ...overrides,
      },
      secondaryBeaches: [],
    };
  }

  it("does not produce double AM/PM when next_tide_time has AM/PM already", () => {
    const data = makeData({ tideTime: "09:00 AM", tideType: "Low" });
    const { description } = generateRegionalForecast(data);
    // Should NOT contain "amam", "pmpm", "AMpm", "PMam", etc.
    expect(description).not.toMatch(/[aApP][mM][aApP][mM]/);
    expect(description).toContain("9:00am");
  });

  it("uses the correct Low tide type from DB", () => {
    const data = makeData({ tideTime: "02:00 PM", tideType: "Low" });
    const { description } = generateRegionalForecast(data);
    expect(description).toContain("Low tide");
  });

  it("uses the correct High tide type from DB", () => {
    const data = makeData({ tideTime: "07:00 AM", tideType: "High" });
    const { description } = generateRegionalForecast(data);
    expect(description).toContain("High tide");
  });

  it("prefers tideAt (timestamptz) over tideTime string when both present", () => {
    // 2026-02-20T14:30:00Z = 6:30am PT
    const data = makeData({
      tideAt: "2026-02-20T14:30:00Z",
      tideTime: "09:00 AM",
      tideType: "Low",
    });
    const { description } = generateRegionalForecast(data);
    // Should use the tideAt-derived time, not 9:00am
    expect(description).toContain("Low tide");
    expect(description).not.toMatch(/9:00am/);
  });

  it("falls back to Low when tideType is null", () => {
    const data = makeData({ tideTime: "03:30 PM", tideType: null });
    const { description } = generateRegionalForecast(data);
    expect(description).toContain("Low tide");
  });
});

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
describe("generateRegionalForecast wind descriptions", () => {
  function makeData(
    windSpeed: number | null,
    windDirection: string | null,
    windOffshoreDeg: number | null
  ): RegionalForecastData {
    return {
      region: "socal",
      primaryBeach: {
        id: "beach-1",
        name: "Scripps",
        waveHeight: 4,
        wavePeriod: 12,
        windSpeed,
        windDirection,
        windOffshoreDeg,
        tideTime: null,
        tideHeight: null,
        tideType: null,
        tideAt: null,
        waterTemp: 65,
      },
      secondaryBeaches: [],
    };
  }

  it("describes glassy conditions for very light wind", () => {
    const { description } = generateRegionalForecast(makeData(1, "NW", 90));
    expect(description).toContain("Glassy");
  });

  it("describes light offshore correctly", () => {
    // E wind on a west-facing beach (offshore deg ~90) → offshore classification
    const { description } = generateRegionalForecast(makeData(5, "E", 90));
    expect(description).toContain("offshore");
    expect(description).toContain("clean faces");
  });

  it("describes moderate offshore correctly", () => {
    const { description } = generateRegionalForecast(makeData(10, "E", 90));
    expect(description).toContain("offshore");
    expect(description).toContain("lined up and groomed");
  });

  it("describes strong offshore correctly", () => {
    const { description } = generateRegionalForecast(makeData(20, "E", 90));
    expect(description).toContain("offshore");
    expect(description).toContain("hold-downs");
  });

  it("describes light variable wind as clean", () => {
    const { description } = generateRegionalForecast(makeData(5, "Light and Variable", 90));
    expect(description).toContain("variable");
    expect(description).toContain("clean");
  });

  it("describes light onshore with slight texture", () => {
    // W wind on a west-facing beach → onshore
    const { description } = generateRegionalForecast(makeData(5, "W", 90));
    expect(description).toContain("onshore");
    expect(description).toContain("slight texture");
  });

  it("describes moderate onshore with chop", () => {
    const { description } = generateRegionalForecast(makeData(10, "W", 90));
    expect(description).toContain("onshore");
    expect(description).toContain("some chop");
  });

  it("describes strong onshore as blown out", () => {
    const { description } = generateRegionalForecast(makeData(22, "W", 90));
    expect(description).toContain("choppy and blown out");
  });
});

// ---------------------------------------------------------------------------
// Bug 7: describeConditionsBriefly with wind awareness (via secondaryBeaches)
// ---------------------------------------------------------------------------
describe("generateRegionalForecast secondary beach conditions", () => {
  function makeDataWithSecondary(
    secondary: RegionalForecastData["secondaryBeaches"]
  ): RegionalForecastData {
    return {
      region: "socal",
      primaryBeach: {
        id: "beach-1",
        name: "Scripps",
        waveHeight: 4,
        wavePeriod: 12,
        windSpeed: 5,
        windDirection: "E",
        windOffshoreDeg: 90,
        tideTime: null,
        tideHeight: null,
        tideType: null,
        tideAt: null,
        waterTemp: 65,
      },
      secondaryBeaches: secondary,
    };
  }

  it("describes small clean conditions for offshore secondary beach", () => {
    const data = makeDataWithSecondary([
      {
        name: "Trestles",
        waveHeight: 2.5,
        windDirection: "E",
        windOffshoreDeg: 90,
        windSpeed: 5,
        conditions: "small and clean",
      },
    ]);
    const { description } = generateRegionalForecast(data);
    expect(description).toContain("Trestles");
  });

  it("skips secondary beaches with no wave height", () => {
    const data = makeDataWithSecondary([
      {
        name: "Huntington",
        waveHeight: null,
        windDirection: "W",
        windOffshoreDeg: 90,
        windSpeed: 15,
        conditions: "choppy",
      },
    ]);
    const { description } = generateRegionalForecast(data);
    expect(description).not.toContain("Huntington");
  });
});

// ---------------------------------------------------------------------------
// Opening tone logic in generateRegionalForecast
// ---------------------------------------------------------------------------
describe("generateRegionalForecast opening tone", () => {
  function makeData(
    windSpeed: number | null,
    windDirection: string | null,
    windOffshoreDeg: number | null
  ): RegionalForecastData {
    return {
      region: "norcal",
      primaryBeach: {
        id: "beach-1",
        name: "Ocean Beach SF",
        waveHeight: 5,
        wavePeriod: 14,
        windSpeed,
        windDirection,
        windOffshoreDeg,
        tideTime: null,
        tideHeight: null,
        tideType: null,
        tideAt: null,
        waterTemp: 55,
      },
      secondaryBeaches: [],
    };
  }

  it("uses 'waking up to' tone for calm wind", () => {
    const { description } = generateRegionalForecast(makeData(1, "E", 90));
    expect(description).toContain("waking up to");
  });

  it("uses 'waking up to' tone for offshore wind", () => {
    const { description } = generateRegionalForecast(makeData(8, "E", 90));
    expect(description).toContain("waking up to");
  });

  it("uses 'showing' tone for light onshore wind (< 10mph)", () => {
    const { description } = generateRegionalForecast(makeData(7, "W", 90));
    expect(description).toContain("showing");
  });

  it("uses 'at' tone for strong onshore wind", () => {
    const { description } = generateRegionalForecast(makeData(18, "W", 90));
    expect(description).toContain(" at ");
  });
});

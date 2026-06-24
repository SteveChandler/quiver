import {
  composeLegibleCall,
  isLastMileCallEnabled,
  type BeachGeometry,
  type LegibleCall,
  type LegibleHourBreakdown,
  type LegibleHourInput,
  type SkillBand,
} from "@/lib/surf/legible-call";

const goodBreakdown: LegibleHourBreakdown = {
  windScore: 0.9,
  tideScore: 0.8,
  swellDirScore: 0.8,
  periodScore: 0,
  heightScore: 0,
  total0to100: 74,
};

const maybeBreakdown: LegibleHourBreakdown = {
  ...goodBreakdown,
  total0to100: 53,
};

const blacksBeach: BeachGeometry = {
  name: "Blacks Beach",
  break_type: "beach",
  wind_offshore_deg: 90,
  wind_cross_ok_kts: 15,
  swell_window_min_deg: 195,
  swell_window_max_deg: 340,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  preferred_tide_direction: "rising",
  terrain_enabled: true,
  swell_access_factors: Array(72).fill(0.8),
  wind_exposure_factors: Array(72).fill(0.8),
  shoaling_factors: { version: 1, type: "period_lookup", buckets: [] },
};

const cottonsBeach: BeachGeometry = {
  ...blacksBeach,
  name: "Cottons",
  swell_window_min_deg: 160,
  swell_window_max_deg: 225,
};

const wraparoundBeach: BeachGeometry = {
  ...blacksBeach,
  name: "Wrap Beach",
  swell_window_min_deg: 340,
  swell_window_max_deg: 20,
  terrain_enabled: false,
  swell_access_factors: null,
  wind_exposure_factors: null,
};

const genericBeach: BeachGeometry = {
  name: "12th Street Jetty",
  break_type: "beach",
  wind_offshore_deg: 270,
  wind_cross_ok_kts: 15,
  swell_window_min_deg: 120,
  swell_window_max_deg: 240,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 4,
  preferred_tide_direction: "rising",
  terrain_enabled: false,
  swell_access_factors: null,
  wind_exposure_factors: null,
  shoaling_factors: null,
};

function hour(overrides: Partial<LegibleHourInput> = {}): LegibleHourInput {
  return {
    tsISO: "2026-06-24T08:00:00.000Z",
    faceHeightFt: 1.9,
    isCalibrated: true,
    breakdown: maybeBreakdown,
    swellDirDeg: 270,
    windKts: 4,
    windDirDeg: 90,
    tideFt: 1.9,
    tideStatus: "Rising",
    ...overrides,
  };
}

function terrainBreakdown(access: number, score = 0.9): LegibleHourBreakdown {
  return {
    ...goodBreakdown,
    total0to100: 74,
    swellDirScore: score,
    terrainFactorsApplied: true,
    swellAccess: access,
    windExposure: 0.8,
  };
}

function callFor(
  beach: BeachGeometry,
  skillBand: SkillBand | null,
  hours: LegibleHourInput[]
): LegibleCall {
  return composeLegibleCall({ beach, skillBand, hours });
}

function expectProvenance(call: LegibleCall): void {
  expect(call.clauses.length).toBeGreaterThan(0);
  for (const clause of call.clauses) {
    expect(clause.signal).not.toHaveLength(0);
    expect(clause.value).not.toBeNull();
    expect(clause.value).not.toBeUndefined();
  }
}

describe("composeLegibleCall", () => {
  it("makes the same 1.9 ft hour skill-relative for beginner and advanced surfers", () => {
    const beginner = callFor(blacksBeach, "beginner", [hour()]);
    const advanced = callFor(blacksBeach, "advanced", [hour()]);

    expect(beginner.verdict).toBe("MAYBE");
    expect(beginner.headline).toContain("1.9ft fun size for you");
    expect(advanced.verdict).toBe("NO");
    expect(advanced.headline).toContain("1.9ft too small to bother");
  });

  it("keeps every emitted clause grounded with a non-null backing value", () => {
    const call = callFor(blacksBeach, "beginner", [
      hour({ breakdown: terrainBreakdown(0.32), tideFt: 0.6 }),
      hour({ tsISO: "2026-06-24T09:00:00.000Z", tideFt: 1.2 }),
      hour({ tsISO: "2026-06-24T10:00:00.000Z", tideFt: 1.8 }),
    ]);

    expect(call.clauses.every((clause) => clause.value != null)).toBe(true);
    expectProvenance(call);
  });

  it("degrades generic uncalibrated beaches with estimated size and no terrain-backed swell angle", () => {
    const call = callFor(genericBeach, "beginner", [
      hour({
        faceHeightFt: 0.9,
        isCalibrated: false,
        breakdown: {
          ...maybeBreakdown,
          swellDirScore: 0,
          total0to100: 35,
        },
        swellDirDeg: 180,
      }),
    ]);

    const size = call.clauses.find((clause) => clause.kind === "size");
    const angle = call.clauses.find((clause) => clause.kind === "swell_angle");

    expect(size).toMatchObject({ estimated: true });
    expect(size?.text).toContain("~0.9ft");
    expect(angle?.signal).toBe("swellDirScore");
    expect(call.clauses.some((clause) => clause.signal === "swell_access")).toBe(false);
  });

  it("size-gates small advanced surf out of a YES scorer verdict", () => {
    const call = callFor(blacksBeach, "advanced", [
      hour({
        faceHeightFt: 1.8,
        breakdown: {
          ...goodBreakdown,
          total0to100: 95,
        },
      }),
    ]);

    expect(call.verdict).toBe("NO");
    expect(call.headline).toContain("too small to bother");
  });

  it("does not invent wind timing on flat wind but emits a crossover when the series turns onshore", () => {
    const flatWind = callFor(blacksBeach, "beginner", [
      hour({ tsISO: "2026-06-24T08:00:00.000Z", windKts: 4, windDirDeg: 90 }),
      hour({ tsISO: "2026-06-24T09:00:00.000Z", windKts: 5, windDirDeg: 100 }),
    ]);

    const crossover = callFor(blacksBeach, "beginner", [
      hour({ tsISO: "2026-06-24T08:00:00.000Z", windKts: 4, windDirDeg: 90 }),
      hour({ tsISO: "2026-06-24T09:00:00.000Z", windKts: 6, windDirDeg: 100 }),
      hour({ tsISO: "2026-06-24T10:00:00.000Z", windKts: 14, windDirDeg: 270 }),
    ]);

    expect(flatWind.headline).not.toContain("till ~");
    expect(crossover.headline).toContain("clean till ~10am");
  });

  it("uses terrain swellAccess over scorer angle when present", () => {
    const call = callFor(cottonsBeach, "beginner", [
      hour({
        breakdown: terrainBreakdown(0.2, 0.95),
      }),
    ]);

    const angle = call.clauses.find((clause) => clause.kind === "swell_angle");
    expect(angle).toMatchObject({
      signal: "swell_access",
      value: 0.2,
    });
    expect(angle?.text).toBe("partly shadowed at this angle");
  });

  it("supports corrected wrap-around geometry scores when terrain is absent", () => {
    const call = callFor(wraparoundBeach, "beginner", [
      hour({
        swellDirDeg: 355,
        breakdown: {
          ...goodBreakdown,
          swellDirScore: 0.82,
          total0to100: 74,
        },
      }),
    ]);

    const angle = call.clauses.find((clause) => clause.kind === "swell_angle");
    expect(angle).toMatchObject({
      signal: "swellDirScore",
      value: 0.82,
    });
    expect(angle?.text).toBe("angled in clean");
  });

  it("omits missing size and tide clauses instead of inventing data", () => {
    const call = callFor(blacksBeach, "beginner", [
      hour({
        faceHeightFt: null,
        swellDirDeg: null,
        tideFt: null,
        breakdown: {
          ...goodBreakdown,
          total0to100: 95,
          terrainFactorsApplied: true,
          swellAccess: 1,
        },
      }),
    ]);

    expect(call.verdict).toBe("NO");
    expect(call.clauses.some((clause) => clause.kind === "size")).toBe(false);
    expect(call.clauses.some((clause) => clause.kind === "swell_angle")).toBe(false);
    expect(call.clauses.some((clause) => clause.kind === "tide")).toBe(false);
    expect(call.clauses.some((clause) => clause.kind === "tide_window")).toBe(false);
  });

  it("emits the longest preferred tide window only when at least two daytime hours qualify", () => {
    const call = callFor(blacksBeach, "beginner", [
      hour({ tsISO: "2026-06-24T07:00:00.000Z", tideFt: 0.2, tideStatus: "Rising" }),
      hour({ tsISO: "2026-06-24T08:00:00.000Z", tideFt: 1.2, tideStatus: "Rising" }),
      hour({ tsISO: "2026-06-24T09:00:00.000Z", tideFt: 1.8, tideStatus: "Rising" }),
      hour({ tsISO: "2026-06-24T10:00:00.000Z", tideFt: 2.4, tideStatus: "Falling" }),
    ]);

    const tideWindow = call.clauses.find((clause) => clause.kind === "tide_window");
    expect(tideWindow?.text).toBe("best on the push, ~8am-9am");
  });
});

describe("isLastMileCallEnabled", () => {
  const previousFlag = process.env.LAST_MILE_CALL_ENABLED;

  afterEach(() => {
    process.env.LAST_MILE_CALL_ENABLED = previousFlag;
  });

  it("defaults off and only enables on an explicit true flag", () => {
    delete process.env.LAST_MILE_CALL_ENABLED;
    expect(isLastMileCallEnabled()).toBe(false);

    process.env.LAST_MILE_CALL_ENABLED = "true";
    expect(isLastMileCallEnabled()).toBe(true);
  });
});

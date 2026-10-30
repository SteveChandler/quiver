import {
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_EVENT_THRESHOLDS,
  detectBeachSwellEvents,
  exposureFactor,
  exposureLabel,
  swellPartitionFaceHeightFt,
  type BeachSwellEvent,
  type DetectOptions,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import { MODEL_SWELL_CALIBRATION_FACTORS } from "@/lib/utils/model-swell-calibration-factors";
import {
  BEACH_ID,
  FLAT,
  NOW,
  TIMEZONE,
  dayRows,
  localDate,
  localIso,
  swellBeach,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";

/** A storm run must return every default event with the same key and values. */
function expectStormRunKeepsDefaultEvents(
  forecasts: SwellEventForecastRow[],
  beach: SwellEventBeach,
  options: DetectOptions = {},
): BeachSwellEvent[] {
  const input = { beach, forecasts, now: NOW, timezone: TIMEZONE };
  const defaults = detectBeachSwellEvents(input, options);
  const withStorms = detectBeachSwellEvents(input, { ...options, stormClass: true });
  for (const event of defaults) expect(withStorms).toContainEqual(event);
  return defaults;
}

// Every default run in this file also checks the storm run against it.
function detect(forecasts: SwellEventForecastRow[], beach = swellBeach(), options?: DetectOptions) {
  if (options?.stormClass) return detectBeachSwellEvents({ beach, forecasts, now: NOW, timezone: TIMEZONE }, options);
  return expectStormRunKeepsDefaultEvents(forecasts, beach, options);
}

const BUILD: PartitionSpec = { heightFt: 2.5, periodS: 15, direction: 270 };
const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };
const FADING: PartitionSpec = { heightFt: 2, periodS: 14, direction: 270 };

function singleSwellWeek(): SwellEventForecastRow[] {
  return [
    ...dayRows(0, FLAT),
    ...dayRows(1, FLAT),
    ...dayRows(2, BUILD),
    ...dayRows(3, PEAK, { noonBumpFt: 0.2 }),
    ...dayRows(4, FADING),
    ...dayRows(5, FLAT),
    ...dayRows(6, FLAT),
  ];
}

describe("exposureFactor", () => {
  const window = { centerDeg: 270, halfWidthDeg: 30 };

  it("is 1 anywhere inside the window, including its edge", () => {
    expect(exposureFactor(270, window)).toBe(1);
    expect(exposureFactor(245, window)).toBe(1);
    expect(exposureFactor(300, window)).toBe(1);
  });

  it("tapers with cos² over exposureTaperDeg outside the window, then reaches 0", () => {
    expect(SWELL_EVENT_THRESHOLDS.exposureTaperDeg).toBe(20);
    expect(exposureFactor(310, window)).toBeCloseTo(0.5, 6);
    expect(exposureFactor(305, window)).toBeCloseTo(Math.cos(Math.PI / 8) ** 2, 6);
    expect(exposureFactor(320, window)).toBe(0);
    expect(exposureFactor(90, window)).toBe(0);
  });

  it("measures across north (359° / 1°)", () => {
    const north = { centerDeg: 359, halfWidthDeg: 10 };
    expect(exposureFactor(1, north)).toBe(1);
    expect(exposureFactor(359, { centerDeg: 1, halfWidthDeg: 1 })).toBeCloseTo(Math.cos(Math.PI / 40) ** 2, 6);
    expect(exposureFactor(19, north)).toBeCloseTo(0.5, 6);
    expect(exposureFactor(29, north)).toBe(0);
  });

  it("is null without a window", () => {
    expect(exposureFactor(270, null)).toBeNull();
    expect(exposureFactor(270, { centerDeg: 270, halfWidthDeg: 0 })).toBeNull();
    expect(exposureFactor(270, { centerDeg: Number.NaN, halfWidthDeg: 30 })).toBeNull();
  });

  it("labels open, partial and shadowed at 0.75 and 0.25", () => {
    expect(exposureLabel(1)).toBe("open");
    expect(exposureLabel(0.75)).toBe("open");
    expect(exposureLabel(0.74)).toBe("partial");
    expect(exposureLabel(0.25)).toBe("partial");
    expect(exposureLabel(0.24)).toBe("shadowed");
  });
});

describe("detectBeachSwellEvents", () => {
  it("detects a qualifying rise with arrival, peak and fade instants", () => {
    const events = detect(singleSwellWeek());

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toMatchObject({
      beachId: BEACH_ID,
      eventKey: `${BEACH_ID}:W:${localDate(3)}`,
      directionDeg: 270,
      directionBand: "W",
      directionLabel: "W",
      periodS: 16,
      peakOffshoreHeightFt: 4.2,
      exposure: 1,
      peakLocalDate: localDate(3),
      peakAt: localIso(3, 12),
      // Onset = baseline + half the rise; the 2.5 ft build day stays below it.
      arrivalAt: localIso(3, 0),
      fadeAt: localIso(4, 0),
    });
    expect(event.peakFaceHeightFt).toBeGreaterThanOrEqual(SWELL_EVENT_THRESHOLDS.minPeakFaceHeightFt);
    expect(event.peakEnergy).toBeCloseTo(4.2 * 4.2 * 16, 6);
    // The 16 s groundswell is a new component over 10 s background: its own
    // baseline is zero, so the ratio is capped rather than infinite.
    expect(event.baselineEnergy).toBe(0);
    expect(event.baselineFaceHeightFt).toBe(0);
    expect(event.energyRatio).toBe(99);
    expect(SWELL_EVENT_DETECTOR_VERSION).toBe("swell-events.v1");
  });

  it("measures a building swell against its own earlier size", () => {
    const background: PartitionSpec = { heightFt: 1.5, periodS: 15, direction: 270 };
    const events = detect([
      ...dayRows(0, background),
      ...dayRows(1, background),
      ...dayRows(2, BUILD),
      ...dayRows(3, PEAK, { noonBumpFt: 0.2 }),
      ...dayRows(4, background),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].baselineEnergy).toBeCloseTo(1.5 * 1.5 * 15, 6);
    expect(events[0].energyRatio).toBeCloseTo((4.2 * 4.2 * 16) / (1.5 * 1.5 * 15), 6);
    expect(events[0].peakFaceHeightFt - events[0].baselineFaceHeightFt).toBeGreaterThanOrEqual(2);
    // Onset sits halfway between baseline and peak energy: 2.5 ft 15 s is below it.
    expect(events[0].arrivalAt).toBe(localIso(3, 0));
  });

  it("measures a swell that arrived yesterday against the lull in the 48 h before now", () => {
    const background: PartitionSpec = { heightFt: 1.5, periodS: 16, direction: 270 };
    const rows = [
      // Before now − 48 h: outside the baseline, so this big day cannot mask the rise.
      ...dayRows(-3, { heightFt: 6, periodS: 16, direction: 270 }),
      ...dayRows(-2, background),
      ...dayRows(-1, PEAK),
      ...dayRows(0, PEAK, { noonBumpFt: 0.2 }),
      ...dayRows(1, background),
    ];
    const events = detect(rows);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ arrivalAt: localIso(-1, 0), peakAt: localIso(0, 12), fadeAt: localIso(1, 0) });
    expect(events[0].baselineEnergy).toBeCloseTo(1.5 * 1.5 * 16, 6);
  });

  it("does not re-detect a steady swell that goes unreported for a day", () => {
    const steady: PartitionSpec = { heightFt: 3, periodS: 16, direction: 270 };
    // On day 2 only a blocked wind swell is reported: data exists, the W swell is just missing.
    const blockedOnly: PartitionSpec = { heightFt: 1, periodS: 8, direction: 90 };
    expect(detect([
      ...dayRows(0, steady),
      ...dayRows(1, steady),
      ...dayRows(2, blockedOnly),
      ...dayRows(3, steady),
      ...dayRows(4, steady),
    ])).toEqual([]);
  });

  it("returns [] when the beach has no swell window", () => {
    expect(detect(singleSwellWeek(), swellBeach({ swell_window_center_deg: null }))).toEqual([]);
    expect(detect(singleSwellWeek(), swellBeach({ swell_window_halfwidth_deg: null }))).toEqual([]);
  });

  it("returns [] when rows carry no swell partitions", () => {
    expect(detect([...dayRows(0, null), ...dayRows(1, null), ...dayRows(2, null)])).toEqual([]);
  });

  it("never turns a partition data gap into a rise", () => {
    const events = detect([
      ...dayRows(0, null),
      ...dayRows(1, null),
      ...dayRows(2, PEAK),
      ...dayRows(3, PEAK),
      ...dayRows(4, PEAK),
    ]);
    expect(events).toEqual([]);
  });

  it("ignores swell the beach cannot see", () => {
    const blocked = (spec: PartitionSpec): PartitionSpec => ({ ...spec, direction: 90 });
    expect(detect([
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, blocked(BUILD)),
      ...dayRows(3, blocked(PEAK)),
    ])).toEqual([]);
  });

  it("skips a bad row instead of voiding the beach", () => {
    const rows = singleSwellWeek();
    const throwing = { ...rows[0] };
    Object.defineProperty(throwing, "swell_1_height", {
      get() { throw new Error("corrupt row"); },
    });
    const events = detect([
      throwing,
      { ...rows[1], forecast_at: "not-a-date" },
      { ...rows[2], swell_1_height: "garbage", swell_1_direction: "sideways" },
      ...rows.slice(3),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].peakAt).toBe(localIso(3, 12));
  });

  it("detects two sequential events, each against a fresh baseline", () => {
    const secondBuild: PartitionSpec = { heightFt: 3, periodS: 14, direction: 275 };
    const secondPeak: PartitionSpec = { heightFt: 4.5, periodS: 14, direction: 275 };
    const events = detect([
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, PEAK, { noonBumpFt: 0.2 }),
      ...dayRows(3, FLAT),
      ...dayRows(4, FLAT),
      ...dayRows(5, secondBuild),
      ...dayRows(6, secondPeak, { noonBumpFt: 0.2 }),
      ...dayRows(7, FLAT),
    ]);

    expect(events.map((event) => [event.peakAt, event.periodS])).toEqual([
      [localIso(2, 12), 16],
      [localIso(6, 12), 14],
    ]);
    expect(events[0].fadeAt).toBe(localIso(3, 0));
    expect(new Set(events.map((event) => event.eventKey)).size).toBe(2);
  });

  it("treats a swell from a direction past trackDirectionDeg as its own event", () => {
    const wideWindow = swellBeach({ swell_window_halfwidth_deg: 60 });
    const events = detect([
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, PEAK, { noonBumpFt: 0.2 }),
      ...dayRows(3, { heightFt: 5, periodS: 16, direction: 330 }),
    ], wideWindow);
    expect(events.map((event) => [event.directionLabel, event.peakLocalDate])).toEqual([
      ["W", localDate(2)],
      ["NNW", localDate(3)],
    ]);
    // The new direction is not the first swell's energy, so the first fades at once.
    expect(events[0].fadeAt).toBe(localIso(3, 0));
  });

  it("tracks swell_1 and swell_2 independently so overlapping swells are two events", () => {
    const wideWindow = swellBeach({ swell_window_center_deg: 225, swell_window_halfwidth_deg: 90 });
    // Off-center in a wide window, so both need real size to clear 3 ft of face.
    const west: PartitionSpec = { heightFt: 7, periodS: 16, direction: 270 };
    const south: PartitionSpec = { heightFt: 5, periodS: 14, direction: 190 };
    const events = detect([
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, west, { noonBumpFt: 0.2, secondary: south }),
      // Slots swap: the south swell is now reported as swell_1.
      ...dayRows(3, south, { secondary: { ...west, heightFt: 5 } }),
      ...dayRows(4, FLAT),
    ], wideWindow);

    expect(events.map((event) => [event.directionLabel, event.periodS, event.peakLocalDate])).toEqual([
      ["S", 14, localDate(2)],
      ["W", 16, localDate(2)],
    ]);
    const [south1, west1] = events;
    expect(Date.parse(south1.arrivalAt)).toBeLessThanOrEqual(Date.parse(west1.peakAt));
    expect(Date.parse(south1.fadeAt ?? "")).toBeGreaterThan(Date.parse(west1.peakAt));
  });

  it("lets only exposed components become events, however large the blocked one", () => {
    const events = detect([
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, { heightFt: 8, periodS: 16, direction: 120 }, { secondary: PEAK }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ directionDeg: 270, peakOffshoreHeightFt: 4, fadeAt: null });
  });

  it("does not look past the horizon", () => {
    const rows = [
      ...dayRows(0, FLAT),
      ...Array.from({ length: 8 }, (_, index) => dayRows(index + 1, FLAT)).flat(),
      ...dayRows(9, PEAK),
    ];
    expect(detect(rows)).toEqual([]);
  });
});

describe("detectBeachSwellEvents options", () => {
  const STORM_CLASS: DetectOptions = { stormClass: true };
  const GROUNDSWELL_LULL: PartitionSpec = { heightFt: 2, periodS: 13, direction: 270 };
  const STORM: PartitionSpec = { heightFt: 7, periodS: 8, direction: 270 };

  function stormWeek(peak: PartitionSpec, lull: PartitionSpec = GROUNDSWELL_LULL): SwellEventForecastRow[] {
    return [
      ...dayRows(0, lull),
      ...dayRows(1, lull),
      ...dayRows(2, lull),
      ...dayRows(3, peak, { noonBumpFt: 0.2 }),
    ];
  }

  function lullThen(...days: Array<{ primary: PartitionSpec; secondary?: PartitionSpec }>): SwellEventForecastRow[] {
    return [
      ...dayRows(0, GROUNDSWELL_LULL),
      ...dayRows(1, GROUNDSWELL_LULL),
      ...dayRows(2, GROUNDSWELL_LULL),
      ...days.flatMap((day, index) => dayRows(3 + index, day.primary, { secondary: day.secondary })),
    ];
  }

  // Each pair tracks as one component (periods within trackPeriodS).
  const stormGrowsIntoSwell = () => lullThen(
    { primary: { heightFt: 7, periodS: 10, direction: 270 } },
    { primary: { heightFt: 8, periodS: 12, direction: 270 } },
  );
  const swellThenStorm = () => lullThen(
    { primary: { heightFt: 3.5, periodS: 11, direction: 270 } },
    { primary: { heightFt: 7, periodS: 10, direction: 270 } },
  );
  const sameDaySwellAndStorm = (swell: PartitionSpec, storm: PartitionSpec) => lullThen(
    { primary: swell, secondary: storm },
  );

  it("default options are unchanged: a 6 ft 8 s rise is no event", () => {
    const rows = stormWeek({ heightFt: 6, periodS: 8, direction: 270 });
    expect(detect(rows)).toEqual([]);
    // The same rise is storm-sized, so [] above is the default ignoring it.
    expect(detect(rows, swellBeach(), STORM_CLASS)).toHaveLength(1);
  });

  it("stormClass detects a big short-period event", () => {
    const events = detect(stormWeek(STORM), swellBeach(), STORM_CLASS);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "storm",
      eventKey: `${BEACH_ID}:W:${localDate(3)}:s`,
      periodS: 8,
      peakLocalDate: localDate(3),
      peakAt: localIso(3, 12),
    });
  });

  it("a small short-period bump is not a storm", () => {
    const lull: PartitionSpec = { heightFt: 1.3, periodS: 8, direction: 270 };
    const bump: PartitionSpec = { heightFt: 4, periodS: 8, direction: 270 };
    const face = (spec: PartitionSpec) => swellPartitionFaceHeightFt(
      [{ heightFt: spec.heightFt, periodS: spec.periodS, directionDeg: 270 }],
      swellBeach(),
    )!;
    expect(face(bump) - face(lull)).toBeCloseTo(2.5, 1);
    expect(detect([
      ...dayRows(0, lull),
      ...dayRows(1, lull),
      ...dayRows(2, lull),
      ...dayRows(3, bump),
    ], swellBeach(), STORM_CLASS)).toEqual([]);
  });

  it("a storm-sized short-period bump still needs a 3 ft rise or a 2.5x energy jump", () => {
    const at9s = (heightFt: number): PartitionSpec => ({ heightFt, periodS: 9, direction: 270 });
    const face = (heightFt: number) => swellPartitionFaceHeightFt(
      [{ heightFt, periodS: 9, directionDeg: 270 }],
      swellBeach(),
    )!;
    // One 9 s component throughout, so the lull days are the storm's own baseline.
    const run = (lullFt: number, bumpFt: number) => detect([
      ...dayRows(0, at9s(lullFt)),
      ...dayRows(1, at9s(lullFt)),
      ...dayRows(2, at9s(lullFt)),
      ...dayRows(3, at9s(bumpFt)),
    ], swellBeach(), STORM_CLASS);

    // Clears the 5 ft face, but rises 1.5 ft at (6.5 / 5)² ≈ 1.7x energy.
    expect(face(6.5)).toBeGreaterThanOrEqual(5);
    expect(face(6.5) - face(5)).toBeCloseTo(1.5, 1);
    expect(run(5, 6.5)).toEqual([]);

    // Same lull, a bigger jump: a storm.
    expect(run(5, 8.5)).toEqual([expect.objectContaining({ kind: "storm", peakLocalDate: localDate(3) })]);

    // Either half alone is enough.
    const [riseOnly] = run(7, 10.5);
    expect(riseOnly).toMatchObject({ kind: "storm", peakLocalDate: localDate(3) });
    expect(riseOnly.peakFaceHeightFt - riseOnly.baselineFaceHeightFt).toBeGreaterThanOrEqual(3);
    expect(riseOnly.energyRatio).toBeLessThan(2.5);

    const [ratioOnly] = run(3.5, 5.7);
    expect(ratioOnly).toMatchObject({ kind: "storm", peakLocalDate: localDate(3) });
    expect(ratioOnly.peakFaceHeightFt - ratioOnly.baselineFaceHeightFt).toBeLessThan(3);
    expect(ratioOnly.energyRatio).toBeGreaterThanOrEqual(2.5);
  });

  it("swell and storm on the same day stay separate", () => {
    const swell: PartitionSpec = { heightFt: 4, periodS: 13, direction: 270 };
    const events = detect(sameDaySwellAndStorm(swell, STORM), swellBeach(), STORM_CLASS);

    expect(events).toHaveLength(2);
    const storm = events.find((event) => event.kind === "storm");
    const groundswell = events.find((event) => event.kind === undefined);
    expect(storm).toMatchObject({ periodS: 8, eventKey: `${BEACH_ID}:W:${localDate(3)}:s` });
    expect(groundswell).toMatchObject({ periodS: 13, eventKey: `${BEACH_ID}:W:${localDate(3)}` });
    expect(groundswell).not.toHaveProperty("kind");
  });

  it("keeps a storm and a swell of close periods apart instead of merging them as duplicates", () => {
    const swell: PartitionSpec = { heightFt: 4, periodS: 12, direction: 270 };
    const storm: PartitionSpec = { heightFt: 6, periodS: 10, direction: 270 };
    const events = detect(sameDaySwellAndStorm(swell, storm), swellBeach(), STORM_CLASS);
    expect(events.map((event) => [event.kind ?? "swell", event.periodS])).toEqual(
      expect.arrayContaining([["swell", 12], ["storm", 10]]),
    );
    expect(events).toHaveLength(2);
  });

  it("keeps a swell and the bigger storm after it on the same component as separate events", () => {
    const events = detect(swellThenStorm(), swellBeach(), STORM_CLASS);
    expect(events).toHaveLength(2);
    const [swell, storm] = events;
    // The storm day does not extend the swell event, and the swell event does not hide the storm.
    expect(swell).toMatchObject({ periodS: 11, peakLocalDate: localDate(3) });
    expect(swell).not.toHaveProperty("kind");
    expect(storm).toMatchObject({
      kind: "storm",
      periodS: 10,
      peakLocalDate: localDate(4),
      eventKey: `${BEACH_ID}:W:${localDate(4)}:s`,
    });
  });

  it("keeps the default swell when a storm grows into it on the same component", () => {
    const rows = stormGrowsIntoSwell();
    const defaults = detect(rows);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]).toMatchObject({ periodS: 12, peakLocalDate: localDate(4), peakFaceHeightFt: 9.8 });

    const events = detect(rows, swellBeach(), STORM_CLASS);
    expect(events.map((event) => [event.kind ?? "swell", event.periodS, event.peakLocalDate])).toEqual([
      ["storm", 10, localDate(3)],
      ["swell", 12, localDate(4)],
    ]);
    expect(events[1]).toEqual(defaults[0]);
  });

  it("a storm run keeps every default event unchanged", () => {
    // detect() checks this on every default run in this file; these fixtures
    // put swells and storms on the same days and the same components.
    const fixtures = [
      singleSwellWeek(),
      stormGrowsIntoSwell(),
      swellThenStorm(),
      sameDaySwellAndStorm({ heightFt: 4, periodS: 13, direction: 270 }, STORM),
      sameDaySwellAndStorm({ heightFt: 4, periodS: 12, direction: 270 }, { heightFt: 6, periodS: 10, direction: 270 }),
    ];
    for (const rows of fixtures) {
      expect(expectStormRunKeepsDefaultEvents(rows, swellBeach()).length).toBeGreaterThan(0);
    }
  });

  it("horizonDays extends reach", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, index) => dayRows(index, FLAT)).flat(),
      ...dayRows(10, PEAK),
      ...dayRows(11, FLAT),
    ];
    expect(detect(rows)).toEqual([]);
    const events = detect(rows, swellBeach(), { horizonDays: 12 });
    expect(events).toHaveLength(1);
    expect(events[0].peakLocalDate).toBe(localDate(10));
  });
});

describe("per-beach model_swell factor", () => {
  it("scales swell-event faces like the forecast rows at the same beach", () => {
    const [calibratedId, k] = Object.entries(MODEL_SWELL_CALIBRATION_FACTORS).find(([, factor]) => factor > 1.2)!;
    const plain = swellPartitionFaceHeightFt([{ heightFt: 3, periodS: 15, directionDeg: 270 }], swellBeach());
    const calibrated = swellPartitionFaceHeightFt(
      [{ heightFt: 3, periodS: 15, directionDeg: 270 }],
      { ...swellBeach(), id: calibratedId },
    );
    expect(plain).not.toBeNull();
    expect(calibrated).toBeCloseTo(plain! * k, 1);
  });
});

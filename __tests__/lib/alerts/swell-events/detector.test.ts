import {
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_EVENT_THRESHOLDS,
  detectBeachSwellEvents,
  exposureFactor,
  exposureLabel,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
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

function detect(forecasts: SwellEventForecastRow[], beach = swellBeach()) {
  return detectBeachSwellEvents({ beach, forecasts, now: NOW, timezone: TIMEZONE });
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

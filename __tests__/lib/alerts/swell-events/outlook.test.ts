// __tests__/lib/alerts/swell-events/outlook.test.ts
import {
  SWELL_EVENT_THRESHOLDS,
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_THRESHOLDS,
  detectBeachSwellEvents,
  detectBeachSwellPulses,
  prominenceRatio,
  type BeachSwellEvent,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import { NOW, TIMEZONE, dayRows, localDate, localIso, swellBeach, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const beach = swellBeach();

/** One primary partition per local day; offsets start two days back so a baseline exists. */
function series(heights: number[], periodS: number = 12, direction: number = 270): SwellEventForecastRow[] {
  return heights.flatMap((heightFt, index) => dayRows(index - 2, { heightFt, periodS, direction }, { noonBumpFt: 0.2 }));
}

function pulses(forecasts: SwellEventForecastRow[]): BeachSwellEvent[] {
  return detectBeachSwellPulses({ beach, forecasts, now: NOW, timezone: TIMEZONE });
}

describe("detectBeachSwellPulses", () => {
  it("lists a modest 2 ft, 10 s swell the notable detector misses", () => {
    const forecasts = series([1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], 10);
    expect(detectBeachSwellEvents({ beach, forecasts, now: NOW, timezone: TIMEZONE })).toEqual([]);
    const found = pulses(forecasts);
    expect(found).toHaveLength(1);
    const [pulse] = found;
    expect(pulse.eventKey).toBe(`${beach.id}:W:${localDate(2)}:p`);
    expect(pulse.peakFaceHeightFt).toBeGreaterThanOrEqual(1.5);
    expect(pulse.periodS).toBe(10);
    expect(pulse).toMatchObject({
      beachId: beach.id,
      directionDeg: 270,
      directionBand: "W",
      directionLabel: "W",
      peakOffshoreHeightFt: 2.2,
      peakFaceHeightFt: 2.2,
      baselineFaceHeightFt: 0,
      exposure: 1,
      arrivalAt: localIso(2, 0),
      peakAt: localIso(2, 12),
      fadeAt: localIso(3, 0),
    });
    expect(pulse.peakEnergy).toBeCloseTo(2.2 ** 2 * 10);
    expect(pulse.baselineEnergy).toBeCloseTo(1.2 ** 2 * 10);
    expect(pulse.energyRatio).toBeCloseTo(2.2 ** 2 / 1.2 ** 2);
  });

  it("keeps two overlapping trains as two pulses when the surf never goes flat", () => {
    const primary = [1, 1, 1, 1, 3, 2.2, 2, 1.2, 1, 1, 1];
    const secondary = [0, 0, 0, 0, 0, 1, 4, 1.2, 0.5, 0.5, 0.5];
    const forecasts = primary.flatMap((heightFt, index) => dayRows(
      index - 2,
      { heightFt, periodS: 12, direction: 270 },
      { noonBumpFt: 0.2, secondary: secondary[index] > 0 ? { heightFt: secondary[index], periodS: 16, direction: 285 } : null },
    ));
    const found = pulses(forecasts);
    expect(found.map((pulse) => pulse.periodS)).toEqual([12, 16]);
    expect(found[0].peakAt < found[1].peakAt).toBe(true);
  });

  it("skips swells below the 1.5 ft face floor and under 9 s", () => {
    expect(pulses(series([0.6, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]))).toEqual([]);
    expect(pulses(series([1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1], 8))).toEqual([]);
  });

  it("ignores a shoulder under 25% prominence", () => {
    const found = pulses(series([2, 2, 2, 2, 3, 2.8, 2.9, 2, 2, 2, 2]));
    expect(found).toHaveLength(1);
    expect(found[0].peakLocalDate).toBe(localDate(2));
  });

  it("skips a pulse peaking today and lists one peaking tomorrow", () => {
    expect(pulses(series([1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]))).toEqual([]);
    expect(pulses(series([1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1]))).toEqual([]);
    expect(pulses(series([1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1])).map((pulse) => pulse.peakLocalDate)).toEqual([localDate(1)]);
  });

  it("never mutates the notable-swell thresholds", () => {
    const before = JSON.stringify(SWELL_EVENT_THRESHOLDS);
    pulses(series([1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1]));
    expect(JSON.stringify(SWELL_EVENT_THRESHOLDS)).toBe(before);
    expect(SWELL_OUTLOOK_PULSE_THRESHOLDS).toMatchObject({ minFaceHeightFt: 1.5, minPeriodS: 9, minProminenceRatio: 0.25, minRegionBeaches: 3 });
    expect(SWELL_OUTLOOK_PULSE_DETECTOR_VERSION).toBe("swell-outlook-pulse.v1");
  });

  it("includes a 9 s pulse at exactly 1.5 ft face and rejects one below it", () => {
    const found = pulses(series([0.6, 0.6, 0.6, 0.6, 1.3, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], 9));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ peakFaceHeightFt: 1.5, periodS: 9 });
    expect(pulses(series([0.6, 0.6, 0.6, 0.6, 1.2, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], 9))).toEqual([]);
  });

  it("defers a peak still rising on the last horizon day even with later input rows", () => {
    expect(pulses(series([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1]))).toEqual([]);
  });

  it("ignores synthetic fallback rows", () => {
    const forecasts = series([1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1])
      .map((forecast) => ({ ...forecast, data_source: "FALLBACK" }));
    expect(pulses(forecasts)).toEqual([]);
  });

  it("returns nothing for a beach without a swell window", () => {
    const open: PartitionSpec = { heightFt: 3, periodS: 12, direction: 270 };
    expect(detectBeachSwellPulses({
      beach: swellBeach({ swell_window_center_deg: null, swell_window_halfwidth_deg: null }),
      forecasts: dayRows(1, open), now: NOW, timezone: TIMEZONE,
    })).toEqual([]);
  });
});

describe("prominenceRatio", () => {
  it("measures against the higher of the two bases", () => {
    expect(prominenceRatio([10, 100, 20, 60, 10], 1)).toBeCloseTo(0.9);
    expect(prominenceRatio([10, 100, 20, 60, 10], 3)).toBeCloseTo((60 - 20) / 60);
  });

  it("includes the exact 25% boundary and gives zero to zero energy or an edge", () => {
    expect(prominenceRatio([3, 4, 3], 1)).toBe(0.25);
    expect(prominenceRatio([0, 0, 0], 1)).toBe(0);
    expect(prominenceRatio([4, 3, 2], 0)).toBe(0);
    expect(prominenceRatio([2, 3, 4], 2)).toBe(0);
  });
});

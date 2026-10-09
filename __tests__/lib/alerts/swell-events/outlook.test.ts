// __tests__/lib/alerts/swell-events/outlook.test.ts
import {
  SWELL_EVENT_THRESHOLDS,
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_THRESHOLDS,
  detectBeachSwellEvents,
  detectBeachSwellPulses,
  prominenceRatio,
  filterPulsesByRegionAgreement,
  type BeachSwellEvent,
  type SwellEventForecastRow,
  type PulseRegionCandidate,
} from "@/lib/alerts/swell-events";
import { NOW, TIMEZONE, beachSwellEvent, dayRows, localDate, localIso, swellBeach, type PartitionSpec } from "@/__tests__/helpers/swell-events";
import { tracksSwellSize } from "@/lib/alerts/swell-events/detector";

const beach = swellBeach();

describe("tracksSwellSize", () => {
  it("uses a symmetric size ratio", () => {
    expect(tracksSwellSize({ peakFaceHeightFt: 3.6 }, { peakFaceHeightFt: 3.2 })).toBe(true);
    expect(tracksSwellSize({ peakFaceHeightFt: 3.6 }, { peakFaceHeightFt: 2.3 })).toBe(false);
    expect(tracksSwellSize({ peakFaceHeightFt: 2.3 }, { peakFaceHeightFt: 3.6 })).toBe(false);
  });
});

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


describe("filterPulsesByRegionAgreement", () => {
  const ids = ["aaaaaaaa-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000003", "aaaaaaaa-0000-4000-8000-000000000004"];
  const near = (index: number): { lat: number; lon: number } => ({ lat: 32.7 + index * 0.05, lon: -117.25 - index * 0.01 });
  const pulse = (beachId: string, overrides: Partial<BeachSwellEvent> = {}): BeachSwellEvent => beachSwellEvent({ beachId, eventKey: `${beachId}:W:2026-09-28:p`, directionDeg: 270, periodS: 12, peakAt: "2026-09-28T19:00:00.000Z", ...overrides });

  it("keeps a pulse seen by three beaches inside the region", () => {
    const kept = filterPulsesByRegionAgreement(ids.slice(0, 3).map((id, index) => ({ beachId: id, ...near(index), pulses: [pulse(id)] })));
    expect([...kept.keys()].sort()).toEqual(ids.slice(0, 3));
  });

  it("drops a pulse only two beaches agree on", () => {
    expect(filterPulsesByRegionAgreement(ids.slice(0, 2).map((id, index) => ({ beachId: id, ...near(index), pulses: [pulse(id)] }))).size).toBe(0);
  });

  it("does not count a far beach or a different swell", () => {
    const candidates = [
      { beachId: ids[0], ...near(0), pulses: [pulse(ids[0])] },
      { beachId: ids[1], ...near(1), pulses: [pulse(ids[1])] },
      { beachId: ids[2], lat: 34.0, lon: -118.5, pulses: [pulse(ids[2])] },
      { beachId: ids[3], ...near(2), pulses: [pulse(ids[3], { directionDeg: 180, periodS: 17 })] },
    ];
    expect(filterPulsesByRegionAgreement(candidates).size).toBe(0);
  });

  it("never counts a beach without coordinates", () => {
    expect(filterPulsesByRegionAgreement(ids.slice(0, 3).map((id) => ({ beachId: id, lat: null, lon: null, pulses: [pulse(id)] }))).size).toBe(0);
  });

  it("counts distinct beach ids, regardless of duplicate pulses or candidates", () => {
    const candidates = ids.slice(0, 2).map((id, index) => ({
      beachId: id, ...near(index), pulses: [pulse(id), pulse(id)],
    }));
    expect(filterPulsesByRegionAgreement([...candidates, candidates[0]]).size).toBe(0);
  });

  it.each([
    { directionDeg: 316 },
    { periodS: 15.1 },
    { peakAt: "2026-09-30T07:00:01.000Z" },
  ])("rejects a third beach outside a single swell tolerance: %p", (overrides) => {
    const candidates = ids.slice(0, 3).map((id, index) => ({
      beachId: id, ...near(index), pulses: [pulse(id, index === 2 ? overrides : {})],
    }));
    expect(filterPulsesByRegionAgreement(candidates).size).toBe(0);
  });

  it("includes the 45 degree, 3 second and 36 hour boundaries", () => {
    const candidates = ids.slice(0, 3).map((id, index) => ({
      beachId: id, ...near(index), pulses: [pulse(id, index === 2 ? {
        directionDeg: 315, periodS: 15, peakAt: "2026-09-30T07:00:00.000Z",
      } : {})],
    }));
    expect([...filterPulsesByRegionAgreement(candidates).keys()].sort()).toEqual(ids.slice(0, 3));
  });

  it("matches directions across north", () => {
    const candidates = ids.slice(0, 3).map((id, index) => ({
      beachId: id, ...near(index), pulses: [pulse(id, { directionDeg: index === 2 ? 1 : 359 })],
    }));
    expect(filterPulsesByRegionAgreement(candidates).size).toBe(3);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])("excludes a third beach with invalid latitude %p", (lat) => {
    const candidates = ids.slice(0, 3).map((id, index) => ({
      beachId: id, ...near(index), lat: index === 2 ? lat : near(index).lat, pulses: [pulse(id)],
    }));
    expect(filterPulsesByRegionAgreement(candidates).size).toBe(0);
  });

  it("uses a 40 mile radius around each beach, rather than transitive agreement", () => {
    const candidates: PulseRegionCandidate[] = ids.slice(0, 3).map((id, index) => ({
      beachId: id, lat: 32.7 + index * 0.4, lon: -117.25, pulses: [pulse(id)],
    }));
    expect([...filterPulsesByRegionAgreement(candidates).keys()]).toEqual([ids[1]]);
  });

  it("filters each pulse independently and preserves the original events", () => {
    const agreed = pulse(ids[0]);
    const isolated = pulse(ids[0], { periodS: 17 });
    const candidates = ids.slice(0, 3).map((id, index) => ({
      beachId: id, ...near(index), pulses: index === 0 ? [agreed, isolated] : [pulse(id)],
    }));
    const kept = filterPulsesByRegionAgreement(candidates);
    expect(kept.get(ids[0])).toEqual([agreed]);
    expect(kept.get(ids[0])?.[0]).toBe(agreed);
    expect(candidates[0].pulses).toEqual([agreed, isolated]);
  });
});

import {
  SWELL_EVENT_THRESHOLDS,
  detectSwellCrossing,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import {
  TIMEZONE,
  dayRows,
  localIso,
  swellBeach,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";

// Window 70°–190°: both a SSE groundswell and an E wind swell reach the beach.
const BEACH = swellBeach({ swell_window_center_deg: 130, swell_window_halfwidth_deg: 60 });
const MAIN: PartitionSpec = { heightFt: 3, periodS: 16, direction: 170 };
const MAIN_EVENT = {
  directionDeg: 170,
  periodS: 16,
  arrivalAt: localIso(2, 0),
  fadeAt: localIso(4, 0),
};

function crossingWith(other: PartitionSpec | null, days: number[] = [2, 3]): ReturnType<typeof detectSwellCrossing> {
  const forecasts: SwellEventForecastRow[] = [1, 2, 3, 4].flatMap((day) => dayRows(
    day,
    day === 2 || day === 3 ? MAIN : null,
    { secondary: other && days.includes(day) ? other : null },
  ));
  return detectSwellCrossing({ beach: BEACH, forecasts, main: MAIN_EVENT, timezone: TIMEZONE });
}

describe("detectSwellCrossing", () => {
  it("uses the contract thresholds", () => {
    expect(SWELL_EVENT_THRESHOLDS).toMatchObject({
      crossingMinPeriodS: 7,
      crossingMinAngleDeg: 60,
      crossingMinEnergyShare: 0.35,
    });
  });

  it("reports a short-period swell 90° off the main one across the overlap", () => {
    // 3 ft 8 s from 80° carries 72 energy vs the main swell's 144: a 50% share.
    expect(crossingWith({ heightFt: 3, periodS: 8, direction: 80 })).toEqual({
      directionDeg: 80,
      directionLabel: "E",
      periodS: 8,
      peakOffshoreHeightFt: 3,
      angleDeg: 90,
      overlapStartAt: localIso(2, 0),
      overlapEndAt: localIso(3, 21),
    });
  });

  it("limits the overlap to the rows where both swells are present", () => {
    const crossing = crossingWith({ heightFt: 3, periodS: 8, direction: 80 }, [3]);
    expect(crossing).toMatchObject({ overlapStartAt: localIso(3, 0), overlapEndAt: localIso(3, 21) });
  });

  it("ignores a second swell only 30° apart", () => {
    expect(crossingWith({ heightFt: 3, periodS: 8, direction: 140 })).toBeNull();
  });

  it("ignores a second swell under the energy share", () => {
    // 1.5 ft 8 s = 18 energy, 12.5% of the main swell.
    expect(crossingWith({ heightFt: 1.5, periodS: 8, direction: 80 })).toBeNull();
  });

  it("ignores a second swell under 7 s", () => {
    expect(crossingWith({ heightFt: 4, periodS: 6, direction: 80 })).toBeNull();
  });

  it("is null without a window or a second swell", () => {
    expect(crossingWith(null)).toBeNull();
    expect(detectSwellCrossing({
      beach: swellBeach({ swell_window_center_deg: null }),
      forecasts: dayRows(2, MAIN, { secondary: { heightFt: 3, periodS: 8, direction: 80 } }),
      main: MAIN_EVENT,
      timezone: TIMEZONE,
    })).toBeNull();
  });
});

import {
  earlyLookPeaks,
  fetchWamDays,
  historyLine,
  regionModelBuoy,
  type WamDay,
} from "@/lib/alerts/swell-events/early-look";
import type { BigSwellBuoy } from "@/lib/big-swells";

const TODAY = "2026-11-01";
const TZ = "America/Los_Angeles";

const SAN_DIEGO_BEACHES = [
  { lat: 32.58, lon: -117.13 },
  { lat: 32.75, lon: -117.255 },
  { lat: 32.857, lon: -117.258 },
  { lat: 32.96, lon: -117.27 },
  { lat: 33.19, lon: -117.39 },
];

function dateAfter(offset: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

function wamDay(offset: number, maxHsM: number, periodS: number | null = 14): WamDay {
  return {
    localDate: dateAfter(offset),
    maxHsM,
    peakAt: `${dateAfter(offset)}T20:00:00.000Z`,
    periodS,
    directionDeg: 280,
  };
}

/** Days 0-10 flat at `baseM`, then the given overrides for days 11-15 (default `baseM`). */
function wamSeries(baseM: number, overrides: Record<number, Partial<WamDay>> = {}): WamDay[] {
  return Array.from({ length: 16 }, (_, offset) => ({
    ...wamDay(offset, baseM),
    ...overrides[offset],
  }));
}

describe("regionModelBuoy", () => {
  it("picks the Del Mar buoy the model tracks, not the closer Scripps one it does not", () => {
    const buoy = regionModelBuoy(SAN_DIEGO_BEACHES);
    expect(buoy?.id).toBe("46266");
    expect(buoy?.modelRatio).toBe(0.88);
  });

  it("returns null when no tracked buoy is within 100 km", () => {
    expect(regionModelBuoy([{ lat: 44.0, lon: -100.0 }])).toBeNull();
  });

  it("returns null for a region with no beaches", () => {
    expect(regionModelBuoy([])).toBeNull();
  });
});

describe("earlyLookPeaks", () => {
  it("reports an 8 s, 2.4 m day-13 peak as a storm against a 1.2 m median", () => {
    const days = wamSeries(1.2, {
      12: { maxHsM: 1.8, periodS: 9 },
      13: { maxHsM: 2.4, periodS: 8 },
      14: { maxHsM: 1.5, periodS: 9 },
    });
    expect(earlyLookPeaks(days, [], TODAY)).toEqual([
      {
        kind: "storm",
        localDate: dateAfter(13),
        peakAt: `${dateAfter(13)}T20:00:00.000Z`,
        maxHsM: 2.4,
        periodS: 8,
        directionDeg: 280,
      },
    ]);
  });

  it("calls a long-period peak a swell, and a missing period a swell", () => {
    const longPeriod = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: 15 } });
    const noPeriod = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: null } });
    expect(earlyLookPeaks(longPeriod, [], TODAY).map((peak) => peak.kind)).toEqual(["swell"]);
    expect(earlyLookPeaks(noPeriod, [], TODAY).map((peak) => peak.kind)).toEqual(["swell"]);
  });

  it("treats an 11 s peak as a swell and a 10.9 s peak as a storm", () => {
    const at11 = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: 11 } });
    const below11 = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: 10.9 } });
    expect(earlyLookPeaks(at11, [], TODAY).map((peak) => peak.kind)).toEqual(["swell"]);
    expect(earlyLookPeaks(below11, [], TODAY).map((peak) => peak.kind)).toEqual(["storm"]);
  });

  it("drops a day-12 peak when a detected storm peaks 20 h earlier", () => {
    const days = wamSeries(1.2, { 12: { maxHsM: 2.4, periodS: 8 } });
    const peakAt = Date.parse(days[12].peakAt) - 20 * 3_600_000;
    const detected = [{ kind: "storm" as const, peakAt: new Date(peakAt).toISOString() }];
    expect(earlyLookPeaks(days, detected, TODAY)).toEqual([]);
  });

  it("keeps the peak when the nearby detected event is a different kind or beyond 36 h", () => {
    const days = wamSeries(1.2, { 12: { maxHsM: 2.4, periodS: 8 } });
    const peakMs = Date.parse(days[12].peakAt);
    const swellNearby = [{ kind: "swell" as const, peakAt: new Date(peakMs - 20 * 3_600_000).toISOString() }];
    const stormFar = [{ kind: "storm" as const, peakAt: new Date(peakMs + 37 * 3_600_000).toISOString() }];
    expect(earlyLookPeaks(days, swellNearby, TODAY)).toHaveLength(1);
    expect(earlyLookPeaks(days, stormFar, TODAY)).toHaveLength(1);
  });

  it("drops a peak exactly 36 h from a same-kind detected event", () => {
    const days = wamSeries(1.2, { 12: { maxHsM: 2.4, periodS: 8 } });
    const peakMs = Date.parse(days[12].peakAt);
    const detected = [{ kind: "storm" as const, peakAt: new Date(peakMs + 36 * 3_600_000).toISOString() }];
    expect(earlyLookPeaks(days, detected, TODAY)).toEqual([]);
  });

  it("returns [] for days that are above 1.5 m only because the median is high", () => {
    const days = wamSeries(1.6, {
      12: { maxHsM: 2.0 },
      13: { maxHsM: 2.4 },
      14: { maxHsM: 2.0 },
    });
    expect(earlyLookPeaks(days, [], TODAY)).toEqual([]);
  });

  it("holds a quiet region to the 1.5 m floor", () => {
    const days = wamSeries(0.5, { 13: { maxHsM: 1.4 } });
    expect(earlyLookPeaks(days, [], TODAY)).toEqual([]);
    expect(earlyLookPeaks(wamSeries(0.5, { 13: { maxHsM: 1.5 } }), [], TODAY)).toHaveLength(1);
  });

  it("ignores peaks outside days 11-14", () => {
    const days = wamSeries(1.2, {
      9: { maxHsM: 3.0 },
      15: { maxHsM: 3.0 },
    });
    expect(earlyLookPeaks(days, [], TODAY)).toEqual([]);
  });

  it("needs a local maximum: only the top of a rising run counts, and a plateau counts once", () => {
    const rising = wamSeries(1.2, {
      11: { maxHsM: 2.2 },
      12: { maxHsM: 2.5 },
      13: { maxHsM: 2.8 },
      14: { maxHsM: 2.8 },
    });
    expect(earlyLookPeaks(rising, [], TODAY).map((peak) => peak.localDate)).toEqual([dateAfter(13)]);
  });

  it("drops a peak under the 6.5 s storm floor, WAM's buoy-scale peak period", () => {
    const wind = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: 6 } });
    const floor = wamSeries(1.2, { 13: { maxHsM: 2.4, periodS: 6.5 } });
    expect(earlyLookPeaks(wind, [], TODAY)).toEqual([]);
    expect(earlyLookPeaks(floor, [], TODAY).map((peak) => peak.kind)).toEqual(["storm"]);
  });

  describe("day 14 at the forecast edge", () => {
    const peakOnEdge = wamSeries(1.2, { 14: { maxHsM: 2.4, periodS: 8 } });

    it("keeps a still-rising day-14 peak when day 15 is missing", () => {
      const truncated = peakOnEdge.slice(0, 15);
      expect(earlyLookPeaks(truncated, [], TODAY).map((peak) => peak.localDate)).toEqual([dateAfter(14)]);
    });

    it("drops a day-14 day that is not above day 13 when day 15 is missing", () => {
      const flat = wamSeries(1.2, {
        13: { maxHsM: 2.4, periodS: 8 },
        14: { maxHsM: 2.4, periodS: 8 },
      }).slice(0, 15);
      expect(earlyLookPeaks(flat, [], TODAY).map((peak) => peak.localDate)).toEqual([dateAfter(13)]);
    });

    it("keeps day 14 when day 15 exists and is lower", () => {
      expect(earlyLookPeaks(peakOnEdge, [], TODAY).map((peak) => peak.localDate)).toEqual([dateAfter(14)]);
    });

    it("applies the normal local-maximum test when day 15 exists and is higher", () => {
      const stillClimbing = wamSeries(1.2, {
        14: { maxHsM: 2.4, periodS: 8 },
        15: { maxHsM: 3.0, periodS: 8 },
      });
      expect(earlyLookPeaks(stillClimbing, [], TODAY)).toEqual([]);
    });

    it("still needs the threshold when day 15 is missing", () => {
      const low = wamSeries(1.2, { 14: { maxHsM: 1.4 } }).slice(0, 15);
      expect(earlyLookPeaks(low, [], TODAY)).toEqual([]);
    });
  });

  it("returns [] when there is no baseline or no data", () => {
    expect(earlyLookPeaks([], [], TODAY)).toEqual([]);
    const lateOnly = wamSeries(1.2).filter((day) => day.localDate >= dateAfter(11));
    expect(earlyLookPeaks(lateOnly, [], TODAY)).toEqual([]);
  });

  describe("starting where the stored forecast stops", () => {
    // The Del Mar WAM run of Nov 1 2026, days 0-14: a 2.88 m, 8 s storm on day 10, its 2.66 m tail on
    // day 11. The stored partitions that day stopped at Nov 10 7 PM, local day 9.
    const NOV_1_RUN = [1.94, 1.68, 1.48, 1.48, 1.42, 1.12, 1.12, 1.04, 1.02, 1.26, 2.88, 2.66, 1.52, 1.44, 1.82, 1.78];
    const nov1Days = NOV_1_RUN.map((maxHsM, offset) => ({
      ...wamDay(offset, maxHsM),
      periodS: offset === 10 ? 8.35 : offset === 11 ? 9.8 : 13,
    }));

    it("reports the day-10 storm when the stored forecast ends on day 9", () => {
      expect(earlyLookPeaks(nov1Days, [], TODAY, dateAfter(9))).toEqual([
        {
          kind: "storm",
          localDate: dateAfter(10),
          peakAt: `${dateAfter(10)}T20:00:00.000Z`,
          maxHsM: 2.88,
          periodS: 8.35,
          directionDeg: 280,
        },
      ]);
    });

    it("misses it when the scan starts at day 11, as it did with no stored reach", () => {
      expect(earlyLookPeaks(nov1Days, [], TODAY)).toEqual([]);
    });

    it("keeps the storm beside the stored 11 s swell 23 h before it: kinds differ", () => {
      // The stored NW swell peaked Nov 10 1 PM; only a same-kind event inside 36 h drops a peak.
      const storedSwell = { kind: "swell" as const, peakAt: `${dateAfter(9)}T21:00:00.000Z` };
      expect(earlyLookPeaks(nov1Days, [storedSwell], TODAY, dateAfter(9)).map((peak) => peak.localDate))
        .toEqual([dateAfter(10)]);
    });

    it("scans the stored forecast's last day too, since it is usually a partial one", () => {
      const days = wamSeries(1.2, { 9: { maxHsM: 2.4, periodS: 8 } });
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(9)).map((peak) => peak.localDate)).toEqual([dateAfter(9)]);
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(10))).toEqual([]);
    });

    it("drops a peak on the stored forecast's last day near a detected event of either kind", () => {
      // The stored rows already saw part of that day, so a nearby event is the same energy whatever WAM's period says.
      const days = wamSeries(1.2, { 9: { maxHsM: 2.4, periodS: 10.5 } });
      const risingSwell = [{ kind: "swell" as const, peakAt: `${dateAfter(9)}T02:00:00.000Z` }];
      expect(earlyLookPeaks(days, risingSwell, TODAY, dateAfter(9))).toEqual([]);
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(9)).map((peak) => peak.kind)).toEqual(["storm"]);
    });

    it("measures the typical height on the days before the scan only", () => {
      // Days 5-10 at 1.5 m lift a 0-10 median to 1.5 (bar 2.4 m); days 0-4 alone keep it at 1.0 (bar 1.6 m).
      const days = wamSeries(1.0, {
        5: { maxHsM: 1.5 }, 6: { maxHsM: 1.5 }, 7: { maxHsM: 1.5 }, 8: { maxHsM: 1.5 }, 9: { maxHsM: 1.5 }, 10: { maxHsM: 1.5 },
        11: { maxHsM: 2.2, periodS: 8 },
      });
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(5)).map((peak) => peak.localDate)).toEqual([dateAfter(11)]);
      expect(earlyLookPeaks(days, [], TODAY)).toEqual([]);
    });

    it("never starts later than day 11, however far the stored forecast reaches", () => {
      const days = wamSeries(1.2, { 11: { maxHsM: 2.4, periodS: 8 } });
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(12)).map((peak) => peak.localDate)).toEqual([dateAfter(11)]);
    });

    it("scans from day 1 when the stored forecast has nothing past today, keeping today as the baseline", () => {
      const days = wamSeries(1.0, { 1: { maxHsM: 2.4, periodS: 8 } });
      expect(earlyLookPeaks(days, [], TODAY, dateAfter(-3)).map((peak) => peak.localDate)).toEqual([dateAfter(1)]);
      expect(earlyLookPeaks(wamSeries(1.0, { 0: { maxHsM: 2.4, periodS: 8 } }), [], TODAY, dateAfter(-3))).toEqual([]);
    });
  });
});

describe("fetchWamDays", () => {
  const buoy = regionModelBuoy(SAN_DIEGO_BEACHES) as BigSwellBuoy;
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
  });

  it("returns null when fetch rejects", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
    await expect(fetchWamDays(buoy, TZ)).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null on an HTTP failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchWamDays(buoy, TZ)).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("asks WAM for 16 days at the buoy in the region's zone and keeps each local day's tallest hour", async () => {
    // 2026-11-01 00:00 PDT is 07:00Z; 2026-11-02 00:00 PST is 08:00Z (clocks fall back overnight).
    const day1 = Date.UTC(2026, 10, 1, 7) / 1000;
    const day2 = Date.UTC(2026, 10, 2, 8) / 1000;
    const hour = 3600;
    // day1 + 24 h is 07:00Z Nov 2 = 23:00 PST Nov 1: the 25-hour local day still owns it.
    const hourly = {
      time: [day1, day1 + 3 * hour, day1 + 23 * hour, day1 + 24 * hour, day2 + hour, day2 + 2 * hour],
      wave_height: [1.0, 1.9, 1.4, 2.6, null, 0.8],
      wave_peak_period: [14, 9.5, 13, 16, null, 12],
      wave_direction: [270, 285, 275, 290, null, 260],
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly }) });
    global.fetch = fetchMock;

    const days = await fetchWamDays(buoy, TZ);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("latitude")).toBe(String(buoy.lat));
    expect(url.searchParams.get("longitude")).toBe(String(buoy.lon));
    expect(url.searchParams.get("models")).toBe("ecmwf_wam025");
    expect(url.searchParams.get("forecast_days")).toBe("16");
    expect(url.searchParams.get("timezone")).toBe(TZ);
    expect(url.searchParams.get("timeformat")).toBe("unixtime");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 10_800 } });
    expect(days).toEqual([
      {
        localDate: "2026-11-01",
        maxHsM: 2.6,
        peakAt: new Date((day1 + 24 * hour) * 1000).toISOString(),
        periodS: 16,
        directionDeg: 290,
      },
      {
        localDate: "2026-11-02",
        maxHsM: 0.8,
        peakAt: new Date((day2 + 2 * hour) * 1000).toISOString(),
        periodS: 12,
        directionDeg: 260,
      },
    ]);
  });
});

describe("historyLine", () => {
  const storm = (overrides: Partial<{ at: string; hsM: number; name: string }> = {}) => ({
    at: "2014-09-26T18:00:00.000Z",
    hsM: 3.4,
    periodS: 14,
    dirDeg: 190,
    ...overrides,
  });
  const delMar = (events: ReturnType<typeof storm>[]): BigSwellBuoy => ({
    id: "46266",
    name: "Del Mar Nearshore, CA (153)",
    lat: 32.957,
    lon: -117.279,
    since: "2012-01-01",
    through: "2026-10-23",
    bigHsM: 1.8,
    modelRatio: 0.88,
    biggest: events,
    recent: events,
  });

  it("names the storm and strips the buoy's location suffix", () => {
    const buoy = delMar([storm({ name: "Hurricane Marie" })]);
    expect(historyLine(buoy, 3.0, TZ)).toBe("Biggest since Hurricane Marie at the Del Mar Nearshore buoy");
  });

  it("falls back to the local month and year when the storm has no name", () => {
    const buoy = delMar([storm({ at: "2024-01-01T03:00:00.000Z" })]);
    expect(historyLine(buoy, 3.0, TZ)).toBe("Biggest since Dec 2023 at the Del Mar Nearshore buoy");
  });

  it("drops the ' - ' location tail from NDBC names and title-cases the ALL-CAPS ones", () => {
    const buoy = { ...delMar([storm({ name: "Hurricane Marie" })]), name: "BODEGA BAY - 48NM NW of San Francisco, CA" };
    expect(historyLine(buoy, 3.0, TZ)).toBe("Biggest since Hurricane Marie at the Bodega Bay buoy");
  });

  it("title-cases only the ALL-CAPS tokens of a mixed-case name", () => {
    const buoy = { ...delMar([storm({ name: "Hurricane Marie" })]), name: "SCRIPPS Nearshore, CA (201)" };
    expect(historyLine(buoy, 3.0, TZ)).toBe("Biggest since Hurricane Marie at the Scripps Nearshore buoy");
  });

  it("keeps real acronyms in caps", () => {
    const buoy = { ...delMar([storm({ name: "Hurricane Marie" })]), name: "OOI Newport Shelf" };
    expect(historyLine(buoy, 3.0, TZ)).toBe("Biggest since Hurricane Marie at the OOI Newport Shelf buoy");
  });

  it("returns null when nothing stored is at least that big", () => {
    const buoy = delMar([storm({ name: "Hurricane Marie" })]);
    expect(historyLine(buoy, 9.0, TZ)).toBeNull();
  });

  it("returns null when the swell is not big for the buoy", () => {
    const buoy = delMar([storm({ name: "Hurricane Marie" })]);
    expect(historyLine(buoy, 1.0, TZ)).toBeNull();
  });
});

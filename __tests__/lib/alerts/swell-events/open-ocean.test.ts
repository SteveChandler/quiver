import {
  OPEN_OCEAN_STEP_DEG,
  fetchOpenOceanSamples,
  matchOpenOceanSwell,
  openOceanSwells,
  regionOpenOceanPoint,
  samplesFromHourly,
  type OpenOceanPart,
  type OpenOceanSample,
} from "@/lib/alerts/swell-events/open-ocean";

// 2026-11-12 00:00Z, then hourly.
const T0 = Date.UTC(2026, 10, 12) / 1000;
const HOUR_MS = 3_600_000;
const T0_MS = T0 * 1000;

function hourly(hours: number, values: Partial<Record<string, Array<number | null>>> = {}) {
  const fill = (value: number | null) => Array.from({ length: hours }, () => value);
  return {
    time: Array.from({ length: hours }, (_, index) => T0 + index * 3600),
    swell_wave_height: fill(3),
    swell_wave_period: fill(17),
    swell_wave_direction: fill(300),
    secondary_swell_wave_height: fill(0.6),
    secondary_swell_wave_period: fill(15),
    secondary_swell_wave_direction: fill(190),
    tertiary_swell_wave_height: fill(null),
    tertiary_swell_wave_period: fill(null),
    tertiary_swell_wave_direction: fill(null),
    ...values,
  };
}

/** Three-hourly samples over `days`, each holding the parts `at` gives for its hour index. */
function samples(days: number, at: (step: number) => OpenOceanPart[]): OpenOceanSample[] {
  return Array.from({ length: days * 8 }, (_, step) => ({ atMs: T0_MS + step * 3 * HOUR_MS, parts: at(step) }));
}

const iso = (step: number) => new Date(T0_MS + step * 3 * HOUR_MS).toISOString();

/** Nov 14, 2026 in small: a NW groundswell building to 13 ft, over a small steady south swell. */
function nwOverSouth(step: number): OpenOceanPart[] {
  const nwFt = step < 8 ? 5 : step < 16 ? 8 + (step - 8) * 0.6 : 13 - (step - 16) * 0.5;
  return [
    { heightFt: nwFt, periodS: 17, directionDeg: 300 },
    { heightFt: 1.9, periodS: 15, directionDeg: 190 },
  ];
}

describe("regionOpenOceanPoint", () => {
  it("steps 1.5° seaward along the beaches' mean facing, past the islands", () => {
    const point = regionOpenOceanPoint([
      { lat: 32.8, lon: -117.25, aspect_deg: 270 },
      { lat: 33.0, lon: -117.27, aspect_deg: 270 },
    ])!;
    expect(OPEN_OCEAN_STEP_DEG).toBe(1.5);
    expect(point.lat).toBeCloseTo(32.9, 5);
    expect(point.lon).toBeCloseTo(-117.26 - 1.5 / Math.cos((32.9 * Math.PI) / 180), 5);
  });

  it("has no point when no beach has a facing or swell window", () => {
    expect(regionOpenOceanPoint([{ lat: 32.8, lon: -117.25, aspect_deg: null }])).toBeNull();
  });
});

describe("samplesFromHourly", () => {
  it("keeps every third hour with all three partitions, mean period, in feet", () => {
    const result = samplesFromHourly(hourly(7, {
      tertiary_swell_wave_height: [0.4, null, null, 0.4, null, null, 0.4],
      tertiary_swell_wave_period: [12, null, null, 12, null, null, 12],
      tertiary_swell_wave_direction: [250, null, null, 250, null, null, 250],
    }))!;
    expect(result.map((sample) => sample.atMs)).toEqual([T0_MS, T0_MS + 3 * HOUR_MS, T0_MS + 6 * HOUR_MS]);
    expect(result[0].parts).toEqual([
      { heightFt: expect.closeTo(9.843, 3), periodS: 17, directionDeg: 300 },
      { heightFt: expect.closeTo(1.969, 3), periodS: 15, directionDeg: 190 },
      { heightFt: expect.closeTo(1.312, 3), periodS: 12, directionDeg: 250 },
    ]);
  });

  it("drops partitions under half a foot or missing a period or direction", () => {
    const result = samplesFromHourly(hourly(1, {
      secondary_swell_wave_height: [0.1],
      tertiary_swell_wave_height: [1],
      tertiary_swell_wave_period: [null],
      tertiary_swell_wave_direction: [200],
    }))!;
    expect(result[0].parts).toHaveLength(1);
  });

  it("is null for a land-masked cell with no partition at any hour", () => {
    const zero = Array.from({ length: 4 }, () => 0);
    expect(samplesFromHourly(hourly(4, { swell_wave_height: zero, secondary_swell_wave_height: zero }))).toBeNull();
    expect(samplesFromHourly(undefined)).toBeNull();
  });
});

describe("fetchOpenOceanSamples", () => {
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
  });

  it("reads three GFS-Wave partitions at the point, cached 3 h", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly: hourly(4) }) });
    global.fetch = fetchMock;

    const result = await fetchOpenOceanSamples({ lat: 32.4913, lon: -119.0004 });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("models")).toBe("ncep_gfswave025");
    expect(url.searchParams.get("latitude")).toBe("32.491");
    expect(url.searchParams.get("hourly")).toContain("tertiary_swell_wave_direction");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 10_800 } });
    expect(result).toHaveLength(2);
  });

  it("returns null on an HTTP failure, a thrown fetch, or a bad body", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchOpenOceanSamples({ lat: 32.5, lon: -119 })).resolves.toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
    await expect(fetchOpenOceanSamples({ lat: 32.5, lon: -119 })).resolves.toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("bad json"); } });
    await expect(fetchOpenOceanSamples({ lat: 32.5, lon: -119 })).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

describe("openOceanSwells", () => {
  it("tracks each partition over time as its own swell", () => {
    const swells = openOceanSwells(samples(4, nwOverSouth));
    expect(swells).toHaveLength(2);
    const nw = swells.find((swell) => swell.points[0].part.directionDeg === 300)!;
    expect(nw.peakHeightFt).toBeCloseTo(13, 5);
    expect(nw.peakMs).toBe(T0_MS + 16 * 3 * HOUR_MS);
  });

  it("splits one direction's track at a trough between two peaks: a new swell behind the last", () => {
    const heights = [4, 6, 8, 6, 4, 3, 3, 5, 7, 9, 7, 5];
    const swells = openOceanSwells(samples(2, (step) => (step < heights.length
      ? [{ heightFt: heights[step], periodS: 16, directionDeg: 295 }] : [])));
    expect(swells.map((swell) => swell.peakHeightFt)).toEqual([8, 9]);
  });

  it("starts a new swell when the period jumps past the tracking step, as a new forerunner does", () => {
    const swells = openOceanSwells(samples(1, (step) => [{ heightFt: 6, periodS: step < 4 ? 14 : 19, directionDeg: 300 }]));
    expect(swells).toHaveLength(2);
  });
});

describe("matchOpenOceanSwell", () => {
  const swells = openOceanSwells(samples(4, nwOverSouth));

  it("gives a big run bent to SW at a north-county beach to the NW swell, not the small south swell", () => {
    const match = matchOpenOceanSwell({ directionDeg: 225, periodS: 16, peakAt: iso(16), heightFt: 4 }, swells);
    expect(match).toMatchObject({ directionDeg: 300, periodS: 17 });
  });

  it("gives a W run to the NW swell, read at the run's peak", () => {
    const match = matchOpenOceanSwell({ directionDeg: 270, periodS: 22, peakAt: iso(12), heightFt: 8 }, swells);
    expect(match).toMatchObject({ directionDeg: 300, heightFt: expect.closeTo(10.4, 5) });
  });

  it("gives a small south run to the south swell: the closest direction wins among swells big enough", () => {
    const match = matchOpenOceanSwell({ directionDeg: 202.5, periodS: 15, peakAt: iso(16), heightFt: 2 }, swells);
    expect(match).toMatchObject({ directionDeg: 190 });
  });

  it("never gives a groundswell run to short-period open-ocean sea", () => {
    // Oahu, Nov 2026: a 12 s north run took the name of a 7.7 s east trade swell.
    const trades = openOceanSwells(samples(2, () => [{ heightFt: 7, periodS: 7.7, directionDeg: 84 }]));
    expect(matchOpenOceanSwell({ directionDeg: 0, periodS: 12, peakAt: iso(8), heightFt: 5 }, trades)).toBeNull();
  });

  it("still matches a mid-period swell whose GFS mean period reads under 10 s", () => {
    const mid = openOceanSwells(samples(2, () => [{ heightFt: 8, periodS: 9.6, directionDeg: 285 }]));
    expect(matchOpenOceanSwell({ directionDeg: 270, periodS: 12, peakAt: iso(8), heightFt: 5 }, mid)).toMatchObject({ directionDeg: 285 });
  });

  it("matches nothing past the bend limit, the period limit, or outside the swell's time in the water", () => {
    // 110° from the NW swell, and the south swell is too small for a 5 ft run.
    expect(matchOpenOceanSwell({ directionDeg: 190, periodS: 16, peakAt: iso(16), heightFt: 5 }, swells)).toBeNull();
    expect(matchOpenOceanSwell({ directionDeg: 280, periodS: 8, peakAt: iso(16), heightFt: 3 }, swells)).toBeNull();
    expect(matchOpenOceanSwell({ directionDeg: 280, periodS: 16, peakAt: iso(40), heightFt: 3 }, swells)).toBeNull();
  });
});

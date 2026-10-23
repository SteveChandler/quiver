import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";
import {
  compareToBigSwells,
  modelTracksBuoy,
  nearestBigSwellBuoy,
  parseHurdat2,
  stormNameFor,
  pickBigSwells,
  type BigSwellBuoy,
} from "@/lib/big-swells";

const HOUR = 3_600_000;
const START = Date.UTC(2020, 0, 1);

function reading(hour: number, waveHeightM: number, dominantPeriodS = 10): NdbcRecord {
  return {
    timeUtcMs: START + hour * HOUR,
    waveHeightM,
    dominantPeriodS,
    meanWaveDirDeg: 100,
    waterTempC: null,
    windDirDeg: null,
    windSpeedMs: null,
  };
}

/** 1,000 calm hours with two storms and one single-reading spike. */
function series(): NdbcRecord[] {
  const records = Array.from({ length: 1000 }, (_, hour) => reading(hour, 1));
  for (const [hour, hs] of [[99, 4], [100, 5], [101, 4.5], [102, 4]] as const) records[hour] = reading(hour, hs, 14);
  for (const [hour, hs] of [[119, 3.5], [120, 3.9], [121, 3.6]] as const) records[hour] = reading(hour, hs);
  for (const [hour, hs] of [[799, 3.4], [800, 4.2], [801, 3.5]] as const) records[hour] = reading(hour, hs, 12);
  records[500] = reading(500, 9);
  return records;
}

describe("pickBigSwells", () => {
  it("keeps one peak per storm, drops lone spikes, and lists the newest separately", () => {
    const { bigHsM, biggest, recent } = pickBigSwells(series());

    expect(bigHsM).toBeGreaterThan(1);
    expect(biggest.map((event) => [event.at.slice(0, 13), event.hsM, event.periodS])).toEqual([
      [new Date(START + 100 * HOUR).toISOString().slice(0, 13), 5, 14],
      [new Date(START + 800 * HOUR).toISOString().slice(0, 13), 4.2, 12],
    ]);
    expect(recent.map((event) => event.hsM)).toEqual([4.2, 5]);
  });

  it("returns nothing when the buoy never reported a height", () => {
    expect(pickBigSwells([{ ...reading(0, 1), waveHeightM: null }])).toEqual({ bigHsM: 0, biggest: [], recent: [] });
  });
});

const STATION: BigSwellBuoy = {
  id: "44065",
  name: "New York Harbor Entrance",
  lat: 40.368,
  lon: -73.701,
  since: "2008-10-30",
  through: "2026-10-23",
  bigHsM: 3,
  modelRatio: 0.9,
  biggest: [
    { at: "2012-10-30T00:00:00.000Z", hsM: 9.86, periodS: 13.79, dirDeg: 121 },
    { at: "2011-08-28T12:00:00.000Z", hsM: 7.95, periodS: 14.81, dirDeg: 170 },
    { at: "2010-03-13T23:00:00.000Z", hsM: 5.94, periodS: 10, dirDeg: 126 },
  ],
  recent: [{ at: "2026-09-26T08:50:00.000Z", hsM: 4.5, periodS: 10, dirDeg: 108 }],
};

describe("compareToBigSwells", () => {
  it("names the closest measured swell and the rank for a big forecast", () => {
    expect(compareToBigSwells(6.5, STATION)).toMatchObject({ isBig: true, rank: 3, closest: STATION.biggest[2] });
    expect(compareToBigSwells(4.4, STATION)).toMatchObject({ isBig: true, rank: null, closest: STATION.recent[0] });
  });

  it("makes no comparison below the big-swell floor", () => {
    expect(compareToBigSwells(1.2, STATION)).toEqual({ isBig: false, rank: null, closest: null, biggestSince: null });
  });

  it("dates 'biggest since' only from swells the stored lists prove are the newest that big", () => {
    // Newest recent swell at least this big.
    expect(compareToBigSwells(4.4, STATION).biggestSince).toBe(STATION.recent[0]);
    // Bigger than every recent one and at least the smallest of the biggest: the newest of those
    // at least this big (Sandy 2012, not Irene 2011).
    expect(compareToBigSwells(6.5, STATION).biggestSince).toBe(STATION.biggest[0]);
    // Bigger than every recent one but under the smallest of the biggest: unknown.
    expect(compareToBigSwells(5, { ...STATION, recent: [{ ...STATION.recent[0], hsM: 3.2 }] }).biggestSince).toBeNull();
    // A record has nothing bigger to date from.
    expect(compareToBigSwells(10.5, STATION)).toMatchObject({ rank: 1, biggestSince: null });
  });
});

const HURDAT2 = [
  "AL182012,              SANDY,      3,",
  "20121029, 1800,  , HU, 38.8N,  73.4W,  80,  945",
  "20121029, 2330, L, EX, 39.4N,  74.5W,  70,  945",
  "20121030, 0600,  , EX, 39.9N,  76.2W,  55,  960",
  "AL052000,            UNNAMED,      1,",
  "20000901, 0000,  , TD, 39.0N,  73.0W,  30, 1008",
  "EP012020,              ALPHA,      1,",
  "20200101, 0000,  , TS, 20.0N, 158.0W,  40, 1000",
].join("\n");

describe("storm names", () => {
  it("keeps named tropical storms and hurricanes from HURDAT2 and drops the unnamed", () => {
    const storms = parseHurdat2(HURDAT2);
    expect(storms.map((storm) => storm.name)).toEqual(["Hurricane Sandy", "Tropical Storm Alpha"]);
    expect(storms[0].fixes[1]).toEqual({ timeUtcMs: Date.UTC(2012, 9, 29, 23, 30), lat: 39.4, lon: -74.5 });
  });

  it("names a swell after the cyclone that passed within 800 km in the 3 days before its peak", () => {
    const storms = parseHurdat2(HURDAT2);
    expect(stormNameFor("2012-10-30T00:50:00.000Z", STATION, storms)).toBe("Hurricane Sandy");
    expect(stormNameFor("2012-11-08T00:00:00.000Z", STATION, storms)).toBeUndefined();
    expect(stormNameFor("2012-10-30T00:50:00.000Z", { lat: 33.6, lon: -118.3 }, storms)).toBeUndefined();
  });
});

describe("modelTracksBuoy", () => {
  it("only compares forecasts at buoys the model reads within 20-25%", () => {
    expect(modelTracksBuoy(STATION)).toBe(true);
    expect(modelTracksBuoy({ ...STATION, modelRatio: 0.68 })).toBe(false);
    expect(modelTracksBuoy({ ...STATION, modelRatio: 1.3 })).toBe(false);
    expect(modelTracksBuoy({ ...STATION, modelRatio: null })).toBe(false);
  });
});

describe("nearestBigSwellBuoy", () => {
  it("picks the closest buoy within 100 km and nothing farther", () => {
    const belmar = { lat: 40.176, lon: -74.013 };
    expect(nearestBigSwellBuoy([STATION], belmar)?.buoy.id).toBe("44065");
    expect(nearestBigSwellBuoy([STATION], { lat: 33.6, lon: -118.3 })).toBeNull();
  });
});

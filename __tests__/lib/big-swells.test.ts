import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";
import {
  compareToBigSwells,
  modelTracksBuoy,
  nearestBigSwellBuoy,
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
    expect(compareToBigSwells(6.5, STATION)).toEqual({ isBig: true, rank: 3, closest: STATION.biggest[2] });
    expect(compareToBigSwells(4.4, STATION)).toEqual({ isBig: true, rank: null, closest: STATION.recent[0] });
  });

  it("makes no comparison below the big-swell floor", () => {
    expect(compareToBigSwells(1.2, STATION)).toEqual({ isBig: false, rank: null, closest: null });
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

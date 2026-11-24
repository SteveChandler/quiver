import { buildReadingSentence, classifyPeriod } from "@/lib/buoy-pages/reading";
import { computeHeightTrend, selectNowObservation } from "@/lib/buoy-pages/series";
import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";

const EMPTY = {
  wave_height_m: null,
  dominant_period_s: null,
  mean_wave_direction_deg: null,
  swell_height_m: null,
  swell_period_s: null,
  swell_direction_deg: null,
  wind_wave_height_m: null,
  wind_wave_period_s: null,
  wind_wave_direction_deg: null,
};

function row(observedAt: string, waveHeightM: number): WaveStationObservationRow {
  return {
    ...EMPTY,
    average_period_s: null,
    steepness: null,
    water_temp_c: null,
    air_temp_c: null,
    wind_speed_ms: null,
    wind_direction_deg: null,
    wind_gust_ms: null,
    pressure_hpa: null,
    wave_height_m: waveHeightM,
    station_id: "ndbc:46225",
    observed_at: observedAt,
    source: "ndbc",
    fetched_at: observedAt,
  };
}

describe("classifyPeriod", () => {
  it.each([
    [16, "groundswell"],
    [13, "groundswell"],
    [12.9, "mid-period"],
    [10, "mid-period"],
    [9, "short-period"],
    [7, "short-period"],
    [6.5, "wind-chop"],
  ])("%s s is %s", (seconds, expected) => {
    expect(classifyPeriod(seconds)).toBe(expected);
  });
});

describe("buildReadingSentence", () => {
  it("returns null without a height", () => {
    expect(buildReadingSentence(null, null)).toBeNull();
    expect(buildReadingSentence({ ...EMPTY }, null)).toBeNull();
  });

  it("calls a sea under 0.3 m close to flat", () => {
    expect(buildReadingSentence({ ...EMPTY, wave_height_m: 0.2 }, null)).toBe(
      "Close to flat at the buoy: 0.7 ft of total wave height.",
    );
  });

  it("leads with long-period groundswell when swell is the larger component", () => {
    expect(
      buildReadingSentence(
        {
          ...EMPTY,
          wave_height_m: 1.4,
          dominant_period_s: 14,
          swell_height_m: 1.0,
          swell_period_s: 14.3,
          swell_direction_deg: 247.5,
          wind_wave_height_m: 0.9,
          wind_wave_period_s: 9.1,
          wind_wave_direction_deg: 292.5,
        },
        null,
      ),
    ).toBe("Long-period groundswell leads: 3.3 ft at 14 s from the WSW, with 3.0 ft of wind waves at 9.1 s from the WNW on top.");
  });

  it("says little wind wave on top when the wind-wave part is under 0.3 m", () => {
    expect(
      buildReadingSentence(
        {
          ...EMPTY,
          wave_height_m: 1.2,
          swell_height_m: 1.15,
          swell_period_s: 11,
          swell_direction_deg: 180,
          wind_wave_height_m: 0.2,
          wind_wave_period_s: 4,
          wind_wave_direction_deg: 270,
        },
        null,
      ),
    ).toBe("Mid-period swell leads: 3.8 ft at 11 s from the S, with little wind wave on top.");
  });

  it("leads with wind waves when they are larger than the swell", () => {
    expect(
      buildReadingSentence(
        {
          ...EMPTY,
          wave_height_m: 2,
          swell_height_m: 0.8,
          swell_period_s: 12,
          swell_direction_deg: 270,
          wind_wave_height_m: 1.8,
          wind_wave_period_s: 6,
          wind_wave_direction_deg: 315,
        },
        null,
      ),
    ).toBe("Wind waves lead: 5.9 ft at 6 s from the NW, over 2.6 ft of mid-period swell at 12 s from the W.");
  });

  it("names the sea by dominant period without a swell split", () => {
    expect(
      buildReadingSentence({ ...EMPTY, wave_height_m: 2.1, dominant_period_s: 8, mean_wave_direction_deg: 300 }, null),
    ).toBe("Short-period swell: 6.9 ft at 8 s from the WNW.");
  });

  it("appends the six-hour trend", () => {
    const sentence = buildReadingSentence(
      { ...EMPTY, wave_height_m: 2, dominant_period_s: 15, mean_wave_direction_deg: 270 },
      { direction: "building", deltaM: 0.5 },
    );
    expect(sentence).toBe("Long-period groundswell: 6.6 ft at 15 s from the W. Building over the last 6 hours, up 1.6 ft.");
    expect(buildReadingSentence({ ...EMPTY, wave_height_m: 2 }, { direction: "steady", deltaM: 0.02 })).toBe(
      "Waves: 6.6 ft. Holding steady over the last 6 hours.",
    );
  });
});

describe("computeHeightTrend", () => {
  it("compares the last hour against 5-7 hours before the newest reading", () => {
    const rows = [
      row("2026-11-11T20:00:00Z", 1.0),
      row("2026-11-11T21:00:00Z", 1.0),
      row("2026-11-12T02:30:00Z", 1.5),
      row("2026-11-12T03:00:00Z", 1.5),
    ];
    expect(computeHeightTrend(rows)).toEqual({ direction: "building", deltaM: 0.5 });
  });

  it("calls a small change steady (under 0.15 m or 15%)", () => {
    const rows = [row("2026-11-11T21:00:00Z", 2.0), row("2026-11-12T03:00:00Z", 2.2)];
    expect(computeHeightTrend(rows)?.direction).toBe("steady");
  });

  it("reports fading", () => {
    const rows = [row("2026-11-11T21:00:00Z", 2.0), row("2026-11-12T03:00:00Z", 1.4)];
    expect(computeHeightTrend(rows)?.direction).toBe("fading");
  });

  it("returns null without readings 5-7 hours back", () => {
    expect(computeHeightTrend([row("2026-11-12T00:00:00Z", 1), row("2026-11-12T03:00:00Z", 1.5)])).toBeNull();
  });
});

describe("selectNowObservation", () => {
  const split = (observedAt: string, hs: number) => ({ ...row(observedAt, hs), swell_height_m: 1, wind_wave_height_m: 0.5 });

  it("uses the newest split row when it is within 90 minutes of the newest wave row", () => {
    const newest = row("2026-11-11T03:26:00Z", 1.4);
    const history = [split("2026-11-11T01:56:00Z", 1.2), split("2026-11-11T02:26:00Z", 1.3), newest];
    expect(selectNowObservation(true, newest, history)?.observed_at).toBe("2026-11-11T02:26:00Z");
  });

  it("falls back to the newest wave row, without a split, when the split row is older than 90 minutes", () => {
    const newest = row("2026-11-11T03:26:00Z", 1.4);
    const history = [split("2026-11-11T01:46:00Z", 1.2), newest];
    expect(selectNowObservation(true, newest, history)).toBe(newest);
  });

  it("keeps the newest row when it already has the split, or the station has none", () => {
    const newest = split("2026-11-11T03:26:00Z", 1.4);
    expect(selectNowObservation(true, newest, [newest])).toBe(newest);
    const plain = row("2026-11-11T03:26:00Z", 1.4);
    expect(selectNowObservation(false, plain, [split("2026-11-11T03:00:00Z", 1.3), plain])).toBe(plain);
    expect(selectNowObservation(true, null, [])).toBeNull();
  });
});

import { buildOutlookDays } from "@/lib/services/discovery/swell-outlook-days";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import type { EnhancedForecastEntity } from "@/types/forecast";

const beach = createMockBeach({ id: "obp", timezone: "America/Los_Angeles", aspect_deg: 270, wind_offshore_deg: 90 });
// 07:00 PDT Saturday 17 October 2026.
const NOW = new Date("2026-10-17T14:00:00Z");

function row(at: string, wave: string, swell1: [string, string, string] | null = ["2 ft", "13s", "SSW"]): EnhancedForecastEntity {
  return {
    forecast_at: at,
    wave_height: wave,
    wave_period: "13",
    wind_speed: "4 mph",
    wind_direction: "E",
    swell_1_height: swell1?.[0] ?? null,
    swell_1_period: swell1?.[1] ?? null,
    swell_1_direction: swell1?.[2] ?? null,
    swell_2_height: "0.7 ft",
    swell_2_period: "12s",
    swell_2_direction: "W",
  } as unknown as EnhancedForecastEntity;
}

describe("buildOutlookDays", () => {
  it("gives every day, today included, its daylight surf range, best-hour score and swell mix", () => {
    const days = buildOutlookDays({
      rows: [
        row("2026-10-17T11:00:00Z", "9 ft"), // 04:00 local: before daylight, ignored
        row("2026-10-17T15:00:00Z", "2 ft"),
        row("2026-10-17T21:00:00Z", "3 ft"),
        row("2026-10-25T18:00:00Z", "2.6 ft", ["2.4 ft", "14s", "SW"]),
      ],
      beach,
      now: NOW,
      horizonDays: 9,
      skillLevel: "intermediate",
      boardClasses: [],
    });

    expect(days.map((day) => day.date)).toEqual([
      "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21",
      "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
    expect(days[0].surfFt).toEqual({ min: 2, max: 3 });
    expect(days[0].score).toEqual(expect.any(Number));
    expect(days[0].swells).toEqual([
      { heightFt: 2, periodS: 13, directionDeg: 202.5, directionLabel: "SSW" },
      { heightFt: 0.7, periodS: 12, directionDeg: 270, directionLabel: "W" },
    ]);
    expect(days[1]).toEqual({ date: "2026-10-18", surfFt: null, score: null, swells: [] });
    expect(days[8].surfFt).toEqual({ min: 2.6, max: 2.6 });
    expect(days[8].swells[0]).toMatchObject({ heightFt: 2.4, directionLabel: "SW" });
  });
});

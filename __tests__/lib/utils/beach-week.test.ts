/**
 * @jest-environment node
 */
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

const mockAggregate = jest.fn<DaySummary[], unknown[]>();
jest.mock("@/lib/utils/horizon-strip-utils", () => ({
  aggregateDayForecasts: (...args: unknown[]) => mockAggregate(...args),
}));

import { buildBeachWeek, EARLY_READ_DAY_OFFSET } from "@/lib/utils/beach-week";

const TZ = "America/Los_Angeles";
const BEACH = { id: "b1", name: "Tourmaline" } as Beach;

function summary(fullDate: string, bestForecastAt: string | null, index: number): DaySummary {
  return {
    date: fullDate, dayName: "Sun", minHeight: 2, maxHeight: 3, tier: "fair", score: 60,
    fullDate, isToday: index === 0, bestTime: null, period: 11, bestForecastAt,
  };
}

function row(forecastAt: string, extra: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    forecast_at: forecastAt,
    swell_1_direction: "225",
    swell_1_period: "11",
    swell_1_height: "1.8",
    raw_forecast: null,
    ...extra,
  } as EnhancedForecastEntity;
}

describe("buildBeachWeek", () => {
  beforeEach(() => mockAggregate.mockReset());

  it("draws each day's glyph from that day's best row, primary swell only", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", "2026-09-27T18:00:00.000Z", 0)]);
    const [day] = buildBeachWeek([row("2026-09-27T18:00:00.000Z")], BEACH, TZ);
    expect(day.swell).toEqual({ directionDeg: 225, periodS: 11, heightFt: 1.8 });
    expect(day.bestAt).toBe("2026-09-27T18:00:00.000Z");
  });

  it("has no glyph when the best row lacks a complete primary swell", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", "2026-09-27T18:00:00.000Z", 0)]);
    const [day] = buildBeachWeek([row("2026-09-27T18:00:00.000Z", { swell_1_period: null })], BEACH, TZ);
    expect(day.swell).toBeNull();
  });

  it("puts a late-evening low on its local day, not the UTC day", () => {
    // 11:40pm PDT on Sep 27 is 06:40 UTC on Sep 28.
    const lateLow = Date.parse("2026-09-28T06:40:00.000Z") / 1000;
    const nextMorningLow = Date.parse("2026-09-28T13:05:00.000Z") / 1000;
    const tides = row("2026-09-27T07:00:00.000Z", {
      raw_forecast: { tide_schedule: [
        { time: lateLow, height: 0.9, type: "low" },
        { time: nextMorningLow, height: 1.2, type: "low" },
      ] },
    } as Partial<EnhancedForecastEntity>);
    mockAggregate.mockReturnValue([
      summary("2026-09-27", null, 0),
      summary("2026-09-28", null, 1),
    ]);
    const [sat, sun] = buildBeachWeek([tides], BEACH, TZ);
    expect(sat.lowTide).toEqual({ at: "2026-09-28T06:40:00.000Z", heightFt: 0.9 });
    expect(sun.lowTide).toEqual({ at: "2026-09-28T13:05:00.000Z", heightFt: 1.2 });
  });

  it("fades days from the fifth card on", () => {
    mockAggregate.mockReturnValue(
      Array.from({ length: 7 }, (_, i) => summary(`2026-09-${27 + i}`, null, i)),
    );
    const week = buildBeachWeek([], BEACH, TZ);
    expect(week.map((d) => d.early)).toEqual([false, false, false, false, true, true, true]);
    expect(EARLY_READ_DAY_OFFSET).toBe(4);
  });

  it("carries no water temperature", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", null, 0)]);
    const [day] = buildBeachWeek([], BEACH, TZ);
    expect(Object.keys(day)).not.toContain("waterTemp");
  });

  it("asks the aggregator for 7 days in the beach's timezone", () => {
    mockAggregate.mockReturnValue([]);
    buildBeachWeek([], BEACH, TZ);
    expect(mockAggregate).toHaveBeenCalledWith([], BEACH, { maxDays: 7, timezone: TZ });
  });
});

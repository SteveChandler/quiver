import { nextGoodTideMs, tideAlertHeightContext, tideHeightAt } from "@/lib/surf/tide-height-now";
import type { TideScheduleEntry } from "@/types/forecast";

const M_TO_FT = 3.28084;
const sec = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

// Haleiwa, Waialua Bay (NOAA 1612668), Nov 14-15 2026, as the station page shows it.
const haleiwa: TideScheduleEntry[] = [
  { time: sec("2026-11-14T06:26:00-10:00"), height: 0.47 * M_TO_FT, type: "high" },
  { time: sec("2026-11-14T13:27:00-10:00"), height: 0.09 * M_TO_FT, type: "low" },
  { time: sec("2026-11-14T18:47:00-10:00"), height: 0.13 * M_TO_FT, type: "high" },
  { time: sec("2026-11-14T21:41:00-10:00"), height: 0.1 * M_TO_FT, type: "low" },
  { time: sec("2026-11-15T07:18:00-10:00"), height: 0.47 * M_TO_FT, type: "high" },
  { time: sec("2026-11-15T14:19:00-10:00"), height: 0.09 * M_TO_FT, type: "low" },
];
const laniakea = { minFt: 1, maxFt: 3 };
const at = (iso: string): number => Date.parse(iso);

describe("tideHeightAt", () => {
  it("reads the synthesized curve the tide chart draws", () => {
    const h = tideHeightAt(haleiwa, at("2026-11-14T16:25:00-10:00"));
    expect(h).not.toBeNull();
    expect(h!.toFixed(1)).toBe("0.4");
  });

  it("returns the extreme's own height at an extreme", () => {
    expect(tideHeightAt(haleiwa, at("2026-11-15T07:18:00-10:00"))).toBeCloseTo(0.47 * M_TO_FT, 5);
  });

  it("is null outside the schedule, never the edge height", () => {
    expect(tideHeightAt(haleiwa, at("2026-11-13T12:00:00-10:00"))).toBeNull();
    expect(tideHeightAt(haleiwa, at("2026-11-16T12:00:00-10:00"))).toBeNull();
  });

  it("is null with fewer than two extremes", () => {
    expect(tideHeightAt(haleiwa.slice(0, 1), at("2026-11-14T06:26:00-10:00"))).toBeNull();
    expect(tideHeightAt([], Date.now())).toBeNull();
  });
});

describe("nextGoodTideMs", () => {
  it("finds the next rising leg that reaches the range (Laniakea, Nov 14 evening)", () => {
    const ms = nextGoodTideMs(haleiwa, laniakea, "rising", at("2026-11-14T16:25:00-10:00"));
    expect(ms).not.toBeNull();
    // The cosine curve reaches 0.95 ft (printed "1.0 ft") at about 2:38 AM; the 10-minute grid lands on 2:40.
    expect(new Date(ms!).toISOString()).toBe(new Date("2026-11-15T02:40:00-10:00").toISOString());
  });

  it("skips a leg in range but in the wrong direction", () => {
    // Falling from the 7:18 AM high is in range by height, but this spot wants rising.
    const ms = nextGoodTideMs(haleiwa, laniakea, "falling", at("2026-11-14T16:25:00-10:00"));
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(at("2026-11-15T07:18:00-10:00"));
  });

  it("ignores direction for an 'either' spot", () => {
    const ms = nextGoodTideMs(haleiwa, laniakea, "either", at("2026-11-14T16:25:00-10:00"));
    expect(new Date(ms!).toISOString()).toBe(new Date("2026-11-15T02:40:00-10:00").toISOString());
  });

  it("is null when the range is not reached within 24 h", () => {
    const high = { minFt: 2, maxFt: 4 };
    expect(nextGoodTideMs(haleiwa, high, "rising", at("2026-11-14T16:25:00-10:00"))).toBeNull();
  });
});

describe("tideAlertHeightContext", () => {
  const base = {
    schedule: haleiwa,
    preferredDirection: "rising",
    nowMs: at("2026-11-14T16:25:00-10:00"),
    timeZone: "Pacific/Honolulu",
  };

  it("gives the height now and the next good time with its day", () => {
    const ctx = tideAlertHeightContext({ ...base, minFt: 1, maxFt: 3 });
    expect(ctx.range).toEqual({ minFt: 1, maxFt: 3 });
    expect(ctx.heightFt!.toFixed(1)).toBe("0.4");
    expect(ctx.nextGoodLabel).toBe("Sun 2:40 AM");
  });

  it("drops the day when the next good time is today", () => {
    const ctx = tideAlertHeightContext({ ...base, minFt: 0.2, maxFt: 0.35, nowMs: at("2026-11-14T13:00:00-10:00") });
    expect(ctx.nextGoodLabel).toBe("1:30 PM");
  });

  it("has no range when either edge is missing or the edges are reversed", () => {
    expect(tideAlertHeightContext({ ...base, minFt: null, maxFt: 3 }).range).toBeNull();
    expect(tideAlertHeightContext({ ...base, minFt: 1, maxFt: undefined }).range).toBeNull();
    expect(tideAlertHeightContext({ ...base, minFt: 3, maxFt: 1 }).range).toBeNull();
  });

  it("has no height before the clock is known or without a schedule", () => {
    const noClock = tideAlertHeightContext({ ...base, minFt: 1, maxFt: 3, nowMs: null });
    expect(noClock.heightFt).toBeNull();
    expect(noClock.nextGoodLabel).toBeNull();
    const noSchedule = tideAlertHeightContext({ ...base, minFt: 1, maxFt: 3, schedule: null });
    expect(noSchedule.heightFt).toBeNull();
    expect(noSchedule.nextGoodLabel).toBeNull();
  });
});

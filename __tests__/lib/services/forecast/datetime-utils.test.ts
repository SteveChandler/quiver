import {
  getNormalizedForecastAt,
  getNormalizedDateString,
  getNormalizedTimeString,
} from "@/lib/services/forecast/datetime-utils";

describe("getNormalizedForecastAt", () => {
  it("returns ISO 8601 UTC string rounded to 3-hour intervals", () => {
    // Feb 14, 2026 at 14:30 UTC → rounds down to 12:00
    const date = new Date("2026-02-14T14:30:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T12:00:00Z");
  });

  it("rounds 05:00 UTC down to 03:00", () => {
    const date = new Date("2026-02-14T05:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T03:00:00Z");
  });

  it("keeps exact 3-hour boundaries unchanged", () => {
    const date = new Date("2026-02-14T06:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T06:00:00Z");
  });

  it("handles midnight correctly", () => {
    const date = new Date("2026-02-14T00:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T00:00:00Z");
  });

  it("handles 23:59 UTC → rounds to 21:00", () => {
    const date = new Date("2026-02-14T23:59:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T21:00:00Z");
  });
});

describe("getNormalizedDateString", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date("2024-07-15T10:30:00");
    expect(getNormalizedDateString(date)).toBe("2024-07-15");
  });

  it("pads single-digit months with zero", () => {
    const date = new Date("2024-01-05T10:30:00");
    expect(getNormalizedDateString(date)).toBe("2024-01-05");
  });

  it("pads single-digit days with zero", () => {
    const date = new Date("2024-12-01T10:30:00");
    expect(getNormalizedDateString(date)).toBe("2024-12-01");
  });
});

describe("getNormalizedTimeString", () => {
  it("rounds to 3-hour intervals", () => {
    const date = new Date("2024-07-15T10:30:00");
    expect(getNormalizedTimeString(date)).toBe("09:00:00");
  });

  it("returns 00:00:00 for midnight to 2:59", () => {
    expect(getNormalizedTimeString(new Date("2024-07-15T00:00:00"))).toBe("00:00:00");
    expect(getNormalizedTimeString(new Date("2024-07-15T02:59:00"))).toBe("00:00:00");
  });

  it("returns 03:00:00 for 3:00 to 5:59", () => {
    expect(getNormalizedTimeString(new Date("2024-07-15T03:00:00"))).toBe("03:00:00");
    expect(getNormalizedTimeString(new Date("2024-07-15T05:59:00"))).toBe("03:00:00");
  });

  it("returns 21:00:00 for 21:00 to 23:59", () => {
    expect(getNormalizedTimeString(new Date("2024-07-15T21:00:00"))).toBe("21:00:00");
    expect(getNormalizedTimeString(new Date("2024-07-15T23:59:00"))).toBe("21:00:00");
  });
});

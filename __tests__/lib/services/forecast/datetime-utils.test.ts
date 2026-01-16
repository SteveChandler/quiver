import {
  getNormalizedDateString,
  getNormalizedTimeString,
} from "@/lib/services/forecast/datetime-utils";

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

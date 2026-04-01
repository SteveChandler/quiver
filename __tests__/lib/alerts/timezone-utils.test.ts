import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";

describe("getUtcDayBounds", () => {
  it("returns PDT bounds for America/Los_Angeles (UTC-7)", () => {
    const { start, end } = getUtcDayBounds("2026-04-01", "America/Los_Angeles");
    // PDT: midnight local = 07:00 UTC
    expect(start).toBe("2026-04-01T07:00:00.000Z");
    expect(end).toBe("2026-04-02T06:59:59.000Z");
  });

  it("returns EDT bounds for America/New_York (UTC-4)", () => {
    const { start, end } = getUtcDayBounds("2026-04-01", "America/New_York");
    // EDT: midnight local = 04:00 UTC
    expect(start).toBe("2026-04-01T04:00:00.000Z");
    expect(end).toBe("2026-04-02T03:59:59.000Z");
  });

  it("returns HST bounds for Pacific/Honolulu (UTC-10, no DST)", () => {
    const { start, end } = getUtcDayBounds("2026-04-01", "Pacific/Honolulu");
    // HST: midnight local = 10:00 UTC
    expect(start).toBe("2026-04-01T10:00:00.000Z");
    expect(end).toBe("2026-04-02T09:59:59.000Z");
  });

  it("returns UTC bounds for UTC timezone", () => {
    const { start, end } = getUtcDayBounds("2026-04-01", "UTC");
    expect(start).toBe("2026-04-01T00:00:00.000Z");
    expect(end).toBe("2026-04-01T23:59:59.000Z");
  });
});

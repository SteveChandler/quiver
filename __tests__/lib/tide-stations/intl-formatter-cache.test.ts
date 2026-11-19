import { formatStationDay, formatStationTime, formatZoneOffset } from "@/lib/tide-stations/format";
import { localDateKey } from "@/lib/tide-stations/series";

// Each new Intl.DateTimeFormat with a time zone holds ~25 KB of native ICU memory that GC
// seldom frees; ~900 per station render took a crawled instance past its memory limit.
describe("tide station Intl formatter reuse", () => {
  const base = Date.parse("2026-11-19T00:02:24Z");
  let construct: jest.SpyInstance;

  beforeEach(() => {
    construct = jest.spyOn(Intl, "DateTimeFormat");
  });

  afterEach(() => {
    construct.mockRestore();
  });

  it("builds one formatter per zone and option set, however many times it is called", () => {
    for (let i = 0; i < 200; i++) {
      const ts = base + i * 600_000;
      localDateKey(ts, "America/New_York");
      formatStationTime(ts, "America/New_York");
      formatStationDay(ts, "America/New_York");
      formatZoneOffset(ts, "America/New_York");
      localDateKey(ts, "Pacific/Honolulu");
    }
    expect(construct.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("keeps zones apart", () => {
    const ts = Date.parse("2026-11-19T06:30:00Z");
    expect(localDateKey(ts, "America/New_York")).toBe("2026-11-19");
    expect(localDateKey(ts, "Pacific/Honolulu")).toBe("2026-11-18");
    expect(formatStationTime(ts, "America/New_York")).toBe("1:30 AM");
    expect(formatStationTime(ts, "Pacific/Honolulu")).toBe("8:30 PM");
    expect(formatStationDay(ts, "Pacific/Honolulu")).toBe("Wed, Nov 18");
    expect(formatZoneOffset(ts, "Pacific/Honolulu")).toBe("GMT-10");
  });

  it("still throws on an unknown zone, and does not cache the failure", () => {
    expect(() => localDateKey(base, "Not/AZone")).toThrow(RangeError);
    expect(() => localDateKey(base, "Not/AZone")).toThrow(RangeError);
    expect(localDateKey(base, "UTC")).toBe("2026-11-19");
  });
});

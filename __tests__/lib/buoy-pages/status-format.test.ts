import {
  compassPoint,
  formatAge,
  formatDirection,
  formatHeightFt,
  formatHeightM,
  formatPeriod,
  formatStationTime,
  formatTempF,
  formatWindKnots,
  travelArrowRotation,
} from "@/lib/buoy-pages/format";
import { buildBuoySitemapEntries } from "@/lib/buoy-pages/sitemap-routes";
import { classifyStationStatus, evaluateStationIndexability } from "@/lib/buoy-pages/status";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("classifyStationStatus", () => {
  it.each([
    [0.5, "fresh"],
    [3, "fresh"],
    [3.01, "stale"],
    [24 * 29, "stale"],
    [24 * 30 + 1, "offline"],
  ])("a reading %s h old is %s", (hours, expected) => {
    expect(classifyStationStatus(hoursAgo(hours), NOW)).toBe(expected);
  });

  it("is offline with no reading", () => {
    expect(classifyStationStatus(null, NOW)).toBe("offline");
    expect(classifyStationStatus("not a date", NOW)).toBe("offline");
  });
});

describe("evaluateStationIndexability", () => {
  const live = { active: true, has_wave: true, last_wave_observed_at: hoursAgo(1) };

  it("indexes a live wave station", () => {
    expect(evaluateStationIndexability(live, NOW)).toEqual({ indexable: true, reason: "live-waves" });
  });

  it("keeps a stale station indexed through a short outage (hysteresis)", () => {
    expect(evaluateStationIndexability({ ...live, last_wave_observed_at: hoursAgo(6) }, NOW).indexable).toBe(true);
    expect(evaluateStationIndexability({ ...live, last_wave_observed_at: hoursAgo(24 * 20) }, NOW).indexable).toBe(true);
  });

  it("drops a station only after 30 days without waves, and re-indexes on a fresh reading", () => {
    const offline = { ...live, last_wave_observed_at: hoursAgo(24 * 31) };
    expect(evaluateStationIndexability(offline, NOW)).toEqual({ indexable: false, reason: "offline" });
    expect(evaluateStationIndexability({ ...offline, last_wave_observed_at: hoursAgo(0.2) }, NOW).indexable).toBe(true);
  });

  it("never indexes inactive or met-only stations", () => {
    expect(evaluateStationIndexability({ ...live, active: false }, NOW).reason).toBe("inactive");
    expect(evaluateStationIndexability({ ...live, has_wave: false }, NOW).reason).toBe("no-wave-data");
  });
});

describe("format", () => {
  it("shows feet with metres beside", () => {
    expect(formatHeightFt(1.4)).toBe("4.6 ft");
    expect(formatHeightM(1.4)).toBe("1.4 m");
    expect(formatHeightFt(null)).toBeNull();
    expect(formatHeightFt(Number.NaN)).toBeNull();
  });

  it("rounds long periods to whole seconds and keeps a decimal on short ones", () => {
    expect(formatPeriod(14.3)).toBe("14 s");
    expect(formatPeriod(9.13)).toBe("9.1 s");
    expect(formatPeriod(0)).toBeNull();
  });

  it("names directions on a 16-point compass", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(359)).toBe("N");
    expect(compassPoint(273)).toBe("W");
    expect(compassPoint(-90)).toBe("W");
    expect(formatDirection(253)).toBe("WSW (253°)");
  });

  it("points the arrow where the waves travel", () => {
    expect(travelArrowRotation(270)).toBe(90);
    expect(travelArrowRotation(0)).toBe(180);
  });

  it("converts temperature and wind", () => {
    expect(formatTempF(24.2)).toBe("76°F");
    expect(formatWindKnots(4)).toBe("8 kt");
  });

  it("formats station-local time with an explicit zone (Jest runs in UTC)", () => {
    expect(formatStationTime("2026-11-11T03:26:00Z", "America/Los_Angeles")).toBe("Nov 10, 7:26 PM PST");
    expect(formatStationTime("2026-11-11T03:26:00Z", "Asia/Seoul")).toBe("Nov 11, 12:26 PM GMT+9");
  });

  it("formats ages", () => {
    expect(formatAge(30_000)).toBe("just now");
    expect(formatAge(22 * 60_000)).toBe("22 min ago");
    expect(formatAge(5 * 3_600_000)).toBe("5 h ago");
    expect(formatAge(4 * 86_400_000)).toBe("4 days ago");
  });
});

describe("buildBuoySitemapEntries", () => {
  const base = { active: true, has_wave: true, country_code: "US", region: "CA" };

  it("lists indexable stations and the hubs above them, with day-precision dates", () => {
    const entries = buildBuoySitemapEntries(
      [
        { ...base, slug: "torrey-pines-outer-ca-46225", last_wave_observed_at: "2026-11-11T03:26:00Z" },
        { ...base, slug: "old-buoy-1", last_wave_observed_at: "2026-09-01T00:00:00Z" },
        { ...base, slug: "met-only-2", has_wave: false, last_wave_observed_at: null },
        { ...base, slug: "halibut-bank-46146", country_code: "CA", region: null, last_wave_observed_at: "2026-11-10T22:00:00Z" },
      ],
      NOW,
    );
    expect(entries).toEqual([
      { path: "/buoys", lastModified: "2026-11-11" },
      { path: "/buoys/ca", lastModified: "2026-11-10" },
      { path: "/buoys/us", lastModified: "2026-11-11" },
      { path: "/buoys/us/ca", lastModified: "2026-11-11" },
      { path: "/buoys/station/halibut-bank-46146", lastModified: "2026-11-10" },
      { path: "/buoys/station/torrey-pines-outer-ca-46225", lastModified: "2026-11-11" },
    ]);
  });
});

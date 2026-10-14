/** @jest-environment node */
import { isAwayFromHome, resolveLocationAnchor } from "@/lib/alerts/location-freshness";

const now = new Date("2026-10-10T13:08:00Z");
const home = { lat: 32.89, lon: -117.25 };
const fix = { lat: 21.28, lon: -157.83, captured_at: "2026-10-09T14:08:00Z" };

describe("resolveLocationAnchor", () => {
  it("uses a 23-hour fix", () => {
    expect(resolveLocationAnchor(fix, now, home)).toEqual({ anchor: { lat: fix.lat, lon: fix.lon }, source: "location" });
  });
  it.each(["2026-10-09T12:08:00Z", "invalid", "2026-10-10T14:08:00Z"])("rejects unusable capture %s", (captured_at) => {
    expect(resolveLocationAnchor({ ...fix, captured_at }, now, home)).toEqual({ anchor: home, source: "home" });
    expect(resolveLocationAnchor({ ...fix, captured_at }, now, null)).toEqual({ anchor: null, source: "none" });
  });
  it("handles no snapshot like a stale snapshot", () => {
    expect(resolveLocationAnchor(null, now, home)).toEqual({ anchor: home, source: "home" });
    expect(resolveLocationAnchor(null, now, null)).toEqual({ anchor: null, source: "none" });
  });
  it("accepts exactly 24 hours and rejects a millisecond older", () => {
    const captured_at = "2026-10-09T13:08:00Z";
    expect(resolveLocationAnchor({ ...fix, captured_at }, now, home).source).toBe("location");
    expect(resolveLocationAnchor({ ...fix, captured_at }, new Date(now.getTime() + 1), home).source).toBe("home");
  });
  it("takes a shorter window for callers that need a recent fix", () => {
    expect(resolveLocationAnchor(fix, now, home, 12)).toEqual({ anchor: home, source: "home" });
    expect(resolveLocationAnchor({ ...fix, captured_at: "2026-10-10T01:08:00Z" }, now, home, 12).source).toBe("location");
  });
  it("does not anchor on missing home coordinates", () => {
    expect(resolveLocationAnchor(null, now, { lat: null, lon: null })).toEqual({ anchor: null, source: "none" });
  });
});

describe("isAwayFromHome", () => {
  const philly = { lat: 39.96, lon: -75.17, captured_at: "2026-10-09T13:08:00Z" };

  it("flags a fix outside the drive radius from the last 72 hours", () => {
    expect(isAwayFromHome(philly, now, home, 90)).toBe(true);
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-07T13:08:00Z" }, now, home, 90)).toBe(true);
  });
  it("ignores a fix older than 72 hours, from the future, or unparseable", () => {
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-07T13:07:59Z" }, now, home, 90)).toBe(false);
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-10T14:08:00Z" }, now, home, 90)).toBe(false);
    expect(isAwayFromHome({ ...philly, captured_at: "invalid" }, now, home, 90)).toBe(false);
  });
  it("keeps a fix inside the radius at home", () => {
    expect(isAwayFromHome({ ...philly, lat: 32.8, lon: -117.24 }, now, home, 90)).toBe(false);
  });
  it("needs a fix and home coordinates", () => {
    expect(isAwayFromHome(null, now, home, 90)).toBe(false);
    expect(isAwayFromHome(philly, now, null, 90)).toBe(false);
    expect(isAwayFromHome(philly, now, { lat: null, lon: null }, 90)).toBe(false);
  });
});

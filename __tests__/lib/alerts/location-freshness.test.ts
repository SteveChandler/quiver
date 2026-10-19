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

  it("flags a fix more than 100 miles from home from the last 72 hours", () => {
    expect(isAwayFromHome(philly, now, home)).toBe(true);
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-07T13:08:00Z" }, now, home)).toBe(true);
  });
  it("ignores a fix older than 72 hours, from the future, or unparseable", () => {
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-07T13:07:59Z" }, now, home)).toBe(false);
    expect(isAwayFromHome({ ...philly, captured_at: "2026-10-10T14:08:00Z" }, now, home)).toBe(false);
    expect(isAwayFromHome({ ...philly, captured_at: "invalid" }, now, home)).toBe(false);
  });
  it("keeps a fix within 100 miles at home, whatever the drive range", () => {
    expect(isAwayFromHome({ ...philly, lat: 32.8, lon: -117.24 }, now, home)).toBe(false);
    // Poway, ~20 miles inland of a La Jolla home beach.
    expect(isAwayFromHome({ ...philly, lat: 32.96, lon: -117.04 }, now, home)).toBe(false);
  });
  it("needs a fix and home coordinates", () => {
    expect(isAwayFromHome(null, now, home)).toBe(false);
    expect(isAwayFromHome(philly, now, null)).toBe(false);
    expect(isAwayFromHome(philly, now, { lat: null, lon: null })).toBe(false);
  });
});

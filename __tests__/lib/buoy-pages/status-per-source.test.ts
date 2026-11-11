/**
 * @jest-environment node
 */

import { classifyStationStatus, liveLimitMs } from "@/lib/buoy-pages/status";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-11T06:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString();

describe("per-source Live limit", () => {
  it("is max(3 h, expected latency + 2 fetch intervals)", () => {
    expect(liveLimitMs({ source: "ndbc", owner: "NDBC" })).toBe(3 * HOUR);
    expect(liveLimitMs({ source: "smhi", owner: "SMHI" })).toBe(3 * HOUR);
    // Hourly Irish rows: 80 min latency + 2 x 60 min.
    expect(liveLimitMs({ source: "marine_ie", owner: "Marine Institute" })).toBe(200 * 60 * 1000);
    // Queensland AODN buoys publish 2.5-2.9 h late: 175 + 2 x 30 min.
    expect(liveLimitMs({ source: "aodn", owner: "Queensland Department of Environment and Science/City of Gold Coast" })).toBe(235 * 60 * 1000);
    expect(liveLimitMs({ source: "aodn", owner: "IMOS Coastal Wave Buoys Facility" })).toBe(3 * HOUR);
  });

  it("keeps a 2.8 h old Queensland reading Live while a 2.8 h old NDBC reading is Stale", () => {
    const qld = { source: "aodn" as const, owner: "Queensland Department of Environment and Science" };
    expect(classifyStationStatus(ago(2.8), NOW, liveLimitMs(qld))).toBe("fresh");
    expect(classifyStationStatus(ago(4), NOW, liveLimitMs(qld))).toBe("stale");
    expect(classifyStationStatus(ago(3.2), NOW, liveLimitMs({ source: "ndbc", owner: null }))).toBe("stale");
    // The default stays 3 h.
    expect(classifyStationStatus(ago(2.8), NOW)).toBe("fresh");
    expect(classifyStationStatus(ago(3.2), NOW)).toBe("stale");
  });
});

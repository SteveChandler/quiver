/**
 * @jest-environment node
 */
import { scoreStation, rankStations, StationCandidate } from "@/lib/services/ioos-station-scorer";

describe("scoreStation", () => {
  const now = new Date("2026-01-22T12:00:00Z");

  it("should heavily weight freshness", () => {
    const fresh: StationCandidate = {
      stationId: "fresh",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"), // 1 hour ago
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const stale: StationCandidate = {
      stationId: "stale",
      distanceKm: 10, // Closer!
      network: "CDIP", // Higher priority!
      latestObservedAt: new Date("2026-01-22T00:00:00Z"), // 12 hours ago
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const freshScore = scoreStation(fresh, now);
    const staleScore = scoreStation(stale, now);

    // Fresh should beat stale despite being farther and lower priority network
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it("should prefer complete data over partial", () => {
    const complete: StationCandidate = {
      stationId: "complete",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const partial: StationCandidate = {
      stationId: "partial",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: false,
      hasDirection: false,
    };

    const completeScore = scoreStation(complete, now);
    const partialScore = scoreStation(partial, now);

    expect(completeScore).toBeGreaterThan(partialScore);
  });

  it("should apply network bonus", () => {
    const cdip: StationCandidate = {
      stationId: "cdip",
      distanceKm: 50,
      network: "CDIP",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const unknown: StationCandidate = {
      stationId: "unknown",
      distanceKm: 50,
      network: "unknown",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const cdipScore = scoreStation(cdip, now);
    const unknownScore = scoreStation(unknown, now);

    expect(cdipScore).toBeGreaterThan(unknownScore);
  });
});

describe("rankStations", () => {
  const now = new Date("2026-01-22T12:00:00Z");

  it("should rank stations by score descending", () => {
    const candidates: StationCandidate[] = [
      {
        stationId: "worst",
        distanceKm: 100,
        network: "unknown",
        latestObservedAt: new Date("2026-01-22T00:00:00Z"),
        hasWaveHeight: true,
        hasPeriod: false,
        hasDirection: false,
      },
      {
        stationId: "best",
        distanceKm: 10,
        network: "CDIP",
        latestObservedAt: new Date("2026-01-22T11:30:00Z"),
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: true,
      },
      {
        stationId: "middle",
        distanceKm: 50,
        network: "NDBC",
        latestObservedAt: new Date("2026-01-22T08:00:00Z"),
        hasWaveHeight: true,
        hasPeriod: true,
        hasDirection: false,
      },
    ];

    const ranked = rankStations(candidates, now);

    expect(ranked[0].stationId).toBe("best");
    expect(ranked[ranked.length - 1].stationId).toBe("worst");
    expect(ranked.every((r, i, arr) => i === 0 || r.score <= arr[i - 1].score)).toBe(true);
  });
});

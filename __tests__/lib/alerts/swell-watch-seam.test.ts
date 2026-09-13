import { normalizeSwellPartitions } from "@/lib/alerts/swell-watch/partition-normalizer";

describe("Swell Watch provider seam", () => {
  it("matches the 13s at 170-degree partition through 69h, 72h, and 75h reranking", () => {
    const result = normalizeSwellPartitions([
      {
        provider: "noaa",
        evaluationId: "noaa-issuance-2026-09-03T00:00:00Z",
        forecastAt: "2026-09-06T21:00:00.000Z",
        sourceSlot: "s1",
        heightM: 0.8,
        periodS: 9,
        directionDeg: 240,
      },
      {
        provider: "noaa",
        evaluationId: "noaa-issuance-2026-09-03T00:00:00Z",
        forecastAt: "2026-09-06T21:00:00.000Z",
        sourceSlot: "s2",
        heightM: 0.4,
        periodS: 13,
        directionDeg: 170,
      },
      {
        provider: "noaa",
        evaluationId: "noaa-issuance-2026-09-03T00:00:00Z",
        forecastAt: "2026-09-07T00:00:00.000Z",
        sourceSlot: "s1",
        heightM: 0.5,
        periodS: 13,
        directionDeg: 170,
      },
      {
        provider: "open_meteo",
        evaluationId: "om-run-2026-09-03T00:00:00Z",
        forecastAt: "2026-09-07T03:00:00.000Z",
        sourceSlot: "s2",
        heightM: 0.6,
        periodS: 13,
        directionDeg: 170,
      },
    ]);

    expect(result).toEqual({
      kind: "observations",
      observations: expect.arrayContaining([
        expect.objectContaining({ forecastAt: "2026-09-06T21:00:00.000Z", sourceSlot: "s2", periodS: 13, directionDeg: 170 }),
        expect.objectContaining({ forecastAt: "2026-09-06T21:00:00.000Z", sourceSlot: "s1", periodS: 9, directionDeg: 240 }),
        expect.objectContaining({ forecastAt: "2026-09-07T00:00:00.000Z", sourceSlot: "s1", periodS: 13, directionDeg: 170 }),
        expect.objectContaining({ forecastAt: "2026-09-07T03:00:00.000Z", sourceSlot: "s2", periodS: 13, directionDeg: 170 }),
      ]),
    });
  });
});

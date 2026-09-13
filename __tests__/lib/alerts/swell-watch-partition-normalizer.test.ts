import { normalizeSwellPartitions } from "@/lib/alerts/swell-watch/partition-normalizer";

describe("normalizeSwellPartitions", () => {
  it("retains complete NOAA and Open-Meteo tuples with provenance", () => {
    const result = normalizeSwellPartitions([
      {
        provider: "noaa",
        evaluationId: "noaa-issuance-1",
        forecastAt: "2026-09-06T12:00:00.000Z",
        sourceSlot: "s1",
        heightM: 0.8,
        periodS: 9,
        directionDeg: 240,
      },
      {
        provider: "open_meteo",
        evaluationId: "om-run-1",
        forecastAt: "2026-09-06T12:00:00.000Z",
        sourceSlot: "s2",
        heightM: 0.4,
        periodS: 13,
        directionDeg: 170,
      },
    ]);

    expect(result).toEqual({
      kind: "observations",
      observations: expect.arrayContaining([
        expect.objectContaining({
          provider: "open_meteo",
          evaluationId: "om-run-1",
          sourceSlot: "s2",
          completeness: "complete",
          periodS: 13,
          directionDeg: 170,
        }),
      ]),
    });
  });

  it("fails closed for incomplete, non-finite, and unknown-provider tuples", () => {
    expect(
      normalizeSwellPartitions([
        {
          provider: "open_meteo",
          evaluationId: "om-run-2",
          forecastAt: "2026-09-06T12:00:00.000Z",
          sourceSlot: "s2",
          heightM: 0.4,
          periodS: 13,
          directionDeg: null,
        },
      ]),
    ).toEqual({ kind: "suppressed", reason: "incomplete_tuple" });

    expect(
      normalizeSwellPartitions([
        {
          provider: "wavecast",
          evaluationId: "third-party-run",
          forecastAt: "2026-09-06T12:00:00.000Z",
          sourceSlot: "s2",
          heightM: 0.4,
          periodS: 13,
          directionDeg: 170,
        },
      ]),
    ).toEqual({ kind: "suppressed", reason: "unknown_provider" });

    expect(
      normalizeSwellPartitions([
        {
          provider: "noaa",
          evaluationId: "noaa-issuance-2",
          forecastAt: "2026-09-06T12:00:00.000Z",
          sourceSlot: "s2",
          heightM: 0.4,
          periodS: 13,
          directionDeg: 170,
        },
        {
          provider: "noaa",
          evaluationId: "noaa-issuance-2",
          forecastAt: "2026-09-06T12:00:00.000Z",
          sourceSlot: "s2",
          heightM: 0.4,
          periodS: 11,
          directionDeg: 170,
        },
      ]),
    ).toEqual({ kind: "suppressed", reason: "contradictory_tuple" });
  });
});

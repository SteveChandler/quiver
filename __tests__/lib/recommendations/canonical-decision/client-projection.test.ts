import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

type ProjectionModule = {
  projectCanonicalDiscoverySurface: (
    discovery: SurfDiscoveryResponse,
  ) => SurfDiscoveryResponse;
};

function loadProjection(): ProjectionModule {
  return require("@/lib/recommendations/canonical-decision/client-projection") as ProjectionModule;
}

function recommendation(
  candidateId: string,
  beachId: string,
): SurfDiscoveryRecommendation {
  return {
    recommendationId: candidateId,
    beach: { id: beachId, name: beachId },
    window: {
      start: new Date("2026-07-23T14:00:00.000Z"),
      end: new Date("2026-07-23T17:00:00.000Z"),
      timezone: "America/Los_Angeles",
    },
  } as SurfDiscoveryRecommendation;
}

function discovery(): SurfDiscoveryResponse {
  return {
    recommendations: [
      recommendation("candidate-1", "beach-1"),
      recommendation("candidate-2", "beach-2"),
    ],
    includedRecommendations: [recommendation("candidate-3", "beach-3")],
    searchCriteria: { maxResults: 3 },
    metadata: {
      totalBeachesConsidered: 3,
      successfulForecasts: 3,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-07-22T18:00:00.000Z",
    },
    regionalCall: "Legacy best beach is beach-1",
    eveningTransition: {
      beachId: "beach-1",
    } as unknown as SurfDiscoveryResponse["eveningTransition"],
  };
}

describe("canonical discovery client projection", () => {
  it("exposes only the exact server-selected candidate", () => {
    const { projectCanonicalDiscoverySurface } = loadProjection();
    const source = discovery();
    source.sessionDecision = {
      verdict: "go",
      createdAt: "2099-07-22T18:00:00.000Z",
      expiresAt: "2099-07-22T18:15:00.000Z",
      selection: { candidateId: "candidate-2", beachId: "beach-2" },
    } as SurfDiscoveryResponse["sessionDecision"];

    const projected = projectCanonicalDiscoverySurface(source);

    expect(projected.recommendations.map((item) => item.recommendationId)).toEqual([
      "candidate-2",
    ]);
    expect(projected.includedRecommendations).toEqual([]);
    expect(projected.regionalCall).toBe("");
    expect(projected.eveningTransition).toBeUndefined();
    expect(source.recommendations).toHaveLength(2);
  });

  it.each([
    ["missing decision", undefined],
    [
      "explicit no",
      { verdict: "no", selection: null } as SurfDiscoveryResponse["sessionDecision"],
    ],
    [
      "stale selection",
      {
        verdict: "go",
        createdAt: "2099-07-22T18:00:00.000Z",
        expiresAt: "2099-07-22T18:15:00.000Z",
        selection: { candidateId: "missing", beachId: "beach-2" },
      } as SurfDiscoveryResponse["sessionDecision"],
    ],
    [
      "expired decision",
      {
        verdict: "go",
        createdAt: "2020-07-22T18:00:00.000Z",
        expiresAt: "2020-07-22T18:15:00.000Z",
        selection: { candidateId: "candidate-2", beachId: "beach-2" },
      } as SurfDiscoveryResponse["sessionDecision"],
    ],
    [
      "missing createdAt",
      {
        verdict: "go",
        expiresAt: "2099-07-22T18:15:00.000Z",
        selection: { candidateId: "candidate-2", beachId: "beach-2" },
      } as SurfDiscoveryResponse["sessionDecision"],
    ],
    [
      "unparseable createdAt",
      {
        verdict: "go",
        createdAt: "not-a-date",
        expiresAt: "2099-07-22T18:15:00.000Z",
        selection: { candidateId: "candidate-2", beachId: "beach-2" },
      } as SurfDiscoveryResponse["sessionDecision"],
    ],
    [
      "non-positive lifetime (createdAt at expiry)",
      {
        verdict: "go",
        createdAt: "2099-07-22T18:15:00.000Z",
        expiresAt: "2099-07-22T18:15:00.000Z",
        selection: { candidateId: "candidate-2", beachId: "beach-2" },
      } as SurfDiscoveryResponse["sessionDecision"],
    ],
  ])("fails closed for %s", (_label, sessionDecision) => {
    const { projectCanonicalDiscoverySurface } = loadProjection();
    const source = discovery();
    source.sessionDecision = sessionDecision;

    const projected = projectCanonicalDiscoverySurface(source);

    expect(projected.recommendations).toEqual([]);
    expect(projected.includedRecommendations).toEqual([]);
  });
});

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";

const mockScore = jest.fn();
const mockProfile = { id: "profile" };
const mockSnapshot = { id: "snapshot", waveHeight: 2.5, wavePeriod: 9 };
const mockCharacter = { label: "Clean", category: "medium-clean" };
const mockGetRecommendationLabel = jest.fn((_score: number) => "Maybe");
const mockGetRecommendationLabelGated = jest.fn(
  (..._args: unknown[]) => "Worth it",
);

jest.mock("@/lib/domains/scoring", () => ({
  beachToSpotProfile: jest.fn(() => mockProfile),
  getDiscoveryScoringEngine: jest.fn(() => ({ score: mockScore })),
  forecastToSnapshot: jest.fn(() => mockSnapshot),
  getConditionCharacter: jest.fn(() => mockCharacter),
  getConditionCharacterDetails: jest.fn(() => ({
    character: mockCharacter,
    smallWeakReason: null,
  })),
}));

jest.mock("@/lib/services/discovery/response-formatter", () => ({
  getRecommendationLabel: (score: number) => mockGetRecommendationLabel(score),
  getRecommendationLabelGated: (...args: unknown[]) =>
    mockGetRecommendationLabelGated(...args),
}));

describe("resolveRecommendationLabel with a learner", () => {
  const beach = {} as Beach;
  const forecast = {} as EnhancedForecastEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScore.mockReturnValue({ total: 64 });
  });

  it("passes the learner context with the snapshot facts", () => {
    resolveRecommendationLabel({
      beach,
      forecast,
      score: 72,
      learner: { skill: "beginner", boardClass: "longboard" },
    });

    expect(mockGetRecommendationLabelGated).toHaveBeenCalledWith(72, "medium-clean", {
      skill: "beginner",
      boardClass: "longboard",
      waveHeightFt: 2.5,
      wavePeriodS: 9,
      smallWeakReason: null,
    });
  });

  it("calls the gate with two arguments without a learner", () => {
    resolveRecommendationLabel({ beach, forecast, score: 72 });

    const lastCall = mockGetRecommendationLabelGated.mock.calls.at(-1);
    expect(lastCall).toHaveLength(2);
  });
});

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";

const mockScore = jest.fn();
const mockProfile = { id: "profile" };
const mockSnapshot = { id: "snapshot" };
const mockCharacter = { label: "Clean", category: "medium-clean" };
const mockGetRecommendationLabel = jest.fn(() => "Maybe");
const mockGetRecommendationLabelGated = jest.fn(() => "Worth it");

jest.mock("@/lib/domains/scoring", () => ({
  beachToSpotProfile: jest.fn(() => mockProfile),
  createDiscoveryScoringEngine: jest.fn(() => ({ score: mockScore })),
  forecastToSnapshot: jest.fn(() => mockSnapshot),
  getConditionCharacter: jest.fn(() => mockCharacter),
}));

jest.mock("@/lib/services/discovery/response-formatter", () => ({
  getRecommendationLabel: (...args: unknown[]) => mockGetRecommendationLabel(...args),
  getRecommendationLabelGated: (...args: unknown[]) =>
    mockGetRecommendationLabelGated(...args),
}));

describe("resolveRecommendationLabel", () => {
  const beach = {} as Beach;
  const forecast = {} as EnhancedForecastEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScore.mockReturnValue({ total: 64 });
  });

  it("returns the gated label with its condition character", () => {
    expect(resolveRecommendationLabel({ beach, forecast, score: 72 })).toEqual({
      label: "Worth it",
      character: mockCharacter,
    });
    expect(mockScore).toHaveBeenCalledWith({
      profile: mockProfile,
      snapshot: mockSnapshot,
      window: null,
      preferences: null,
    });
    expect(mockGetRecommendationLabelGated).toHaveBeenCalledWith(72, "medium-clean");
  });

  it("falls back to the score-only label when character derivation fails", () => {
    mockScore.mockImplementationOnce(() => {
      throw new Error("scoring failed");
    });

    expect(resolveRecommendationLabel({ beach, forecast, score: 64 })).toEqual({
      label: "Maybe",
      character: undefined,
    });
    expect(mockGetRecommendationLabel).toHaveBeenCalledWith(64);
  });
});
